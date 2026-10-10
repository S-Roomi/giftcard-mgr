import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { getSession, isSameOrigin } from "~/server/auth/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // All routes are private except the login screen and credential submission.
  const publicRoute = path === "/login" || path === "/api/auth/login";
  const apiRoute = path.startsWith("/api/");
  // tRPC checks sessions and mutation origins in protectedProcedure. Let its
  // handler encode failures for batched/streaming clients instead of returning
  // plain JSON, which the client reports as "Unknown error".
  if (path.startsWith("/api/trpc/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (apiRoute && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !isSameOrigin(request.headers)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!publicRoute && !await getSession(request.headers)) {
    if (apiRoute) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const login = new URL("/login", env.APP_URL);
    login.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
