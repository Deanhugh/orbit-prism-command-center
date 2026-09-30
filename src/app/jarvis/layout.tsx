import type { Metadata } from "next";
import { getSessionUser } from "@/lib/server/session";
import { JarvisShell } from "@/components/jarvis/JarvisShell";
import { listEnabledMcpApps } from "@/lib/server/mcp-nav-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Center · Orbit Prism",
};

export default async function JarvisLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const mcpApps = listEnabledMcpApps();
  return (
    <JarvisShell username={user?.username || "there"} needsGuest={!user} initialMcpApps={mcpApps}>
      {children}
    </JarvisShell>
  );
}
