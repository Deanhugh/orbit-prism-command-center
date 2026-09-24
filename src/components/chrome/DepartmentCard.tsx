"use client";

import { useMemo } from "react";
import type { DeptId } from "@/lib/types";
import { AGENTS_BY_DEPT, DEPT_MAP } from "@/lib/office-data";
import { useOffice } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DepartmentCard({
  deptId,
  selected,
  onSelect,
}: {
  deptId: DeptId;
  selected: boolean;
  onSelect: () => void;
}) {
  const dept = DEPT_MAP[deptId];
  const tasks = useOffice((s) => s.tasks);

  const counts = useMemo(() => {
    const t = tasks.filter((x) => x.dept === deptId);
    return {
      doing: t.filter((x) => x.status === "in_progress").length,
      next: t.filter(
        (x) => x.status === "backlog" || x.status === "waiting_approval",
      ).length,
      done: t.filter((x) => x.status === "done").length,
    };
  }, [tasks, deptId]);

  const agents = AGENTS_BY_DEPT[deptId];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-[188px] select-none rounded-md border bg-panel/95 px-3 py-2.5 text-left shadow-[0_6px_20px_rgba(60,50,30,0.14)] backdrop-blur transition",
        selected ? "border-2" : "border-line hover:border-ink/30",
      )}
      style={{ borderColor: selected ? dept.accent : undefined }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dept.accent }}
        />
        <span className="serif text-[11px] font-bold uppercase tracking-wider text-ink">
          {dept.name}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="serif text-2xl font-semibold leading-none text-ink">
          {agents.length}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-ink-soft">
          Agents
        </span>
      </div>

      <div className="mt-2 space-y-0.5">
        {dept.metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-ink-soft">
              {m.label}
            </span>
            <span className="text-[11px] font-semibold text-ink">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-line pt-1.5 text-[10px]">
        <Stat label="DOING" value={counts.doing} accent={dept.accent} />
        <Stat label="NEXT" value={counts.next} />
        <Stat label="DONE" value={counts.done} />
      </div>
    </button>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="uppercase tracking-wide text-ink-soft">{label}</span>
      <span
        className="font-semibold"
        style={{ color: accent ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </span>
  );
}
