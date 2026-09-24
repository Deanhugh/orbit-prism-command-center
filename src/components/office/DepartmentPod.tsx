"use client";

import { useMemo } from "react";
import type { DeptId } from "@/lib/types";
import { DEPT_MAP } from "@/lib/office-data";
import type { PodLayout, ScenePalette } from "./scene-util";
import { accentFor } from "./scene-util";
import { Desk } from "./Desk";

interface Props {
  layout: PodLayout;
  workingSeats: Set<number>;
  selected: boolean;
  dimmed: boolean;
  palette: ScenePalette;
  dark: boolean;
  onSelect: (id: DeptId) => void;
}

export function DepartmentPod({
  layout,
  workingSeats,
  selected,
  dimmed,
  palette,
  dark,
  onSelect,
}: Props) {
  const dept = DEPT_MAP[layout.id];
  const accent = accentFor(dark, layout.id, dept.accent);
  const platformH = 0.55;
  const opacity = dimmed ? 0.55 : 1;

  const desks = useMemo(
    () =>
      layout.seatPositions.map(([sx, sz], i) => (
        <Desk
          key={i}
          position={[sx, platformH, sz]}
          accent={accent}
          working={workingSeats.has(i)}
          palette={palette}
        />
      )),
    [layout.seatPositions, accent, workingSeats, palette],
  );

  return (
    <group position={[layout.x, 0, layout.z]}>
      {/* platform */}
      <mesh
        position={[0, platformH / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(layout.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[layout.w, platformH, layout.d]} />
        <meshStandardMaterial color={palette.platform} transparent opacity={opacity} />
      </mesh>
      {/* accent trim around the top edge */}
      <mesh position={[0, platformH + 0.02, 0]}>
        <boxGeometry args={[layout.w * 1.02, 0.06, layout.d * 1.02]} />
        <meshStandardMaterial
          color={accent}
          transparent
          opacity={selected ? 1 : dark ? 0.7 : 0.55}
          emissive={accent}
          emissiveIntensity={selected ? (dark ? 0.9 : 0.4) : dark ? 0.4 : 0.12}
        />
      </mesh>
      {/* skirt / base */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[layout.w * 0.92, 0.4, layout.d * 0.92]} />
        <meshStandardMaterial color={palette.skirt} transparent opacity={opacity} />
      </mesh>

      {desks}
    </group>
  );
}
