import { getSessionUser } from "@/lib/server/session";
import { PageHead } from "@/components/jarvis/PageHead";
import { BriefingApp } from "@/components/jarvis/pages/BriefingApp";

export default async function Page() {
  const user = await getSessionUser();
  return (
    <>
      <PageHead title="Briefing" />
      <BriefingApp username={user?.username || "there"} />
    </>
  );
}
