import { createHash, randomBytes } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";

export const SESSION_COOKIE = "giftcard-session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const cookieOptions = {
  httpOnly: true,
  secure: env.APP_URL?.startsWith("https://") ?? false,
  sameSite: "lax" as const,
  path: "/",
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function readSessionToken(headers: Headers) {
  return headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export async function getSession(headers: Headers) {
  const token = readSessionToken(headers);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session;
}

export async function createSession(userId: number, oldToken?: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: {
      OR: [ { expiresAt: { lte: now } }, ...(oldToken ? [{ tokenHash: hashToken(oldToken) }] : []) ],
    } });
    await tx.session.create({ data: {
      tokenHash: hashToken(token), userId,
      expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
    } });
  });
  return token;
}

export function isSameOrigin(headers: Headers) {
  return headers.get("origin") === new URL(env.APP_URL).origin;
}

// Limit the total work done by password hashing and guessing, including unknown users.
export async function allowLoginAttempt() {
  const now = new Date();
  const throttle = await db.$transaction(async (tx) => {
    await tx.loginThrottle.deleteMany({ where: { id: 1, resetAt: { lte: now } } });
    return tx.loginThrottle.upsert({
      where: { id: 1 },
      create: { id: 1, attempts: 1, resetAt: new Date(now.getTime() + 15 * 60 * 1000) },
      update: { attempts: { increment: 1 } },
    });
  });
  return throttle.attempts <= 10;
}
