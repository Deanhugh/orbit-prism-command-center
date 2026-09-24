import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { PmoBoard } from "@/components/pmo/PmoBoard";

export default async function PmoPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <PmoBoard />;
}
