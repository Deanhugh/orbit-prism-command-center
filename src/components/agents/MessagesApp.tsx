"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Settings } from "lucide-react";
import type { AgentConversation, ChatMessage, ChatToolStep, ChatUsage } from "@/lib/agents-types";
import type { AgentRuntimeInfo, Task } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/office-data";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { useOffice } from "@/lib/store";
import { useSpaceToTalk, useVoice } from "@/lib/use-voice";
import { HeaderControls } from "@/components/chrome/HeaderControls";
import { BrainGraphOverlay } from "@/components/chrome/BrainGraphOverlay";
import { Brand } from "@/components/chrome/Brand";
import { useJarvisHub } from "@/components/jarvis/useJarvisHub";
import { OfficeSafe } from "@/components/agents/OfficeSafe";
import { ChatPill } from "@/components/agents/ChatPill";
import { ArtifactPane } from "@/components/agents/ArtifactPane";
import { accountHandle, cn, timeAgo } from "@/lib/utils";
import { looksLikeClearChat } from "@/lib/clear-chat";
import { isDemoChoice, parseSlash, type SlashCmd } from "@/lib/chat-commands";
import { estimateTokens, extractVideoUrl, inferArtifactKind, titleFromMarkdown, type ArtifactMeta } from "@/lib/artifacts";

// The animated 3D office scene (client-only), embedded compactly under the agents list.
const OfficeScene = dynamic(() => import("@/components/office/OfficeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <p className="serif text-[12px] text-ink-soft">Opening the office…</p>
    </div>
  ),
});

interface ProviderInfo { id: string; label: string; configured: boolean; ok: boolean; reason: string }
interface Cfg { provider: string; model: string; temperature: number; composio: boolean }

type StatusTone = "working" | "ending" | "offline";
interface AgentStatus { tone: StatusTone; label: string }

type ChatMode = "chat" | "task" | "plan";
interface Pref { provider: string; model: string; mode: ChatMode; skill: string }
interface SkillInfo { name: string; description?: string; department: string | null; agents: string[] }

const STATUS_COLOR: Record<StatusTone, string> = {
  working: "#35b26a", // green
  ending: "#e0a72e", // yellow
  offline: "#d64550", // red
};
const STATUS_LABEL: Record<StatusTone, string> = {
  working: "Working",
  ending: "Coming to end of shift",
  offline: "Not active",
};

function initials(title: string) {
  return title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Derive a green/yellow/red shift status per agent from live runtime signals
 * (circuit-breaker + budget + active tasks). Idle agents get a stable
 * deterministic status so the panel shows a realistic mix rather than all-green.
 */
function deriveStatuses(rt: AgentRuntimeInfo[], tasks: Task[]): Record<string, AgentStatus> {
  const byId = new Map(rt.map((r) => [r.id, r]));
  const active = new Set(tasks.filter((t) => t.status === "in_progress").map((t) => t.agentId));
  const out: Record<string, AgentStatus> = {};
  const ids = new Set<string>([...byId.keys(), ...tasks.map((t) => t.agentId)]);
  for (const id of ids) {
    const r = byId.get(id);
    let tone: StatusTone;
    if (r?.breaker === "stopped") tone = "offline";
    else if (active.has(id)) tone = "working";
    else if (r?.breaker === "steer" || r?.breaker === "constrain" || (r && r.limit && r.used / r.limit >= 0.7)) tone = "ending";
    else if (r && r.used > 0) tone = "working";
    else {
      const h = hashStr(id) % 10;
      tone = h < 7 ? "working" : h < 9 ? "ending" : "offline";
    }
    out[id] = { tone, label: STATUS_LABEL[tone] };
  }
  return out;
}

export function MessagesApp({ username }: { username: string }) {
  useOrbitInit();
  const router = useRouter();
  const { hub } = useJarvisHub(undefined, username);
  const avatarUrl = hub?.profile.logoUrl || "/profile.png";

  const [convs, setConvs] = useState<AgentConversation[]>([]);
  const [activeId, setActiveId] = useState<string>("dm:jarvis");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<{ content: string; agentName: string; tools: ChatToolStep[] } | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({});
  const [prefs, setPrefs] = useState<Record<string, Pref>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("orbit_agent_prefs"); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [artifact, setArtifact] = useState<ArtifactMeta | null>(null);
  const [brainFiles, setBrainFiles] = useState<{ title: string; path: string }[]>([]);
  const [lastUsage, setLastUsage] = useState<ChatUsage | null>(null);
  const [tokPerSec, setTokPerSec] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const loadedModels = useRef<Set<string>>(new Set());

  const active = convs.find((c) => c.id === activeId);

  // Fetch a provider's model list on demand (once per provider); state only
  // updates after the fetch resolves.
  const ensureModels = useCallback((provider: string) => {
    if (!provider || loadedModels.current.has(provider)) return;
    loadedModels.current.add(provider);
    fetch(`/api/agents/models?provider=${encodeURIComponent(provider)}`)
      .then((r) => r.json())
      .then((d) => setModelsByProvider((mm) => ({ ...mm, [provider]: d.models || [] })))
      .catch(() => { loadedModels.current.delete(provider); });
  }, []);

  // The model / mode / skill chosen for the currently-open agent (falls back to
  // the global default). Each agent remembers its own choices.
  const current: Pref = prefs[activeId] || { provider: cfg?.provider || "demo", model: cfg?.model || "", mode: "chat", skill: "" };

  useEffect(() => { ensureModels(current.provider); }, [current.provider, ensureModels]);

  function setPref(patch: Partial<Pref>) {
    setPrefs((p) => {
      const cur = p[activeId] || { provider: cfg?.provider || "demo", model: cfg?.model || "", mode: "chat" as ChatMode, skill: "" };
      return { ...p, [activeId]: { ...cur, ...patch } };
    });
  }
  function pickModel(model: string, provider?: string) {
    if (provider) {
      setPref({ provider, model });
      ensureModels(provider);
      return;
    }
    setPref({ model });
  }
  function pickSkill(skill: string) { setPref({ skill }); }
  function pickMode(mode: ChatMode) { setPref({ mode }); }

  async function handleSlash(cmd: SlashCmd, rest: string) {
    if (cmd === "/clear") {
      setInput("");
      await clearOpenChat();
      return;
    }
    if (cmd === "/help") {
      setInput("");
      setMessages((m) => [...m, {
        id: "help-" + Date.now(),
        role: "assistant",
        content: "Pill commands: /clear · /task [text] · /plan [text] · /chat [text] · @filename to attach a Brain note.",
        ts: Date.now(),
        agentName: active?.title || "Office",
      }]);
      return;
    }
    if (cmd === "/task") pickMode("task");
    else if (cmd === "/plan") pickMode("plan");
    else if (cmd === "/chat") pickMode("chat");
    if (rest) {
      setInput(rest);
      return;
    }
    setInput("");
  }

  const modelCatalog = useMemo(() => {
    const rows: { provider: string; model: string }[] = [];
    const seen = new Set<string>();
    for (const p of providers) {
      if (isDemoChoice(p.id, "")) continue;
      for (const m of modelsByProvider[p.id] || []) {
        if (isDemoChoice(p.id, m)) continue;
        const key = `${p.id}:${m}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ provider: p.id, model: m });
      }
    }
    if (
      current.model &&
      !isDemoChoice(current.provider, current.model) &&
      !rows.some((r) => r.model === current.model && r.provider === current.provider)
    ) {
      rows.unshift({ provider: current.provider, model: current.model });
    }
    return rows;
  }, [providers, modelsByProvider, current.model, current.provider]);

  // Skills available to the currently-open desk. The skills API returns agent
  // *names*. Department is grouping only when a playbook names specific desks.
  const activeAgentId = active && active.kind === "dm" ? active.agentIds[0] : undefined;
  const activeAgentName = active && active.kind === "dm" && activeAgentId !== "jarvis" ? active.title : undefined;
  const activeDeptId = active?.deptId;
  const isJarvis = activeAgentId === "jarvis";

  const clearOpenChat = useCallback(async () => {
    if (!activeId) return;
    setDraft(null);
    setInput("");
    setAttachments([]);
    setMessages([]);
    try {
      const res = await fetch("/api/agents/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId }),
      });
      const d = await res.json().catch(() => ({}));
      if (Array.isArray(d.conversations)) setConvs(d.conversations);
      setMessages([]);
    } catch {
      /* keep the empty thread locally */
    }
  }, [activeId]);

  const onVoice = useCallback((t: string) => {
    if (looksLikeClearChat(t)) {
      void clearOpenChat();
      return;
    }
    setInput((prev) => (prev ? prev + " " : "") + t);
  }, [clearOpenChat]);
  const { supported: voiceSupported, listening, start, stop } = useVoice(onVoice);
  useSpaceToTalk({ enabled: voiceSupported, listening, start, stop });

  useEffect(() => {
    fetch("/api/agents/conversations").then((r) => r.json()).then((d) => setConvs(d.conversations || [])).catch(() => {});
    fetch("/api/agents/providers").then((r) => r.json()).then((d) => {
      setProviders(d.providers || []);
      setCfg(d.config);
      if (d.config?.provider) {
        loadedModels.current.add(d.config.provider);
        if (d.models?.length) setModelsByProvider((m) => ({ ...m, [d.config.provider]: d.models || [] }));
        else ensureModels(d.config.provider);
      }
    }).catch(() => {});
  }, [ensureModels]);

  // Persist per-agent choices locally.
  useEffect(() => {
    try { localStorage.setItem("orbit_agent_prefs", JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  // Load skills once for the Skill picker / insert menu.
  useEffect(() => {
    fetch("/api/settings/skills").then((r) => r.json()).then((d) => setAllSkills(d.skills || [])).catch(() => {});
    fetch("/api/brain").then((r) => r.json()).then((d) => {
      setBrainFiles((d.nodes || []).map((n: { title: string; path: string }) => ({ title: n.title, path: n.path })));
    }).catch(() => {});
  }, []);

  const officeAgents = useOffice((s) => s.agents);
  const officeTasks = useOffice((s) => s.tasks);
  useEffect(() => {
    setStatuses(deriveStatuses(officeAgents, officeTasks));
  }, [officeAgents, officeTasks]);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/agents/conversations?id=${encodeURIComponent(activeId)}`).then((r) => r.json()).then((d) => setMessages(d.messages || [])).catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, draft?.content]);

  const q = search.trim().toLowerCase();
  const jarvisConv = useMemo(() => convs.find((c) => c.id === "dm:jarvis"), [convs]);
  const sections = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const group = convs.find((c) => c.id === `grp:${d.id}`);
      let agents = convs.filter((c) => c.kind === "dm" && c.deptId === d.id);
      const deptMatch = q ? d.name.toLowerCase().includes(q) : true;
      if (q && !deptMatch) {
        agents = agents.filter((c) => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
      }
      return { dept: d, group, agents };
    }).filter((s) => !q || s.dept.name.toLowerCase().includes(q) || s.agents.length > 0);
  }, [convs, q]);

  const activeDept = active?.deptId;
  const isOpen = (deptId: string) =>
    q ? true : expanded[deptId] !== undefined ? expanded[deptId] : deptId === activeDept;
  const toggleDept = (deptId: string) =>
    setExpanded((e) => ({ ...e, [deptId]: !isOpen(deptId) }));

  // Task mode: dispatch the message as real work through the task engine.
  async function dispatchTask(text: string) {
    if (!active) return;
    if (looksLikeClearChat(text)) {
      await clearOpenChat();
      return;
    }
    setBusy(true);
    setInput("");
    const ts = Date.now();
    setMessages((m) => [...m, { id: "u" + ts, role: "user", content: text, ts }]);
    try {
      let note = "";
      if (active.id === "dm:jarvis") {
        const res = await fetch("/api/jarvis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: text }) });
        const d = await res.json();
        note = d.reply || `Dispatched ${d.tasks?.length ?? 0} task(s) through the department leads.`;
      } else {
        const dept = active.deptId;
        const agentId = active.kind === "dm" ? active.agentIds[0] : undefined;
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text, dept, agentId }) });
        const d = await res.json();
        const who = d.task?.agentName || active.title;
        note = d.routine
          ? `⟲ Scheduled routine created for ${active.title}.`
          : `✅ Task dispatched to ${who} — it's running now. Watch the office scene light up; the result files to the Brain.`;
      }
      setMessages((m) => [...m, { id: "a" + Date.now(), role: "assistant", content: note, ts: Date.now(), agentName: active.title }]);
    } catch {
      setMessages((m) => [...m, { id: "a" + Date.now(), role: "assistant", content: "Couldn't dispatch that task — try again.", ts: Date.now(), agentName: active.title }]);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    let raw = input.trim();
    const slash = parseSlash(raw);
    if (slash) {
      if (slash.command === "/clear") {
        await clearOpenChat();
        return;
      }
      if (slash.command === "/help") {
        await handleSlash("/help", "");
        return;
      }
      if (slash.command === "/task") pickMode("task");
      else if (slash.command === "/plan") pickMode("plan");
      else if (slash.command === "/chat") pickMode("chat");
      raw = slash.rest;
      if (!raw) {
        setInput("");
        return;
      }
    }
    const text = [raw, attachments.length ? `Attached: ${attachments.join(", ")}` : ""].filter(Boolean).join("\n\n");
    if (!text || busy || !active) return;
    if (looksLikeClearChat(raw)) {
      await clearOpenChat();
      return;
    }
    setAttachments([]);
    const modeNow = slash?.command === "/task" ? "task" : slash?.command === "/plan" ? "plan" : slash?.command === "/chat" ? "chat" : current.mode;
    if (modeNow === "task") { await dispatchTask(text); return; }
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { id: "u" + Date.now(), role: "user", content: text, ts: Date.now() }]);
    setDraft({ content: "", agentName: active.title, tools: [] });
    const t0 = Date.now();

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: active.id, text, provider: current.provider, model: current.model, mode: modeNow, skill: current.skill || undefined }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let content = "";
      let tools: ChatToolStep[] = [];
      let agentName = active.title;
      let doneMsg: ChatMessage | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const ev = JSON.parse(t.slice(5).trim());
          if (ev.type === "start") { agentName = ev.agentName; }
          else if (ev.type === "cleared") {
            setMessages([]);
            setDraft(null);
            doneMsg = null;
          }
          else if (ev.type === "token") { content += ev.text; setDraft({ content, agentName, tools: [...tools] }); }
          else if (ev.type === "tool") {
            const ex = tools.find((x) => x.name === ev.name && x.status === "running");
            if (ex && ev.status !== "running") { ex.status = ev.status; ex.detail = ev.detail; }
            else if (!ex) tools.push({ name: ev.name, status: ev.status, detail: ev.detail });
            tools = [...tools];
            setDraft({ content, agentName, tools });
          } else if (ev.type === "done") { doneMsg = ev.message; }
        }
      }
      const reply = doneMsg?.content || content;
      const usage = doneMsg?.usage || {
        promptTokens: estimateTokens(text),
        completionTokens: estimateTokens(reply),
        totalTokens: estimateTokens(text) + estimateTokens(reply),
        cachedTokens: 0,
        estimated: true,
      };
      setLastUsage(usage);
      const sec = (Date.now() - t0) / 1000;
      if (sec > 0 && usage.completionTokens) setTokPerSec(usage.completionTokens / sec);
      if (doneMsg) setMessages((m) => [...m, { ...doneMsg!, usage: doneMsg!.usage || usage }]);
      setDraft(null);
      const kind = inferArtifactKind(text, reply);
      if (kind && reply.trim()) {
        try {
          const art = await fetch("/api/agents/artifacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              markdown: reply,
              prompt: text,
              kind,
              convId: active.id,
              title: titleFromMarkdown(reply, active.title),
              videoUrl: extractVideoUrl(reply),
            }),
          }).then((r) => r.json());
          if (art.artifact) setArtifact(art.artifact);
        } catch {
          /* preview optional */
        }
      }
      fetch("/api/agents/conversations").then((r) => r.json()).then((d) => setConvs(d.conversations || [])).catch(() => {});
    } catch {
      setDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(markdown: string) {
    const kind = inferArtifactKind("", markdown) || "document";
    try {
      const art = await fetch("/api/agents/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          kind,
          convId: activeId,
          title: titleFromMarkdown(markdown, active?.title || "Deliverable"),
          videoUrl: extractVideoUrl(markdown),
        }),
      }).then((r) => r.json());
      if (art.artifact) setArtifact(art.artifact);
    } catch {
      /* ignore */
    }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pillSkills = allSkills.filter((s) => {
    if (isJarvis || s.agents?.includes("all")) return true;
    if (activeAgentName && s.agents?.includes(activeAgentName)) return true;
    const unnamed = !s.agents?.length;
    if (unnamed && activeDeptId && (s.department === activeDeptId || s.department === "all")) return true;
    return false;
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-canvas text-ink lg:flex-row lg:overflow-hidden">
      {/* left: Agents list (top) + animated Office scene (bottom) */}
      <aside className="flex h-[70vh] w-full shrink-0 flex-col border-b border-line bg-panel/60 lg:h-full lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex items-start gap-2 px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <Brand size="office" />
          </div>
          <Link href="/jarvis/settings?tab=mcp" className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line text-ink-soft hover:text-ink" title="Settings">
            <Plus size={13} />
          </Link>
        </div>
        <div className="px-3 pb-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-[12px] outline-none placeholder:text-ink-soft/60" />
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-2">
          {/* Chief (Jarvis) pinned at the top */}
          {jarvisConv && (!q || "chief".includes(q) || jarvisConv.subtitle.toLowerCase().includes(q)) && (
            <button
              onClick={() => setActiveId(jarvisConv.id)}
              className={cn("mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition", activeId === jarvisConv.id ? "bg-canvas-2" : "hover:bg-canvas-2/60")}
            >
              <PresenceAvatar accent={jarvisConv.accent} text={initials(jarvisConv.title)} tone={statuses["jarvis"]?.tone ?? "working"} />
              <span className="min-w-0 flex-1">
                <span className="truncate text-[12px] font-semibold">{jarvisConv.title}</span>
                <span className="block truncate text-[11px] text-ink-soft">{jarvisConv.subtitle}</span>
              </span>
            </button>
          )}

          {/* Departments — collapsible, each revealing its agents with a status */}
          {sections.map(({ dept, group, agents }) => {
            const open = isOpen(dept.id);
            return (
              <div key={dept.id} className="mb-0.5">
                <button
                  onClick={() => toggleDept(dept.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-canvas-2/60"
                >
                  <ChevronRight size={14} className={cn("shrink-0 text-ink-soft transition-transform", open && "rotate-90")} />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dept.accent }} />
                  <span className="flex-1 truncate text-[12px] font-semibold">{dept.name}</span>
                  {open ? (
                    <span className="shrink-0 text-[10px] text-ink-soft">{agents.length}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5">
                      {agents.map((c) => {
                        const ag = c.agentIds[0];
                        return <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[statuses[ag]?.tone ?? "working"] }} />;
                      })}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="mb-1 ml-3 border-l border-line pl-1">
                    {group && (
                      <button
                        onClick={() => setActiveId(group.id)}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition", activeId === group.id ? "bg-canvas-2" : "hover:bg-canvas-2/60")}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: group.accent }}>#</span>
                        <span className="min-w-0 flex-1">
                          <span className="truncate text-[12px] font-semibold">Team thread</span>
                          <span className="block truncate text-[10px] text-ink-soft">Message the whole {dept.name}</span>
                        </span>
                      </button>
                    )}
                    {agents.map((c) => {
                      const ag = c.agentIds[0];
                      const st = statuses[ag] ?? { tone: "working" as StatusTone, label: STATUS_LABEL.working };
                      return (
                        <button
                          key={c.id}
                          onClick={() => setActiveId(c.id)}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition", activeId === c.id ? "bg-canvas-2" : "hover:bg-canvas-2/60")}
                        >
                          <PresenceAvatar accent={c.accent} text={initials(c.title)} tone={st.tone} small />
                          <span className="min-w-0 flex-1">
                            <span className="truncate text-[12px] font-semibold">{c.title}</span>
                            <span className="block truncate text-[10px] text-ink-soft">{c.subtitle}</span>
                          </span>
                          <span className="shrink-0 text-[9px] text-ink-soft">{c.lastTs ? timeAgo(c.lastTs) : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* status legend */}
        <div className="flex items-center gap-3 border-t border-line px-4 py-1.5 text-[9px] text-ink-soft">
          {(["working", "ending", "offline"] as StatusTone[]).map((tone) => (
            <span key={tone} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[tone] }} />
              {STATUS_LABEL[tone]}
            </span>
          ))}
        </div>
        {/* animated Office scene — under the agents panel (bottom-left) */}
        <div className="relative h-[200px] shrink-0 overflow-hidden border-t border-line">
          <OfficeSafe>
            <OfficeScene zoom={22} />
          </OfficeSafe>
          <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-panel/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ink-soft backdrop-blur">
            The Office
          </span>
          <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 text-[8px] uppercase tracking-widest text-ink-soft/70">
            Click a pod to focus a department
          </span>
        </div>

        <div className="border-t border-line px-2 py-2">
          <Link
            href="/jarvis/settings"
            title="Settings"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-ink-soft hover:bg-panel-2 hover:text-ink"
          >
            <Settings size={16} className="shrink-0" />
            Settings
          </Link>
          <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{accountHandle(username)}</span>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* center: chat + optional artifact pane */}
      <div className="flex min-h-[80vh] w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-row">
      <main className="flex min-h-[80vh] w-full min-w-0 flex-1 flex-col lg:min-h-0">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: active?.accent }} />
            <span className="serif text-[14px] font-bold">{active?.title}</span>
            <span className="text-[10px] uppercase tracking-wide text-ink-soft">{active?.subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <HeaderControls />
          </div>
        </header>

        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {messages.length === 0 && !draft && (
            <div className="mt-16 text-center text-[12px] text-ink-soft">
              <p className="serif text-[14px] text-ink">Message {active?.title}</p>
              <p className="mt-1">Say what you need. {current.provider === "demo" ? "Running in demo — pick a model in the chat box below to go live." : ""}</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              accent={active?.accent || "#888"}
              onPreview={m.role === "assistant" ? () => void openPreview(m.content) : undefined}
            />
          ))}
          {draft && <DraftRow content={draft.content} agentName={draft.agentName} tools={draft.tools} accent={active?.accent || "#888"} />}
          <div ref={endRef} />
        </div>

        {/* composer — capsule chat + Clear Chat outside it */}
        <div className="relative z-30 overflow-visible border-t border-line px-5 py-3">
          <div className="flex items-end gap-2">
            <ChatPill
              input={input}
              onInput={setInput}
              onSend={() => void send()}
              busy={busy}
              mode={current.mode}
              onMode={pickMode}
              onSlash={(cmd, rest) => void handleSlash(cmd, rest)}
              model={current.model}
              provider={current.provider}
              modelOptions={modelCatalog}
              onPickModel={pickModel}
              voiceSupported={voiceSupported}
              listening={listening}
              start={start}
              stop={stop}
              skills={pillSkills}
              onPickSkill={(name) => {
                pickSkill(name);
                setInput((v) => (v ? `${v} ` : "") + `Use the ${name} skill: `);
              }}
              onAttachBrain={(file) => {
                setAttachments((a) => a.includes(file.title) ? a : [...a, file.title]);
                setInput((v) => (v ? `${v}\n` : "") + `Use [[${file.title}]] from the Brain.`);
              }}
              onAttachLocal={(file) => {
                setAttachments((a) => a.includes(file.name) ? a : [...a, file.name]);
                if (file.size < 200_000 && (file.type.startsWith("text") || file.name.endsWith(".md"))) {
                  void file.text().then((text) => {
                    setInput((v) => `${v}\n\n[Attached ${file.name}]\n${text.slice(0, 8000)}`);
                  });
                } else {
                  setInput((v) => `${v}\n[Attached file: ${file.name}]`);
                }
              }}
              attachments={attachments}
              onRemoveAttachment={(name) => setAttachments((a) => a.filter((n) => n !== name))}
              brainFiles={brainFiles}
              stats={{
                turns: messages.filter((m) => m.role === "user").length,
                steps: draft?.tools.length || lastAssistant?.tools?.length || 0,
                tokPerSec,
                usage: lastUsage || lastAssistant?.usage || null,
              }}
            />
            <button
              type="button"
              onClick={() => void clearOpenChat()}
              disabled={busy || (!messages.length && !draft)}
              className="mb-6 shrink-0 self-end rounded-full border border-line bg-panel px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-40"
              title="Clear this chat history"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </main>
      {artifact && <ArtifactPane artifact={artifact} onClose={() => setArtifact(null)} />}
      </div>

      {/* Brain graph modal (opened from the Tasks panel's Brain card) */}
      <BrainGraphOverlay />
    </div>
  );
}

function PresenceAvatar({ accent, text, tone, small }: { accent: string; text: string; tone: StatusTone; small?: boolean }) {
  const size = small ? "h-7 w-7" : "h-9 w-9";
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", size)} style={{ background: accent }}>
      {text}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel"
        style={{ background: STATUS_COLOR[tone] }}
        title={STATUS_LABEL[tone]}
      />
    </span>
  );
}

function ToolChecklist({ tools }: { tools: ChatToolStep[] }) {
  if (!tools.length) return null;
  return (
    <div className="mb-2 space-y-1 rounded-lg border border-line bg-canvas/60 p-2.5">
      {tools.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className={t.status === "done" ? "text-emails" : t.status === "error" ? "text-marketing" : "text-ink-soft"}>
            {t.status === "done" ? "✓" : t.status === "error" ? "✕" : "⋯"}
          </span>
          <span className="font-medium text-ink">{t.name}</span>
          {t.detail && <span className="truncate text-ink-soft">→ {t.detail}</span>}
        </div>
      ))}
    </div>
  );
}

function MessageRow({ m, accent, onPreview }: { m: ChatMessage; accent: string; onPreview?: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2 text-[13px] text-canvas whitespace-pre-wrap">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-soft">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        {m.agentName}
      </div>
      {m.tools && <ToolChecklist tools={m.tools} />}
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas-2 px-3.5 py-2 text-[13px] text-ink whitespace-pre-wrap">{m.content}</div>
      {onPreview && m.content.trim().length > 80 && (
        <button type="button" onClick={onPreview} className="mt-1 text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink">
          Open in pane
        </button>
      )}
    </div>
  );
}

function DraftRow({ content, agentName, tools, accent }: { content: string; agentName: string; tools: ChatToolStep[]; accent: string }) {
  return (
    <div className="flex flex-col items-start">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-soft">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        {agentName}
      </div>
      <ToolChecklist tools={tools} />
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-canvas-2 px-3.5 py-2 text-[13px] text-ink whitespace-pre-wrap">
        {content || <span className="text-ink-soft">Drafting…</span>}
      </div>
    </div>
  );
}
