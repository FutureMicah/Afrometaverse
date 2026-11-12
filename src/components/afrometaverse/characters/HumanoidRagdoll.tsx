/**
 * Rapier humanoid soft-ragdoll.
 * Capsule/sphere rigid bodies + spring constraints (stable across Rapier versions).
 * Requires <Physics> from @react-three/rapier.
 */

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  BallCollider,
  CapsuleCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import type { RagdollSegmentId } from "@/lib/mixamoRetarget";

type Props = {
  origin?: [number, number, number];
  impulse?: [number, number, number];
  active?: boolean;
  color?: string;
  scale?: number;
  onHipsMove?: (x: number, y: number, z: number) => void;
};

const REST: Record<
  RagdollSegmentId,
  { pos: [number, number, number]; halfH: number; radius: number }
> = {
  hips: { pos: [0, 0.95, 0], halfH: 0.08, radius: 0.12 },
  spine: { pos: [0, 1.25, 0], halfH: 0.16, radius: 0.11 },
  head: { pos: [0, 1.58, 0], halfH: 0.06, radius: 0.1 },
  leftUpperArm: { pos: [-0.28, 1.35, 0], halfH: 0.12, radius: 0.05 },
  leftLowerArm: { pos: [-0.48, 1.1, 0], halfH: 0.12, radius: 0.045 },
  rightUpperArm: { pos: [0.28, 1.35, 0], halfH: 0.12, radius: 0.05 },
  rightLowerArm: { pos: [0.48, 1.1, 0], halfH: 0.12, radius: 0.045 },
  leftUpperLeg: { pos: [-0.1, 0.6, 0], halfH: 0.16, radius: 0.07 },
  leftLowerLeg: { pos: [-0.1, 0.22, 0], halfH: 0.16, radius: 0.055 },
  rightUpperLeg: { pos: [0.1, 0.6, 0], halfH: 0.16, radius: 0.07 },
  rightLowerLeg: { pos: [0.1, 0.22, 0], halfH: 0.16, radius: 0.055 },
};

const SPRINGS: { parent: RagdollSegmentId; child: RagdollSegmentId; restLen: number }[] = [
  { parent: "hips", child: "spine", restLen: 0.32 },
  { parent: "spine", child: "head", restLen: 0.34 },
  { parent: "spine", child: "leftUpperArm", restLen: 0.3 },
  { parent: "leftUpperArm", child: "leftLowerArm", restLen: 0.32 },
  { parent: "spine", child: "rightUpperArm", restLen: 0.3 },
  { parent: "rightUpperArm", child: "rightLowerArm", restLen: 0.32 },
  { parent: "hips", child: "leftUpperLeg", restLen: 0.36 },
  { parent: "leftUpperLeg", child: "leftLowerLeg", restLen: 0.38 },
  { parent: "hips", child: "rightUpperLeg", restLen: 0.36 },
  { parent: "rightUpperLeg", child: "rightLowerLeg", restLen: 0.38 },
];

const SEGMENTS = Object.keys(REST) as RagdollSegmentId[];
const STIFFNESS = 28;
const DAMPING = 4.5;

export function HumanoidRagdoll({
  origin = [0, 0, 0],
  impulse = [0, 0, 0],
  active = true,
  color = "#8d5524",
  scale = 1,
  onHipsMove,
}: Props) {
  const bodies = useRef<Partial<Record<RagdollSegmentId, RapierRigidBody | null>>>({});
  const impulseApplied = useRef(false);

  useEffect(() => {
    if (!active || impulseApplied.current) return;
    const t = setTimeout(() => {
      const hips = bodies.current.hips;
      const spine = bodies.current.spine;
      if (hips) {
        hips.applyImpulse({ x: impulse[0], y: impulse[1] + 0.8, z: impulse[2] }, true);
        hips.applyTorqueImpulse({ x: impulse[2] * 0.2, y: 0.15, z: -impulse[0] * 0.2 }, true);
      }
      if (spine) {
        spine.applyImpulse(
          { x: impulse[0] * 0.5, y: impulse[1] * 0.3, z: impulse[2] * 0.5 },
          true,
        );
      }
      impulseApplied.current = true;
    }, 40);
    return () => clearTimeout(t);
  }, [active, impulse]);

  useFrame((_, dt) => {
    if (!active) return;
    const clamped = Math.min(dt, 0.033);

    for (const link of SPRINGS) {
      const a = bodies.current[link.parent];
      const b = bodies.current[link.child];
      if (!a || !b) continue;

      const pa = a.translation();
      const pb = b.translation();
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dy, dz) || 0.0001;
      const rest = link.restLen * scale;
      const stretch = dist - rest;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const force = stretch * STIFFNESS;

      const va = a.linvel();
      const vb = b.linvel();
      const closing = (vb.x - va.x) * nx + (vb.y - va.y) * ny + (vb.z - va.z) * nz;
      const damp = closing * DAMPING;
      const f = (force + damp) * clamped;

      a.applyImpulse({ x: nx * f, y: ny * f, z: nz * f }, true);
      b.applyImpulse({ x: -nx * f, y: -ny * f, z: -nz * f }, true);
    }

    if (onHipsMove) {
      const hips = bodies.current.hips;
      if (hips) {
        const t = hips.translation();
        onHipsMove(t.x, t.y, t.z);
      }
    }
  });

  if (!active) return null;

  return (
    <group>
      {SEGMENTS.map((id) => {
        const rest = REST[id];
        const isHead = id === "head";
        const pos: [number, number, number] = [
          origin[0] + rest.pos[0] * scale,
          origin[1] + rest.pos[1] * scale,
          origin[2] + rest.pos[2] * scale,
        ];
        return (
          <RigidBody
            key={id}
            ref={(rb) => {
              bodies.current[id] = rb;
            }}
            position={pos}
            colliders={false}
            linearDamping={0.35}
            angularDamping={0.5}
            density={id === "hips" ? 2.8 : id.includes("Leg") ? 1.5 : 1.1}
          >
            {isHead ? (
              <BallCollider args={[rest.radius * scale]} />
            ) : (
              <CapsuleCollider args={[rest.halfH * scale, rest.radius * scale]} />
            )}
            <mesh castShadow>
              {isHead ? (
                <sphereGeometry args={[rest.radius * scale, 12, 10]} />
              ) : (
                <capsuleGeometry
                  args={[rest.radius * scale, rest.halfH * 2 * scale, 6, 10]}
                />
              )}
              <meshStandardMaterial color={color} roughness={0.65} />
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}

export function SpawnRagdoll({
  position,
  impulse = [1.5, 2, 0.5],
  color = "#6b4423",
}: {
  position: [number, number, number];
  impulse?: [number, number, number];
  color?: string;
}) {
  return (
    <HumanoidRagdoll origin={position} impulse={impulse} active color={color} scale={1} />
  );
}

export default HumanoidRagdoll;
