import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { MarketingBoard } from "@/components/marketing/MarketingBoard";

export default async function MarketingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <MarketingBoard />;
}
