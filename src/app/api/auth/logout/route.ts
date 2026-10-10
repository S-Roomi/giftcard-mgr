import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { cookieOptions, hashToken, isSameOrigin, readSessionToken, SESSION_COOKIE } from "~/server/auth/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const token = readSessionToken(request.headers);
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const response = NextResponse.redirect(new URL("/login", env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
