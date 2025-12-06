import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { google } from "googleapis";

interface EnablePayload {
  agent_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  gmail_email: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EnablePayload;

    const {
      agent_id,
      access_token,
      refresh_token,
      expires_at,
      gmail_email,
    } = body;

    if (!agent_id || !gmail_email || !access_token) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    // 1️⃣ Save Gmail credentials
    const { error: saveError } = await supabase
      .from("client_credentials")
      .upsert(
        {
          agent_id,
          provider: "google",
          email: gmail_email,
          access_token,
          refresh_token,
          expires_at,
          email_connected: true,
        },
        { onConflict: "email" }
      );

    if (saveError) {
      console.error("❌ Failed to save Gmail credentials:", saveError);
      return NextResponse.json(
        { error: "save_failed" },
        { status: 500 }
      );
    }

    console.log("✅ Gmail OAuth credentials saved for:", gmail_email);

    // 2️⃣ Create Gmail Watch subscription
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    oauth2.setCredentials({
      access_token,
      refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/EMAIL_PUSH`,
        labelIds: ["INBOX"],
      },
    });

    console.log("🔔 Gmail watch() created for:", gmail_email);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ Enable Gmail Sync ERROR:", e);
    return NextResponse.json(
      { error: e.message || "unknown_error" },
      { status: 500 }
    );
  }
}
