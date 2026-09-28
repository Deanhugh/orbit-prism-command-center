"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { modelExtents, type CadSolid } from "@/lib/cad-geometry";

function InstancedSolids({ solids, reveal }: { solids: CadSolid[]; reveal: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shown = Math.max(0, Math.min(solids.length, reveal));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const inst = mesh.current;
    if (!inst || !solids.length) return;
    inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(solids.length * 3), 3);
  }, [solids]);

  useFrame(() => {
    const inst = mesh.current;
    if (!inst) return;
    for (let i = 0; i < shown; i++) {
      const s = solids[i];
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(s.sx, s.sy, s.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.set(s.color || "#4f8cff");
      inst.setColorAt(i, color);
    }
    inst.count = shown;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  if (!solids.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(solids.length, 1)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.38} metalness={0.12} />
    </instancedMesh>
  );
}

function SpinHint() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.08;
  });
  return <group ref={ref} />;
}

export function CadViewport({ solids, reveal }: { solids: CadSolid[]; reveal: number }) {
  const extent = modelExtents(solids);
  const dist = Math.max(28, extent * 2.1);
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [dist * 0.72, dist * 0.55, dist * 0.86], fov: 38, near: 0.1, far: 4000 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#070b14"]} />
        <hemisphereLight args={["#dce8ff", "#1a2233", 0.85]} />
        <directionalLight position={[40, 70, 30]} intensity={1.15} />
        <directionalLight position={[-30, 20, -40]} intensity={0.35} />
        <gridHelper args={[Math.max(80, extent * 4), 20, "#1b2a44", "#121a2a"]} position={[0, -extent - 2, 0]} />
        <InstancedSolids solids={solids} reveal={reveal} />
        <SpinHint />
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={8} maxDistance={400} />
      </Canvas>
    </div>
  );
}
