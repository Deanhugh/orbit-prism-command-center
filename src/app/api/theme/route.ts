import { NextRequest } from "next/server";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { redirectTo } from "@/lib/server/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(raw: string | null) {
  if (!raw) return "/jarvis";
  try {
    const url = new URL(raw, "http://local.test");
    if (url.origin !== "http://local.test") return "/jarvis";
    if (!url.pathname.startsWith("/")) return "/jarvis";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/jarvis";
  }
}

export async function GET(req: NextRequest) {
  const theme = parseTheme(req.nextUrl.searchParams.get("set"));
  const res = redirectTo(safeNext(req.nextUrl.searchParams.get("next")));
  res.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
