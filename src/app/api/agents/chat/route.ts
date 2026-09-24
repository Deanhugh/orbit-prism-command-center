import { NextRequest } from "next/server";
import { conversationById, getMessages, appendMessage, resolveResponder } from "@/lib/server/conversations";
import { prepareChat } from "@/lib/server/agent-chat";
import { chatStream } from "@/lib/server/llm";
import { executeTool } from "@/lib/server/composio";
import { loadAgentsConfig, type ProviderId } from "@/lib/server/providers";
import type { ChatToolStep } from "@/lib/agents-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const convId = String(body.conversationId || "");
  const text = String(body.text || "").trim();
  const conv = conversationById(convId);
  if (!conv || !text) {
    return new Response(JSON.stringify({ error: "conversationId and text required" }), { status: 400 });
  }

  const cfg = loadAgentsConfig();
  const provider = (body.provider as ProviderId) || cfg.provider;
  const model = (body.model as string) || cfg.model || "demo";

  // record the user's message
  appendMessage(convId, { role: "user", content: text });

  const mode = body.mode === "plan" ? "plan" : "chat";
  const skill = typeof body.skill === "string" ? body.skill : undefined;

  const history = getMessages(convId);
  const responderId = resolveResponder(conv, text);
  const prepared = prepareChat(conv, responderId, history.slice(0, -1), text, { mode, skill });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* closed */ }
      };
      send({ type: "start", agentId: responderId, agentName: prepared.responderName });

      let content = "";
      const tools: ChatToolStep[] = [];
      try {
        for await (const ev of chatStream({
          provider,
          model,
          messages: prepared.messages,
          temperature: cfg.temperature,
          tools: prepared.tools.length ? prepared.tools : undefined,
          execTool: executeTool,
        })) {
          if (ev.type === "token") { content += ev.text; send(ev); }
          else if (ev.type === "tool") {
            const existing = tools.find((t) => t.name === ev.name && t.status === "running");
            if (existing && ev.status !== "running") { existing.status = ev.status; existing.detail = ev.detail; }
            else tools.push({ name: ev.name, status: ev.status, detail: ev.detail });
            send(ev);
          } else if (ev.type === "error") { send(ev); }
          else if (ev.type === "done") { content = ev.content || content; }
        }
      } catch (e) {
        send({ type: "error", error: String(e).slice(0, 160) });
      }

      const saved = appendMessage(convId, {
        role: "assistant",
        content: content || "(no response)",
        agentId: responderId,
        agentName: prepared.responderName,
        tools: tools.length ? tools : undefined,
      });
      send({ type: "done", message: saved });
      controller.close();
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
