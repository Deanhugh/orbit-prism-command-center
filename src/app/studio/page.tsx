import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { VideoStudio } from "@/components/studio/VideoStudio";

export default async function StudioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <VideoStudio />;
}
