import { Dashboard } from "~/app/_components/dashboard";
import { api, HydrateClient } from "~/trpc/server";
import { requirePageSession } from "~/server/auth/page";
import { AccountMenu } from "~/app/_components/account-menu";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const session = await requirePageSession();
  void api.category.getAll.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-slate-950 text-white">
        <AccountMenu username={session.user.username} />
        <Dashboard />
      </main>
    </HydrateClient>
  );
}
