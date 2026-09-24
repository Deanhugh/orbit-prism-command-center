import { getSessionUser } from "@/lib/server/session";
import { readHub } from "@/lib/server/jarvis-hub";
import { JarvisDashboard } from "@/components/jarvis/JarvisDashboard";

export const dynamic = "force-dynamic";

export default async function JarvisPage() {
  const user = await getSessionUser();
  const username = user?.username || "there";
  const initialHub = user ? readHub(user.id, username) : undefined;
  return <JarvisDashboard username={username} initialHub={initialHub} />;
}
