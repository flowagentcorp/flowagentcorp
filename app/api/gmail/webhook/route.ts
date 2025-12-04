import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PubSubPayload = {
  message?: {
    data?: string;
  };
};

type PubSubData = {
  emailAddress?: string;
  historyId?: string;
};

type CredentialRow = {
  agent_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at?: string | null;
  expiry_timestamp?: string | null;
};

function decodeData(data: string): PubSubData {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as PubSubData;
}

function isExpired(expires_at?: string | null) {
  if (!expires_at) return true;
  return new Date(expires_at).getTime() <= Date.now() + 60_000;
}

async function refreshToken(agent_id: string, refresh_token: string | null) {
  if (!refresh_token) {
    throw new Error("refresh_token_missing");
  }

  const params = new URLSearchParams();
  params.append("client_id", process.env.GOOGLE_CLIENT_ID!);
  params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refresh_token);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const details = await tokenRes.text();
    throw new Error(`google_refresh_failed: ${details}`);
  }

  const tokenData = await tokenRes.json();
  const expires_at = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("client_credentials")
    .update({ access_token: tokenData.access_token, expires_at })
    .eq("agent_id", agent_id)
    .eq("provider", "google");

  if (error) {
    throw new Error(`supabase_update_failed: ${error.message}`);
  }

  return { access_token: tokenData.access_token as string, expires_at };
}

async function getCredentialsByEmail(email: string) {
  const { data, error } = await supabase
    .from("client_credentials")
    .select("agent_id, access_token, refresh_token, expires_at, expiry_timestamp")
    .eq("email", email)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    throw new Error("credentials_not_found");
  }

  return data as CredentialRow;
}

async function ensureAccessToken(creds: CredentialRow) {
  const expires_at = creds.expires_at || creds.expiry_timestamp;
  if (!isExpired(expires_at)) {
    return { access_token: creds.access_token, expires_at };
  }
  return refreshToken(creds.agent_id, creds.refresh_token);
}

async function fetchHistoryMessageIds(
  access_token: string,
  historyId?: string
): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
  url.searchParams.set("historyTypes", "messageAdded");
  url.searchParams.set("labelId", "INBOX");
  url.searchParams.set("maxResults", "5");
  if (historyId) url.searchParams.set("startHistoryId", historyId);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!resp.ok) {
    return [];
  }

  const json = (await resp.json()) as {
    history?: {
      messagesAdded?: { message?: { id?: string } }[];
    }[];
  };
  const history = json.history ?? [];
  const ids = history.flatMap((h) =>
    (h.messagesAdded ?? [])
      .map((m) => m.message?.id)
      .filter((id): id is string => Boolean(id))
  );

  return Array.from(new Set(ids));
}

async function fetchLatestMessageIds(access_token: string): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("labelIds", "INBOX");
  url.searchParams.set("maxResults", "1");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!resp.ok) {
    return [];
  }

  const json = await resp.json();
  const messages = (json.messages || []) as { id?: string }[];
  return messages
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as PubSubPayload;
    const data = payload.message?.data;

    if (!data) {
      return NextResponse.json({ error: "invalid_message" }, { status: 400 });
    }

    const decoded = decodeData(data);
    const emailAddress = decoded.emailAddress as string | undefined;
    const historyId = decoded.historyId as string | undefined;

    if (!emailAddress) {
      return NextResponse.json({ error: "email_missing" }, { status: 400 });
    }

    const creds = await getCredentialsByEmail(emailAddress);
    const { access_token } = await ensureAccessToken(creds);

    let messageIds = await fetchHistoryMessageIds(access_token, historyId);
    if (messageIds.length === 0) {
      messageIds = await fetchLatestMessageIds(access_token);
    }

    for (const messageId of messageIds) {
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/gmail/fetch-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: creds.agent_id, messageId }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      agent_id: creds.agent_id,
      processed: messageIds.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "webhook_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
