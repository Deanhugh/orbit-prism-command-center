import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createToken, requestIsHttps, sessionCookieOptions } from "./auth";
import { APP_HOME } from "../home";

export type AuthMode = "login" | "register";

export async function readAuthFields(req: NextRequest): Promise<{
  username: string;
  password: string;
  viaForm: boolean;
}> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      username: String(body.username ?? "").trim(),
      password: String(body.password ?? ""),
      viaForm: false,
    };
  }
  const form = await req.formData().catch(() => null);
  return {
    username: String(form?.get("username") ?? "").trim(),
    password: String(form?.get("password") ?? ""),
    viaForm: Boolean(form),
  };
}

export function wantsRedirect(req: NextRequest, viaForm: boolean): boolean {
  if (viaForm) return true;
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return accept.includes("text/html") && !accept.includes("application/json");
}

export function requestOrigin(req: NextRequest): URL {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const forwarded = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwarded || (requestIsHttps(req) ? "https" : req.nextUrl.protocol.replace(":", "") || "http");
  return new URL(`${proto}://${host}/`);
}

/** Relative Location so Preview / proxies do not bounce to the machine's 127.0.0.1. */
export function redirectTo(path: string, status = 303): NextResponse {
  const loc = path.startsWith("/") ? path : `/${path}`;
  return new NextResponse(null, { status, headers: { Location: loc } });
}

export function signedIn(
  req: NextRequest,
  user: { id: string; username: string },
  redirectAway: boolean,
): NextResponse {
  const res = redirectAway
    ? redirectTo(APP_HOME)
    : NextResponse.json({ user: { id: user.id, username: user.username } });
  res.cookies.set(SESSION_COOKIE, createToken(user.id), sessionCookieOptions(requestIsHttps(req)));
  return res;
}

export function authFail(
  req: NextRequest,
  redirectAway: boolean,
  mode: AuthMode,
  code: string,
  status: number,
  message: string,
): NextResponse {
  if (redirectAway) {
    return redirectTo(`/login?mode=${mode}&error=${code}`);
  }
  return NextResponse.json({ error: message }, { status });
}
