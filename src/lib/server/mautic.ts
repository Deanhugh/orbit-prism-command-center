// Mautic integration (https://github.com/mautic/mautic).
//
// Mautic is open-source marketing automation — email campaigns, contacts,
// segments and drip journeys. It's the Email Marketing agent's platform. We talk
// to its REST API (base = {APP_URL}/api):
//   GET/POST  {base}/api/emails            list / create emails
//   POST      {base}/api/emails/{id}/send  send an email to its segment(s)
//   GET/POST  {base}/api/contacts          list / create contacts
//   GET       {base}/api/segments          segments (lists)
//   GET       {base}/api/campaigns         campaigns
// Auth is OAuth2 client_credentials (recommended for machine access) or Basic
// Auth. Mautic returns collections as objects keyed by id (not arrays).
//
// When no instance is configured we fall back to a seeded in-memory mock store
// (persisted to data/) so the agent and the Email page work locally.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const EMAIL_STATES = ["DRAFT", "SENT"] as const;
export type EmailState = (typeof EMAIL_STATES)[number];
export const EMAIL_STATE_LABEL: Record<EmailState, string> = { DRAFT: "Draft", SENT: "Sent" };

export interface EmailItem {
  id: string;
  name: string;
  subject: string;
  fromAddress: string | null;
  status: EmailState;
  sentCount: number;
  readCount: number;
  segment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  published: boolean;
  contacts: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  stage: string | null;
}

export interface Segment {
  id: string;
  name: string;
  contacts: number;
}

const DEFAULT_CLOUD = "https://mautic.example.com";

export function mauticBaseUrl(): string {
  const raw = getSecret("MAUTIC_API_URL") || process.env.MAUTIC_API_URL || DEFAULT_CLOUD;
  return raw.replace(/\/+$/, "");
}

export function mauticAppUrl(): string | undefined {
  const explicit = getSecret("MAUTIC_APP_URL") || process.env.MAUTIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const b = mauticBaseUrl();
  return b === DEFAULT_CLOUD ? undefined : b;
}

function clientCreds(): { id?: string; secret?: string } {
  return { id: getSecret("MAUTIC_CLIENT_ID"), secret: getSecret("MAUTIC_CLIENT_SECRET") };
}
function basicCreds(): { user?: string; pass?: string } {
  return { user: getSecret("MAUTIC_BASIC_USER"), pass: getSecret("MAUTIC_BASIC_PASS") };
}

export function mauticConfigured(): boolean {
  const c = clientCreds();
  const b = basicCreds();
  return Boolean((c.id && c.secret) || (b.user && b.pass));
}

const gTok = globalThis as unknown as { __mauticTok?: { token: string; exp: number } };

async function getToken(): Promise<string | null> {
  const c = clientCreds();
  if (!c.id || !c.secret) return null;
  const now = Date.now();
  if (gTok.__mauticTok && gTok.__mauticTok.exp > now + 30_000) return gTok.__mauticTok.token;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: c.id, client_secret: c.secret });
  const res = await fetch(`${mauticBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Mautic token ${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Mautic token: no access_token");
  gTok.__mauticTok = { token: json.access_token, exp: now + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  const c = clientCreds();
  if (c.id && c.secret) {
    const token = await getToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } else {
    const b = basicCreds();
    if (b.user && b.pass) h.Authorization = `Basic ${Buffer.from(`${b.user}:${b.pass}`).toString("base64")}`;
  }
  return h;
}

export interface EmailStatus {
  mode: "live" | "mock";
  baseUrl: string;
  appUrl?: string;
  hasKey: boolean;
  auth: "client_credentials" | "basic" | "none";
  reachable?: boolean;
  reason?: string;
}

export async function emailStatus(): Promise<EmailStatus> {
  const baseUrl = mauticBaseUrl();
  const appUrl = mauticAppUrl();
  const auth = clientCreds().id ? "client_credentials" : basicCreds().user ? "basic" : "none";
  if (!mauticConfigured()) return { mode: "mock", baseUrl, appUrl, hasKey: false, auth, reason: "No credentials — using local mock emails" };
  try {
    const res = await fetch(`${baseUrl}/api/emails?limit=1`, { headers: await authHeaders(), signal: AbortSignal.timeout(8000) });
    if (res.ok) return { mode: "live", baseUrl, appUrl, hasKey: true, auth, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, hasKey: true, auth, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, hasKey: true, auth, reachable: false, reason: String(e).slice(0, 80) };
  }
}

async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${mauticBaseUrl()}${pathname}`, {
    ...init,
    headers: await authHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mautic ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

function unwrapMap<T>(json: unknown, key: string): T[] {
  const j = json as Record<string, unknown>;
  const coll = j?.[key];
  if (Array.isArray(coll)) return coll as T[];
  if (coll && typeof coll === "object") return Object.values(coll as Record<string, T>);
  return [];
}

interface MockDB {
  emails: EmailItem[];
  campaigns: Campaign[];
  contacts: Contact[];
  segments: Segment[];
}

const g = globalThis as unknown as { __mauticMock?: MockDB };

function mockFile() {
  return path.join(dataDir(), "mautic-mock.json");
}

function seed(): MockDB {
  const now = new Date().toISOString();
  const emails: EmailItem[] = [
    { id: "em_1", name: "September Newsletter", subject: "What we shipped in September", fromAddress: "hello@orbitprism.co", status: "SENT", sentCount: 1240, readCount: 512, segment: "Subscribers", createdAt: now, updatedAt: now },
    { id: "em_2", name: "Product update — Agent evals", subject: "New: agent evaluations", fromAddress: "hello@orbitprism.co", status: "SENT", sentCount: 860, readCount: 402, segment: "Customers", createdAt: now, updatedAt: now },
    { id: "em_3", name: "Trial nudge day 3", subject: "Getting the most from your trial", fromAddress: "hello@orbitprism.co", status: "DRAFT", sentCount: 0, readCount: 0, segment: "Trials", createdAt: now, updatedAt: now },
    { id: "em_4", name: "Webinar invite", subject: "Join us: AI Engineering for SMBs", fromAddress: "hello@orbitprism.co", status: "DRAFT", sentCount: 0, readCount: 0, segment: "Subscribers", createdAt: now, updatedAt: now },
  ];
  const campaigns: Campaign[] = [
    { id: "cmp_1", name: "Welcome drip", published: true, contacts: 318 },
    { id: "cmp_2", name: "Trial → paid nurture", published: true, contacts: 96 },
    { id: "cmp_3", name: "Re-engagement", published: false, contacts: 240 },
  ];
  const contacts: Contact[] = [
    { id: "c_1", name: "Amara Okafor", email: "amara@harbourside.vc", stage: "Customer" },
    { id: "c_2", name: "Sam Devlin", email: "sam@meridianlog.com", stage: "Trial" },
    { id: "c_3", name: "Wei Chen", email: "wei@northwind.store", stage: "Subscriber" },
    { id: "c_4", name: "Elena Ruiz", email: "elena@lumenhealth.io", stage: "Customer" },
  ];
  const segments: Segment[] = [
    { id: "seg_1", name: "Subscribers", contacts: 3120 },
    { id: "seg_2", name: "Trials", contacts: 214 },
    { id: "seg_3", name: "Customers", contacts: 486 },
  ];
  return { emails, campaigns, contacts, segments };
}

function db(): MockDB {
  if (g.__mauticMock) return g.__mauticMock;
  let loaded: MockDB | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8"));
  } catch {
    /* none yet */
  }
  g.__mauticMock = loaded && loaded.emails ? loaded : seed();
  persist();
  return g.__mauticMock;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(mockFile(), JSON.stringify(g.__mauticMock, null, 2));
  } catch {
    /* read-only fs */
  }
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normEmail(o: Record<string, unknown>): EmailItem {
  const now = new Date().toISOString();
  const sent = Number(o.sentCount ?? 0);
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? "Untitled"),
    subject: String(o.subject ?? ""),
    fromAddress: (o.fromAddress as string) ?? null,
    status: sent > 0 ? "SENT" : "DRAFT",
    sentCount: sent,
    readCount: Number(o.readCount ?? 0),
    segment: null,
    createdAt: String(o.dateAdded ?? now),
    updatedAt: String(o.dateModified ?? now),
  };
}

function normContact(o: Record<string, unknown>): Contact {
  const fields = (o.fields as { all?: Record<string, unknown> })?.all ?? {};
  const first = String(fields.firstname ?? "");
  const last = String(fields.lastname ?? "");
  const email = (fields.email as string) ?? null;
  return {
    id: String(o.id ?? ""),
    name: `${first} ${last}`.trim() || email || "Contact",
    email,
    stage: (fields.stage as string) ?? null,
  };
}

export async function listEmails(opts: { status?: string; search?: string; limit?: number } = {}): Promise<EmailItem[]> {
  const limit = Math.min(opts.limit ?? 100, 300);
  let emails: EmailItem[];
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/emails?limit=${limit}`);
      emails = unwrapMap<Record<string, unknown>>(json, "emails").map(normEmail);
    } catch {
      emails = db().emails.slice();
    }
  } else {
    emails = db().emails.slice();
  }
  if (opts.status) emails = emails.filter((e) => e.status === opts.status!.toUpperCase());
  if (opts.search) {
    const q = opts.search.toLowerCase();
    emails = emails.filter((e) => e.name.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
  }
  return emails.slice(0, limit);
}

export async function createEmail(input: { name: string; subject?: string; fromAddress?: string; segment?: string }): Promise<EmailItem> {
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/emails/new`, {
        method: "POST",
        body: JSON.stringify({ name: input.name, subject: input.subject || input.name, fromAddress: input.fromAddress, isPublished: true }),
      });
      const o = (json as { email?: Record<string, unknown> })?.email;
      if (o?.id) return normEmail(o);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const now = new Date().toISOString();
  const email: EmailItem = {
    id: rid("em"),
    name: input.name,
    subject: input.subject || input.name,
    fromAddress: input.fromAddress ?? "hello@orbitprism.co",
    status: "DRAFT",
    sentCount: 0,
    readCount: 0,
    segment: input.segment ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.emails.unshift(email);
  persist();
  return email;
}

export async function sendEmail(id: string): Promise<EmailItem | null> {
  if (mauticConfigured()) {
    try {
      await liveFetch(`/api/emails/${id}/send`, { method: "POST", body: "{}" });
      const fresh = (await listEmails({ limit: 300 })).find((e) => e.id === id);
      if (fresh) return fresh;
    } catch {
      /* mock */
    }
  }
  const store = db();
  const email = store.emails.find((e) => e.id === id);
  if (!email) return null;
  email.status = "SENT";
  if (email.sentCount === 0) {
    const seg = store.segments.find((s) => s.name === email.segment);
    email.sentCount = seg?.contacts ?? 500;
  }
  email.updatedAt = new Date().toISOString();
  persist();
  return email;
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/campaigns?limit=100`);
      const arr = unwrapMap<Record<string, unknown>>(json, "campaigns").map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? "Campaign"),
        published: Boolean(o.isPublished),
        contacts: Number((o.stats as { leadCount?: number })?.leadCount ?? 0),
      }));
      if (arr.length) return arr;
    } catch {
      /* mock */
    }
  }
  return db().campaigns.slice();
}

export async function listContacts(opts: { search?: string; limit?: number } = {}): Promise<Contact[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  let contacts: Contact[];
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/contacts?limit=${limit}${opts.search ? `&search=${encodeURIComponent(opts.search)}` : ""}`);
      contacts = unwrapMap<Record<string, unknown>>(json, "contacts").map(normContact);
    } catch {
      contacts = db().contacts.slice();
    }
  } else {
    contacts = db().contacts.slice();
  }
  if (opts.search && !mauticConfigured()) {
    const q = opts.search.toLowerCase();
    contacts = contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
  }
  return contacts.slice(0, limit);
}

export async function createContact(input: { email: string; firstName?: string; lastName?: string }): Promise<Contact> {
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/contacts/new`, {
        method: "POST",
        body: JSON.stringify({ email: input.email, firstname: input.firstName, lastname: input.lastName }),
      });
      const o = (json as { contact?: Record<string, unknown> })?.contact;
      if (o?.id) return normContact(o);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const contact: Contact = {
    id: rid("c"),
    name: `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || input.email,
    email: input.email,
    stage: "Subscriber",
  };
  store.contacts.unshift(contact);
  persist();
  return contact;
}

export async function listSegments(): Promise<Segment[]> {
  if (mauticConfigured()) {
    try {
      const json = await liveFetch(`/api/segments?limit=100`);
      const arr = unwrapMap<Record<string, unknown>>(json, "lists").map((o) => ({
        id: String(o.id ?? ""),
        name: String(o.name ?? "Segment"),
        contacts: Number(o.leadCount ?? 0),
      }));
      if (arr.length) return arr;
    } catch {
      /* mock */
    }
  }
  return db().segments.slice();
}

export interface EmailSummary {
  totalEmails: number;
  sent: number;
  drafts: number;
  totalSent: number;
  avgOpenRate: number;
  campaigns: number;
  contacts: number;
}

export async function emailSummary(): Promise<EmailSummary> {
  const [emails, campaigns, segments] = await Promise.all([listEmails({ limit: 300 }), listCampaigns(), listSegments()]);
  const sent = emails.filter((e) => e.status === "SENT");
  const totalSent = sent.reduce((a, b) => a + b.sentCount, 0);
  const totalRead = sent.reduce((a, b) => a + b.readCount, 0);
  return {
    totalEmails: emails.length,
    sent: sent.length,
    drafts: emails.filter((e) => e.status === "DRAFT").length,
    totalSent,
    avgOpenRate: totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0,
    campaigns: campaigns.length,
    contacts: segments.reduce((a, b) => a + b.contacts, 0),
  };
}

export const EMAIL_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  { name: "email_summary", description: "Get an email-marketing summary — email counts, total sent, avg open rate, campaigns, and contacts.", parameters: { type: "object", properties: {} } },
  { name: "email_list_emails", description: "List email campaigns. Filter by status (DRAFT/SENT) or search.", parameters: { type: "object", properties: { status: { type: "string", enum: [...EMAIL_STATES] }, search: { type: "string" }, limit: { type: "number" } } } },
  { name: "email_create_email", description: "Create a new email (draft) with a subject and from address.", parameters: { type: "object", properties: { name: { type: "string" }, subject: { type: "string" }, fromAddress: { type: "string" }, segment: { type: "string" } }, required: ["name"] } },
  { name: "email_send", description: "Send an email to its segment.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "email_list_campaigns", description: "List marketing automation campaigns (drip journeys).", parameters: { type: "object", properties: {} } },
  { name: "email_list_segments", description: "List contact segments (lists).", parameters: { type: "object", properties: {} } },
  { name: "email_list_contacts", description: "List contacts. Optionally search by name/email.", parameters: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" } } } },
  { name: "email_create_contact", description: "Create a contact (subscriber).", parameters: { type: "object", properties: { email: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } }, required: ["email"] } },
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);

export async function runEmailTool(name: string, args: Record<string, unknown>): Promise<string> {
  const source = mauticConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source, data });
  try {
    switch (name) {
      case "email_summary":
        return wrap(await emailSummary());
      case "email_list_emails":
        return wrap(await listEmails({ status: s(args.status), search: s(args.search), limit: n(args.limit) }));
      case "email_create_email":
        return wrap(await createEmail({ name: s(args.name) || "New email", subject: s(args.subject), fromAddress: s(args.fromAddress), segment: s(args.segment) }));
      case "email_send": {
        const e = await sendEmail(s(args.id) || "");
        return e ? wrap(e) : JSON.stringify({ ok: false, error: "email not found" });
      }
      case "email_list_campaigns":
        return wrap(await listCampaigns());
      case "email_list_segments":
        return wrap(await listSegments());
      case "email_list_contacts":
        return wrap(await listContacts({ search: s(args.search), limit: n(args.limit) }));
      case "email_create_contact":
        return wrap(await createContact({ email: s(args.email) || "contact@example.com", firstName: s(args.firstName), lastName: s(args.lastName) }));
      default:
        return JSON.stringify({ ok: false, error: `unknown email tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}

export async function emailDiagnostics(): Promise<{
  mode: "live" | "mock";
  baseUrl: string;
  probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[];
}> {
  const baseUrl = mauticBaseUrl();
  if (!mauticConfigured()) {
    return { mode: "mock", baseUrl, probes: [{ endpoint: "(none)", ok: false, error: "Set client credentials in Settings → Connectors → Email" }] };
  }
  const endpoints = [
    { path: "/api/emails?limit=1", key: "emails" },
    { path: "/api/contacts?limit=1", key: "contacts" },
    { path: "/api/segments?limit=1", key: "lists" },
    { path: "/api/campaigns?limit=1", key: "campaigns" },
  ];
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch (e) {
    return { mode: "live", baseUrl, probes: [{ endpoint: "/oauth/v2/token", ok: false, error: String(e).slice(0, 120) }] };
  }
  const probes = await Promise.all(
    endpoints.map(async (e) => {
      try {
        const res = await fetch(`${baseUrl}${e.path}`, { headers, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { endpoint: e.path, ok: false, status: res.status };
        const json = await res.json();
        const arr = unwrapMap<Record<string, unknown>>(json, e.key);
        return { endpoint: e.path, ok: true, status: res.status, count: arr.length, sampleFields: arr[0] ? Object.keys(arr[0]).slice(0, 20) : [] };
      } catch (err) {
        return { endpoint: e.path, ok: false, error: String(err).slice(0, 100) };
      }
    }),
  );
  return { mode: "live", baseUrl, probes };
}
