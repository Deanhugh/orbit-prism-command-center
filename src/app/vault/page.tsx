import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { VaultPage } from "@/components/vault/VaultPage";

export default async function Vault() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <VaultPage />;
}
