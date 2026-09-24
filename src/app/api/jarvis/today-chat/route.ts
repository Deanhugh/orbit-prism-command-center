import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { loadAgentsConfig, PRESETS } from "@/lib/server/providers";
import { redirectTo } from "@/lib/server/auth-http";
import {
  SESSION_COOKIE,
  createToken,
  createUser,
  requestIsHttps,
  sessionCookieOptions,
} from "@/lib/server/auth";
import {
  appendTodayLine,
  answerTodayChat,
  readTodayChat,
  resolveTodayPrompt,
} from "@/lib/server/jarvis-today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const cfg = loadAgentsConfig();
  return Response.json({
    messages: readTodayChat(user.id),
    provider: cfg.provider,
    providerLabel: PRESETS[cfg.provider]?.label || cfg.provider,
    model: cfg.model,
    ready: false,
    reason: "Orbit Prism model",
  });
}

async function readPost(req: NextRequest): Promise<{
  text: string;
  kind: "brief" | "chat";
  viaForm: boolean;
}> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const resolved = resolveTodayPrompt(String(body.preset || ""), String(body.text || ""));
    if (body.kind === "brief") resolved.kind = "brief";
    return { ...resolved, viaForm: false };
  }
  const form = await req.formData().catch(() => null);
  const resolved = resolveTodayPrompt(String(form?.get("preset") || ""), String(form?.get("text") || ""));
  return { ...resolved, viaForm: true };
}

function startGuest() {
  for (let i = 0; i < 4; i++) {
    const username = `guest-${Date.now().toString(36)}${i ? `-${i}` : ""}`;
    const password = `orbit-${Math.random().toString(36).slice(2, 10)}`;
    const user = createUser(username, password);
    if (user) return user;
  }
  return null;
}

function withSession(
  req: NextRequest,
  res: NextResponse,
  user: { id: string },
  minted: boolean,
) {
  if (minted) {
    res.cookies.set(SESSION_COOKIE, createToken(user.id), sessionCookieOptions(requestIsHttps(req)));
  }
  return res;
}

export async function POST(req: NextRequest) {
  let user = await getSessionUser();
  let minted = false;
  if (!user) {
    const guest = startGuest();
    if (!guest) {
      if ((req.headers.get("accept") || "").includes("text/html")) {
        return redirectTo("/login");
      }
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    user = { id: guest.id, username: guest.username };
    minted = true;
  }

  const { text, kind, viaForm } = await readPost(req);
  if (!text) {
    if (viaForm) return withSession(req, redirectTo("/jarvis#today-jarvis"), user, minted);
    return withSession(req, NextResponse.json({ error: "text required" }, { status: 400 }), user, minted);
  }

  appendTodayLine(user.id, { role: "user", content: text });
  const content = await answerTodayChat(user.id, user.username, text, kind);
  const saved = appendTodayLine(user.id, { role: "assistant", content });

  if (viaForm || (req.headers.get("accept") || "").includes("text/html")) {
    return withSession(req, redirectTo("/jarvis#today-jarvis"), user, minted);
  }

  return withSession(
    req,
    NextResponse.json({ message: saved, messages: readTodayChat(user.id) }),
    user,
    minted,
  );
}
