import { getSessionUser } from "@/lib/server/session";
import { readHub } from "@/lib/server/jarvis-hub";
import { PageHead } from "@/components/jarvis/PageHead";
import { JarvisSettingsApp } from "@/components/jarvis/pages/JarvisSettingsApp";
import { settingsTabFromQuery } from "@/lib/jarvis-settings";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  const username = user?.username || "there";
  const initialTab = settingsTabFromQuery((await searchParams).tab);
  const initialHub = user ? readHub(user.id, username) : undefined;
  return (
    <>
      <PageHead title="Settings" />
      <JarvisSettingsApp username={username} initialTab={initialTab} initialHub={initialHub} />
    </>
  );
}
