import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=missing_params`
    );
  }

  let agentId: string | null = null;

  try {
    const parsed = JSON.parse(stateParam);
    agentId = parsed.agent_id ?? null;
  } catch (err) {
    console.error("Failed to parse state:", err);
  }

  if (!agentId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=invalid_state`
    );
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  ) {
    console.error("Missing GOOGLE_* envs");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=missing_google_env`
    );
  }

  // 1️⃣ Exchange code → tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed:", tokenRes.status, text);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=token_exchange_failed`
    );
  }

  const tokenJson: any = await tokenRes.json();
  const {
    access_token,
    refresh_token,
    expires_in,
    scope,
    token_type,
    id_token,
  } = tokenJson;

  if (!access_token || !refresh_token) {
    console.error("Missing tokens in response:", tokenJson);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=no_tokens`
    );
  }

  // 2️⃣ Z expires_in → expires_at (timestamptz)
  const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  // 3️⃣ Získame email z id_token (ak je)
  let emailConnected: string | null = null;
  try {
    if (id_token) {
      const [, payloadBase64] = id_token.split(".");
      const payloadJson = JSON.parse(
        Buffer.from(payloadBase64, "base64").toString("utf8")
      );
      emailConnected = payloadJson.email ?? null;
    }
  } catch (err) {
    console.error("Failed to decode id_token:", err);
  }

  // 4️⃣ Zapíšeme / upsert do client_credentials
  const { error: upsertError } = await supabaseAdmin
    .from("client_credentials")
    .upsert(
      {
        agent_id: agentId,
        provider: "google",
        access_token,
        refresh_token,
        scope,
        token_type,
        expires_at: expiresAt,
        email_connected: emailConnected,
      },
      {
        onConflict: "agent_id",
      }
    );

  if (upsertError) {
    console.error("DB upsert error:", upsertError);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=db_error`
    );
  }

  // 5️⃣ Hotovo
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?connected=1`
  );
}
