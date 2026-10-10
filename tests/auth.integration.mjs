import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import SuperJSON from "superjson";
import { PrismaClient } from "../generated/prisma/index.js";
import { hashPassword, verifyPassword } from "../src/server/auth/password.mjs";

test("authentication protects pages, APIs, and persistent sessions", { timeout: 180_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "giftcard-auth-"));
  const production = process.env.AUTH_TEST_PRODUCTION === "1";
  const address = "http://localhost:3107";
  const origin = process.env.AUTH_TEST_ORIGIN ?? (production ? "https://cards.example.test" : address);
  const env = {
    ...process.env, DATABASE_URL: `file:${directory}/test.sqlite`, APP_URL: origin,
    NEXT_DIST_DIR: production ? ".next-auth-build" : ".next-auth-test",
    NODE_ENV: production ? "production" : "development",
  };
  const password = "a-long-test-password-123";
  const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  let server;
  let output = "";

  async function command(args, input) {
    const child = spawn(process.execPath, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (data) => { log += data; });
    child.stderr.on("data", (data) => { log += data; });
    child.stdin.end(input);
    const [code] = await once(child, "exit");
    assert.equal(code, 0, log);
  }

  async function start() {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...(production ? ["start"] : ["dev", "--turbo"]), "-p", "3107", "-H", "localhost"], { env, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", (data) => { output += data; });
    server.stderr.on("data", (data) => { output += data; });
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        const response = await fetch(`${address}/login`, { signal: AbortSignal.timeout(1000) });
        if (response.status === 200) return;
      } catch { /* Wait for compilation. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Server did not start: ${output}`);
  }

  async function stop() {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      await exited;
    }
  }

  const request = (path, options = {}) => fetch(`${address}${path}`, { redirect: "manual", ...options });
  const client = (cookie, requestOrigin = origin) => createTRPCClient({
    links: [httpBatchStreamLink({
      url: `${address}/api/trpc`, transformer: SuperJSON,
      headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) },
    })],
  });
  async function login(value = password, cookie, next = "/manage", requestOrigin = origin) {
    return request("/api/auth/login", {
      method: "POST", headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) },
      body: new URLSearchParams({ username: "owner", password: value, next }),
    });
  }
  function cookieFrom(response) {
    const header = response.headers.get("set-cookie");
    assert.ok(header?.includes("HttpOnly"));
    assert.ok(header?.includes("SameSite=lax"));
    assert.equal(header?.includes("Secure"), origin.startsWith("https://"));
    return header.split(";")[0];
  }

  try {
    await command(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]);
    const encoded = await hashPassword(password);
    assert.ok(await verifyPassword(password, encoded));
    assert.equal(await verifyPassword("incorrect", encoded), false);
    const user = await db.user.create({ data: { username: "owner", passwordHash: encoded } });
    await db.category.create({ data: { name: "PRIVATE-CATEGORY", giftCards: { create: { code: "PRIVATE-CARD-CODE", balance: 25 } } } });
    await start();

    await t.test("anonymous pages redirect and API requests fail, including forged cookies", async () => {
      for (const path of ["/", "/manage", "/unknown-page"]) {
        const response = await request(path);
        assert.equal(response.status, 307);
        assert.ok(response.headers.get("location")?.includes("/login"));
        assert.equal((await response.text()).includes("PRIVATE-CARD-CODE"), false);
      }
      for (const path of ["/api/trpc/category.getAll", "/api/unknown"]) {
        assert.equal((await request(path)).status, 401);
        assert.equal((await request(path, { headers: { Cookie: `giftcard-session=${"a".repeat(64)}` } })).status, 401);
      }
      assert.equal((await request("/api/trpc/category.create", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ json: { name: "Unauthorized mutation" } }),
      })).status, 401);
      await assert.rejects(client().category.create.mutate({ name: "Anonymous streamed mutation" }),
        (error) => error.data?.code === "UNAUTHORIZED" && error.message.includes("Sign in"));
    });

    await t.test("incorrect credentials and foreign origins cannot establish sessions", async () => {
      const response = await login("incorrect");
      assert.equal(response.status, 303);
      assert.ok(response.headers.get("location")?.includes("error=credentials"));
      assert.equal(response.headers.has("set-cookie"), false);
      assert.equal((await login(password, undefined, "/", "https://attacker.example")).status, 403);
      assert.equal(await db.session.count(), 0);
    });

    let cookie;
    await t.test("login grants page and API access; tokens are hashed in SQLite", async () => {
      const response = await login();
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), `${origin}/manage`);
      cookie = cookieFrom(response);
      const session = await db.session.findFirstOrThrow();
      assert.equal(session.userId, user.id);
      assert.notEqual(session.tokenHash, cookie.split("=")[1]);
      for (const path of ["/", "/manage"]) {
        const page = await request(path, { headers: { Cookie: cookie } });
        assert.equal(page.status, 200);
        assert.ok((await page.text()).includes("PRIVATE-CATEGORY"));
      }
      const api = await request("/api/trpc/category.getAll", { headers: { Cookie: cookie } });
      assert.equal(api.status, 200);
      assert.ok((await api.text()).includes("PRIVATE-CARD-CODE"));
      const mutation = await request("/api/trpc/category.create", {
        method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ json: { name: "Authenticated mutation" } }),
      });
      assert.equal(mutation.status, 200);
      const streamed = await client(cookie).category.create.mutate({ name: "Streaming mutation" });
      assert.equal(streamed.name, "Streaming mutation");
      await assert.rejects(
        client(cookie, "http://localhost:6565").category.create.mutate({ name: "Blocked origin" }),
        (error) => error.data?.code === "FORBIDDEN" && error.message.includes("address"),
      );
      assert.equal((await request("/api/trpc/category.create", {
        method: "POST", headers: { Cookie: cookie, Origin: "https://attacker.example", "Content-Type": "application/json" },
        body: JSON.stringify({ json: { name: "Foreign origin mutation" } }),
      })).status, 403);
      assert.equal(await db.category.count({ where: { name: "Blocked origin" } }), 0);
    });

    await t.test("session survives a restart, then logout revokes the token", async () => {
      await stop();
      await start();
      assert.equal((await request("/api/trpc/category.getAll", { headers: { Cookie: cookie } })).status, 200);
      assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: "https://attacker.example" } })).status, 403);
      const response = await request("/api/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: origin } });
      assert.equal(response.status, 303);
      assert.ok(response.headers.get("set-cookie")?.includes("Max-Age=0"));
      assert.equal((await request("/api/trpc/category.getAll", { headers: { Cookie: cookie } })).status, 401);
    });

    await t.test("expiry, rotation, password reset and account deletion revoke access", async () => {
      cookie = cookieFrom(await login());
      await db.session.updateMany({ data: { expiresAt: new Date(0) } });
      assert.equal((await request("/manage", { headers: { Cookie: cookie } })).status, 307);
      const oldCookie = cookieFrom(await login());
      cookie = cookieFrom(await login(password, oldCookie, "//attacker.example"));
      assert.equal((await request("/api/trpc/category.getAll", { headers: { Cookie: oldCookie } })).status, 401);
      assert.equal((await login(password, undefined, "/\\attacker.example")).headers.get("location"), `${origin}/`);
      await command(["scripts/manage-user.mjs", "owner"], `${password}\n`);
      assert.equal((await request("/api/trpc/category.getAll", { headers: { Cookie: cookie } })).status, 401);
      cookie = cookieFrom(await login());
      await command(["scripts/manage-user.mjs", "--delete", "owner"]);
      assert.equal((await request("/api/trpc/category.getAll", { headers: { Cookie: cookie } })).status, 401);
    });

    await t.test("login throttling persists and blocks guessing", async () => {
      await db.loginThrottle.deleteMany();
      for (let attempt = 0; attempt < 10; attempt++) assert.equal((await login("incorrect")).status, 303);
      assert.equal((await login("incorrect")).status, 429);
      await stop();
      await start();
      assert.equal((await login("incorrect")).status, 429);
    });
  } finally {
    await stop();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
