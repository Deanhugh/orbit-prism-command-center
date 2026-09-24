import { NextRequest } from "next/server";
import { verifyPasswordOnly, verifyUser } from "@/lib/server/auth";
import { authFail, readAuthFields, redirectTo, signedIn, wantsRedirect } from "@/lib/server/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return redirectTo("/login");
}

export async function POST(req: NextRequest) {
  const { username, password, viaForm } = await readAuthFields(req);
  const redirectAway = wantsRedirect(req, viaForm);
  const user = username ? verifyUser(username, password) : verifyPasswordOnly(password);
  if (!user) {
    return authFail(
      req,
      redirectAway,
      "login",
      "wrong",
      401,
      "Wrong password",
    );
  }
  return signedIn(req, user, redirectAway);
}
