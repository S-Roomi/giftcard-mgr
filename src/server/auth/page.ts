import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "./session";

export async function requirePageSession() {
  const session = await getSession(await headers());
  if (!session) redirect("/login");
  return session;
}
