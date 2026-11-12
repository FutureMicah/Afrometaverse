/**
 * Mixamo-rigged player (Soldier.glb) with AnimationMixer crossfade blending.
 * Clips: Idle, Walk, Run, TPose — retarget-ready via mixamoRetarget helpers.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { retargetClipsToSkeleton } from "@/lib/mixamoRetarget";

const RIGGED_URL = "/models/rigged/Soldier.glb";

useGLTF.preload(RIGGED_URL);

type MoveState = "idle" | "walk" | "run" | "ride";

type Props = {
  moveState?: MoveState;
  /** World yaw (radians) */
  rotationY?: number;
  position?: [number, number, number];
  scale?: number;
  visible?: boolean;
  /** Tint materials toward skin / fabric */
  color?: string;
};

/**
 * Drop-in Mixamo character with smooth Idle ↔ Walk ↔ Run blending.
 */
export function RiggedPlayer({
  moveState = "idle",
  rotationY = 0,
  position = [0, 0, 0],
  scale = 1,
  visible = true,
  color,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(RIGGED_URL);

  // Clone so multiple instances don't share skeleton pose
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as unknown as THREE.Group;
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (color && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ("color" in m && m.color) {
              (m as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(color), 0.55);
            }
          });
        }
      }
    });
    return c;
  }, [scene, color]);

  // Retarget clips onto this clone's skeleton (no-op when names match)
  const clips = useMemo(
    () => retargetClipsToSkeleton(animations, clone),
    [animations, clone],
  );

  const { actions, mixer } = useAnimations(clips, group);
  const current = useRef<string | null>(null);

  // Crossfade when moveState changes
  useEffect(() => {
    if (!actions) return;
    const target =
      moveState === "run"
        ? "Run"
        : moveState === "walk"
          ? "Walk"
          : "Idle";

    // Prefer exact name; fall back to case-insensitive match
    const action =
      actions[target] ??
      actions[Object.keys(actions).find((k) => k.toLowerCase() === target.toLowerCase()) ?? ""];

    if (!action) return;
    if (current.current === target) return;

    const prev = current.current ? actions[current.current] : null;
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (prev && prev !== action) {
      prev.fadeOut(0.22);
      action.fadeIn(0.22).play();
    } else {
      action.play();
    }
    current.current = target;
  }, [moveState, actions]);

  // Ensure mixer ticks (drei useAnimations usually does this, keep explicit safety)
  useFrame((_, dt) => {
    mixer?.update(dt);
  });

  if (!visible) return null;

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]} scale={scale} dispose={null}>
      <primitive object={clone} />
    </group>
  );
}

/**
 * List available clip names from the Soldier pack (debug / UI).
 */
export function useSoldierClipNames(): string[] {
  const { animations } = useGLTF(RIGGED_URL);
  return useMemo(() => animations.map((a) => a.name), [animations]);
}

export default RiggedPlayer;
