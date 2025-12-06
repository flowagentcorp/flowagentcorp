import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { agent_id, email, access_token, historyId } = await req.json();

    if (!historyId) {
      return NextResponse.json({ error: "historyId_required" }, { status: 400 });
    }

    // Initialize Gmail API client
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token });

    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // 1️⃣ Get history diff → find new messages
    const history = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      historyTypes: ["messageAdded"],
    });

    const messages = history.data.history?.flatMap(h => h.messagesAdded || []);
    if (!messages || messages.length === 0) {
      console.log("📭 No new messages found in history");
      return NextResponse.json({ ok: true, message: "no_new_messages" });
    }

    const messageId = messages[0].message?.id;
    if (!messageId) {
      return NextResponse.json({ error: "messageId_not_found" }, { status: 400 });
    }

    console.log("📩 New Gmail messageId:", messageId);

    // 2️⃣ Fetch full message
    const gmailMessage = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    // Extract payload
    const headers = gmailMessage.data.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
    const from = headers.find(h => h.name === "From")?.value || "Unknown Sender";

    let body = "";
    const parts = gmailMessage.data.payload?.parts || [];
    
    const textPart = parts.find(p => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }

    // 3️⃣ Save message to Supabase
    await supabase.from("messages").insert({
      agent_id,
      external_message_id: messageId,
      subject,
      content: body,
      direction: "inbound",
      status: "received",
      activity_type: "email",
    });

    console.log("💾 Message saved to database");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Fetch-message ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
