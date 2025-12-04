import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RegisterBody = {
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody;
    const { full_name, email, phone, company_name } = body;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "full_name_and_email_required" },
        { status: 400 }
      );
    }

    const existing = await supabase
      .from("agents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json(
        { error: "agent_exists", agent_id: existing.data.id },
        { status: 409 }
      );
    }

    const agent_id = crypto.randomUUID();
    const { error } = await supabase.from("agents").insert({
      id: agent_id,
      full_name,
      email,
      phone: phone || null,
      company_name: company_name || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const res = NextResponse.json({ success: true, agent_id });
    const session = await getSession(req, res);

    session.user = {
      agent_id,
      email,
    };
    await session.save();

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { error: "registration_failed", details: message },
      { status: 500 }
    );
  }
}
