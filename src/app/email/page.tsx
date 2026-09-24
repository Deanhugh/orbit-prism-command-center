import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { EmailBoard } from "@/components/email/EmailBoard";

export default async function EmailPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <EmailBoard />;
}
