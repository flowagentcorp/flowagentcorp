import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RefreshBody = {
  agent_id?: string;
};

async function refreshAccessToken(agent_id: string) {
  const { data, error } = await supabase
    .from("client_credentials")
    .select("refresh_token")
    .eq("agent_id", agent_id)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    throw new Error("credentials_not_found");
  }

  const refresh_token = data.refresh_token;
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
    const text = await tokenRes.text();
    throw new Error(`google_refresh_failed: ${text}`);
  }

  const tokenData = await tokenRes.json();
  const expires_at = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const updateRes = await supabase
    .from("client_credentials")
    .update({
      access_token: tokenData.access_token,
      expires_at,
    })
    .eq("agent_id", agent_id)
    .eq("provider", "google");

  if (updateRes.error) {
    throw new Error(`supabase_update_failed: ${updateRes.error.message}`);
  }

  return { access_token: tokenData.access_token as string, expires_at };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RefreshBody;
    const agent_id = body.agent_id;

    if (!agent_id) {
      return NextResponse.json(
        { error: "agent_id_required" },
        { status: 400 }
      );
    }

    const updated = await refreshAccessToken(agent_id);
    return NextResponse.json({ success: true, ...updated });
  } catch (err: unknown) {
    console.error("refresh error:", err);
    const message = err instanceof Error ? err.message : "server_error";
    const clientErrors = [
      "agent_id_required",
      "credentials_not_found",
      "refresh_token_missing",
    ];
    const status = clientErrors.includes(message) ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
