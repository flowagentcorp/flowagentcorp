import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type LoginBody = {
  email?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody;
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "user_not_found" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, agent_id: data.id });
    const session = await getSession(req, res);

    session.user = {
      agent_id: data.id,
      email: data.email,
    };
    await session.save();

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json(
      { error: "login_failed", details: message },
      { status: 500 }
    );
  }
}
