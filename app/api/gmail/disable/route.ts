import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 1️⃣ Nájdeme credentials podľa email_connected
    const { data: creds, error } = await supabase
      .from("client_credentials")
      .select("*")
      .eq("provider", "google")
      .neq("email_connected", null)
      .single();

    if (error || !creds) {
      console.error("No connected Gmail found");
      return NextResponse.json({ error: "no_connected_email" }, { status: 404 });
    }

    // 2️⃣ Získame OAuth client
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    oauth2.setCredentials({
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // 3️⃣ STOP Gmail Watch
    try {
      await gmail.users.stop({ userId: "me" });
      console.log("📵 Gmail WATCH STOPPED");
    } catch (stopErr) {
      console.error("Failed stopping Gmail watch:", stopErr);
    }

    // 4️⃣ Reset credentials
    await supabase
      .from("client_credentials")
      .update({
        history_id: null,
        email_connected: null,
      })
      .eq("id", creds.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Disable Gmail Sync ERROR:", err);
    return NextResponse.json({ error: "failed_to_disable" }, { status: 500 });
  }
}
