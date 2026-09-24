"use client";

import type { ScenePalette } from "./scene-util";

interface DeskProps {
  position: [number, number, number];
  accent: string;
  working: boolean;
  palette: ScenePalette;
}

export function Desk({ position, accent, working, palette }: DeskProps) {
  return (
    <group position={position}>
      {/* desk top */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.62, 0.06, 0.44]} />
        <meshStandardMaterial color={palette.deskTop} />
      </mesh>
      {/* legs */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.5, 0.16, 0.32]} />
        <meshStandardMaterial color={palette.deskLeg} />
      </mesh>
      {/* monitor */}
      <mesh position={[0, 0.32, -0.12]}>
        <boxGeometry args={[0.34, 0.22, 0.03]} />
        <meshStandardMaterial
          color={working ? accent : palette.monitorIdle}
          emissive={working ? accent : "#000000"}
          emissiveIntensity={working ? 0.7 : 0}
        />
      </mesh>

      {/* seated agent character */}
      <group position={[0, 0, 0.26]}>
        <mesh position={[0, 0.3, 0]}>
          <capsuleGeometry args={[0.1, 0.16, 4, 10]} />
          <meshStandardMaterial
            color={accent}
            emissive={working ? accent : "#000000"}
            emissiveIntensity={working ? 0.4 : 0}
          />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color={palette.head} />
        </mesh>
        <mesh position={[0, 0.26, -0.13]} rotation={[-0.5, 0, 0]}>
          <capsuleGeometry args={[0.035, 0.14, 4, 8]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      </group>

      {/* chair back */}
      <mesh position={[0, 0.22, 0.42]}>
        <boxGeometry args={[0.26, 0.3, 0.06]} />
        <meshStandardMaterial color={palette.chair} />
      </mesh>

      {/* working indicator above the head */}
      {working && (
        <mesh position={[0, 0.78, 0.26]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.7}
          />
        </mesh>
      )}
    </group>
  );
}
