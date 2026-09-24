import { PageHead } from "@/components/jarvis/PageHead";
import { NotepadApp } from "@/components/jarvis/pages/NotepadApp";

export default function Page() {
  return (
    <>
      <PageHead title="Notepad" />
      <NotepadApp />
    </>
  );
}
