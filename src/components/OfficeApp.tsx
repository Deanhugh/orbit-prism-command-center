"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { DEPARTMENTS } from "@/lib/office-data";
import { useOffice } from "@/lib/store";
import { TopBar } from "@/components/chrome/TopBar";
import { TaskSidebar } from "@/components/chrome/TaskSidebar";
import { BrainGraphOverlay } from "@/components/chrome/BrainGraphOverlay";
import { OfficeOverlay } from "@/components/chrome/OfficeOverlay";
import { useOrbitInit } from "@/lib/use-orbit-init";

const OfficeCanvas = dynamic(() => import("@/components/office/OfficeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <p className="serif text-[13px] text-ink-soft">Opening the office…</p>
    </div>
  ),
});

export function OfficeApp() {
  useOrbitInit();
  const setSelectedDept = useOffice((s) => s.setSelectedDept);
  const setBrainOpen = useOffice((s) => s.setBrainOpen);
  const brainOpen = useOffice((s) => s.brainOpen);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key >= "1" && e.key <= "6") {
        const idx = parseInt(e.key, 10) - 1;
        if (DEPARTMENTS[idx]) setSelectedDept(DEPARTMENTS[idx].id);
      } else if (e.key.toLowerCase() === "g") {
        setBrainOpen(!brainOpen);
      } else if (e.key === "Escape") {
        setBrainOpen(false);
        setSelectedDept("all");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelectedDept, setBrainOpen, brainOpen]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-canvas">
      <div className="flex h-full w-full flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1">
          <OfficeCanvas />
          <OfficeOverlay />
          <TopBar />
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-ink-soft/70">
              Click a pod · press 1–6 · G Brain
            </p>
          </div>
        </div>
        <div className="h-[46%] shrink-0 lg:h-full">
          <TaskSidebar />
        </div>
      </div>
      <BrainGraphOverlay />
    </main>
  );
}
