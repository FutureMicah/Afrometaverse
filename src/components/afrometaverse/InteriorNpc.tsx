/**
 * Stylized seated/standing NPC figure for interiors — lightweight primitives only.
 * Idle breath, head glances, talk/discuss gestures when active or player is near.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
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
  const bob = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  const look = useRef({ yaw: 0, pitch: 0 });
  const { camera } = useThree();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime + phase.current;

    // Soft idle: breath + weight shift
    if (bob.current) bob.current.position.y = Math.sin(t * 1.55) * 0.012;
    if (torso.current) {
      torso.current.rotation.x = Math.sin(t * 1.4) * 0.02 + (active ? 0.04 : 0);
      torso.current.rotation.y = Math.sin(t * 0.55) * (active ? 0.06 : 0.02);
    }

    // Distance to camera (player viewpoint inside interior)
    const wp = new THREE.Vector3();
    group.current.getWorldPosition(wp);
    const dx = camera.position.x - wp.x;
    const dy = camera.position.y - (wp.y + 1.05);
    const dz = camera.position.z - wp.z;
    const dist = Math.hypot(dx, dz);
    const near = dist < 3.2;

    // Desired head look toward camera when near / speaking
    let targetYaw = Math.sin(t * 0.45) * 0.1 + Math.sin(t * 0.19) * 0.05;
    let targetPitch = Math.sin(t * 0.6) * 0.04;
    if (near && dist > 0.2) {
      let rel = Math.atan2(dx, dz) - npc.facing;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      targetYaw = THREE.MathUtils.clamp(rel, -0.9, 0.9) * 0.85;
      targetPitch = THREE.MathUtils.clamp(-Math.atan2(dy, dist) * 0.5, -0.3, 0.22);
    }

    if (active) {
      // Stronger nods while dialogue is open
      targetPitch += Math.sin(t * 3.4) * 0.1;
      targetYaw += Math.sin(t * 1.5) * 0.08;
    }

    look.current.yaw += (targetYaw - look.current.yaw) * 0.09;
    look.current.pitch += (targetPitch - look.current.pitch) * 0.09;
    if (head.current) {
      head.current.rotation.y = look.current.yaw;
      head.current.rotation.x = look.current.pitch;
    }

    // Arm gestures: idle hang vs talk / discuss
    if (leftArm.current && rightArm.current) {
      if (active) {
        const g = Math.sin(t * 2.6);
        const g2 = Math.sin(t * 1.9 + 0.7);
        leftArm.current.rotation.x = -0.45 + g * 0.5;
        leftArm.current.rotation.z = -0.35 + g2 * 0.15;
        leftArm.current.rotation.y = g * 0.2;
        rightArm.current.rotation.x = -0.3 + g2 * 0.4;
        rightArm.current.rotation.z = 0.25 + g * 0.12;
        rightArm.current.rotation.y = -g2 * 0.15;
      } else if (near) {
        const g = Math.sin(t * 1.8);
        leftArm.current.rotation.x = -0.15 + g * 0.12;
        leftArm.current.rotation.z = -0.2;
        rightArm.current.rotation.x = -0.55 + Math.sin(t * 2.2) * 0.25;
        rightArm.current.rotation.z = 0.15;
        rightArm.current.rotation.y = Math.sin(t * 2.2) * 0.15;
      } else {
        leftArm.current.rotation.x = Math.sin(t * 0.7) * 0.05 - 0.12;
        leftArm.current.rotation.z = -0.18;
        leftArm.current.rotation.y = 0;
        rightArm.current.rotation.x = Math.sin(t * 0.65 + 1) * 0.05 - 0.12;
        rightArm.current.rotation.z = 0.18;
        rightArm.current.rotation.y = 0;
      }
    }
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
      <group ref={bob}>
      {/* torso */}
      <group ref={torso}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.45, 4, 8]} />
          <meshStandardMaterial color={npc.cloth} roughness={0.9} />
        </mesh>
      </group>

      {/* arms */}
      <group ref={leftArm} position={[-0.2, 0.85, 0]}>
        <mesh position={[-0.06, -0.18, 0]} rotation={[0.15, 0, -0.4]} castShadow>
          <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
          <meshStandardMaterial color={npc.cloth} roughness={0.88} />
        </mesh>
        <mesh position={[-0.12, -0.38, 0.04]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={npc.skin} roughness={0.75} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.2, 0.85, 0]}>
        <mesh position={[0.06, -0.18, 0]} rotation={[0.15, 0, 0.4]} castShadow>
          <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
          <meshStandardMaterial color={npc.cloth} roughness={0.88} />
        </mesh>
        <mesh position={[0.12, -0.38, 0.04]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={npc.skin} roughness={0.75} />
        </mesh>
      </group>

      {/* head */}
      <group ref={head} position={[0, 1.05, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={npc.skin} roughness={0.75} />
        </mesh>
        {/* simple eyes so head turns read */}
        <mesh position={[-0.05, 0.02, 0.12]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.05, 0.02, 0.12]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[-0.05, 0.02, 0.14]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#2c1810" />
        </mesh>
        <mesh position={[0.05, 0.02, 0.14]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#2c1810" />
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
    </group>
  );
}

export default InteriorNpcMesh;
