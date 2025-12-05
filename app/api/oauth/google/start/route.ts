import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const agentId = url.searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=no_agent_id`
    );
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_REDIRECT_URI
  ) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI env");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? origin}/connect/google?error=missing_google_env`
    );
  }

  const state = JSON.stringify({
    agent_id: agentId,
    nonce: crypto.randomUUID(),
  });

  const redirect = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  redirect.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  redirect.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI);
  redirect.searchParams.set("response_type", "code");
  redirect.searchParams.set("access_type", "offline");
  redirect.searchParams.set("prompt", "consent");
  redirect.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.labels",
    ].join(" ")
  );
  redirect.searchParams.set("state", state);

  return NextResponse.redirect(redirect.toString());
}
