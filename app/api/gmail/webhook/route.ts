import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { google } from "googleapis";

// ====== TYPES ======
interface GmailPushMessage {
  emailAddress: string;
  historyId: string;
}

interface CredentialRow {
  agent_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email: string;
}

// ====== MAIN POST HANDLER ======
export async function POST(req: Request) {
  try {
    const raw = await req.text();

    // Google validation challenge
    if (raw.includes("validationToken")) {
      return new NextResponse(JSON.stringify({ ok: true }), { status: 200 });
    }

    const pubsubBody = JSON.parse(raw);
    const messageData = pubsubBody?.message?.data;

    if (!messageData) {
      console.error("❌ No PubSub message.data");
      return NextResponse.json({ error: "no_data" }, { status: 200 });
    }

    const decoded = JSON.parse(
      Buffer.from(messageData, "base64").toString()
    ) as GmailPushMessage;

    console.log("🔔 Gmail PUSH:", decoded);

    const gmailEmail = decoded.emailAddress;
    const historyId = decoded.historyId;

    // 1️⃣ Load correct Gmail credentials
    const credentials = await getCredentialsByAgentEmail(gmailEmail);

    // 2️⃣ Refresh token if expired
    const accessToken = await refreshIfNeeded(credentials);

    // 3️⃣ Call message fetcher
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/gmail/fetch-message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: credentials.agent_id,
          email: gmailEmail,
          access_token: accessToken,
          historyId,
        }),
      }
    );

    const result = await res.json();
    console.log("📩 Fetch-message result:", result);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ Webhook ERROR:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ====== 1. LOAD CREDENTIALS PROPERLY ======
async function getCredentialsByAgentEmail(email: string): Promise<CredentialRow> {
  const { data, error } = await supabase
    .from("client_credentials")
    .select(
      `
      agent_id,
      access_token,
      refresh_token,
      expires_at,
      email
    `
    )
    .eq("provider", "google")
    .eq("email", email) // ⚡ FIX – lookup by Gmail OAuth email
    .maybeSingle();

  if (error || !data) {
    console.error("❌ Credentials not found for Gmail email:", email, error);
    throw new Error("credentials_not_found");
  }

  return data as CredentialRow;
}

// ====== 2. REFRESH TOKEN WHEN NEEDED ======
async function refreshIfNeeded(credentials: CredentialRow): Promise<string> {
  const expiresAt = new Date(credentials.expires_at).getTime();
  const now = Date.now();

  if (now >= expiresAt - 60_000) {
    console.log("♻️ Refreshing Google token...");

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    oauth2.setCredentials({
      refresh_token: credentials.refresh_token,
    });

    const refreshed = await oauth2.refreshAccessToken();
    const updated = refreshed.credentials;

    await supabase
      .from("client_credentials")
      .update({
        access_token: updated.access_token,
        expires_at: new Date(Date.now() + updated.expiry_date!).toISOString(),
      })
      .eq("agent_id", credentials.agent_id)
      .eq("provider", "google")
      .eq("email", credentials.email);

    return updated.access_token!;
  }

  return credentials.access_token;
}
