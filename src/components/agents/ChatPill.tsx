"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowUp, Check, ChevronDown, Mic } from "lucide-react";
import { ComposerPlus } from "@/components/agents/ComposerPlus";
import { cn } from "@/lib/utils";
import { PILL_PLACEHOLDER, isDemoChoice, mentionQuery, slashSuggestions, type SlashCmd } from "@/lib/chat-commands";
import { formatTokens } from "@/lib/artifacts";
import type { ChatUsage } from "@/lib/agents-types";
import { OPENROUTER_FAVORITES, favoriteLabel } from "@/lib/openrouter-favorites";

type ChatMode = "chat" | "task" | "plan";
interface SkillInfo { name: string; description?: string; department: string | null; agents: string[] }
interface BrainFile { title: string; path: string }

const MODE_LABEL: Record<ChatMode, string> = {
  chat: "Chat",
  task: "Task",
  plan: "Plan",
};

export interface PillStats {
  turns: number;
  steps: number;
  tokPerSec: number;
  usage: ChatUsage | null;
}

export function ChatPill({
  input,
  onInput,
  onSend,
  busy,
  mode,
  onMode,
  onSlash,
  model,
  provider,
  modelOptions,
  onPickModel,
  voiceSupported,
  listening,
  start,
  stop,
  skills,
  onPickSkill,
  onAttachBrain,
  onAttachLocal,
  attachments,
  onRemoveAttachment,
  brainFiles,
  stats,
}: {
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  mode: ChatMode;
  onMode: (m: ChatMode) => void;
  onSlash: (cmd: SlashCmd, rest: string) => void;
  model: string;
  provider: string;
  modelOptions: { provider: string; model: string }[];
  onPickModel: (model: string, provider?: string) => void;
  voiceSupported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
  skills: SkillInfo[];
  onPickSkill: (name: string) => void;
  onAttachBrain: (file: { title: string; path: string }) => void;
  onAttachLocal: (file: File) => void;
  attachments: string[];
  onRemoveAttachment: (name: string) => void;
  brainFiles: BrainFile[];
  stats: PillStats;
}) {
  const slashes = slashSuggestions(input);
  const mention = mentionQuery(input);
  const mentions = useMemo(() => {
    if (mention === null) return [];
    const q = mention.toLowerCase();
    return brainFiles.filter((f) => !q || f.title.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)).slice(0, 8);
  }, [brainFiles, mention]);

  function applyMention(file: BrainFile) {
    const at = input.lastIndexOf("@");
    const next = `${input.slice(0, at)}@${file.title} `;
    onInput(next);
    onAttachBrain(file);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (slashes.length === 1 && !input.trim().includes(" ")) {
        onSlash(slashes[0].cmd, "");
        return;
      }
      if (mentions.length === 1 && mention !== null) {
        applyMention(mentions[0]);
        return;
      }
      onSend();
    }
  }

  const cachePct =
    stats.usage && stats.usage.promptTokens > 0
      ? Math.round((stats.usage.cachedTokens / stats.usage.promptTokens) * 100)
      : 0;

  return (
    <div className="min-w-0 flex-1">
      <div className="overflow-visible rounded-2xl border border-line bg-canvas px-2.5 py-2 shadow-sm">
        <div className="flex items-end gap-2 overflow-visible">
          <ComposerPlus
            skills={skills}
            onPickSkill={onPickSkill}
            onAttachBrain={onAttachBrain}
            onAttachLocal={onAttachLocal}
          />
          <ModeMenu value={mode} onChange={onMode} />
          <textarea
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={PILL_PLACEHOLDER}
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[13px] outline-none placeholder:text-ink-soft/60"
          />
          <ModelPicker value={model} provider={provider} options={modelOptions} onPick={onPickModel} />
          {voiceSupported && (
            <button
              type="button"
              onMouseDown={start}
              onMouseUp={stop}
              className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", listening ? "bg-finance text-white" : "text-ink-soft hover:bg-canvas-2 hover:text-ink")}
              title="Hold to talk, or press Space"
            >
              <Mic size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={busy || !input.trim()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-canvas transition disabled:opacity-40"
            title="Send"
          >
            <ArrowUp size={16} />
          </button>
        </div>

        {(slashes.length > 0 || mentions.length > 0) && (
          <div className="mt-1.5 overflow-hidden rounded-lg border border-line bg-panel">
            {slashes.map((s) => (
              <button
                key={s.cmd}
                type="button"
                onClick={() => onSlash(s.cmd, "")}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-canvas-2"
              >
                <span className="font-mono text-ink">{s.cmd}</span>
                <span className="text-[11px] text-ink-soft">{s.hint}</span>
              </button>
            ))}
            {mentions.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => applyMention(f)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-canvas-2"
              >
                <span className="text-[12px] text-ink">@{f.title}</span>
                <span className="truncate text-[10px] text-ink-soft">{f.path}</span>
              </button>
            ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 px-1">
            {attachments.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onRemoveAttachment(name)}
                className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-ink-soft hover:text-ink"
                title="Remove attachment"
              >
                {name} ×
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[10px] text-ink-soft">
        <span>{stats.turns} turn{stats.turns === 1 ? "" : "s"}</span>
        <span>{stats.steps} step{stats.steps === 1 ? "" : "s"}</span>
        <span>{stats.tokPerSec > 0 ? `${Math.round(stats.tokPerSec)} tok/s` : "— tok/s"}</span>
        <span>
          {formatTokens(stats.usage?.totalTokens || 0)} tok
          {stats.usage?.estimated ? " est." : ""}
        </span>
        <span>Cache hit {cachePct}%</span>
      </div>
    </div>
  );
}

function ModeMenu({ value, onChange }: { value: ChatMode; onChange: (m: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[120px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-canvas-2 hover:text-ink"
        title="Chat, task, or plan"
      >
        <span className="truncate">{MODE_LABEL[value]}</span>
        <ChevronDown size={12} className={cn("shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-8 right-0 z-20 w-40 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
            {(["chat", "task", "plan"] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-canvas-2"
              >
                {MODE_LABEL[m]}
                {value === m && <Check size={13} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function displayModel(value: string) {
  if (!value || isDemoChoice("", value)) return "Model";
  return favoriteLabel(value) || value;
}

function ModelPicker({
  value,
  provider,
  options,
  onPick,
}: {
  value: string;
  provider: string;
  options: { provider: string; model: string }[];
  onPick: (model: string, provider?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const liveOptions = options.filter((o) => !isDemoChoice(o.provider, o.model));
  const q = query.trim().toLowerCase();
  const favorites = OPENROUTER_FAVORITES.filter((f) => {
    if (!q) return true;
    return f.id.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || f.hint.toLowerCase().includes(q);
  });
  const favIds = new Set(OPENROUTER_FAVORITES.map((f) => f.id));
  const rest = (q
    ? liveOptions.filter((o) => o.model.toLowerCase().includes(q) || o.provider.toLowerCase().includes(q))
    : liveOptions
  ).filter((o) => !(o.provider === "openrouter" && favIds.has(o.model)));

  function choose(model: string, nextProvider?: string) {
    if (isDemoChoice(nextProvider, model)) return;
    onPick(model, nextProvider);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Model"
        className="flex max-w-[160px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-canvas-2 hover:text-ink"
      >
        <span className="truncate">{displayModel(value)}</span>
        <ChevronDown size={12} className={cn("shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-8 right-0 z-20 w-72 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  e.preventDefault();
                  choose(query.trim(), provider);
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search or type a model id"
              className="w-full border-b border-line bg-transparent px-3 py-2 text-[12px] outline-none"
            />
            <div className="thin-scroll max-h-56 overflow-y-auto py-1">
              {favorites.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">Favorites</div>
              )}
              {favorites.map((f) => {
                const selected = f.id === value && (provider === "openrouter" || !provider);
                return (
                  <button
                    key={`fav:${f.id}`}
                    type="button"
                    onClick={() => choose(f.id, "openrouter")}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-canvas-2"
                    title={f.hint}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {f.label}
                      <span className="ml-1 text-[10px] text-ink-soft">{f.id}</span>
                    </span>
                    {selected && <Check size={13} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
              {rest.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">All models</div>
              )}
              {favorites.length === 0 && rest.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-ink-soft">
                  {query.trim() ? `Press Enter to use “${query.trim()}”` : "No models yet — type a name."}
                </p>
              )}
              {rest.map((o) => {
                const selected = o.model === value && o.provider === provider;
                return (
                  <button
                    key={`${o.provider}:${o.model}`}
                    type="button"
                    onClick={() => choose(o.model, o.provider)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-canvas-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{o.model}</span>
                    {selected && <Check size={13} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
