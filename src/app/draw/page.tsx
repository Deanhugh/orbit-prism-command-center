import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { DrawStudio } from "@/components/draw/DrawStudio";

export default async function DrawPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <DrawStudio />;
}
