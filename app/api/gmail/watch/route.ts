import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type WatchBody = {
  agent_id?: string;
};

type CredentialRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at?: string | null;
  expiry_timestamp?: string | null;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as WatchBody;
    const res = new NextResponse();
    const session = await getSession(req, res);

    const sessionAgent = session.user?.agent_id;
    const agent_id = body.agent_id || sessionAgent;

    if (!agent_id || (sessionAgent && sessionAgent !== agent_id)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("client_credentials")
      .select("access_token, refresh_token, expires_at, expiry_timestamp")
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "credentials_not_found" },
        { status: 404 }
      );
    }

    const credentials = data as CredentialRow;
    let access_token = credentials.access_token;
    const refresh_token = credentials.refresh_token;
    const expires_at = credentials.expires_at || credentials.expiry_timestamp;

    if (isExpired(expires_at)) {
      const refreshed = await refreshToken(agent_id, refresh_token);
      access_token = refreshed.access_token;
    }

    const watchRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName: process.env.GMAIL_WATCH_TOPIC,
          labelIds: ["INBOX"],
        }),
      }
    );

    const watchData = await watchRes.json();

    if (!watchRes.ok) {
      return NextResponse.json(
        { error: "gmail_watch_failed", details: watchData },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, watchData });
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : "watch_error";
    return NextResponse.json(
      { error: "watch_error", details },
      { status: 500 }
    );
  }
}
