// Bigcapital integration (https://github.com/bigcapitalhq/bigcapital).
//
// Bigcapital is an open-source double-entry accounting platform. We talk to its
// Core REST API for the Finance team:
//   GET/POST   {base}/api/sale-invoices        list / create invoices (AR)
//   GET/POST   {base}/api/bills                 list / create bills (AP)
//   GET/POST   {base}/api/payments-received     payments in
//   GET/POST   {base}/api/payments-made         payments out
// Auth is a Bearer API key ("bc_…") created in Bigcapital settings; a JWT token
// additionally needs an `organization-id` header.
//
// When no instance is configured we fall back to a seeded in-memory mock store
// (persisted to data/) so the Finance agents and the Finance page work locally.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const INVOICE_STATES = ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE"] as const;
export type InvoiceState = (typeof INVOICE_STATES)[number];
export const BILL_STATES = ["OPEN", "APPROVED", "PAID"] as const;
export type BillState = (typeof BILL_STATES)[number];

export interface Invoice {
  id: string; invoiceNo: string; customerId: string | null; customerName: string;
  amount: number; currency: string; status: InvoiceState; issueDate: string;
  dueDate: string | null; createdAt: string; updatedAt: string;
}
export interface Bill {
  id: string; billNo: string; vendorId: string | null; vendorName: string;
  amount: number; currency: string; status: BillState; issueDate: string;
  dueDate: string | null; createdAt: string; updatedAt: string;
}
export interface Payment {
  id: string; type: "received" | "made"; party: string; amount: number; currency: string;
  date: string; reference: string | null; invoiceId?: string | null; billId?: string | null; reconciled: boolean;
}
export interface Account {
  id: string; name: string; code: string; type: string; normal: "debit" | "credit"; currency: string; balance: number;
}
export interface FinanceSummary {
  currency: string; cash: number; arOutstanding: number; apOwed: number; overdueCount: number;
  revenue: number; expenses: number; net: number; unreconciled: number;
}

const DEFAULT_CLOUD = "https://api.bigcapital.com";
export function bigcapitalBaseUrl(): string {
  const raw = getSecret("BIGCAPITAL_API_URL") || process.env.BIGCAPITAL_API_URL || DEFAULT_CLOUD;
  return raw.replace(/\/+$/, "");
}
export function bigcapitalApiKey(): string | undefined { return getSecret("BIGCAPITAL_API_KEY"); }
export function bigcapitalConfigured(): boolean { return Boolean(bigcapitalApiKey()); }
export function bigcapitalAppUrl(): string | undefined {
  const explicit = getSecret("BIGCAPITAL_APP_URL") || process.env.BIGCAPITAL_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = bigcapitalBaseUrl();
  if (!api) return undefined;
  if (api.includes("//api.")) return api.replace("//api.", "//app.");
  if (api.includes("api.bigcapital.com")) return "https://app.bigcapital.com";
  return api;
}
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${bigcapitalApiKey()}` };
  const org = getSecret("BIGCAPITAL_ORG_ID");
  if (org) h["organization-id"] = org;
  return h;
}
export interface BooksStatus {
  mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string;
}
export async function booksStatus(): Promise<BooksStatus> {
  const hasKey = bigcapitalConfigured();
  const baseUrl = bigcapitalBaseUrl();
  const appUrl = bigcapitalAppUrl();
  if (!hasKey) return { mode: "mock", baseUrl, appUrl, hasKey: false, reason: "No API key — using local mock books" };
  try {
    const res = await fetch(`${baseUrl}/api/sale-invoices?page=1&page_size=1`, { headers: authHeaders(), signal: AbortSignal.timeout(6000) });
    if (res.ok) return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, hasKey: true, reachable: false, reason: String(e).slice(0, 80) };
  }
}
async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${bigcapitalBaseUrl()}${pathname}`, { ...init, headers: authHeaders(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bigcapital ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}
interface MockDB { invoices: Invoice[]; bills: Bill[]; payments: Payment[]; accounts?: Account[]; }
const g = globalThis as unknown as { __bigcapitalMock?: MockDB };
function mockFile() { return path.join(dataDir(), "bigcapital-mock.json"); }
function iso(daysFromNow: number): string { return new Date(Date.now() + daysFromNow * 864e5).toISOString(); }
function seed(): MockDB {
  const now = new Date().toISOString();
  const invoices: Invoice[] = [
    mkInv("inv_1041", "INV-1041", "Harbourside Ventures", 24000, "PAID", -20, -5, now),
    mkInv("inv_1042", "INV-1042", "Meridian Logistics", 13600, "SENT", -6, 9, now),
    mkInv("inv_1043", "INV-1043", "Northwind Retail", 8400, "PARTIAL", -3, 12, now),
    mkInv("inv_1044", "INV-1044", "Lumen Health", 42000, "SENT", -1, 21, now),
    mkInv("inv_1045", "INV-1045", "Harbourside Ventures", 18000, "OVERDUE", -35, -6, now),
    mkInv("inv_1046", "INV-1046", "Meridian Logistics", 9500, "DRAFT", 0, 30, now),
  ];
  const bills: Bill[] = [
    mkBill("bill_501", "BILL-501", "AWS", 4200, "PAID", -18, -4, now),
    mkBill("bill_502", "BILL-502", "Figma", 720, "APPROVED", -6, 8, now),
    mkBill("bill_503", "BILL-503", "Contractor — Ada Lin", 6800, "OPEN", -2, 12, now),
    mkBill("bill_504", "BILL-504", "OpenAI", 1300, "OPEN", -1, 14, now),
  ];
  const payments: Payment[] = [
    mkPay("pay_9001", "received", "Harbourside Ventures", 24000, -5, "INV-1041", "inv_1041", null, true),
    mkPay("pay_9002", "received", "Northwind Retail", 4200, -3, "INV-1043 (partial)", "inv_1043", null, false),
    mkPay("pay_9003", "made", "AWS", 4200, -4, "BILL-501", null, "bill_501", true),
  ];
  return { invoices, bills, payments, accounts: seedAccounts() };
}
function seedAccounts(): Account[] {
  const mk = (id: string, code: string, name: string, type: string, normal: "debit" | "credit", balance: number): Account =>
    ({ id, code, name, type, normal, currency: "USD", balance });
  return [
    mk("acc_ap", "20001", "Accounts Payable (A/P)", "Accounts Payable", "credit", 8820),
    mk("acc_ar", "10007", "Accounts Receivable (A/R)", "Accounts Receivable", "debit", 82000),
    mk("acc_bank", "10001", "Bank Account", "Bank", "debit", 37600),
    mk("acc_bankfees", "40006", "Bank Fees and Charges", "Expense", "debit", 1200),
    mk("acc_computers", "10005", "Computer Equipment", "Fixed Asset", "debit", 12000),
    mk("acc_cogs", "40002", "Cost of Goods Sold", "Cost of Goods Sold", "debit", 0),
    mk("acc_depr", "40007", "Depreciation Expense", "Expense", "debit", 0),
    mk("acc_office", "10006", "Office Equipment", "Fixed Asset", "debit", 9500),
    mk("acc_officeexp", "40003", "Office Expenses", "Expense", "debit", 3400),
    mk("acc_sales", "30001", "Sales Income", "Income", "credit", 121000),
    mk("acc_opening", "30002", "Opening Balance Equity", "Equity", "credit", 25000),
    mk("acc_retained", "30003", "Retained Earnings", "Equity", "credit", 0),
  ];
}
function mkInv(id: string, no: string, customer: string, amount: number, status: InvoiceState, issued: number, due: number, now: string): Invoice {
  return { id, invoiceNo: no, customerId: null, customerName: customer, amount, currency: "USD", status, issueDate: iso(issued), dueDate: iso(due), createdAt: now, updatedAt: now };
}
function mkBill(id: string, no: string, vendor: string, amount: number, status: BillState, issued: number, due: number, now: string): Bill {
  return { id, billNo: no, vendorId: null, vendorName: vendor, amount, currency: "USD", status, issueDate: iso(issued), dueDate: iso(due), createdAt: now, updatedAt: now };
}
function mkPay(id: string, type: "received" | "made", party: string, amount: number, date: number, reference: string, invoiceId: string | null, billId: string | null, reconciled: boolean): Payment {
  return { id, type, party, amount, currency: "USD", date: iso(date), reference, invoiceId, billId, reconciled };
}
function db(): MockDB {
  if (g.__bigcapitalMock) return g.__bigcapitalMock;
  let loaded: MockDB | null = null;
  try { loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8")); } catch { /* none yet */ }
  g.__bigcapitalMock = loaded && loaded.invoices ? loaded : seed();
  if (!g.__bigcapitalMock.accounts) g.__bigcapitalMock.accounts = seedAccounts();
  persist();
  return g.__bigcapitalMock;
}
function persist() {
  try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(mockFile(), JSON.stringify(g.__bigcapitalMock, null, 2)); } catch { /* read-only fs */ }
}
function rid(prefix: string): string { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function withDerivedStatus(inv: Invoice): Invoice {
  if ((inv.status === "SENT" || inv.status === "PARTIAL") && inv.dueDate && new Date(inv.dueDate).getTime() < Date.now()) {
    return { ...inv, status: "OVERDUE" };
  }
  return inv;
}
function unwrapArray<T>(json: unknown, ...keys: string[]): T[] {
  const j = json as Record<string, unknown>;
  for (const key of keys) { if (Array.isArray(j?.[key])) return j[key] as T[]; }
  const data = j?.data as Record<string, unknown> | undefined;
  if (data) {
    for (const key of keys) { if (Array.isArray(data[key])) return data[key] as T[]; }
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}
function normInvoice(o: Record<string, unknown>): Invoice {
  const now = new Date().toISOString();
  const paid = Boolean(o.is_fully_paid ?? o.isFullyPaid);
  const delivered = Boolean(o.is_delivered ?? o.delivered);
  const balance = Number(o.balance ?? o.due_amount ?? 0);
  const total = Number(o.total ?? o.amount ?? o.balance ?? 0);
  let status: InvoiceState = "DRAFT";
  if (paid) status = "PAID";
  else if (balance > 0 && balance < total) status = "PARTIAL";
  else if (delivered) status = "SENT";
  return {
    id: String(o.id ?? ""), invoiceNo: String(o.invoice_no ?? o.invoiceNo ?? o.id ?? ""),
    customerId: (o.customer_id as string) ?? null,
    customerName: String((o.customer as { display_name?: string })?.display_name ?? o.customer_name ?? "Customer"),
    amount: total, currency: String(o.currency_code ?? "USD"), status,
    issueDate: String(o.invoice_date ?? now), dueDate: (o.due_date as string) ?? null,
    createdAt: String(o.created_at ?? now), updatedAt: String(o.updated_at ?? now),
  };
}
export async function listInvoices(opts: { status?: string; search?: string; limit?: number } = {}): Promise<Invoice[]> {
  const limit = Math.min(opts.limit ?? 100, 300);
  let invoices: Invoice[];
  if (bigcapitalConfigured()) {
    try { const json = await liveFetch(`/api/sale-invoices?page_size=${limit}`); invoices = unwrapArray<Record<string, unknown>>(json, "sale_invoices").map(normInvoice); }
    catch { invoices = db().invoices.slice(); }
  } else { invoices = db().invoices.slice(); }
  invoices = invoices.map(withDerivedStatus);
  if (opts.status) invoices = invoices.filter((i) => i.status === opts.status!.toUpperCase());
  if (opts.search) {
    const q = opts.search.toLowerCase();
    invoices = invoices.filter((i) => i.customerName.toLowerCase().includes(q) || i.invoiceNo.toLowerCase().includes(q));
  }
  return invoices.slice(0, limit);
}
export async function getInvoice(id: string): Promise<Invoice | null> {
  return (await listInvoices({ limit: 300 })).find((i) => i.id === id) || null;
}
export async function createInvoice(input: { customerName: string; amount: number; currency?: string; dueDate?: string | null; issueDate?: string | null; status?: string; invoiceNo?: string }): Promise<Invoice> {
  const status = normalizeInvoiceState(input.status) || "SENT";
  if (bigcapitalConfigured()) {
    try {
      const json = await liveFetch(`/api/sale-invoices`, { method: "POST", body: JSON.stringify({ customer_name: input.customerName, invoice_date: input.issueDate || new Date().toISOString(), due_date: input.dueDate || iso(30), delivered: status !== "DRAFT", entries: [{ description: input.customerName, quantity: 1, rate: input.amount }] }) });
      const o = (json as { data?: Record<string, unknown> })?.data ?? (json as Record<string, unknown>);
      if (o && o.id) return normInvoice(o as Record<string, unknown>);
    } catch { /* mock */ }
  }
  const store = db();
  const now = new Date().toISOString();
  const inv: Invoice = { id: rid("inv"), invoiceNo: input.invoiceNo || `INV-${1047 + store.invoices.length}`, customerId: null, customerName: input.customerName, amount: input.amount, currency: input.currency || "USD", status, issueDate: input.issueDate || now, dueDate: input.dueDate ?? iso(30), createdAt: now, updatedAt: now };
  store.invoices.unshift(inv); persist(); return inv;
}
export async function updateInvoice(id: string, patch: { status?: string; amount?: number; dueDate?: string }): Promise<Invoice | null> {
  const store = db();
  const inv = store.invoices.find((i) => i.id === id);
  if (!inv) return null;
  if (patch.status) inv.status = normalizeInvoiceState(patch.status) || inv.status;
  if (patch.amount !== undefined) inv.amount = patch.amount;
  if (patch.dueDate !== undefined) inv.dueDate = patch.dueDate;
  inv.updatedAt = new Date().toISOString();
  if (inv.status === "PAID" && !store.payments.some((p) => p.invoiceId === inv.id && p.type === "received" && p.amount >= inv.amount)) {
    store.payments.unshift(mkPay(rid("pay"), "received", inv.customerName, inv.amount, 0, inv.invoiceNo, inv.id, null, false));
  }
  persist(); return inv;
}
export async function listBills(opts: { status?: string; search?: string; limit?: number } = {}): Promise<Bill[]> {
  const limit = Math.min(opts.limit ?? 100, 300);
  let bills = db().bills.slice();
  if (bigcapitalConfigured()) {
    try {
      const json = await liveFetch(`/api/bills?page_size=${limit}`);
      const arr = unwrapArray<Record<string, unknown>>(json, "bills");
      if (arr.length) {
        const now = new Date().toISOString();
        bills = arr.map((o) => ({
          id: String(o.id ?? ""), billNo: String(o.bill_number ?? o.bill_no ?? o.id ?? ""),
          vendorId: (o.vendor_id as string) ?? null,
          vendorName: String((o.vendor as { display_name?: string })?.display_name ?? o.vendor_name ?? "Vendor"),
          amount: Number(o.total ?? o.amount ?? 0), currency: String(o.currency_code ?? "USD"),
          status: (Boolean(o.is_fully_paid) ? "PAID" : Boolean(o.is_open ?? o.open) ? "OPEN" : "APPROVED") as BillState,
          issueDate: String(o.bill_date ?? now), dueDate: (o.due_date as string) ?? null,
          createdAt: String(o.created_at ?? now), updatedAt: String(o.updated_at ?? now),
        }));
      }
    } catch { /* mock */ }
  }
  if (opts.status) bills = bills.filter((b) => b.status === opts.status!.toUpperCase());
  if (opts.search) {
    const q = opts.search.toLowerCase();
    bills = bills.filter((b) => b.vendorName.toLowerCase().includes(q) || b.billNo.toLowerCase().includes(q));
  }
  return bills.slice(0, limit);
}
export async function createBill(input: { vendorName: string; amount: number; currency?: string; dueDate?: string | null; status?: string; billNo?: string }): Promise<Bill> {
  const store = db();
  const now = new Date().toISOString();
  const bill: Bill = { id: rid("bill"), billNo: input.billNo || `BILL-${505 + store.bills.length}`, vendorId: null, vendorName: input.vendorName, amount: input.amount, currency: input.currency || "USD", status: normalizeBillState(input.status) || "OPEN", issueDate: now, dueDate: input.dueDate ?? iso(21), createdAt: now, updatedAt: now };
  store.bills.unshift(bill); persist(); return bill;
}
export async function updateBill(id: string, patch: { status?: string }): Promise<Bill | null> {
  const store = db();
  const bill = store.bills.find((b) => b.id === id);
  if (!bill) return null;
  if (patch.status) bill.status = normalizeBillState(patch.status) || bill.status;
  bill.updatedAt = new Date().toISOString();
  if (bill.status === "PAID" && !store.payments.some((p) => p.billId === bill.id && p.type === "made")) {
    store.payments.unshift(mkPay(rid("pay"), "made", bill.vendorName, bill.amount, 0, bill.billNo, null, bill.id, false));
  }
  persist(); return bill;
}
export async function listPayments(opts: { type?: "received" | "made"; limit?: number } = {}): Promise<Payment[]> {
  let payments = db().payments.slice();
  if (bigcapitalConfigured()) {
    try {
      const [recJson, madeJson] = await Promise.all([liveFetch(`/api/payments-received?page_size=200`), liveFetch(`/api/payments-made?page_size=200`)]);
      const rec = unwrapArray<Record<string, unknown>>(recJson, "payment_receives", "payments_received", "paymentReceives").map((o) => normPayment(o, "received"));
      const made = unwrapArray<Record<string, unknown>>(madeJson, "payment_mades", "payments_made", "billPayments", "paymentMades").map((o) => normPayment(o, "made"));
      const merged = [...rec, ...made].sort((a, b) => (a.date < b.date ? 1 : -1));
      if (merged.length) payments = merged;
    } catch { /* mock */ }
  }
  if (opts.type) payments = payments.filter((p) => p.type === opts.type);
  return payments.slice(0, Math.min(opts.limit ?? 100, 300));
}
function normPayment(o: Record<string, unknown>, type: "received" | "made"): Payment {
  const now = new Date().toISOString();
  const party = (o.customer as { display_name?: string })?.display_name ?? (o.vendor as { display_name?: string })?.display_name ?? o.customer_name ?? o.vendor_name ?? "Party";
  return { id: String(o.id ?? ""), type, party: String(party), amount: Number(o.amount ?? o.total ?? 0), currency: String(o.currency_code ?? "USD"), date: String(o.payment_date ?? o.date ?? now), reference: (o.reference_no as string) ?? (o.reference as string) ?? null, invoiceId: null, billId: null, reconciled: Boolean(o.is_reconciled ?? o.reconciled ?? false) };
}
export async function listAccounts(opts: { search?: string; limit?: number } = {}): Promise<Account[]> {
  let accounts = (db().accounts ?? []).slice();
  if (bigcapitalConfigured()) {
    try {
      const json = await liveFetch(`/api/accounts`);
      const arr = unwrapArray<Record<string, unknown>>(json, "accounts");
      if (arr.length) {
        accounts = arr.map((o) => ({
          id: String(o.id ?? ""), name: String(o.name ?? o.account_name ?? ""), code: String(o.code ?? o.slug ?? ""),
          type: String((o.account_type as { label?: string })?.label ?? o.account_type ?? o.account_type_label ?? ""),
          normal: (String(o.account_normal ?? o.normal ?? "debit").toLowerCase() === "credit" ? "credit" : "debit") as "debit" | "credit",
          currency: String(o.currency_code ?? "USD"), balance: Number(o.amount ?? o.balance ?? 0),
        }));
      }
    } catch { /* mock */ }
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    accounts = accounts.filter((a) => a.name.toLowerCase().includes(q) || a.code.includes(q) || a.type.toLowerCase().includes(q));
  }
  return accounts.slice(0, Math.min(opts.limit ?? 200, 500));
}
export async function recordPayment(input: { type: "received" | "made"; party: string; amount: number; reference?: string; invoiceId?: string | null; billId?: string | null; date?: string }): Promise<Payment> {
  const store = db();
  const pay: Payment = { id: rid("pay"), type: input.type, party: input.party, amount: input.amount, currency: "USD", date: input.date || new Date().toISOString(), reference: input.reference ?? null, invoiceId: input.invoiceId ?? null, billId: input.billId ?? null, reconciled: false };
  store.payments.unshift(pay); persist(); return pay;
}
export async function reconcilePayment(id?: string): Promise<Payment | null> {
  const store = db();
  const pay = id ? store.payments.find((p) => p.id === id) : store.payments.find((p) => !p.reconciled);
  if (!pay) return null;
  pay.reconciled = true; persist(); return pay;
}
export async function financeSummary(): Promise<FinanceSummary> {
  const [invoices, bills, payments] = await Promise.all([listInvoices({ limit: 300 }), listBills({ limit: 300 }), listPayments({ limit: 300 })]);
  const received = payments.filter((p) => p.type === "received").reduce((a, b) => a + b.amount, 0);
  const made = payments.filter((p) => p.type === "made").reduce((a, b) => a + b.amount, 0);
  const arOutstanding = invoices.filter((i) => i.status !== "PAID" && i.status !== "DRAFT").reduce((a, b) => a + b.amount, 0);
  const apOwed = bills.filter((b) => b.status !== "PAID").reduce((a, b) => a + b.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const revenue = invoices.filter((i) => i.status !== "DRAFT").reduce((a, b) => a + b.amount, 0);
  const expenses = bills.reduce((a, b) => a + b.amount, 0);
  return { currency: "USD", cash: received - made, arOutstanding, apOwed, overdueCount, revenue, expenses, net: revenue - expenses, unreconciled: payments.filter((p) => !p.reconciled).length };
}
export function normalizeInvoiceState(s?: string): InvoiceState | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase().replace(/[^A-Z]/g, "");
  return INVOICE_STATES.find((x) => x === up || up.startsWith(x));
}
export function normalizeBillState(s?: string): BillState | undefined {
  if (!s) return undefined;
  const up = s.toUpperCase().replace(/[^A-Z]/g, "");
  return BILL_STATES.find((x) => x === up || up.startsWith(x));
}
export const FINANCE_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  { name: "finance_summary", description: "Get the books summary — cash position, AR outstanding, AP owed, overdue count, revenue, expenses, net, and unreconciled payments.", parameters: { type: "object", properties: {} } },
  { name: "finance_list_invoices", description: "List sales invoices (AR). Optionally filter by status (DRAFT/SENT/PARTIAL/PAID/OVERDUE) or search customer/number.", parameters: { type: "object", properties: { status: { type: "string", enum: [...INVOICE_STATES] }, search: { type: "string" }, limit: { type: "number" } } } },
  { name: "finance_create_invoice", description: "Raise a new sales invoice for a customer.", parameters: { type: "object", properties: { customerName: { type: "string" }, amount: { type: "number", description: "Invoice total in whole currency units" }, currency: { type: "string" }, dueDate: { type: "string", description: "ISO date" }, status: { type: "string", enum: [...INVOICE_STATES] } }, required: ["customerName", "amount"] } },
  { name: "finance_update_invoice", description: "Update an invoice — e.g. mark it PAID, change amount or due date.", parameters: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: [...INVOICE_STATES] }, amount: { type: "number" }, dueDate: { type: "string" } }, required: ["id"] } },
  { name: "finance_list_bills", description: "List vendor bills (AP). Optionally filter by status (OPEN/APPROVED/PAID) or search vendor/number.", parameters: { type: "object", properties: { status: { type: "string", enum: [...BILL_STATES] }, search: { type: "string" }, limit: { type: "number" } } } },
  { name: "finance_create_bill", description: "Record a new vendor bill (a payable).", parameters: { type: "object", properties: { vendorName: { type: "string" }, amount: { type: "number" }, currency: { type: "string" }, dueDate: { type: "string" }, status: { type: "string", enum: [...BILL_STATES] } }, required: ["vendorName", "amount"] } },
  { name: "finance_update_bill", description: "Update a bill — e.g. APPROVE it or mark it PAID.", parameters: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: [...BILL_STATES] } }, required: ["id"] } },
  { name: "finance_list_payments", description: "List payments (money in and out). Optionally filter by type.", parameters: { type: "object", properties: { type: { type: "string", enum: ["received", "made"] }, limit: { type: "number" } } } },
  { name: "finance_record_payment", description: "Record a payment received (from a customer) or made (to a vendor).", parameters: { type: "object", properties: { type: { type: "string", enum: ["received", "made"] }, party: { type: "string", description: "Customer or vendor name" }, amount: { type: "number" }, reference: { type: "string" }, invoiceId: { type: "string" }, billId: { type: "string" } }, required: ["type", "party", "amount"] } },
  { name: "finance_reconcile", description: "Reconcile a payment (match a bank line to an invoice/bill). Reconciles the next unreconciled payment if no id is given.", parameters: { type: "object", properties: { id: { type: "string" } } } },
  { name: "finance_list_accounts", description: "List the chart of accounts (name, code, type, normal balance, and balance).", parameters: { type: "object", properties: { search: { type: "string" }, limit: { type: "number" } } } },
];
const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);
export async function booksDiagnostics(): Promise<{ mode: "live" | "mock"; baseUrl: string; probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[]; }> {
  const baseUrl = bigcapitalBaseUrl();
  if (!bigcapitalConfigured()) {
    return { mode: "mock", baseUrl, probes: [{ endpoint: "(none)", ok: false, error: "No API key — set one in Settings → Connectors → Finance" }] };
  }
  const endpoints = [
    { path: "/api/sale-invoices?page_size=1", keys: ["sale_invoices"] },
    { path: "/api/bills?page_size=1", keys: ["bills"] },
    { path: "/api/payments-received?page_size=1", keys: ["payment_receives", "payments_received"] },
    { path: "/api/payments-made?page_size=1", keys: ["payment_mades", "payments_made", "bill_payments"] },
    { path: "/api/accounts", keys: ["accounts"] },
  ];
  const probes = await Promise.all(endpoints.map(async (e) => {
    try {
      const res = await fetch(`${baseUrl}${e.path}`, { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { endpoint: e.path, ok: false, status: res.status };
      const json = await res.json();
      const arr = unwrapArray<Record<string, unknown>>(json, ...e.keys);
      return { endpoint: e.path, ok: true, status: res.status, count: arr.length, sampleFields: arr[0] ? Object.keys(arr[0]).slice(0, 20) : [] };
    } catch (err) { return { endpoint: e.path, ok: false, error: String(err).slice(0, 100) }; }
  }));
  return { mode: "live", baseUrl, probes };
}
export async function runFinanceTool(name: string, args: Record<string, unknown>): Promise<string> {
  const source = bigcapitalConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source, data });
  try {
    switch (name) {
      case "finance_summary": return wrap(await financeSummary());
      case "finance_list_invoices": return wrap(await listInvoices({ status: s(args.status), search: s(args.search), limit: n(args.limit) }));
      case "finance_create_invoice": return wrap(await createInvoice({ customerName: s(args.customerName) || "Customer", amount: n(args.amount) || 0, currency: s(args.currency), dueDate: s(args.dueDate) ?? null, status: s(args.status) }));
      case "finance_update_invoice": { const inv = await updateInvoice(s(args.id) || "", { status: s(args.status), amount: n(args.amount), dueDate: s(args.dueDate) }); return inv ? wrap(inv) : JSON.stringify({ ok: false, error: "invoice not found" }); }
      case "finance_list_bills": return wrap(await listBills({ status: s(args.status), search: s(args.search), limit: n(args.limit) }));
      case "finance_create_bill": return wrap(await createBill({ vendorName: s(args.vendorName) || "Vendor", amount: n(args.amount) || 0, currency: s(args.currency), dueDate: s(args.dueDate) ?? null, status: s(args.status) }));
      case "finance_update_bill": { const bill = await updateBill(s(args.id) || "", { status: s(args.status) }); return bill ? wrap(bill) : JSON.stringify({ ok: false, error: "bill not found" }); }
      case "finance_list_payments": return wrap(await listPayments({ type: s(args.type) as "received" | "made" | undefined, limit: n(args.limit) }));
      case "finance_record_payment": return wrap(await recordPayment({ type: (s(args.type) as "received" | "made") || "received", party: s(args.party) || "Party", amount: n(args.amount) || 0, reference: s(args.reference), invoiceId: s(args.invoiceId) ?? null, billId: s(args.billId) ?? null }));
      case "finance_reconcile": { const pay = await reconcilePayment(s(args.id)); return pay ? wrap(pay) : JSON.stringify({ ok: false, error: "nothing to reconcile" }); }
      case "finance_list_accounts": return wrap(await listAccounts({ search: s(args.search), limit: n(args.limit) }));
      default: return JSON.stringify({ ok: false, error: `unknown finance tool ${name}` });
    }
  } catch (e) { return JSON.stringify({ ok: false, error: String(e).slice(0, 160) }); }
}
