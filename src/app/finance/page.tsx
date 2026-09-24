import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { FinanceBoard } from "@/components/finance/FinanceBoard";

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <FinanceBoard />;
}
