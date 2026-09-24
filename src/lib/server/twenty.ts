// Twenty CRM integration (https://github.com/twentyhq/twenty).
//
// Twenty is an open-source CRM that auto-generates a REST + GraphQL API from the
// workspace schema. Deals are "Opportunities". We talk to the Core REST API:
//   GET/POST   {base}/rest/opportunities        list / create
//   GET/PATCH  {base}/rest/opportunities/{id}   read / update one
//   ...same shape for /rest/companies and /rest/people
// Auth is a Bearer API key created in Settings → API & Webhooks.
//
// When no instance is configured we fall back to an in-memory mock store (seeded
// with sample data) so agents can still read and write deals locally. The store
// is persisted to data/ so reads/writes survive across requests.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const DEAL_STAGES = ["NEW", "SCREENING", "MEETING", "PROPOSAL", "CUSTOMER"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface Deal {
  id: string;
  name: string;
  amount: number;
  currency: string;
  stage: DealStage;
  closeDate: string | null;
  companyId: string | null;
  companyName?: string | null;
  contactId: string | null;
  contactName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  employees: number | null;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  companyId: string | null;
}

export interface DealInput {
  name: string;
  amount?: number;
  currency?: string;
  stage?: string;
  closeDate?: string | null;
  companyId?: string | null;
  contactId?: string | null;
}

const DEFAULT_CLOUD = "https://api.twenty.com";

export function twentyBaseUrl(): string {
  const raw = getSecret("TWENTY_API_URL") || process.env.TWENTY_API_URL || DEFAULT_CLOUD;
  return raw.replace(/\/+$/, "");
}

export function twentyApiKey(): string | undefined {
  return getSecret("TWENTY_API_KEY");
}

export function twentyConfigured(): boolean {
  return Boolean(twentyApiKey());
}

export function twentyAppUrl(): string | undefined {
  const explicit = getSecret("TWENTY_APP_URL") || process.env.TWENTY_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = twentyBaseUrl();
  if (api.includes("//api.")) return api.replace("//api.", "//app.");
  if (api.includes("api.twenty.com")) return "https://app.twenty.com";
  return api;
}

export interface CrmStatus {
  mode: "live" | "mock";
  baseUrl: string;
  appUrl?: string;
  hasKey: boolean;
  reachable?: boolean;
  reason?: string;
}

export async function crmStatus(): Promise<CrmStatus> {
  const hasKey = twentyConfigured();
  const baseUrl = twentyBaseUrl();
  const appUrl = twentyAppUrl();
  if (!hasKey) {
    return { mode: "mock", baseUrl, appUrl, hasKey: false, reason: "No API key — using local mock data" };
  }
  try {
    const res = await fetch(`${baseUrl}/rest/opportunities?limit=1`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: String(e).slice(0, 80) };
  }
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${twentyApiKey()}` };
}

const MICROS = 1_000_000;

function unwrap<T>(json: unknown, prefer?: string): T {
  const data = (json as { data?: Record<string, unknown> })?.data;
  if (!data) return json as T;
  if (prefer && prefer in data) return data[prefer] as T;
  const vals = Object.values(data);
  return (vals[0] ?? data) as T;
}

function normDeal(o: Record<string, unknown>): Deal {
  const amount = o.amount as { amountMicros?: number; currencyCode?: string } | undefined;
  const company = o.company as { id?: string; name?: string } | undefined;
  const contact = o.pointOfContact as { id?: string; name?: { firstName?: string; lastName?: string } } | undefined;
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? "Untitled deal"),
    amount: amount?.amountMicros ? amount.amountMicros / MICROS : 0,
    currency: amount?.currencyCode || "USD",
    stage: (String(o.stage ?? "NEW") as DealStage),
    closeDate: (o.closeDate as string) ?? null,
    companyId: (o.companyId as string) ?? company?.id ?? null,
    companyName: company?.name ?? null,
    contactId: (o.pointOfContactId as string) ?? contact?.id ?? null,
    contactName: contact?.name ? `${contact.name.firstName ?? ""} ${contact.name.lastName ?? ""}`.trim() : null,
    createdAt: (o.createdAt as string) || new Date().toISOString(),
    updatedAt: (o.updatedAt as string) || new Date().toISOString(),
  };
}

function dealToTwenty(input: Partial<DealInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.stage !== undefined) body.stage = input.stage;
  if (input.closeDate !== undefined && input.closeDate) body.closeDate = input.closeDate;
  if (input.companyId !== undefined && input.companyId) body.companyId = input.companyId;
  if (input.contactId !== undefined && input.contactId) body.pointOfContactId = input.contactId;
  if (input.amount !== undefined) {
    body.amount = { amountMicros: Math.round((input.amount || 0) * MICROS), currencyCode: input.currency || "USD" };
  }
  return body;
}

async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${twentyBaseUrl()}${pathname}`, {
    ...init,
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twenty ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

interface MockDB {
  deals: Deal[];
  companies: Company[];
  people: Person[];
}

const g = globalThis as unknown as { __twentyMock?: MockDB };

function mockFile() {
  return path.join(dataDir(), "twenty-mock.json");
}

function seed(): MockDB {
  const now = new Date().toISOString();
  const companies: Company[] = [
    { id: "c_harbourside", name: "Harbourside Ventures", domain: "harbourside.vc", employees: 40 },
    { id: "c_meridian", name: "Meridian Logistics", domain: "meridianlog.com", employees: 220 },
    { id: "c_northwind", name: "Northwind Retail", domain: "northwind.store", employees: 85 },
    { id: "c_lumen", name: "Lumen Health", domain: "lumenhealth.io", employees: 130 },
  ];
  const people: Person[] = [
    { id: "p_amara", firstName: "Amara", lastName: "Okafor", email: "amara@harbourside.vc", companyId: "c_harbourside" },
    { id: "p_devlin", firstName: "Sam", lastName: "Devlin", email: "sam@meridianlog.com", companyId: "c_meridian" },
    { id: "p_chen", firstName: "Wei", lastName: "Chen", email: "wei@northwind.store", companyId: "c_northwind" },
    { id: "p_ruiz", firstName: "Elena", lastName: "Ruiz", email: "elena@lumenhealth.io", companyId: "c_lumen" },
  ];
  const deals: Deal[] = [
    mkSeed("d_hs", "Harbourside — Command Center rollout", 120000, "PROPOSAL", "c_harbourside", "Harbourside Ventures", "p_amara", "Amara Okafor", now, 24),
    mkSeed("d_mer", "Meridian — IoT fleet pilot", 68000, "MEETING", "c_meridian", "Meridian Logistics", "p_devlin", "Sam Devlin", now, 12),
    mkSeed("d_nw", "Northwind — Agent build retainer", 42000, "SCREENING", "c_northwind", "Northwind Retail", "p_chen", "Wei Chen", now, 40),
    mkSeed("d_lum", "Lumen — AI ops platform", 210000, "NEW", "c_lumen", "Lumen Health", "p_ruiz", "Elena Ruiz", now, 55),
    mkSeed("d_hs2", "Harbourside — Expansion (year 2)", 90000, "CUSTOMER", "c_harbourside", "Harbourside Ventures", "p_amara", "Amara Okafor", now, 5),
  ];
  return { companies, people, deals };
}

function mkSeed(id: string, name: string, amount: number, stage: DealStage, companyId: string, companyName: string, contactId: string, contactName: string, now: string, closeInDays: number): Deal {
  const close = new Date(Date.now() + closeInDays * 864e5).toISOString();
  return { id, name, amount, currency: "USD", stage, companyId, companyName, contactId, contactName, closeDate: close, createdAt: now, updatedAt: now };
}

function db(): MockDB {
  if (g.__twentyMock) return g.__twentyMock;
  let loaded: MockDB | null = null;
  try { loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8")); } catch { /* none yet */ }
  g.__twentyMock = loaded && loaded.deals ? loaded : seed();
  persist();
  return g.__twentyMock;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(mockFile(), JSON.stringify(g.__twentyMock, null, 2));
  } catch { /* read-only fs */ }
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function listDeals(opts: { limit?: number; stage?: string; search?: string } = {}): Promise<Deal[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  let deals: Deal[];
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/opportunities?limit=${limit}&depth=1`);
      const arr = unwrap<Record<string, unknown>[]>(json, "opportunities") || [];
      deals = Array.isArray(arr) ? arr.map(normDeal) : [];
    } catch { deals = db().deals.slice(); }
  } else { deals = db().deals.slice(); }
  if (opts.stage) deals = deals.filter((d) => d.stage === opts.stage!.toUpperCase());
  if (opts.search) {
    const q = opts.search.toLowerCase();
    deals = deals.filter((d) => d.name.toLowerCase().includes(q) || (d.companyName || "").toLowerCase().includes(q));
  }
  return deals.slice(0, limit);
}

export async function getDeal(id: string): Promise<Deal | null> {
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/opportunities/${id}?depth=1`);
      const o = unwrap<Record<string, unknown>>(json, "opportunity");
      return o && o.id ? normDeal(o) : null;
    } catch { /* mock */ }
  }
  return db().deals.find((d) => d.id === id) || null;
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const stage = normalizeStage(input.stage);
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/opportunities`, { method: "POST", body: JSON.stringify(dealToTwenty({ ...input, stage })) });
      const o = unwrap<Record<string, unknown>>(json, "createOpportunity");
      if (o && o.id) return normDeal(o);
    } catch { /* mock */ }
  }
  const store = db();
  const company = input.companyId ? store.companies.find((c) => c.id === input.companyId) : undefined;
  const contact = input.contactId ? store.people.find((p) => p.id === input.contactId) : undefined;
  const now = new Date().toISOString();
  const deal: Deal = {
    id: rid("d"), name: input.name, amount: input.amount ?? 0, currency: input.currency || "USD", stage,
    closeDate: input.closeDate ?? null, companyId: input.companyId ?? null, companyName: company?.name ?? null,
    contactId: input.contactId ?? null, contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
    createdAt: now, updatedAt: now,
  };
  store.deals.unshift(deal);
  persist();
  return deal;
}

export async function updateDeal(id: string, patch: Partial<DealInput>): Promise<Deal | null> {
  const stage = patch.stage ? normalizeStage(patch.stage) : undefined;
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(dealToTwenty({ ...patch, stage })) });
      const o = unwrap<Record<string, unknown>>(json, "updateOpportunity");
      if (o && o.id) return normDeal(o);
    } catch { /* mock */ }
  }
  const store = db();
  const deal = store.deals.find((d) => d.id === id);
  if (!deal) return null;
  if (patch.name !== undefined) deal.name = patch.name;
  if (patch.amount !== undefined) deal.amount = patch.amount;
  if (patch.currency !== undefined) deal.currency = patch.currency;
  if (stage !== undefined) deal.stage = stage;
  if (patch.closeDate !== undefined) deal.closeDate = patch.closeDate;
  deal.updatedAt = new Date().toISOString();
  persist();
  return deal;
}

export async function listCompanies(opts: { limit?: number; search?: string } = {}): Promise<Company[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  let companies: Company[];
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/companies?limit=${limit}`);
      const arr = unwrap<Record<string, unknown>[]>(json, "companies") || [];
      companies = Array.isArray(arr) ? arr.map(normCompany) : [];
    } catch { companies = db().companies.slice(); }
  } else { companies = db().companies.slice(); }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    companies = companies.filter((c) => c.name.toLowerCase().includes(q));
  }
  return companies.slice(0, limit);
}

export async function createCompany(input: { name: string; domain?: string; employees?: number }): Promise<Company> {
  if (twentyConfigured()) {
    try {
      const body: Record<string, unknown> = { name: input.name };
      if (input.domain) body.domainName = input.domain;
      if (input.employees) body.employees = input.employees;
      const json = await liveFetch(`/rest/companies`, { method: "POST", body: JSON.stringify(body) });
      const c = unwrap<Record<string, unknown>>(json, "createCompany");
      if (c && c.id) return normCompany(c);
    } catch { /* mock */ }
  }
  const store = db();
  const company: Company = { id: rid("c"), name: input.name, domain: input.domain ?? null, employees: input.employees ?? null };
  store.companies.unshift(company);
  persist();
  return company;
}

export async function listPeople(opts: { limit?: number; search?: string } = {}): Promise<Person[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  let people: Person[];
  if (twentyConfigured()) {
    try {
      const json = await liveFetch(`/rest/people?limit=${limit}`);
      const arr = unwrap<Record<string, unknown>[]>(json, "people") || [];
      people = Array.isArray(arr) ? arr.map(normPerson) : [];
    } catch { people = db().people.slice(); }
  } else { people = db().people.slice(); }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    people = people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }
  return people.slice(0, limit);
}

export async function createPerson(input: { firstName: string; lastName: string; email?: string; companyId?: string }): Promise<Person> {
  if (twentyConfigured()) {
    try {
      const body: Record<string, unknown> = { name: { firstName: input.firstName, lastName: input.lastName } };
      if (input.email) body.emails = { primaryEmail: input.email };
      if (input.companyId) body.companyId = input.companyId;
      const json = await liveFetch(`/rest/people`, { method: "POST", body: JSON.stringify(body) });
      const p = unwrap<Record<string, unknown>>(json, "createPerson");
      if (p && p.id) return normPerson(p);
    } catch { /* mock */ }
  }
  const store = db();
  const person: Person = { id: rid("p"), firstName: input.firstName, lastName: input.lastName, email: input.email ?? null, companyId: input.companyId ?? null };
  store.people.unshift(person);
  persist();
  return person;
}

function normCompany(c: Record<string, unknown>): Company {
  const domain = c.domainName as string | { primaryLinkUrl?: string } | undefined;
  return { id: String(c.id ?? ""), name: String(c.name ?? "Untitled"), domain: typeof domain === "string" ? domain : domain?.primaryLinkUrl ?? null, employees: (c.employees as number) ?? null };
}

function normPerson(p: Record<string, unknown>): Person {
  const name = p.name as { firstName?: string; lastName?: string } | undefined;
  const emails = p.emails as { primaryEmail?: string } | undefined;
  return { id: String(p.id ?? ""), firstName: name?.firstName ?? (p.firstName as string) ?? "", lastName: name?.lastName ?? (p.lastName as string) ?? "", email: emails?.primaryEmail ?? (p.email as string) ?? null, companyId: (p.companyId as string) ?? null };
}

export function normalizeStage(stage?: string): DealStage {
  if (!stage) return "NEW";
  const up = stage.toUpperCase().replace(/[^A-Z]/g, "");
  const match = DEAL_STAGES.find((s) => s === up || up.startsWith(s));
  return match || "NEW";
}

export async function pipelineSummary(): Promise<{ stage: DealStage; count: number; value: number }[]> {
  const deals = await listDeals({ limit: 200 });
  return DEAL_STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    return { stage, count: inStage.length, value: inStage.reduce((sum, d) => sum + d.amount, 0) };
  });
}

export const CRM_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  { name: "crm_list_deals", description: "List deals (opportunities) in the CRM pipeline, newest first. Optionally filter by stage or search text.", parameters: { type: "object", properties: { stage: { type: "string", enum: [...DEAL_STAGES], description: "Filter to one pipeline stage" }, search: { type: "string", description: "Match deal name or company" }, limit: { type: "number", description: "Max results (default 50)" } } } },
  { name: "crm_get_deal", description: "Get one deal by its id, including amount, stage, company and contact.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "crm_create_deal", description: "Create a new deal (opportunity) in the CRM. Use after Sales closes or opens an opportunity.", parameters: { type: "object", properties: { name: { type: "string", description: "Deal name, e.g. 'Acme — platform rollout'" }, amount: { type: "number", description: "Deal value in whole currency units (e.g. 50000)" }, currency: { type: "string", description: "ISO currency code, default USD" }, stage: { type: "string", enum: [...DEAL_STAGES] }, closeDate: { type: "string", description: "Expected close date, ISO (YYYY-MM-DD)" }, companyId: { type: "string", description: "Existing company id to link" }, contactId: { type: "string", description: "Existing person id as point of contact" } }, required: ["name"] } },
  { name: "crm_update_deal", description: "Update a deal — e.g. move it to a new stage, change the amount, or set a close date.", parameters: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, amount: { type: "number" }, currency: { type: "string" }, stage: { type: "string", enum: [...DEAL_STAGES] }, closeDate: { type: "string" } }, required: ["id"] } },
  { name: "crm_list_companies", description: "List companies (accounts) in the CRM.", parameters: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" } } } },
  { name: "crm_create_company", description: "Create a company (account) in the CRM.", parameters: { type: "object", properties: { name: { type: "string" }, domain: { type: "string" }, employees: { type: "number" } }, required: ["name"] } },
  { name: "crm_list_people", description: "List people (contacts) in the CRM.", parameters: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" } } } },
  { name: "crm_create_person", description: "Create a person (contact) in the CRM, optionally linked to a company.", parameters: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, companyId: { type: "string" } }, required: ["firstName", "lastName"] } },
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);

export async function runCrmTool(name: string, args: Record<string, unknown>): Promise<string> {
  const status = twentyConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source: status, data });
  try {
    switch (name) {
      case "crm_list_deals":
        return wrap(await listDeals({ stage: s(args.stage), search: s(args.search), limit: n(args.limit) }));
      case "crm_get_deal": {
        const deal = await getDeal(s(args.id) || "");
        return deal ? wrap(deal) : JSON.stringify({ ok: false, error: "deal not found" });
      }
      case "crm_create_deal":
        return wrap(await createDeal({ name: s(args.name) || "New deal", amount: n(args.amount), currency: s(args.currency), stage: s(args.stage), closeDate: s(args.closeDate) ?? null, companyId: s(args.companyId) ?? null, contactId: s(args.contactId) ?? null }));
      case "crm_update_deal": {
        const updated = await updateDeal(s(args.id) || "", { name: s(args.name), amount: n(args.amount), currency: s(args.currency), stage: s(args.stage), closeDate: s(args.closeDate) });
        return updated ? wrap(updated) : JSON.stringify({ ok: false, error: "deal not found" });
      }
      case "crm_list_companies":
        return wrap(await listCompanies({ search: s(args.search), limit: n(args.limit) }));
      case "crm_create_company":
        return wrap(await createCompany({ name: s(args.name) || "New company", domain: s(args.domain), employees: n(args.employees) }));
      case "crm_list_people":
        return wrap(await listPeople({ search: s(args.search), limit: n(args.limit) }));
      case "crm_create_person":
        return wrap(await createPerson({ firstName: s(args.firstName) || "New", lastName: s(args.lastName) || "Contact", email: s(args.email), companyId: s(args.companyId) }));
      default:
        return JSON.stringify({ ok: false, error: `unknown crm tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}
