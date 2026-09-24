"use client";

import type { DeptId } from "@/lib/types";
import { useOffice } from "@/lib/store";
import { DepartmentCard } from "./DepartmentCard";

// HUD positions (percent of the scene area), arranged like the reference office.
const CARD_POS: Record<DeptId, { top: string; left: string }> = {
  emails: { top: "13%", left: "39%" },
  delivery: { top: "15%", left: "67%" },
  marketing: { top: "40%", left: "13%" },
  sales: { top: "42%", left: "85%" },
  ops: { top: "75%", left: "24%" },
  finance: { top: "76%", left: "62%" },
};

export function OfficeOverlay() {
  const selectedDept = useOffice((s) => s.selectedDept);
  const setSelectedDept = useOffice((s) => s.setSelectedDept);
  const setBrainOpen = useOffice((s) => s.setBrainOpen);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {(Object.keys(CARD_POS) as DeptId[]).map((id) => (
        <div
          key={id}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
          style={CARD_POS[id]}
        >
          <DepartmentCard
            deptId={id}
            selected={selectedDept === id}
            onSelect={() =>
              setSelectedDept(selectedDept === id ? "all" : id)
            }
          />
        </div>
      ))}

      {/* central Brain button + Jarvis (Chief of Staff) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <button
          onClick={() => setBrainOpen(true)}
          className="pointer-events-auto rounded-full border border-line bg-panel/85 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-ink shadow-[0_6px_20px_rgba(60,50,30,0.18)] backdrop-blur transition hover:bg-panel"
        >
          <span className="serif">THE BRAIN</span>
        </button>
        <span className="rounded-full border border-line bg-ink/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-canvas">
          Jarvis · Chief of Staff
        </span>
      </div>
    </div>
  );
}
