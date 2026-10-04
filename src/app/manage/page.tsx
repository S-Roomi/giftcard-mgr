import { Dashboard } from "~/app/_components/dashboard";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  void api.category.getAll.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-slate-950 text-white">
        <Dashboard />
      </main>
    </HydrateClient>
  );
}
