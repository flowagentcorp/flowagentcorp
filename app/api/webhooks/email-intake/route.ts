import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EmailPayload = {
  from_email?: string;
  from_name?: string;
  subject?: string;
  body_plain?: string;
  phone?: string;
  source?: string;
  received_at?: string;
};

type IntakeBody = {
  agent_id?: string;
  email?: EmailPayload;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntakeBody;
    const { agent_id, email } = body;

    if (!agent_id || !email?.from_email) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const existingLead = await supabase
      .from("leads")
      .select("id")
      .eq("agent_id", agent_id)
      .eq("email", email.from_email)
      .maybeSingle();

    let lead_id = existingLead.data?.id as string | undefined;

    if (!lead_id) {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          agent_id,
          name: email.from_name || email.subject || email.from_email,
          email: email.from_email,
          phone: email.phone || null,
          source: email.source || "email",
          status: "new",
          created_at: email.received_at || new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "lead_insert_failed", details: error?.message },
          { status: 500 }
        );
      }

      lead_id = data.id;
    }

    const existingMessage = await supabase
      .from("messages")
      .select("id")
      .eq("agent_id", agent_id)
      .eq("lead_id", lead_id)
      .eq("direction", "inbound")
      .eq("channel", "email")
      .eq("content", email.body_plain || "")
      .maybeSingle();

    if (existingMessage.data) {
      return NextResponse.json({ success: true, lead_id, message_id: existingMessage.data.id });
    }

    const { data: messageRow, error: messageError } = await supabase
      .from("messages")
      .insert({
        agent_id,
        lead_id,
        direction: "inbound",
        channel: "email",
        content: email.body_plain || "",
        created_at: email.received_at || new Date().toISOString(),
      })
      .select("id")
      .single();

    if (messageError || !messageRow) {
      return NextResponse.json(
        { error: "message_insert_failed", details: messageError?.message },
        { status: 500 }
      );
    }

    if (process.env.N8N_WEBHOOK_URL) {
      await fetch(process.env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead_created",
          agent_id,
          lead_id,
          message_id: messageRow.id,
        }),
      });
    }

    return NextResponse.json({ success: true, lead_id, message_id: messageRow.id });
  } catch (err: unknown) {
    console.error("INTAKE ERROR", err);
    const message = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: "server_error", details: message }, { status: 500 });
  }
}
