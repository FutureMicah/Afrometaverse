/**
 * Day 1 — Atmospheric Life (visual pillars)
 * Dust motes, spirit fireflies, dry grass sway, lightning flash for storms.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";

/** Daytime heat / Harmattan dust motes */
export function DustMotes({
  count = 80,
  active = true,
}: {
  count?: number;
  active?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 28,
        y: Math.random() * 8 + 0.5,
        z: (Math.random() - 0.5) * 24,
        speed: 0.004 + Math.random() * 0.01,
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  );

  useFrame(({ clock }) => {
    if (!mesh.current || !active) return;
    const t = clock.elapsedTime;
    particles.forEach((p, i) => {
      p.y -= p.speed;
      if (p.y < 0.2) p.y = 8;
      p.x += Math.sin(t * 0.4 + p.phase) * 0.003;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.04 + Math.sin(t + p.phase) * 0.015);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={SCENE_PALETTE.moccasin} transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  );
}

/** Night / dewy spirit fireflies */
export function SpiritFireflies({
  count = 40,
  active = true,
}: {
  count?: number;
  active?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!mesh.current || !active) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const x = Math.sin(t * 0.45 + i * 1.7) * 9 + Math.cos(i * 2.1) * 3;
      const y = 1.2 + Math.cos(t * 0.35 + i) * 1.4 + (i % 5) * 0.15;
      const z = Math.cos(t * 0.55 + i * 1.3) * 8 + Math.sin(i * 0.9) * 2;
      const s = 0.06 + Math.sin(t * 3 + i) * 0.04;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(Math.max(0.02, s));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={SCENE_PALETTE.fireflyGreen} transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}

/** Wind-reactive dry savannah grass tufts */
export function SavannahGrass({
  count = 220,
  windIntensity = 0.4,
}: {
  count?: number;
  windIntensity?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const placements = useMemo(() => {
    const out: { x: number; z: number; s: number; phase: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 36;
      const z = (Math.random() - 0.5) * 32;
      if (Math.hypot(x, z) < 10) continue; // clear village core
      out.push({
        x,
        z,
        s: 0.5 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return out;
  }, [count]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    placements.forEach((p, i) => {
      const sway = Math.sin(t * 2.2 + p.phase) * 0.18 * windIntensity;
      dummy.position.set(p.x, 0.15 * p.s, p.z);
      dummy.rotation.set(sway, p.phase, sway * 0.5);
      dummy.scale.set(0.15 * p.s, 0.45 * p.s, 0.08 * p.s);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, placements.length]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={SCENE_PALETTE.dryGrass}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        roughness={1}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/** Occasional lightning flash during rainy weather */
export function LightningFlash({ active = false }: { active?: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const nextFlash = useRef(3 + Math.random() * 4);

  useFrame(({ clock }) => {
    if (!light.current || !active) {
      if (light.current) light.current.intensity = 0;
      return;
    }
    const t = clock.elapsedTime;
    if (t > nextFlash.current) {
      light.current.intensity = 8 + Math.random() * 12;
      light.current.position.set(
        (Math.random() - 0.5) * 30,
        12 + Math.random() * 8,
        (Math.random() - 0.5) * 30,
      );
      // brief double flash
      nextFlash.current = t + 0.08 + Math.random() * 0.12;
      if (Math.random() > 0.4) {
        // schedule longer gap after burst
        setTimeout(() => {
          nextFlash.current = t + 4 + Math.random() * 8;
        }, 150);
      }
    } else {
      light.current.intensity *= 0.82;
    }
  });

  if (!active) return null;

  return <pointLight ref={light} color={SCENE_PALETTE.moonlight} intensity={0} distance={80} decay={1.5} />;
}

/** Sacred grove soft mist patch */
export function SacredGroveMist({
  position = [8, 0.5, -8] as [number, number, number],
  active = true,
}: {
  position?: [number, number, number];
  active?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.4) * 0.15;
  });
  if (!active) return null;
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[3.5, 12, 12]} />
        <meshBasicMaterial color={SCENE_PALETTE.mistGreen} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <pointLight color={SCENE_PALETTE.wispGreen} intensity={0.35} distance={12} />
    </group>
  );
}
