import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // SESSION CEZ SUPABASE (správne)
    const supabaseAuthClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const {
      data: { user },
    } = await supabaseAuthClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Nájdeme agenta podľa user.id
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!agent) {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }

    const agent_id = agent.id;

    // Načítame credentials
    const { data: creds } = await supabase
      .from("client_credentials")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("provider", "google")
      .maybeSingle();

    if (!creds) {
      return NextResponse.json({ error: "credentials_not_found" }, { status: 404 });
    }

    let access_token = creds.access_token;

    // Ak expirované → refresh
    if (!creds.expires_at || new Date(creds.expires_at).getTime() < Date.now()) {
      const params = new URLSearchParams();
      params.append("client_id", process.env.GOOGLE_CLIENT_ID!);
      params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", creds.refresh_token!);

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const refreshData = await refreshRes.json();
      access_token = refreshData.access_token;

      await supabase
        .from("client_credentials")
        .update({
          access_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq("agent_id", agent_id)
        .eq("provider", "google");
    }

    // ENABLE GMAIL WATCH
    const watchRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName: process.env.GMAIL_WATCH_TOPIC,
          labelIds: ["INBOX"],
        }),
      }
    );

    const watchData = await watchRes.json();

    if (!watchRes.ok) {
      return NextResponse.json(
        { error: "gmail_watch_failed", details: watchData },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, watchData });
  } catch (err: any) {
    return NextResponse.json(
      { error: "watch_error", details: err.message },
      { status: 500 }
    );
  }
}
