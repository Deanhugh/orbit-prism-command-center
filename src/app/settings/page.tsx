import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default async function Settings() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <SettingsPage />;
}
