// TryPost integration (https://github.com/trypostit/trypost).
//
// TryPost is an open-source social-media scheduling platform. It's the Marketing
// team's platform for drafting, scheduling and publishing posts across networks.
// We talk to its REST API (base = {APP_URL}/api):
//   GET/POST  {base}/api/posts             list / create posts
//   PUT       {base}/api/posts/{id}         update a post
//   GET       {base}/api/social-accounts    connected channels
// Auth is a workspace-scoped Bearer token (Personal Access Token) created in the
// TryPost dashboard.
//
// When no instance is configured we fall back to a seeded in-memory mock store
// (persisted to data/) so agents and the Marketing page work locally. The page
// also embeds the real TryPost app when an app URL is set.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const POST_STATES = ["DRAFT", "SCHEDULED", "PUBLISHED", "FAILED"] as const;
export type PostState = (typeof POST_STATES)[number];

export const POST_STATE_LABEL: Record<PostState, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
};

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  active: boolean;
}

export interface Post {
  id: string;
  content: string;
  status: PostState;
  platforms: string[];
  scheduledAt: string | null;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- config ---------------------------------------------------------------

const DEFAULT_CLOUD = "https://app.trypost.it";

// The instance root (APP_URL). API lives at `${root}/api`.
export function trypostBaseUrl(): string {
  const raw = getSecret("TRYPOST_API_URL") || process.env.TRYPOST_API_URL || DEFAULT_CLOUD;
  return raw.replace(/\/+$/, "");
}

export function trypostAppUrl(): string | undefined {
  const explicit = getSecret("TRYPOST_APP_URL") || process.env.TRYPOST_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  return trypostBaseUrl();
}

export function trypostApiKey(): string | undefined {
  return getSecret("TRYPOST_API_KEY");
}

export function trypostConfigured(): boolean {
  return Boolean(trypostApiKey());
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${trypostApiKey()}` };
}

export interface SocialStatus {
  mode: "live" | "mock";
  baseUrl: string;
  appUrl?: string;
  hasKey: boolean;
  reachable?: boolean;
  reason?: string;
}

export async function socialStatus(): Promise<SocialStatus> {
  const hasKey = trypostConfigured();
  const baseUrl = trypostBaseUrl();
  const appUrl = trypostAppUrl();
  if (!hasKey) return { mode: "mock", baseUrl, appUrl, hasKey: false, reason: "No API key — using local mock posts" };
  try {
    const res = await fetch(`${baseUrl}/api/workspace`, { headers: authHeaders(), signal: AbortSignal.timeout(6000) });
    if (res.ok) return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: String(e).slice(0, 80) };
  }
}

async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${trypostBaseUrl()}${pathname}`, {
    ...init,
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TryPost ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

function unwrapArray<T>(json: unknown, ...keys: string[]): T[] {
  const j = json as Record<string, unknown>;
  if (Array.isArray(j)) return j as T[];
  for (const key of keys) if (Array.isArray(j?.[key])) return j[key] as T[];
  if (Array.isArray(j?.data)) return j.data as T[];
  return [];
}

// ---- mock store -----------------------------------------------------------

interface MockDB {
  accounts: SocialAccount[];
  posts: Post[];
}

const g = globalThis as unknown as { __trypostMock?: MockDB };

function mockFile() {
  return path.join(dataDir(), "trypost-mock.json");
}

function iso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 864e5).toISOString();
}

function seed(): MockDB {
  const now = new Date().toISOString();
  const accounts: SocialAccount[] = [
    { id: "acc_x", platform: "X", handle: "@orbitprism", active: true },
    { id: "acc_li", platform: "LinkedIn", handle: "Orbit Prism", active: true },
    { id: "acc_ig", platform: "Instagram", handle: "@orbitprism", active: true },
    { id: "acc_bs", platform: "Bluesky", handle: "@orbitprism.bsky.social", active: false },
  ];
  const p = (id: string, content: string, status: PostState, platforms: string[], sched: number | null, author: string): Post => ({
    id, content, status, platforms, scheduledAt: sched === null ? null : iso(sched), author, createdAt: now, updatedAt: now,
  });
  const posts: Post[] = [
    p("post_1", "How we build client AI agents in a week — a thread 🧵", "SCHEDULED", ["X", "LinkedIn"], 1, "SOCIAL MEDIA"),
    p("post_2", "New case study: Meridian's IoT fleet, live in 30 days.", "SCHEDULED", ["LinkedIn"], 3, "CONTENT STRATEGIST"),
    p("post_3", "Brand refresh incoming 👀 here's a sneak peek.", "DRAFT", ["Instagram", "X"], null, "BRAND"),
    p("post_4", "5 signs your ops need an OS Command Center.", "DRAFT", ["LinkedIn"], null, "CONTENT STRATEGIST"),
    p("post_5", "We shipped agent evals. Here's why it matters.", "PUBLISHED", ["X"], -1, "SOCIAL MEDIA"),
    p("post_6", "Behind the scenes: our design system.", "PUBLISHED", ["Instagram"], -3, "BRAND"),
    p("post_7", "Webinar: AI Engineering for SMBs — register.", "SCHEDULED", ["LinkedIn", "X"], 5, "CONTENT STRATEGIST"),
  ];
  return { accounts, posts };
}

function db(): MockDB {
  if (g.__trypostMock) return g.__trypostMock;
  let loaded: MockDB | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8"));
  } catch {
    /* none yet */
  }
  g.__trypostMock = loaded && loaded.posts ? loaded : seed();
  persist();
  return g.__trypostMock;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(mockFile(), JSON.stringify(g.__trypostMock, null, 2));
  } catch {
    /* read-only fs */
  }
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---- live mappers ---------------------------------------------------------

function normPost(o: Record<string, unknown>): Post {
  const now = new Date().toISOString();
  const raw = String(o.status ?? o.state ?? "draft").toLowerCase();
  let status: PostState = "DRAFT";
  if (raw.includes("publish") || raw.includes("sent") || raw.includes("posted")) status = "PUBLISHED";
  else if (raw.includes("schedul")) status = "SCHEDULED";
  else if (raw.includes("fail") || raw.includes("error")) status = "FAILED";
  const accounts = (o.social_accounts ?? o.accounts ?? o.channels) as Array<{ platform?: string; name?: string }> | undefined;
  const platforms = Array.isArray(accounts)
    ? accounts.map((a) => String(a.platform ?? a.name ?? "")).filter(Boolean)
    : Array.isArray(o.platforms) ? (o.platforms as string[]) : [];
  return {
    id: String(o.id ?? o.uuid ?? ""),
    content: String(o.content ?? o.body ?? o.text ?? ""),
    status,
    platforms,
    scheduledAt: (o.scheduled_at as string) ?? (o.scheduled_for as string) ?? null,
    author: (o.author as string) ?? null,
    createdAt: String(o.created_at ?? now),
    updatedAt: String(o.updated_at ?? now),
  };
}

function normAccount(o: Record<string, unknown>): SocialAccount {
  return {
    id: String(o.id ?? ""),
    platform: String(o.platform ?? o.provider ?? o.type ?? "Social"),
    handle: String(o.handle ?? o.username ?? o.name ?? ""),
    active: Boolean(o.active ?? o.is_active ?? o.enabled ?? true),
  };
}

// ---- public API -----------------------------------------------------------

export async function listChannels(): Promise<SocialAccount[]> {
  if (trypostConfigured()) {
    try {
      const json = await liveFetch(`/api/social-accounts`);
      const arr = unwrapArray<Record<string, unknown>>(json, "social_accounts", "socialAccounts", "accounts").map(normAccount);
      if (arr.length) return arr;
    } catch {
      /* mock */
    }
  }
  return db().accounts.slice();
}

export async function listPosts(opts: { status?: string; search?: string; limit?: number } = {}): Promise<Post[]> {
  const limit = Math.min(opts.limit ?? 200, 500);
  let posts: Post[];
  if (trypostConfigured()) {
    try {
      const json = await liveFetch(`/api/posts`);
      posts = unwrapArray<Record<string, unknown>>(json, "posts", "data").map(normPost);
    } catch {
      posts = db().posts.slice();
    }
  } else {
    posts = db().posts.slice();
  }
  if (opts.status) posts = posts.filter((p) => p.status === opts.status!.toUpperCase());
  if (opts.search) {
    const q = opts.search.toLowerCase();
    posts = posts.filter((p) => p.content.toLowerCase().includes(q) || p.platforms.join(" ").toLowerCase().includes(q));
  }
  return posts.slice(0, limit);
}

export async function createPost(input: { content: string; platforms?: string[]; status?: string; scheduledAt?: string | null; author?: string }): Promise<Post> {
  const status = normalizePostState(input.status) || (input.scheduledAt ? "SCHEDULED" : "DRAFT");
  if (trypostConfigured()) {
    try {
      const body: Record<string, unknown> = {
        content: input.content,
        status: status.toLowerCase(),
      };
      if (input.scheduledAt) body.scheduled_at = input.scheduledAt;
      const json = await liveFetch(`/api/posts`, { method: "POST", body: JSON.stringify(body) });
      const o = (json as { data?: Record<string, unknown> })?.data ?? (json as Record<string, unknown>);
      if (o?.id) return normPost(o as Record<string, unknown>);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const now = new Date().toISOString();
  const post: Post = {
    id: rid("post"),
    content: input.content,
    status,
    platforms: input.platforms && input.platforms.length ? input.platforms : ["X"],
    scheduledAt: input.scheduledAt ?? (status === "SCHEDULED" ? iso(1) : null),
    author: input.author ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.posts.unshift(post);
  persist();
  return post;
}

export async function updatePost(id: string, patch: { content?: string; status?: string; scheduledAt?: string | null }): Promise<Post | null> {
  const status = patch.status ? normalizePostState(patch.status) : undefined;
  if (trypostConfigured()) {
    try {
      const body: Record<string, unknown> = {};
      if (patch.content !== undefined) body.content = patch.content;
      if (status) body.status = status.toLowerCase();
      if (patch.scheduledAt !== undefined && patch.scheduledAt) body.scheduled_at = patch.scheduledAt;
      const json = await liveFetch(`/api/posts/${id}`, { method: "PUT", body: JSON.stringify(body) });
      const o = (json as { data?: Record<string, unknown> })?.data ?? (json as Record<string, unknown>);
      if (o?.id) return normPost(o as Record<string, unknown>);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const post = store.posts.find((p) => p.id === id);
  if (!post) return null;
  if (patch.content !== undefined) post.content = patch.content;
  if (status) post.status = status;
  if (patch.scheduledAt !== undefined) post.scheduledAt = patch.scheduledAt;
  if (post.status === "SCHEDULED" && !post.scheduledAt) post.scheduledAt = iso(1);
  post.updatedAt = new Date().toISOString();
  persist();
  return post;
}

export interface SocialSummary {
  channels: number;
  activeChannels: number;
  totalPosts: number;
  byState: { state: PostState; label: string; count: number }[];
  scheduledNext7: number;
}

export async function socialSummary(): Promise<SocialSummary> {
  const [accounts, posts] = await Promise.all([listChannels(), listPosts({ limit: 500 })]);
  const in7 = Date.now() + 7 * 864e5;
  return {
    channels: accounts.length,
    activeChannels: accounts.filter((a) => a.active).length,
    totalPosts: posts.length,
    byState: POST_STATES.map((state) => ({ state, label: POST_STATE_LABEL[state], count: posts.filter((p) => p.status === state).length })),
    scheduledNext7: posts.filter((p) => p.status === "SCHEDULED" && p.scheduledAt && new Date(p.scheduledAt).getTime() <= in7).length,
  };
}

export function normalizePostState(s?: string): PostState | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase().replace(/[^A-Z]/g, "");
  if (up.startsWith("PUBLISH") || up === "NOW" || up === "SENT" || up === "POSTED") return "PUBLISHED";
  if (up.startsWith("SCHEDUL")) return "SCHEDULED";
  if (up.startsWith("FAIL") || up === "ERROR") return "FAILED";
  if (up.startsWith("DRAFT")) return "DRAFT";
  return POST_STATES.find((x) => x === up);
}

export const SOCIAL_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "social_summary",
    description: "Get a marketing summary — connected channels, total posts, counts by state, and posts scheduled in the next 7 days.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "social_list_channels",
    description: "List connected social channels (accounts) and whether each is active.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "social_list_posts",
    description: "List posts. Filter by status (DRAFT/SCHEDULED/PUBLISHED/FAILED) or search text.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...POST_STATES] },
        search: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "social_create_post",
    description: "Draft a new social post. Set scheduledAt to schedule it, or status=PUBLISHED to post now.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Post copy" },
        platforms: { type: "array", items: { type: "string" }, description: "Channels, e.g. [\"X\",\"LinkedIn\"]" },
        status: { type: "string", enum: [...POST_STATES] },
        scheduledAt: { type: "string", description: "ISO datetime to schedule" },
      },
      required: ["content"],
    },
  },
  {
    name: "social_update_post",
    description: "Update a post — edit copy, schedule it (SCHEDULED + scheduledAt), or publish it (PUBLISHED).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        content: { type: "string" },
        status: { type: "string", enum: [...POST_STATES] },
        scheduledAt: { type: "string" },
      },
      required: ["id"],
    },
  },
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);
const arr = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map(String) : undefined);

export async function runSocialTool(name: string, args: Record<string, unknown>): Promise<string> {
  const source = trypostConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source, data });
  try {
    switch (name) {
      case "social_summary":
        return wrap(await socialSummary());
      case "social_list_channels":
        return wrap(await listChannels());
      case "social_list_posts":
        return wrap(await listPosts({ status: s(args.status), search: s(args.search), limit: n(args.limit) }));
      case "social_create_post":
        return wrap(await createPost({ content: s(args.content) || "", platforms: arr(args.platforms), status: s(args.status), scheduledAt: s(args.scheduledAt) ?? null }));
      case "social_update_post": {
        const post = await updatePost(s(args.id) || "", { content: s(args.content), status: s(args.status), scheduledAt: s(args.scheduledAt) });
        return post ? wrap(post) : JSON.stringify({ ok: false, error: "post not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown social tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}

export async function socialDiagnostics(): Promise<{
  mode: "live" | "mock";
  baseUrl: string;
  probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[];
}> {
  const baseUrl = trypostBaseUrl();
  if (!trypostConfigured()) {
    return { mode: "mock", baseUrl, probes: [{ endpoint: "(none)", ok: false, error: "Set an API key in Settings → Connectors → Marketing" }] };
  }
  const endpoints = [
    { path: "/api/workspace", keys: [] as string[] },
    { path: "/api/social-accounts", keys: ["social_accounts", "socialAccounts", "accounts"] },
    { path: "/api/posts", keys: ["posts", "data"] },
    { path: "/api/content-types", keys: ["content_types", "contentTypes", "data"] },
  ];
  const probes = await Promise.all(
    endpoints.map(async (e) => {
      try {
        const res = await fetch(`${baseUrl}${e.path}`, { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { endpoint: e.path, ok: false, status: res.status };
        const json = await res.json();
        const a = e.keys.length ? unwrapArray<Record<string, unknown>>(json, ...e.keys) : [];
        const sample = a[0] || (json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : undefined);
        return { endpoint: e.path, ok: true, status: res.status, count: a.length, sampleFields: sample ? Object.keys(sample).slice(0, 20) : [] };
      } catch (err) {
        return { endpoint: e.path, ok: false, error: String(err).slice(0, 100) };
      }
    }),
  );
  return { mode: "live", baseUrl, probes };
}
