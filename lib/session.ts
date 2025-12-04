// lib/session.ts
import { getIronSession } from "iron-session";
import type { SessionOptions } from "iron-session";

export type SessionData = {
  user?: {
    agent_id?: string;
    email?: string;
  };
  oauth?: {
    nonce: string;
    agent_id: string;
  };
};

const cookieName = process.env.SESSION_COOKIE_NAME || "agent_session";

export const sessionOptions: SessionOptions = {
  cookieName,
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export function getSession(req: Request, res: Response) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}
