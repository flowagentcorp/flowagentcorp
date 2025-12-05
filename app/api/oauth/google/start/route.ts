import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  const state = JSON.stringify({
    agent_id: "manual", // neskôr doplníme reálneho agenta
    nonce: randomUUID(),
  });

  const redirect = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  redirect.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  redirect.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
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
