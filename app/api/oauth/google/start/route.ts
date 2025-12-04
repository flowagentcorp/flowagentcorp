import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const sessionHolder = new NextResponse();
    const session = await getSession(req, sessionHolder);

    const agent_id = session.user?.agent_id;
    if (!agent_id) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const nonce = crypto.randomUUID();
    session.oauth = { nonce, agent_id };
    await session.save();

    const state = encodeURIComponent(JSON.stringify({ agent_id, nonce }));

    const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    oauthUrl.searchParams.append("client_id", process.env.GOOGLE_CLIENT_ID!);
    oauthUrl.searchParams.append("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
    oauthUrl.searchParams.append("response_type", "code");
    oauthUrl.searchParams.append("access_type", "offline");
    oauthUrl.searchParams.append("prompt", "consent");
    oauthUrl.searchParams.append(
      "scope",
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" ")
    );
    oauthUrl.searchParams.append("state", state);

    const redirectRes = NextResponse.redirect(oauthUrl.toString());
    const setCookie = sessionHolder.headers.get("set-cookie");
    if (setCookie) {
      redirectRes.headers.append("set-cookie", setCookie);
    }

    return redirectRes;
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : "unknown_error";
    console.error("OAuth start error:", error);
    return NextResponse.json(
      { error: "oauth_start_failed", details },
      { status: 500 }
    );
  }
}
