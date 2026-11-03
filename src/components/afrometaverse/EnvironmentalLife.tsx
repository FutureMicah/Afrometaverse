/**
 * Ground-level life & organic detail: insects, mushrooms, shells,
 * paw prints, feathers, scales cues. Lightweight so chunks stay mobile-friendly.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleHeight, sampleRegion } from "@/lib/worldGen";
import { WORLD_CHUNK_SIZE } from "@/lib/worldConfig";

function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Cluster of mushrooms under trees / damp ground */
export function MushroomCluster({
  x,
  z,
  count = 4,
  phase = 0,
}: {
  x: number;
  z: number;
  count?: number;
  phase?: number;
}) {
  const y = sampleHeight(x, z);
  const items = useMemo(() => {
    const out: { ox: number; oz: number; h: number; r: number; stem: number; color: string }[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        ox: (seeded(i, 1 + phase) - 0.5) * 0.5,
        oz: (seeded(i, 2 + phase) - 0.5) * 0.5,
        h: 0.04 + seeded(i, 3 + phase) * 0.06,
        r: 0.04 + seeded(i, 4 + phase) * 0.05,
        stem: 0.012 + seeded(i, 5 + phase) * 0.01,
        color: seeded(i, 6 + phase) > 0.5 ? "#d4a060" : "#c8b070",
      });
    }
    return out;
  }, [count, phase]);

  return (
    <group position={[x, y, z]}>
      {items.map((m, i) => (
        <group key={i} position={[m.ox, 0, m.oz]}>
          <mesh position={[0, m.h * 0.45, 0]} castShadow>
            <cylinderGeometry args={[m.stem, m.stem * 1.1, m.h, 5]} />
            <meshStandardMaterial color="#e8dcc8" roughness={0.95} />
          </mesh>
          <mesh position={[0, m.h * 0.95, 0]} castShadow>
            <sphereGeometry args={[m.r, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={m.color} roughness={0.88} />
          </mesh>
          {/* Underside gills cue */}
          <mesh position={[0, m.h * 0.88, 0]} rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[m.r * 0.85, 8]} />
            <meshStandardMaterial color="#c8b898" roughness={1} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Coastal / river shells */
export function Shell({
  x,
  z,
  phase = 0,
}: {
  x: number;
  z: number;
  phase?: number;
}) {
  const y = sampleHeight(x, z) + 0.01;
  const rot = phase * 4;
  const scale = 0.6 + (phase % 1) * 0.5;
  const color = phase % 1 > 0.5 ? "#e8d0b0" : "#d0c0a8";

  return (
    <group position={[x, y, z]} rotation={[0.2, rot, 0.1]} scale={scale}>
      <mesh castShadow>
        <sphereGeometry args={[0.04, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0.02, 0, 0.01]} rotation={[0, 0.5, 0]}>
        <sphereGeometry args={[0.03, 5, 4, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
      </mesh>
    </group>
  );
}

/** Soft paw print pressed into dirt */
export function PawPrint({
  x,
  z,
  scale = 1,
  rotation = 0,
}: {
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
}) {
  const y = sampleHeight(x, z) + 0.008;
  return (
    <group position={[x, y, z]} rotation={[-Math.PI / 2, 0, rotation]} scale={scale}>
      {/* Pad */}
      <mesh>
        <circleGeometry args={[0.045, 8]} />
        <meshStandardMaterial color="#3a3028" roughness={1} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Toes */}
      {[
        [-0.035, 0.05],
        [-0.012, 0.06],
        [0.012, 0.06],
        [0.035, 0.05],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, pz, 0]}>
          <circleGeometry args={[0.016, 6]} />
          <meshStandardMaterial color="#3a3028" roughness={1} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Butterfly that flutters nearby */
export function Butterfly({
  x,
  z,
  phase = 0,
}: {
  x: number;
  z: number;
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const baseY = sampleHeight(x, z) + 0.6;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.x = x + Math.sin(t * 0.8 + phase) * 0.8;
    ref.current.position.z = z + Math.cos(t * 0.7 + phase) * 0.8;
    ref.current.position.y = baseY + Math.sin(t * 1.5 + phase) * 0.35;
    ref.current.rotation.y = t * 0.5 + phase;
    const flap = Math.sin(t * 12 + phase) * 0.6;
    if (wingL.current) wingL.current.rotation.z = 0.4 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.4 - flap;
  });

  const color = phase % 1 > 0.5 ? "#e8a020" : "#c04080";

  return (
    <group ref={ref} position={[x, baseY, z]} scale={0.45}>
      <mesh>
        <capsuleGeometry args={[0.015, 0.04, 3, 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>
      <mesh ref={wingL} position={[-0.04, 0, 0]}>
        <circleGeometry args={[0.06, 6]} />
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh ref={wingR} position={[0.04, 0, 0]}>
        <circleGeometry args={[0.06, 6]} />
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Beetle on the ground */
export function Beetle({
  x,
  z,
  phase = 0,
}: {
  x: number;
  z: number;
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const ox = Math.sin(t * 0.4 + phase) * 0.35;
    const oz = Math.cos(t * 0.35 + phase) * 0.3;
    const px = x + ox;
    const pz = z + oz;
    ref.current.position.set(px, sampleHeight(px, pz) + 0.015, pz);
    ref.current.rotation.y = Math.atan2(Math.cos(t * 0.4 + phase), -Math.sin(t * 0.35 + phase));
  });

  return (
    <group ref={ref} position={[x, sampleHeight(x, z), z]} scale={0.5}>
      <mesh castShadow>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#1a3a28" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <sphereGeometry args={[0.02, 5, 4]} />
        <meshStandardMaterial color="#0a2a18" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Tiny legs */}
      {[-1, 1].map((s) =>
        [0.02, 0, -0.02].map((lz, i) => (
          <mesh key={`${s}-${i}`} position={[s * 0.03, -0.015, lz]} rotation={[0, 0, s * 0.5]}>
            <cylinderGeometry args={[0.003, 0.003, 0.025, 3]} />
            <meshStandardMaterial color="#0a2010" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Feather resting on ground */
export function FallenFeather({
  x,
  z,
  phase = 0,
}: {
  x: number;
  z: number;
  phase?: number;
}) {
  const y = sampleHeight(x, z) + 0.012;
  const color = phase % 1 > 0.6 ? "#e8e0d0" : phase % 1 > 0.3 ? "#4a6a3a" : "#c49a3c";
  return (
    <group position={[x, y, z]} rotation={[-0.2, phase * 5, 0.15]} scale={0.7 + (phase % 1) * 0.4}>
      <mesh>
        <boxGeometry args={[0.02, 0.005, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.04, 0.003, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.85} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Scatter organic detail across a chunk centre.
 * Call once per streamed WorldChunk (outside village core).
 */
export function ChunkOrganicDetail({
  cx,
  cz,
  densityScale = 1,
}: {
  cx: number;
  cz: number;
  densityScale?: number;
}) {
  const region = sampleRegion(cx, cz);
  const seed = Math.floor(cx * 12.3 + cz * 7.7);

  const content = useMemo(() => {
    const mushrooms: { x: number; z: number; n: number; p: number }[] = [];
    const shells: { x: number; z: number; p: number }[] = [];
    const prints: { x: number; z: number; s: number; r: number }[] = [];
    const butterflies: { x: number; z: number; p: number }[] = [];
    const beetles: { x: number; z: number; p: number }[] = [];
    const feathers: { x: number; z: number; p: number }[] = [];

    const mushCount = region === "RAINFOREST" || region === "RIVERINE" ? Math.floor(3 * densityScale) : Math.floor(1 * densityScale);
    for (let i = 0; i < mushCount; i++) {
      mushrooms.push({
        x: cx + (seeded(seed + i, 10) - 0.5) * WORLD_CHUNK_SIZE * 0.7,
        z: cz + (seeded(seed + i, 11) - 0.5) * WORLD_CHUNK_SIZE * 0.7,
        n: 2 + Math.floor(seeded(seed + i, 12) * 4),
        p: seeded(seed + i, 13),
      });
    }

    if (region === "COASTAL" || region === "RIVERINE") {
      const sc = Math.floor(4 * densityScale);
      for (let i = 0; i < sc; i++) {
        shells.push({
          x: cx + (seeded(seed + i, 20) - 0.5) * WORLD_CHUNK_SIZE * 0.8,
          z: cz + (seeded(seed + i, 21) - 0.5) * WORLD_CHUNK_SIZE * 0.8,
          p: seeded(seed + i, 22),
        });
      }
    }

    const pc = Math.floor(3 * densityScale);
    for (let i = 0; i < pc; i++) {
      prints.push({
        x: cx + (seeded(seed + i, 30) - 0.5) * WORLD_CHUNK_SIZE * 0.6,
        z: cz + (seeded(seed + i, 31) - 0.5) * WORLD_CHUNK_SIZE * 0.6,
        s: 0.8 + seeded(seed + i, 32) * 0.6,
        r: seeded(seed + i, 33) * Math.PI * 2,
      });
    }

    if (region !== "HILLS") {
      const bc = Math.floor(2 * densityScale);
      for (let i = 0; i < bc; i++) {
        butterflies.push({
          x: cx + (seeded(seed + i, 40) - 0.5) * WORLD_CHUNK_SIZE * 0.5,
          z: cz + (seeded(seed + i, 41) - 0.5) * WORLD_CHUNK_SIZE * 0.5,
          p: seeded(seed + i, 42),
        });
      }
    }

    const betc = Math.floor(2 * densityScale);
    for (let i = 0; i < betc; i++) {
      beetles.push({
        x: cx + (seeded(seed + i, 50) - 0.5) * WORLD_CHUNK_SIZE * 0.6,
        z: cz + (seeded(seed + i, 51) - 0.5) * WORLD_CHUNK_SIZE * 0.6,
        p: seeded(seed + i, 52),
      });
    }

    if (region === "SAVANNAH" || region === "PLATEAU") {
      for (let i = 0; i < 2; i++) {
        feathers.push({
          x: cx + (seeded(seed + i, 60) - 0.5) * WORLD_CHUNK_SIZE * 0.5,
          z: cz + (seeded(seed + i, 61) - 0.5) * WORLD_CHUNK_SIZE * 0.5,
          p: seeded(seed + i, 62),
        });
      }
    }

    return { mushrooms, shells, prints, butterflies, beetles, feathers };
  }, [cx, cz, densityScale, region, seed]);

  return (
    <group>
      {content.mushrooms.map((m, i) => (
        <MushroomCluster key={`m${i}`} x={m.x} z={m.z} count={m.n} phase={m.p} />
      ))}
      {content.shells.map((s, i) => (
        <Shell key={`s${i}`} x={s.x} z={s.z} phase={s.p} />
      ))}
      {content.prints.map((p, i) => (
        <PawPrint key={`p${i}`} x={p.x} z={p.z} scale={p.s} rotation={p.r} />
      ))}
      {content.butterflies.map((b, i) => (
        <Butterfly key={`bf${i}`} x={b.x} z={b.z} phase={b.p} />
      ))}
      {content.beetles.map((b, i) => (
        <Beetle key={`be${i}`} x={b.x} z={b.z} phase={b.p} />
      ))}
      {content.feathers.map((f, i) => (
        <FallenFeather key={`f${i}`} x={f.x} z={f.z} phase={f.p} />
      ))}
    </group>
  );
}
