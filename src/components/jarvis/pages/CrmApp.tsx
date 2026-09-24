"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultCrmTaxonomy, seedContacts, type JarvisContact } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";
import { useJarvisHub } from "../useJarvisHub";

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

export function CrmApp() {
  const { hub } = useJarvisHub();
  const taxonomy = hub?.crm ?? defaultCrmTaxonomy();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    fetch("/api/crm")
      .then((r) => {
        if (!r.ok) throw new Error("CRM unavailable");
        return r.json();
      })
      .then((d) => setPeople(d.people || []))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const rows = useMemo(() => mergeContacts(people), [people]);
  const categories = ["All", ...new Set([...taxonomy.categories, ...rows.map((r) => r.category)])];
  const shown = rows.filter((r) => {
    if (cat !== "All" && r.category !== cat) return false;
    if (status !== "All" && r.status !== status) return false;
    if (!q.trim()) return true;
    return `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase());
  });

  const withEmail = rows.filter((r) => r.email).length;

  return (
    <div className="px-5 py-6">
      <p className="text-[13px] text-ink-soft">People you’ve connected with.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Stat label="Total contacts" value={rows.length} />
        <Stat label="Active" value={rows.filter((r) => r.status === "Active").length} />
        <Stat label="With email" value={withEmail} />
        <Stat label="Categories" value={new Set(rows.map((r) => r.category)).size} />
        <Stat label="Pending review" value={0} />
      </div>
      {error ? <p className="mt-3 text-[12px] text-marketing">{error} — showing the local deck.</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-lg border border-line bg-panel px-2 py-2 text-[12px]"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-line bg-panel px-2 py-2 text-[12px]"
        >
          <option>All</option>
          {taxonomy.statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 overflow-x-auto hud-panel">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="text-[10px] uppercase tracking-wide text-ink-soft">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Labels</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Last engagement</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                  No connections match that filter.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", labelTone(r.label))}>
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{r.category}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(r.lastEngagement).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hud-panel px-3 py-3">
      <p className="hud-label">{label}</p>
      <p className="serif mt-2 text-[28px] font-semibold">{value}</p>
    </div>
  );
}

function mergeContacts(people: Person[]): JarvisContact[] {
  const seed = seedContacts();
  const extras: JarvisContact[] = people
    .filter((p) => !seed.some((s) => s.email && p.email && s.email === p.email))
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email || "",
      label: "new-lead",
      category: "Lead",
      status: "Active",
      lastEngagement: Date.now() - 86400000,
    }));
  return [...seed, ...extras];
}

function labelTone(label: string) {
  if (label === "engaged" || label === "referral-source") return "bg-emails/15 text-emails";
  if (label === "new-lead") return "bg-ops/15 text-ops";
  return "bg-marketing/15 text-marketing";
}
