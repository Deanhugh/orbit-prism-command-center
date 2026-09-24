import { redirect } from "next/navigation";

// Jarvis is the first authenticated screen. The Agents office stays at /agents.
export default function Home() {
  redirect("/jarvis");
}
