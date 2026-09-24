import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { MessagesApp } from "@/components/agents/MessagesApp";

export default async function AgentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <MessagesApp username={user.username} />;
}
