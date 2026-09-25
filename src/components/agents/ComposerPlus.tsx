"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Paperclip, Plus, Plug, Search, Upload } from "lucide-react";
import { MCP_CATALOG } from "@/lib/mcp-catalog";
import { McpBrowse, type McpCatalogRow } from "@/components/settings/McpBrowse";

interface SkillInfo { name: string; description?: string }
interface BrainNode { title: string; path: string }

const EMPTY_CATALOG: McpCatalogRow[] = MCP_CATALOG.map((item) => ({ ...item, enabled: false }));

export function ComposerPlus({
  skills,
  onPickSkill,
  onAttachBrain,
  onAttachLocal,
}: {
  skills: SkillInfo[];
  onPickSkill: (name: string) => void;
  onAttachBrain: (file: { title: string; path: string }) => void;
  onAttachLocal: (file: File) => void;
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<BrainNode[]>([]);
  const [fileQ, setFileQ] = useState("");
  const [skillQ, setSkillQ] = useState("");
  const [catalog, setCatalog] = useState<McpCatalogRow[]>(EMPTY_CATALOG);
  const [busyId, setBusyId] = useState<string | null>(null);

  function close() {
    if (rootRef.current) rootRef.current.open = false;
  }

  const loaded = useRef(false);
  function ensureLoaded() {
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/brain")
      .then((r) => r.json())
      .then((d) => setFiles((d.nodes || []).map((n: BrainNode) => ({ title: n.title, path: n.path }))))
      .catch(() => setFiles([]));
    fetch("/api/settings/connectors")
      .then((r) => r.json())
      .then((d) => { if (d.catalog?.length) setCatalog(d.catalog); })
      .catch(() => {});
  }

  async function enable(item: McpCatalogRow) {
    setBusyId(item.id);
    setCatalog((rows) => rows.map((r) => (r.id === item.id ? { ...r, enabled: true } : r)));
    await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name, transport: item.transport, target: item.command }),
    });
    const d = await fetch("/api/settings/connectors").then((r) => r.json()).catch(() => null);
    if (d?.catalog?.length) setCatalog(d.catalog);
    setBusyId(null);
  }

  async function disable(item: McpCatalogRow) {
    setBusyId(item.id);
    setCatalog((rows) => rows.map((r) => (r.id === item.id ? { ...r, enabled: false } : r)));
    await fetch("/api/settings/connectors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name, deny: true }),
    });
    const d = await fetch("/api/settings/connectors").then((r) => r.json()).catch(() => null);
    if (d?.catalog?.length) setCatalog(d.catalog);
    setBusyId(null);
  }

  const shownFiles = files.filter((f) => {
    const q = fileQ.trim().toLowerCase();
    if (!q) return true;
    return `${f.title} ${f.path}`.toLowerCase().includes(q);
  });
  const shownSkills = skills.filter((s) => {
    const q = skillQ.trim().toLowerCase();
    if (!q) return true;
    return `${s.name} ${s.description || ""}`.toLowerCase().includes(q);
  });

  return (
    <details ref={rootRef} className="relative z-[60] group/plus" onToggle={(e) => { if (e.currentTarget.open) ensureLoaded(); }}>
      <summary
        title="Files, skills, and MCP servers"
        className="flex h-8 w-8 shrink-0 cursor-pointer list-none items-center justify-center rounded-full border border-line text-ink hover:bg-canvas-2 [&::-webkit-details-marker]:hidden"
      >
        <Plus size={16} />
      </summary>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          for (const f of Array.from(e.target.files || [])) onAttachLocal(f);
          e.target.value = "";
          close();
        }}
      />
      <div className="absolute bottom-[calc(100%+10px)] left-0 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-panel shadow-[0_16px_40px_rgba(35,32,27,0.18)]">
        <Section testId="plus-files" icon={<Paperclip size={15} />} label="Files" detail="Attach a Brain note or a local file">
          <label className="mb-2 flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-1.5">
            <Search size={12} className="text-ink-soft" />
            <input value={fileQ} onChange={(e) => setFileQ(e.target.value)} placeholder="Search files" className="w-full bg-transparent text-[12px] outline-none" />
          </label>
          <button type="button" onClick={() => fileRef.current?.click()} className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-canvas-2">
            <Upload size={13} /> Upload from this computer…
          </button>
          <div className="max-h-48 overflow-y-auto">
            {shownFiles.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => { onAttachBrain(f); close(); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas-2"
              >
                <Paperclip size={12} className="shrink-0 text-ink-soft" />
                <span className="min-w-0 flex-1 truncate text-[12px]">{f.title}</span>
                <span className="max-w-[40%] truncate text-[10px] text-ink-soft">{f.path}</span>
              </button>
            ))}
            {shownFiles.length === 0 && <p className="px-2 py-2 text-[11px] text-ink-soft">{fileQ.trim() ? "No matching files." : "No Brain files yet — upload from this computer."}</p>}
          </div>
        </Section>

        <Section testId="plus-skills" icon={<BookOpen size={15} />} label="Skills" detail="Apply an agent skill">
          <label className="mb-2 flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-1.5">
            <Search size={12} className="text-ink-soft" />
            <input value={skillQ} onChange={(e) => setSkillQ(e.target.value)} placeholder="Search skills" className="w-full bg-transparent text-[12px] outline-none" />
          </label>
          <div className="max-h-56 overflow-y-auto">
            {shownSkills.length === 0 && <p className="px-2 py-2 text-[11px] text-ink-soft">No skills for this agent yet. Add them in Settings → Skills.</p>}
            {shownSkills.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => { onPickSkill(s.name); close(); }}
                className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-canvas-2"
              >
                <span>
                  <span className="block text-[12px] font-medium">{s.name}</span>
                  {s.description && <span className="mt-0.5 block truncate text-[10px] text-ink-soft">{s.description}</span>}
                </span>
                <ChevronRight size={13} className="mt-1 shrink-0 text-ink-soft" />
              </button>
            ))}
          </div>
        </Section>

        <Section testId="plus-mcp" icon={<Plug size={15} />} label="MCP Servers" detail="Enable apps agents can use">
          <div className="max-h-[360px] overflow-y-auto">
            <McpBrowse
              catalog={catalog}
              compact
              onEnable={enable}
              onDisable={disable}
              busyId={busyId}
              onCustom={() => {
                window.location.href = "/jarvis/settings?tab=mcp#add-mcp";
              }}
            />
            <Link href="/jarvis/settings?tab=mcp#add-mcp" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ops hover:underline">
              <Plus size={12} /> Add a custom MCP in Settings
            </Link>
          </div>
        </Section>
      </div>
    </details>
  );
}

function Section({
  testId,
  icon,
  label,
  detail,
  children,
}: {
  testId: string;
  icon: ReactNode;
  label: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <details className="border-b border-line last:border-b-0" data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2 hover:bg-canvas-2 [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 text-ink-soft">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-ink">{label}</span>
          <span className="block text-[10px] text-ink-soft">{detail}</span>
        </span>
        <ChevronRight size={14} className="mt-1 shrink-0 text-ink-soft" />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
