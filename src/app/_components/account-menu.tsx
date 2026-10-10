export function AccountMenu({ username }: { username: string }) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
      <span>Signed in as {username}</span>
      <form action="/api/auth/logout" method="post">
        <button className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800">Sign out</button>
      </form>
    </div>
  );
}
