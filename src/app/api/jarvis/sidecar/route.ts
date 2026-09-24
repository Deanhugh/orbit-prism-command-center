import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import {
  forgetSidecar,
  getSidecarStatus,
  pairSidecar,
  readSidecarConfig,
  sendSidecarCommand,
  writeSidecarConfig,
} from "@/lib/server/mark-liv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getSidecarStatus());
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    text?: string;
    pin?: string;
    url?: string;
  };
  try {
    if (body.action === "url" && body.url) {
      const cfg = readSidecarConfig();
      writeSidecarConfig({ url: body.url, token: cfg.token });
      return NextResponse.json(await getSidecarStatus());
    }
    if (body.action === "pair") {
      return NextResponse.json(await pairSidecar(String(body.pin || "")));
    }
    if (body.action === "forget") {
      return NextResponse.json(await forgetSidecar());
    }
    if (body.action === "command") {
      return NextResponse.json(await sendSidecarCommand(String(body.text || "")));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sidecar error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
