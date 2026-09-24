import type { OfficeEvent } from "@/lib/types";
import { ensureStarted, getSnapshot, subscribe } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureStarted();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: OfficeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* closed */
        }
      };

      // prime with a full snapshot
      send({ type: "snapshot", snapshot: await getSnapshot() });

      const unsub = subscribe(send);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);

      // @ts-expect-error non-standard cleanup hook
      controller.oncancel = () => {
        clearInterval(ping);
        unsub();
      };
    },
    cancel() {
      /* handled above */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
