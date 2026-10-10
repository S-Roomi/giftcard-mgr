import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { hashPassword, verifyPassword } from "~/server/auth/password.mjs";
import { allowLoginAttempt, cookieOptions, createSession, isSameOrigin, readSessionToken, SESSION_COOKIE, SESSION_SECONDS } from "~/server/auth/session";

// Unknown users take the same password-verification path as known users.
const dummyHash = hashPassword("unused-account-password");

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!await allowLoginAttempt()) return NextResponse.json(
    { error: "Too many login attempts. Try again in 15 minutes." },
    { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } },
  );
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form" }, { status: 400 }); }
  const username = form.get("username");
  const password = form.get("password");
  const destination = form.get("next");
  const next = typeof destination === "string" && destination.startsWith("/") &&
    !destination.startsWith("//") && !destination.includes("\\") && !/[\r\n]/.test(destination) &&
    !destination.startsWith("/api/") && !destination.startsWith("/login") ? destination : "/";
  const login = new URL("/login", env.APP_URL);
  login.searchParams.set("next", next);
  if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 1024) {
    login.searchParams.set("error", "credentials");
    return NextResponse.redirect(login, 303);
  }
  const user = await db.user.findUnique({ where: { username: username.trim() } });
  const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) {
    login.searchParams.set("error", "credentials");
    return NextResponse.redirect(login, 303);
  }
  const token = await createSession(user.id, readSessionToken(request.headers));
  const response = NextResponse.redirect(new URL(next, env.APP_URL), 303);
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_SECONDS });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
