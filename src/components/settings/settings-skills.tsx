"use client";

import { useEffect, useState } from "react";
import { DEPARTMENTS } from "@/lib/office-data";

interface SkillRow {
  name: string;
  description: string;
  department: string | null;
  agents: string[];
  path: string;
  source?: "github" | "uploaded" | "brain";
  githubUrl?: string | null;
}
interface SkillsRepo {
  owner: string;
  name: string;
  treeUrl: string;
  newFileUrl: string;
}

export function Skills() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [repo, setRepo] = useState<SkillsRepo | null>(null);
  const [form, setForm] = useState({ name: "", description: "", department: "", agents: "", body: "" });
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const load = () =>
    fetch("/api/settings/skills")
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.skills || []);
        if (d.repo) setRepo(d.repo);
      });
  useEffect(() => { load(); }, []);

  async function create() {
    setMsg("");
    const res = await fetch("/api/settings/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, agents: form.agents.split(",").map((s) => s.trim()).filter(Boolean) }) });
    const d = await res.json();
    if (d.ok) { setMsg(`Created skill "${d.name}".`); setForm({ name: "", description: "", department: "", agents: "", body: "" }); load(); }
    else setMsg(d.error || "Could not create");
  }

  async function upload(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setUploading(true);
    setMsg("");
    const body = new FormData();
    for (const file of files) body.append("files", file);
    try {
      const res = await fetch("/api/settings/skills", { method: "POST", body });
      const d = await res.json().catch(() => ({}));
      if (d.ok) {
        setMsg(`Uploaded ${(d.uploaded || []).join(", ")}.`);
        setSkills(d.skills || []);
        if (d.repo) setRepo(d.repo);
      } else {
        setMsg(d.error || "Could not upload");
      }
    } catch {
      setMsg("Could not upload — check the connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">GitHub skills folder</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
          This Command Center deploys from{" "}
          <a
            href={repo ? `https://github.com/${repo.owner}/${repo.name}` : "https://github.com/Deanhugh/orbit-prism-command-center"}
            className="text-ink underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {repo ? `${repo.owner}/${repo.name}` : "Deanhugh/orbit-prism-command-center"}
          </a>
          . Playbooks checked into <code className="text-ink">skills/&lt;name&gt;/SKILL.md</code> ship on the next Railway deploy and show a GitHub badge below.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={repo?.treeUrl || "https://github.com/Deanhugh/orbit-prism-command-center/tree/main/skills"}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas"
          >
            Open skills on GitHub
          </a>
          <a
            href={repo?.newFileUrl || "https://github.com/Deanhugh/orbit-prism-command-center/new/main/skills"}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            Add SKILL.md on GitHub
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Upload SKILL.md</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
          Drop one or more <code className="text-ink">SKILL.md</code> or <code className="text-ink">.md</code> playbooks.
          They apply immediately and persist on this host. To keep them in version control, also add the same files under
          the GitHub <code className="text-ink">skills/</code> folder.
        </p>
        <label
          className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center hover:border-cyan/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files);
          }}
        >
          <span className="text-[13px] font-medium text-ink">{uploading ? "Uploading…" : "Drop SKILL.md files here"}</span>
          <span className="mt-1 text-[11px] text-ink-soft">or click to choose. Markdown only, 400 KB each.</span>
          <input
            type="file"
            accept=".md,text/markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {msg ? <p className="mt-2 text-[11px] text-ink-soft">{msg}</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Skills ({skills.length})</h2>
        <p className="text-[12px] leading-relaxed text-ink-soft">
          These are playbooks for Command Center agents — not Ollama models. Ollama (or Claude / ChatGPT)
          is the brain. A skill is the written method that agent should follow.
        </p>
        {skills.length === 0 ? (
          <p className="rounded-lg border border-line bg-panel px-3 py-4 text-[12px] text-ink-soft">
            No skills yet. Upload a SKILL.md or add one on GitHub.
          </p>
        ) : null}
        {skills.map((s) => (
          <div key={s.path} className="rounded-lg border border-line bg-panel p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold">{s.name} {s.department && <span className="text-[10px] text-ink-soft">· {s.department}</span>}</p>
              <span className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-soft">
                {s.source === "github" ? "GitHub" : s.source === "uploaded" ? "Uploaded" : "Brain"}
              </span>
              {s.githubUrl ? (
                <a href={s.githubUrl} target="_blank" rel="noreferrer" className="text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink">
                  View on GitHub
                </a>
              ) : null}
            </div>
            <p className="text-[11px] text-ink-soft">{s.description}</p>
            {s.agents.length > 0 && <p className="mt-0.5 text-[10px] text-ink-soft">Agents: {s.agents.join(", ")}</p>}
          </div>
        ))}
      </section>
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Write a skill</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input placeholder="name (e.g. proposal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
          <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
            <option value="">department (optional)</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input placeholder="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
          <input placeholder="agent ids, comma-separated (or 'all')" value={form.agents} onChange={(e) => setForm({ ...form, agents: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
          <textarea placeholder="how this work is done, step by step…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button onClick={create} disabled={!form.name.trim()} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">Create skill</button>
          {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
