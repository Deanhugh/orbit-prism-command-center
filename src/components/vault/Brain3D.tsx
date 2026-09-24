"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CATEGORY_COLOR } from "@/lib/brain-categories";

export interface GNode {
  id: string;
  title: string;
  path: string;
  category: string;
  links: string[];
  size: number;
}

interface Props {
  nodes: GNode[];
  edges: [string, string][];
  visibleCats: Set<string>;
  query: string;
  revealed: number | null; // null = show everything
  selectedId: string | null;
  onSelect: (n: GNode) => void;
  cinema: boolean;
  spin: boolean;
}

function fib(i: number, n: number, radius: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius];
}

function Orb() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.25; });
  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color="#eaf6f2" emissive="#37cfc4" emissiveIntensity={0.7} flatShading />
      </mesh>
    </group>
  );
}

function Scene({ nodes, edges, visibleCats, query, revealed, selectedId, onSelect, spin }: Props) {
  const [hover, setHover] = useState<GNode | null>(null);

  // stable positions + BFS reveal order (growth follows connections)
  const { pos, order } = useMemo(() => {
    const radius = Math.max(3, Math.min(7, 2.2 + nodes.length * 0.05));
    const pos = new Map<string, THREE.Vector3>();
    nodes.forEach((n, i) => { const [x, y, z] = fib(i, nodes.length, radius); pos.set(n.id, new THREE.Vector3(x, y, z)); });
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const [a, b] of edges) { adj.get(a)?.push(b); adj.get(b)?.push(a); }
    const degree = new Map<string, number>();
    for (const n of nodes) degree.set(n.id, adj.get(n.id)?.length ?? 0);
    const start = [...nodes].sort((a, b) => (degree.get(b.id)! - degree.get(a.id)!))[0];
    const order = new Map<string, number>();
    const seen = new Set<string>();
    let idx = 0;
    const queue: string[] = start ? [start.id] : [];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      order.set(id, idx++);
      for (const nb of adj.get(id) ?? []) if (!seen.has(nb)) queue.push(nb);
    }
    for (const n of nodes) if (!order.has(n.id)) order.set(n.id, idx++);
    return { pos, order };
  }, [nodes, edges]);

  const q = query.trim().toLowerCase();
  const isVisible = (n: GNode) => {
    if (!visibleCats.has(n.category)) return false;
    if (revealed !== null && (order.get(n.id) ?? 0) >= revealed) return false;
    return true;
  };
  const isMatch = (n: GNode) => !q || n.title.toLowerCase().includes(q);

  const edgeGeom = useMemo(() => {
    const pts: number[] = [];
    for (const [a, b] of edges) {
      const na = nodes.find((n) => n.id === a);
      const nb = nodes.find((n) => n.id === b);
      if (!na || !nb || !isVisible(na) || !isVisible(nb)) continue;
      const pa = pos.get(a); const pb = pos.get(b);
      if (!pa || !pb) continue;
      pts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes, pos, revealed, visibleCats, q]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 0, 0]} intensity={1.2} color="#37cfc4" />
      <Orb />

      <lineSegments geometry={edgeGeom}>
        <lineBasicMaterial color="#2f6b7a" transparent opacity={0.35} />
      </lineSegments>

      {nodes.map((n) => {
        if (!isVisible(n)) return null;
        const p = pos.get(n.id)!;
        const color = CATEGORY_COLOR[n.category] || "#6fd4e6";
        const match = isMatch(n);
        const sel = selectedId === n.id;
        const r = 0.09 + (n.size / 30) * 0.14;
        return (
          <group key={n.id} position={p}>
            {/* visible node */}
            <mesh scale={sel ? 1.8 : match ? 1 : 0.6}>
              <sphereGeometry args={[r, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={sel ? 1.2 : match ? 0.55 : 0.12}
                transparent
                opacity={q && !match ? 0.25 : 1}
              />
            </mesh>
            {/* larger invisible hit target for easy clicking */}
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); setHover(n); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { setHover(null); document.body.style.cursor = "auto"; }}
              onClick={(e) => { e.stopPropagation(); onSelect(n); }}
            >
              <sphereGeometry args={[Math.max(0.34, r * 2.6), 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {hover && pos.get(hover.id) && (
        <Html position={pos.get(hover.id)!} center zIndexRange={[30, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold shadow-lg" style={{ background: "rgba(5,10,18,0.92)", color: "#cfe6ee", border: "1px solid rgba(111,212,230,0.4)", transform: "translateY(-22px)" }}>
            {hover.title}
          </div>
        </Html>
      )}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.1}
        minDistance={4}
        maxDistance={22}
        autoRotate={spin && !hover}
        autoRotateSpeed={0.4}
      />
    </>
  );
}

export default function Brain3D(props: Props) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1, 12], fov: 50 }} gl={{ alpha: true, antialias: true }} style={{ position: "absolute", inset: 0 }}>
      <color attach="background" args={["#05080f"]} />
      <Scene {...props} />
    </Canvas>
  );
}
