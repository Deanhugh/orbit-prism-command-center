import type { Metadata } from "next";
import { getSessionUser } from "@/lib/server/session";
import { JarvisShell } from "@/components/jarvis/JarvisShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Center · Orbit Prism",
};

export default async function JarvisLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <JarvisShell username={user?.username || "there"} needsGuest={!user}>
      {children}
    </JarvisShell>
  );
}
