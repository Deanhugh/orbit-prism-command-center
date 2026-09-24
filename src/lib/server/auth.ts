import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "./config";

export interface User {
  id: string;
  username: string;
  salt: string;
  hash: string;
  createdAt: number;
}

interface UserFile {
  users: User[];
}

function usersPath() {
  return path.join(dataDir(), "users.json");
}

function secretPath() {
  return path.join(dataDir(), ".session-secret");
}

function ensureDataDir() {
  fs.mkdirSync(dataDir(), { recursive: true });
}

function readUsers(): UserFile {
  try {
    return JSON.parse(fs.readFileSync(usersPath(), "utf8"));
  } catch {
    return { users: [] };
  }
}

function writeUsers(data: UserFile) {
  ensureDataDir();
  fs.writeFileSync(usersPath(), JSON.stringify(data, null, 2));
}

function sessionSecret(): string {
  if (process.env.ORBIT_SECRET) return process.env.ORBIT_SECRET;
  try {
    return fs.readFileSync(secretPath(), "utf8");
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    try {
      ensureDataDir();
      fs.writeFileSync(secretPath(), s);
    } catch {
      /* read-only fs */
    }
    return s;
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function userCount(): number {
  return readUsers().users.length;
}

export function localUsers(): User[] {
  return readUsers().users.filter((u) => !u.username.startsWith("guest-"));
}

export function localUserCount(): number {
  return localUsers().length;
}

export function verifyPasswordOnly(password: string): User | null {
  if (!password) return null;
  for (const user of localUsers()) {
    const candidate = hashPassword(password, user.salt);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(user.hash, "hex");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return user;
  }
  return null;
}

export const CONSOLE_USERNAME = "operator";

export function usernameTaken(username: string): boolean {
  return readUsers().users.some(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
}

export function createUser(username: string, password: string): User | null {
  const clean = username.trim();
  if (clean.length < 3 || password.length < 6) return null;
  if (usernameTaken(clean)) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = {
    id: crypto.randomBytes(8).toString("hex"),
    username: clean,
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
  const data = readUsers();
  data.users.push(user);
  writeUsers(data);
  return user;
}

export function verifyUser(username: string, password: string): User | null {
  const user = readUsers().users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!user) return null;
  const candidate = hashPassword(password, user.salt);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(user.hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return user;
}

export function getUserById(id: string): User | null {
  return readUsers().users.find((u) => u.id === id) ?? null;
}

export function changePassword(
  userId: string,
  current: string,
  next: string,
): { ok: true } | { ok: false; error: string } {
  if (next.length < 6) return { ok: false, error: "New password must be 6+ characters." };
  const data = readUsers();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "Account not found." };
  if (user.username.startsWith("guest-")) {
    return { ok: false, error: "Guest sessions cannot change a password. Create a local account." };
  }
  if (!verifyUser(user.username, current)) return { ok: false, error: "Current password is wrong." };
  const salt = crypto.randomBytes(16).toString("hex");
  user.salt = salt;
  user.hash = hashPassword(next, salt);
  writeUsers(data);
  return { ok: true };
}

export const SESSION_COOKIE = "orbit_session";

export function sessionCookieOptions(https: boolean): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function requestIsHttps(req: { headers: { get(name: string): string | null }; nextUrl?: { protocol: string } }): boolean {
  const forwarded = req.headers.get("x-forwarded-proto") || "";
  if (forwarded.split(",")[0].trim() === "https") return true;
  if (req.nextUrl?.protocol === "https:") return true;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) return false;
  return host.includes("trycloudflare.com") || host.includes("orbitprism.com") || host.includes("railway.app");
}

export function createToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = crypto
      .createHmac("sha256", sessionSecret())
      .update(`${userId}.${ts}`)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    if (!getUserById(userId)) return null;
    return userId;
  } catch {
    return null;
  }
}
