import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FetchBody = {
  agent_id?: string;
  messageId?: string;
};

type CredentialRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at?: string | null;
  expiry_timestamp?: string | null;
};

type GmailHeader = { name?: string; value?: string };
type GmailPartBody = { data?: string };
type GmailPart = { mimeType?: string; body?: GmailPartBody };
type GmailPayload = { headers?: GmailHeader[]; parts?: GmailPart[] };
type GmailMessage = {
  id?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
};

function isExpired(expires_at?: string | null) {
  if (!expires_at) return true;
  return new Date(expires_at).getTime() <= Date.now() + 60_000;
}

async function refreshToken(agent_id: string, refresh_token?: string | null) {
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

async function getCredentials(agent_id: string): Promise<CredentialRow> {
  const { data, error } = await supabase
    .from("client_credentials")
    .select("access_token, refresh_token, expires_at, expiry_timestamp")
    .eq("agent_id", agent_id)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    throw new Error("credentials_not_found");
  }

  return data as CredentialRow;
}

async function ensureAccessToken(agent_id: string) {
  const data = await getCredentials(agent_id);
  const expires_at = data.expires_at || data.expiry_timestamp;
  if (!isExpired(expires_at)) {
    return { token: data.access_token, refresh_token: data.refresh_token };
  }

  const refreshed = await refreshToken(agent_id, data.refresh_token);
  return { token: refreshed.access_token, refresh_token: data.refresh_token };
}

async function gmailFetch(accessToken: string, messageId: string) {
  return fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

function parseEmail(msg: GmailMessage) {
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const from = getHeader("From");
  const subject = getHeader("Subject");
  const to = getHeader("To");

  let body_plain = "";
  const parts = msg.payload?.parts ?? [];
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  const htmlPart = parts.find((p) => p.mimeType === "text/html");
  const selected = textPart || htmlPart;
  if (selected?.body?.data) {
    body_plain = Buffer.from(selected.body.data, "base64").toString("utf8");
  }

  if (!body_plain) body_plain = msg.snippet || "";

  return {
    external_message_id: msg.id,
    subject: subject || "",
    from_email: from.match(/<(.+)>/)?.[1] || from,
    from_name: from.split("<")[0].trim(),
    to_email: to,
    body_plain,
    received_at: msg.internalDate
      ? new Date(parseInt(msg.internalDate)).toISOString()
      : new Date().toISOString(),
    source: "gmail",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FetchBody;
    const messageId = body.messageId;

    if (!messageId) {
      return NextResponse.json(
        { error: "messageId_required" },
        { status: 400 }
      );
    }

    const res = new NextResponse();
    const session = await getSession(req, res);

    const sessionAgent = session.user?.agent_id;
    const agent_id = body.agent_id || sessionAgent;

    if (!agent_id || (sessionAgent && sessionAgent !== agent_id)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { token: access_token, refresh_token } = await ensureAccessToken(agent_id);

    let response = await gmailFetch(access_token, messageId);

    if (response.status === 401 || response.status === 403) {
      const refreshedToken = await refreshToken(agent_id, refresh_token).catch(() => null);
      if (refreshedToken?.access_token) {
        response = await gmailFetch(refreshedToken.access_token, messageId);
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "gmail_fetch_failed", status: response.status },
        { status: response.status }
      );
    }

    const msg = await response.json();
    const emailObj = parseEmail(msg);
    const finalPayload = { agent_id, email: emailObj };

    if (process.env.N8N_WEBHOOK_URL) {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });
    }

    return NextResponse.json({ success: true, payload: finalPayload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "fetch_message_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
