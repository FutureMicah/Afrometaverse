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

/** Build one grass-tuft mesh: fan of tapered multi-segment blades. */
function makeTuftGeometry(bladeCount = 9, height = 0.72, width = 0.26): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < bladeCount; i++) {
    const a = (i / bladeCount) * Math.PI * 2 + (i % 3) * 0.1;
    const h = height * (0.55 + (i % 5) * 0.12);
    const lean = 0.1 + (i % 4) * 0.05;
    const tipX = Math.cos(a) * lean;
    const tipZ = Math.sin(a) * lean;
    const hw = width * (0.3 + (i % 3) * 0.14);
    const bx = Math.cos(a + Math.PI / 2) * hw;
    const bz = Math.sin(a + Math.PI / 2) * hw;
    const mx = tipX * 0.45;
    const mz = tipZ * 0.45;
    const mh = h * 0.55;
    // two-segment blade for softer silhouette
    positions.push(-bx, 0, -bz, bx, 0, bz, mx, mh, mz);
    positions.push(mx - bx * 0.4, mh, mz - bz * 0.4, mx + bx * 0.4, mh, mz + bz * 0.4, tipX, h, tipZ);
    const shade = 0.7 + (i % 4) * 0.08;
    colors.push(0.26 * shade, 0.38 * shade, 0.11 * shade);
    colors.push(0.3 * shade, 0.42 * shade, 0.13 * shade);
    colors.push(0.4, 0.5, 0.16);
    colors.push(0.42, 0.52, 0.17);
    colors.push(0.5, 0.58, 0.2);
    colors.push(0.6, 0.66, 0.26);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Realistic savannah grass — instanced multi-blade tufts + short ground cover.
 * Tufts cluster along path edges and compound rings; wind bends the whole clump.
 */
export function SavannahGrass({
  count = 560,
  windIntensity = 0.55,
}: {
  count?: number;
  windIntensity?: number;
}) {
  const tallRef = useRef<THREE.InstancedMesh>(null);
  const shortRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const placements = useMemo(() => {
    const out: { x: number; z: number; s: number; phase: number; hue: number; short: boolean }[] = [];
    // Seeded-ish clusters so grass forms natural patches, not uniform dots
    const clusters = 28;
    for (let c = 0; c < clusters; c++) {
      const ring = c / clusters;
      const radius = 6.5 + ring * 22 + (c % 5) * 1.2;
      const baseA = (c / clusters) * Math.PI * 2;
      const cx = Math.cos(baseA) * radius;
      const cz = Math.sin(baseA) * radius;
      const inCluster = 12 + (c % 6);
      for (let j = 0; j < inCluster; j++) {
        if (out.length >= count) break;
        const ja = Math.random() * Math.PI * 2;
        const jd = Math.random() * 2.8;
        const x = cx + Math.cos(ja) * jd;
        const z = cz + Math.sin(ja) * jd;
        if (Math.hypot(x, z) < 5.0) continue;
        out.push({
          x,
          z,
          s: 0.7 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random(),
          short: Math.random() < 0.35,
        });
      }
    }
    // Fill remaining random near paths
    while (out.length < count) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.random() * 20;
      const x = Math.cos(a) * r + (Math.random() - 0.5) * 2;
      const z = Math.sin(a) * r + (Math.random() - 0.5) * 2;
      if (Math.hypot(x, z) < 5.0) continue;
      out.push({
        x,
        z,
        s: 0.6 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random(),
        short: Math.random() < 0.4,
      });
    }
    return out;
  }, [count]);

  const tallGeo = useMemo(() => makeTuftGeometry(9, 0.78, 0.28), []);
  const shortGeo = useMemo(() => makeTuftGeometry(7, 0.4, 0.22), []);

  const tallCount = placements.filter((p) => !p.short).length;
  const shortCount = placements.length - tallCount;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Travelling wind wave + gust envelope
    const windAngle = 0.65;
    const gust = 0.5 + 0.5 * Math.sin(t * 0.32);
    let ti = 0;
    let si = 0;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]!;
      const spatial = p.x * 0.2 + p.z * 0.14;
      const primary = Math.sin(t * 2.2 + spatial + p.phase) * 0.48 * windIntensity * gust;
      const secondary = Math.sin(t * 3.6 + spatial * 1.4 + p.phase * 0.7) * 0.18 * windIntensity;
      const tertiary = Math.cos(t * 1.15 + p.phase) * 0.1 * windIntensity;
      const bend = primary + secondary;
      const rotX = Math.cos(windAngle) * bend + tertiary;
      const rotZ = Math.sin(windAngle) * bend;
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(rotX, p.phase, rotZ);
      const sm = p.short ? 0.9 : 1;
      dummy.scale.set(p.s * sm, p.s * (1 + Math.abs(bend) * 0.06), p.s * sm);
      dummy.updateMatrix();

      const r = 0.28 + (1 - p.hue) * 0.38;
      const g = 0.36 + p.hue * 0.32;
      color.setRGB(r, g, 0.09 + p.hue * 0.07);

      if (p.short && shortRef.current) {
        shortRef.current.setMatrixAt(si, dummy.matrix);
        shortRef.current.setColorAt(si, color);
        si++;
      } else if (tallRef.current) {
        tallRef.current.setMatrixAt(ti, dummy.matrix);
        tallRef.current.setColorAt(ti, color);
        ti++;
      }
    }
    if (tallRef.current) {
      tallRef.current.instanceMatrix.needsUpdate = true;
      if (tallRef.current.instanceColor) tallRef.current.instanceColor.needsUpdate = true;
    }
    if (shortRef.current) {
      shortRef.current.instanceMatrix.needsUpdate = true;
      if (shortRef.current.instanceColor) shortRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={tallRef} args={[tallGeo, undefined, Math.max(1, tallCount)]} frustumCulled={false}>
        <meshStandardMaterial
          color="#5a7030"
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.92}
          metalness={0}
        />
      </instancedMesh>
      <instancedMesh ref={shortRef} args={[shortGeo, undefined, Math.max(1, shortCount)]} frustumCulled={false}>
        <meshStandardMaterial
          color="#4a6028"
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.95}
          metalness={0}
        />
      </instancedMesh>
    </group>
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
