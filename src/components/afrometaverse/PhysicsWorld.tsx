/**
 * Optional Rapier physics root for AfroMetaverse.
 * Wraps children in <Physics>. Safe to mount inside Canvas.
 */

import { type ReactNode, Suspense, useState, useEffect } from "react";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { HumanoidRagdoll } from "@/components/afrometaverse/characters/HumanoidRagdoll";
import { useRoamStore } from "@/stores/roamStore";

type Props = {
  children?: ReactNode;
  /** Gravity (default earth-like) */
  gravity?: [number, number, number];
};

/**
 * Physics provider. Place once under Canvas.
 * Ground collider is a large static box under the village.
 */
export function PhysicsWorld({ children, gravity = [0, -9.81, 0] }: Props) {
  return (
    <Physics gravity={gravity} interpolate>
      {/* Ground plane collider — village playable area */}
      <RigidBody type="fixed" position={[0, -0.05, 0]} colliders={false}>
        <CuboidCollider args={[80, 0.05, 80]} />
      </RigidBody>
      {children}
    </Physics>
  );
}

/**
 * Press-triggered ragdoll demo near the player.
 * Call `spawnRagdoll()` from UI or combat death later.
 */
export function RagdollDemoLayer() {
  const [spawns, setSpawns] = useState<
    { id: number; pos: [number, number, number]; impulse: [number, number, number] }[]
  >([]);
  const playerPos = useRoamStore((s) => s.position);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // R = spawn ragdoll in front of player (debug)
      if (e.key === "r" || e.key === "R") {
        if (e.repeat) return;
        const yaw = 0; // approximate; full yaw from camera later
        const forward: [number, number, number] = [
          playerPos[0] + Math.sin(yaw) * 2.5,
          playerPos[1] + 0.2,
          playerPos[2] + Math.cos(yaw) * 2.5,
        ];
        const impulse: [number, number, number] = [
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 2,
          (Math.random() - 0.5) * 4,
        ];
        setSpawns((prev) => [
          ...prev.slice(-4), // keep last 5
          { id: performance.now(), pos: forward, impulse },
        ]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerPos]);

  return (
    <Suspense fallback={null}>
      {spawns.map((s) => (
        <HumanoidRagdoll
          key={s.id}
          origin={s.pos}
          impulse={s.impulse}
          active
          color="#6b4423"
          scale={1}
        />
      ))}
    </Suspense>
  );
}

export default PhysicsWorld;
