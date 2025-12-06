import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";            // FIXNUTÁ CESTA
import { google } from "googleapis";

// ====== 1. Typy ======
interface GmailPushMessage {
  emailAddress: string;
  historyId: string;
}

interface CredentialRow {
  agent_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// ====== 2. POST handler ======
export async function POST(req: Request) {
  try {
    const raw = await req.text();

    // Google validation ping
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

    const userEmail = decoded.emailAddress;
    const historyId = decoded.historyId;

    // 1️⃣ Find agent credentials via JOIN
    const credentials = await getCredentialsByAgentEmail(userEmail);

    // 2️⃣ Refresh token if needed
    const accessToken = await refreshIfNeeded(credentials);

    // 3️⃣ Call message fetcher
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/gmail/fetch-message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: credentials.agent_id,
          email: userEmail,
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

// ====== 3. Load credentials based on agent email ======
async function getCredentialsByAgentEmail(email: string): Promise<CredentialRow> {
  const { data, error } = await supabase
    .from("client_credentials")
    .select(
      `
      agent_id,
      access_token,
      refresh_token,
      expires_at,
      agents!inner (email)
    `
    )
    .eq("provider", "google")
    .eq("agents.email", email)
    .maybeSingle();

  if (error || !data) {
    console.error("❌ Credentials not found for email:", email, error);
    throw new Error("credentials_not_found");
  }

  return data as CredentialRow;
}

// ====== 4. Refresh if expired ======
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
      .eq("provider", "google");

    return updated.access_token!;
  }

  return credentials.access_token;
}
