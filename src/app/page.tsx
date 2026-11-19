import { UsePage } from "~/app/_components/use-page";
import { api, HydrateClient } from "~/trpc/server";
import { requirePageSession } from "~/server/auth/page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requirePageSession();
  void api.category.getAll.prefetch();

  return (
    <HydrateClient>
      <div className="min-h-screen bg-canvas text-foreground">
        <UsePage username={session.user.username} />
      </div>
    </HydrateClient>
  );
}
