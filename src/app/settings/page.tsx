import { redirect } from "next/navigation";

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const raw = ((await searchParams).tab || "providers").toLowerCase();
  const tab = raw === "connectors" ? "mcp" : raw === "plugins" ? "skills" : raw;
  redirect(`/jarvis/settings?tab=${encodeURIComponent(tab)}`);
}
