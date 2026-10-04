import { UsePage } from "~/app/_components/use-page";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  void api.category.getAll.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-slate-950 text-white">
        <UsePage />
      </main>
    </HydrateClient>
  );
}
