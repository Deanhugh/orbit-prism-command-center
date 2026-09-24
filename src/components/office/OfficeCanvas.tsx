"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { DeptId } from "@/lib/types";
import { AGENTS } from "@/lib/office-data";
import { useOffice } from "@/lib/store";
import { podLayouts, scenePalette } from "./scene-util";
import { DepartmentPod } from "./DepartmentPod";
import { Brain } from "./Brain";

function Redraw() {
  const invalidate = useThree((s) => s.invalidate);
  const tasks = useOffice((s) => s.tasks);
  const theme = useOffice((s) => s.theme);
  const selected = useOffice((s) => s.selectedDept);
  useEffect(() => { invalidate(); }, [tasks, theme, selected, invalidate]);
  return null;
}

function CameraRig() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

export default function OfficeCanvas({ zoom = 58 }: { zoom?: number }) {
  const tasks = useOffice((s) => s.tasks);
  const selectedDept = useOffice((s) => s.selectedDept);
  const setSelectedDept = useOffice((s) => s.setSelectedDept);
  const setBrainOpen = useOffice((s) => s.setBrainOpen);
  const palette = useMemo(() => scenePalette(true), []);

  const layouts = useMemo(() => podLayouts(), []);

  const workingByDept = useMemo(() => {
    const seatById = new Map(AGENTS.map((a) => [a.id, { dept: a.dept, seat: a.seat }]));
    const map = new Map<DeptId, Set<number>>();
    for (const t of tasks) {
      if (t.status !== "in_progress") continue;
      const info = seatById.get(t.agentId);
      if (!info) continue;
      if (!map.has(info.dept)) map.set(info.dept, new Set());
      map.get(info.dept)!.add(info.seat);
    }
    return map;
  }, [tasks]);

  return (
    <Canvas
      frameloop="demand"
      orthographic
      camera={{ zoom, near: -100, far: 100, position: [15, 13, 15] }}
      dpr={1}
      gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
      onPointerMissed={() => setSelectedDept("all")}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <color attach="background" args={[palette.bg]} />
      <Redraw />
      <CameraRig />
      <ambientLight intensity={palette.ambient + 0.25} />
      <hemisphereLight args={["#e8f4f8", "#1C1F26", 0.35]} />
      <directionalLight position={[9, 16, 6]} intensity={1.0} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[46, 46]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      {/* walkways from brain to each pod */}
      {layouts.map((l) => {
        const angle = Math.atan2(l.z, l.x);
        const len = Math.hypot(l.x, l.z);
        return (
          <mesh
            key={`path-${l.id}`}
            rotation={[-Math.PI / 2, 0, -angle]}
            position={[l.x / 2, 0.015, l.z / 2]}
          >
            <planeGeometry args={[len, 0.8]} />
            <meshStandardMaterial color={palette.walkway} />
          </mesh>
        );
      })}

      <Brain onOpen={() => setBrainOpen(true)} palette={palette} />

      {layouts.map((l) => (
        <DepartmentPod
          key={l.id}
          layout={l}
          workingSeats={workingByDept.get(l.id) ?? new Set()}
          selected={selectedDept === l.id}
          dimmed={selectedDept !== "all" && selectedDept !== l.id}
          palette={palette}
          dark
          onSelect={setSelectedDept}
        />
      ))}
    </Canvas>
  );
}
