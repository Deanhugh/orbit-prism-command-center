import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/server/auth";
import { redirectTo, signedIn, wantsRedirect } from "@/lib/server/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startGuest() {
  for (let i = 0; i < 4; i++) {
    const username = `guest-${Date.now().toString(36)}${i ? `-${i}` : ""}`;
    const password = `orbit-${Math.random().toString(36).slice(2, 10)}`;
    const user = createUser(username, password);
    if (user) return user;
  }
  return null;
}

async function enter(req: NextRequest, forceRedirect: boolean) {
  const user = startGuest();
  if (!user) {
    if (forceRedirect || wantsRedirect(req, false)) {
      return redirectTo("/login?error=fail");
    }
    return NextResponse.json({ error: "Could not start a guest session" }, { status: 400 });
  }
  return signedIn(req, user, forceRedirect || wantsRedirect(req, false));
}

/** Browser-friendly: set the session cookie and send you to Agents. */
export async function GET(req: NextRequest) {
  return enter(req, true);
}

export async function POST(req: NextRequest) {
  return enter(req, false);
}
