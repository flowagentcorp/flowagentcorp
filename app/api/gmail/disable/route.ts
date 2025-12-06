import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 1️⃣ Nájdeme aktuálne prihláseného agenta
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }

    // 2️⃣ Nájdeme jeho credentials
    const { data: creds, error: credsError } = await supabase
      .from("client_credentials")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("provider", "google")
      .single();

    if (credsError || !creds) {
      return NextResponse.json({ error: "no_credentials" }, { status: 404 });
    }

    // 3️⃣ Initialize Google OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    oauth2Client.setCredentials({
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 4️⃣ ZRUŠÍME Gmail watch subscription
    try {
      await gmail.users.stop({ userId: "me" });
      console.log("Gmail watch STOPPED");
    } catch (err) {
      console.error("Failed to stop Gmail watch:", err);
    }

    // 5️⃣ Vymažeme stored historyId a flag
    await supabase
      .from("client_credentials")
      .update({
        email_connected: false,
        history_id: null,
      })
      .eq("id", creds.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Disable Gmail Sync ERROR:", err);
    return NextResponse.json(
      { error: "failed_to_disable" },
      { status: 500 }
    );
  }
}
