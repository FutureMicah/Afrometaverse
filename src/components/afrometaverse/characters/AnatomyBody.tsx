/**
 * Detailed human body from muscular-anatomy GLB studies (male / female).
 * Used for high-detail NPCs and optional realistic body base.
 * Models live in /public/models/{male,female}_anatomy.glb
 */

import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MALE_URL = "/models/male_anatomy.glb";
const FEMALE_URL = "/models/female_anatomy.glb";

// Preload so first NPC does not hitch
useGLTF.preload(MALE_URL);
useGLTF.preload(FEMALE_URL);

export type AnatomyGender = "male" | "female";

type AnatomyBodyProps = {
  gender?: AnatomyGender;
  /** Target standing height in metres (approx). */
  height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  /** Skin / flesh tint applied over anatomy materials. */
  skinColor?: string;
  /** 0 = full anatomy colors, 1 = fully tinted skin. */
  skinBlend?: number;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Breathing + weight-shift idle (default on). */
  idleMotion?: boolean;
  /** Phase offset so villagers don't sync. */
  idlePhase?: number;
};

/**
 * Centres the model on XZ, plants feet on y=0, scales so body height ≈ `height`.
 */
function normalizeRoot(
  scene: THREE.Object3D,
  targetHeight: number,
): { root: THREE.Group; fitScale: number } {
  const root = new THREE.Group();
  const clone = scene.clone(true);
  root.add(clone);

  // Compute bounds
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Centre horizontally; shift so minY sits on 0
  clone.position.x -= center.x;
  clone.position.z -= center.z;
  clone.position.y -= box.min.y;

  const fitScale = size.y > 0.001 ? targetHeight / size.y : 1;
  root.scale.setScalar(fitScale);

  return { root, fitScale };
}

function applySkinTint(
  root: THREE.Object3D,
  skinColor: string,
  blend: number,
  castShadow: boolean,
  receiveShadow: boolean,
) {
  const skin = new THREE.Color(skinColor);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((mat) => {
      const m = (mat as THREE.MeshStandardMaterial).clone();
      if (m.color && blend > 0) {
        m.color.lerp(skin, Math.min(1, Math.max(0, blend)));
      }
      // Soft flesh-like response
      if ("roughness" in m) m.roughness = Math.min(0.95, (m.roughness ?? 0.7) * 0.9 + 0.15);
      if ("metalness" in m) m.metalness = Math.min(m.metalness ?? 0, 0.08);
      m.needsUpdate = true;
      return m;
    }) as THREE.Material;
  });
}

export function AnatomyBody({
  gender = "male",
  height = 1.7,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  skinColor = "#8d5524",
  skinBlend = 0.55,
  visible = true,
  castShadow = true,
  receiveShadow = true,
  idleMotion = true,
  idlePhase = 0,
}: AnatomyBodyProps) {
  const url = gender === "female" ? FEMALE_URL : MALE_URL;
  const { scene } = useGLTF(url);
  const motionRef = useRef<THREE.Group>(null);

  const prepared = useMemo(() => {
    const { root } = normalizeRoot(scene, height);
    applySkinTint(root, skinColor, skinBlend, castShadow, receiveShadow);
    return root;
  }, [scene, height, skinColor, skinBlend, castShadow, receiveShadow]);

  // Dispose cloned materials on change
  useEffect(() => {
    return () => {
      prepared.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose?.());
      });
    };
  }, [prepared]);

  useFrame(({ clock }) => {
    if (!idleMotion || !motionRef.current) return;
    const t = clock.elapsedTime + idlePhase;
    const g = motionRef.current;

    // --- Breathing (asymmetric: slower inhale, quicker exhale) ---
    // Triangle-ish cycle shaped with sin^3 for a soft hold at full breath
    const breathCycle = t * 0.9; // ~9 breaths / 10s — calm resting rate
    const raw = Math.sin(breathCycle);
    const breath =
      Math.sign(raw) * Math.pow(Math.abs(raw), 1.6) * 0.01 +
      Math.sin(breathCycle * 2.1) * 0.0015; // small secondary rib motion

    // --- Weight transfer: settle on one leg, then ease to the other ---
    // Smoothstep between sides every ~3.5s instead of constant rocking
    const transferPeriod = 3.6 + (idlePhase % 1) * 0.8;
    const transferT = (t % transferPeriod) / transferPeriod;
    // Ease in-out so weight "settles" then moves
    const ease =
      transferT < 0.15
        ? transferT / 0.15
        : transferT > 0.85
          ? (1 - transferT) / 0.15
          : 1;
    const side = Math.sin((t / transferPeriod) * Math.PI) ; // -1 … 1
    const weightLean = side * 0.028 * Math.min(1, ease + 0.3);

    // --- Micro-sway: layered low-amplitude noise (looks less looped) ---
    const microX =
      Math.sin(t * 0.37) * 0.008 +
      Math.sin(t * 0.91 + 1.3) * 0.004;
    const microY =
      Math.sin(t * 0.23 + 0.7) * 0.012 +
      Math.sin(t * 0.67 + 2.1) * 0.005;
    const microZ =
      Math.sin(t * 0.31 + 0.4) * 0.006 +
      Math.sin(t * 1.05 + 1.7) * 0.003;

    // Occasional deeper posture reset (sigh) every ~12–16s
    const sighPeriod = 13.5 + (idlePhase % 1) * 3;
    const sighPhase = (t % sighPeriod) / sighPeriod;
    const sigh =
      sighPhase > 0.72 && sighPhase < 0.88
        ? Math.sin(((sighPhase - 0.72) / 0.16) * Math.PI) * 0.014
        : 0;

    const breathAmt = breath + sigh;

    // Keep feet planted: lean with rotation, only tiny lateral slide
    g.scale.set(
      scale * (1 - breathAmt * 0.35),
      scale * (1 + breathAmt),
      scale * (1 - breathAmt * 0.2),
    );
    g.position.x = position[0] + weightLean * 0.15;
    g.position.y = position[1] + breathAmt * 0.4;
    g.position.z = position[2];
    g.rotation.x = rotation[0] + microX + breathAmt * 0.15;
    g.rotation.y = rotation[1] + microY;
    g.rotation.z = rotation[2] + weightLean + microZ;
  });

  if (!visible) return null;

  return (
    <group
      ref={motionRef}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={prepared} />
    </group>
  );
}

/** Standing villager with breathing + weight-shift idle */
export function AnatomyVillager({
  gender = "male",
  position = [0, 0, 0],
  rotationY = 0,
  skinColor = "#8d5524",
  height = 1.65,
  idlePhase,
}: {
  gender?: AnatomyGender;
  position?: [number, number, number];
  rotationY?: number;
  skinColor?: string;
  height?: number;
  /** Unique phase so nearby villagers don't breathe in sync. */
  idlePhase?: number;
}) {
  const phase = idlePhase ?? (position[0] * 0.37 + position[2] * 0.21);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <AnatomyBody
        gender={gender}
        height={height}
        skinColor={skinColor}
        skinBlend={0.62}
        castShadow
        receiveShadow
        idleMotion
        idlePhase={phase}
      />
    </group>
  );
}

export default AnatomyBody;
