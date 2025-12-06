import { google } from "googleapis";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    console.log("🔌 Disconnect Gmail triggered");

    // 1️⃣ Nájdeme pripojený Gmail
    const { data: creds, error } = await supabase
      .from("client_credentials")
      .select("*")
      .eq("provider", "google")
      .not("email_connected", "is", null)
      .single();

    if (error || !creds) {
      console.error("❌ No Gmail account connected");
      return NextResponse.json(
        { error: "no_connected_gmail" },
        { status: 400 }
      );
    }

    // 2️⃣ Setup OAuth client
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

    // 3️⃣ Stop Gmail Watch
    try {
      await gmail.users.stop({ userId: "me" });
      console.log("📵 Gmail WATCH stopped");
    } catch (err) {
      console.error("⚠️ Gmail watch stop error:", err);
    }

    // 4️⃣ Reset credentials in DB
    await supabase
      .from("client_credentials")
      .update({
        history_id: null,
        email_connected: null,
        access_token: null,
        refresh_token: null,
        expires_at: null,
      })
      .eq("id", creds.id);

    return NextResponse.json({ ok: true, message: "gmail_disconnected" });
  } catch (err) {
    console.error("❌ Disconnect ERROR:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
