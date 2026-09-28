import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { CadStudio } from "@/components/cad/CadStudio";

export default async function CadPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <CadStudio />;
}
