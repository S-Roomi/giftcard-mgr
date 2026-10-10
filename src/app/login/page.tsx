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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <form action="/api/auth/login" method="post" className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <h1 className="text-2xl font-bold">Gift Card Manager</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to access your gift cards.</p>
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <label className="mt-6 flex flex-col gap-2 text-sm text-slate-300">
          Username
          <input name="username" autoComplete="username" required maxLength={100} autoFocus className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none" />
        </label>
        <label className="mt-4 flex flex-col gap-2 text-sm text-slate-300">
          Password
          <input name="password" type="password" autoComplete="current-password" required maxLength={1024} className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none" />
        </label>
        {params.error && <p role="alert" className="mt-4 text-sm text-red-400">Incorrect username or password.</p>}
        <button type="submit" className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">Sign in</button>
      </form>
    </main>
  );
}
