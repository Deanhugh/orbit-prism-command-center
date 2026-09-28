import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { PaperclipBoard } from "@/components/paperclip/PaperclipBoard";

export default async function PaperclipPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <PaperclipBoard />;
}
