import { NextRequest } from "next/server";
import { CONSOLE_USERNAME, createUser, usernameTaken } from "@/lib/server/auth";
import { authFail, readAuthFields, redirectTo, signedIn, wantsRedirect } from "@/lib/server/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return redirectTo("/login?mode=register");
}

export async function POST(req: NextRequest) {
  const fields = await readAuthFields(req);
  const username = fields.username || CONSOLE_USERNAME;
  const { password, viaForm } = fields;
  const redirectAway = wantsRedirect(req, viaForm);

  if (username.length < 3) {
    return authFail(req, redirectAway, "register", "short_user", 400, "Username must be at least 3 characters");
  }
  if (password.length < 6) {
    return authFail(req, redirectAway, "register", "short_pass", 400, "Password must be at least 6 characters");
  }
  if (usernameTaken(username)) {
    return authFail(req, redirectAway, "register", "taken", 409, "That username is taken");
  }

  const user = createUser(username, password);
  if (!user) {
    return authFail(req, redirectAway, "register", "fail", 400, "Could not create account");
  }
  return signedIn(req, user, redirectAway);
}
