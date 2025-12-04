import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/connect/google?error=no_code`
      );
    }

    // ✅ Supabase klient so SERVICE ROLE (server-side)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ Vymeníme code za Google tokeny
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("❌ Token exchange failed:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/connect/google?error=token_failed`
      );
    }

    // ✅ Zistíme aktuálne prihláseného agenta
    const cookie = req.headers.get("cookie") ?? "";
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(cookie);

    if (!user || userError) {
      console.error("❌ User not authenticated:", userError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/login`
      );
    }

    const agent_id = user.id;

    // ✅ UPSERT do client_credentials (vďaka unique indexom)
    const { error: upsertError } = await supabase
      .from("client_credentials")
      .upsert(
        {
          agent_id,
          provider: "google",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(
            Date.now() + tokenData.expires_in * 1000
          ).toISOString(),
          scope: tokenData.scope,
          token_type: tokenData.token_type,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "agent_id,provider",
        }
      );

    if (upsertError) {
      console.error("❌ DB upsert failed:", upsertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/connect/google?error=db_error`
      );
    }

    // ✅ HOTOVO – úspech
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/connect/google?success=1`
    );
  } catch (err) {
    console.error("❌ OAuth callback crash:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/connect/google?error=server_error`
    );
  }
}
