import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { google } from "googleapis";

// Extract Gmail account data from frontend
interface EnablePayload {
  agent_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  gmail_email: string; // ⚡ IMPORTANT – Gmail account email!
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

    if (!agent_id || !gmail_email) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    // 1️⃣ Save credentials to Supabase
    const { error: saveError } = await supabase
      .from("client_credentials")
      .upsert(
        {
          agent_id,
          provider: "google",
          email: gmail_email, // ⚡ THIS IS WHAT WEBHOOK MATCHES
          access_token,
          refresh_token,
          expires_at,
          email_connected: true,
        },
        { onConflict: "email" }
      );

    if (saveError) {
      console.error("❌ Failed to save credentials:", saveError);
      return NextResponse.json(
        { error: "save_failed" },
        { status: 500 }
      );
    }

    console.log("✅ Gmail credentials saved for:", gmail_email);

    // 2️⃣ Set up Gmail watch
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
