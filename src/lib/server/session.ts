import { cookies } from "next/headers";
import { SESSION_COOKIE, getUserById, verifyToken } from "./auth";

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = verifyToken(token);
  if (!userId) return null;
  const user = getUserById(userId);
  return user ? { id: user.id, username: user.username } : null;
}
