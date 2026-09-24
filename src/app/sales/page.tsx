import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { CrmBoard } from "@/components/crm/CrmBoard";

export default async function SalesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <CrmBoard />;
}
