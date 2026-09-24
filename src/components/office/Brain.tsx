"use client";

import type { ScenePalette } from "./scene-util";

export function Brain({
  onOpen,
  palette,
}: {
  onOpen: () => void;
  palette: ScenePalette;
}) {
  return (
    <group position={[0, 0, 0]}>
      {/* base pad */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.7, 1.95, 0.16, 44]} />
        <meshStandardMaterial color={palette.brainPad} />
      </mesh>
      {/* accent ring */}
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[1.72, 1.72, 0.03, 44]} />
        <meshStandardMaterial
          color={palette.brainEmissive}
          emissive={palette.brainEmissive}
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* core */}
      <mesh
        position={[0, 0.95, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <icosahedronGeometry args={[0.78, 1]} />
        <meshStandardMaterial
          color={palette.brainCore}
          emissive={palette.brainEmissive}
          emissiveIntensity={0.75}
          flatShading
        />
      </mesh>
      {/* orbiting nodes */}
      <group position={[0, 0.95, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2]}>
              <sphereGeometry args={[0.12, 12, 12]} />
              <meshStandardMaterial
                color={palette.brainNode}
                emissive={palette.brainNode}
                emissiveIntensity={0.7}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
