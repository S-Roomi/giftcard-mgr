export function AccountMenu({ username }: { username: string }) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-raised bg-canvas px-4 py-3 text-sm text-subtle">
      <span>Signed in as {username}</span>
      <form action="/api/auth/logout" method="post">
        <button className="rounded-md border border-edge px-3 py-1.5 text-secondary hover:bg-raised">Sign out</button>
      </form>
    </div>
  );
}
