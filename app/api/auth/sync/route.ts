// app/api/auth/sync/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

type SyncBody = {
  agent_id?: string;
  email?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const agent_id = body.agent_id;
    const email = body.email ?? undefined;

    if (!agent_id || !email) {
      return NextResponse.json(
        { error: "missing_agent_or_email" },
        { status: 400 }
      );
    }

    const res = new NextResponse(
      JSON.stringify({ ok: true }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const session = await getSession(req, res);
    session.user = { agent_id, email };
    await session.save();

    return res;
  } catch (err) {
    console.error("auth/sync error:", err);
    return NextResponse.json(
      { error: "sync_failed" },
      { status: 500 }
    );
  }
}
