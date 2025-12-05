import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect("/connect/google?error=no_code");
  }

  // 1) Google token exchange
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = await tokenRes.json();

  if (!tokenJson.access_token) {
    return NextResponse.redirect("/connect/google?error=token_failed");
  }

  console.log("📩 Gmail credentials získané:", tokenJson);

  return NextResponse.redirect("/connect/google?success=1");
}
