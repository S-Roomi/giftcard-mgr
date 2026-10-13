import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "~/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await getSession(await headers())) redirect("/");
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-foreground">
      <form action="/api/auth/login" method="post" className="w-full max-w-sm rounded-xl border border-edge bg-raised/60 p-6">
        <h1 className="text-2xl font-bold">Gift Card Manager</h1>
        <p className="mt-2 text-sm text-subtle">Sign in to access your gift cards.</p>
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <label className="mt-6 flex flex-col gap-2 text-sm text-secondary">
          Username
          <input name="username" autoComplete="username" required maxLength={100} autoFocus className="rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none" />
        </label>
        <label className="mt-4 flex flex-col gap-2 text-sm text-secondary">
          Password
          <input name="password" type="password" autoComplete="current-password" required maxLength={1024} className="rounded-md border border-edge-strong bg-surface px-3 py-2 text-foreground focus:border-primary-hover focus:outline-none" />
        </label>
        {params.error && <p role="alert" className="mt-4 text-sm text-danger">Incorrect username or password.</p>}
        <button type="submit" className="mt-6 w-full rounded-md bg-primary text-on-primary px-4 py-2 font-semibold hover:bg-primary-hover">Sign in</button>
      </form>
    </main>
  );
}
