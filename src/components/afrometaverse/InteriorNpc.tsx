/**
 * Stylized seated/standing NPC figure for interiors — lightweight primitives only.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { InteriorNpcDef } from "@/data/interiorNpcs";
import { Html } from "@react-three/drei";

export function InteriorNpcMesh({
  npc,
  active,
  onSelect,
}: {
  npc: InteriorNpcDef;
  active: boolean;
  onSelect?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime + phase.current;
    // Soft idle: breath + slight head bob
    group.current.position.y = Math.sin(t * 1.6) * 0.015;
    const head = group.current.children[1] as THREE.Group | undefined;
    if (head) head.rotation.y = Math.sin(t * 0.7) * 0.08;
  });

  return (
    <group
      ref={group}
      position={npc.position}
      rotation={[0, npc.facing, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.45, 4, 8]} />
        <meshStandardMaterial color={npc.cloth} roughness={0.9} />
      </mesh>
      {/* head */}
      <group position={[0, 1.05, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={npc.skin} roughness={0.75} />
        </mesh>
      </group>
      {/* legs suggestion */}
      <mesh position={[-0.07, 0.2, 0.02]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 3, 6]} />
        <meshStandardMaterial color={npc.skin} roughness={0.8} />
      </mesh>
      <mesh position={[0.07, 0.2, 0.02]} castShadow>
        <capsuleGeometry args={[0.05, 0.28, 3, 6]} />
        <meshStandardMaterial color={npc.skin} roughness={0.8} />
      </mesh>
      {/* name tag */}
      <Html position={[0, 1.35, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div
          className={`am-npc-tag ${active ? "am-npc-tag-active" : ""}`}
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: active ? "rgba(40, 90, 60, 0.92)" : "rgba(20, 14, 10, 0.85)",
            color: "#f5e9d6",
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
            border: active ? "1px solid rgba(120, 220, 160, 0.5)" : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {npc.name}
        </div>
      </Html>
      {active && (
        <pointLight position={[0, 1.2, 0.3]} intensity={0.35} distance={2.2} color="#ffd9a0" />
      )}
    </group>
  );
}

export default InteriorNpcMesh;
