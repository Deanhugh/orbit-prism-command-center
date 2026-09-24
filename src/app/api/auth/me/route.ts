import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getUserById, userCount, verifyToken } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = verifyToken(token);
  const user = userId ? getUserById(userId) : null;
  return NextResponse.json({
    user: user ? { id: user.id, username: user.username } : null,
    hasAccounts: userCount() > 0,
  });
}
