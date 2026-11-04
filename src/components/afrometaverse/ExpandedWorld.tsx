/**
 * Expanded world layer: rainforest, river, mountains, valleys, outer communities.
 * Instanced where possible so the larger map stays mobile-friendly.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BhungaHut, VillageHearth } from "@/components/afrometaverse/HeritageArchitecture";
import { SCENE_PALETTE } from "@/lib/scenePalette";

function seeded(i: number, salt = 1) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Dense tropical canopy — deep green, tall trunks, layered crowns */
function RainforestPatch({
  cx,
  cz,
  count = 80,
  radius = 28,
  darkness = 0.55,
}: {
  cx: number;
  cz: number;
  count?: number;
  radius?: number;
  darkness?: number;
}) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; h: number; r: number; lean: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = seeded(i, 2) * Math.PI * 2;
      const d = Math.sqrt(seeded(i, 3)) * radius;
      out.push({
        x: cx + Math.cos(a) * d,
        z: cz + Math.sin(a) * d,
        h: 4.5 + seeded(i, 4) * 5.5,
        r: 0.7 + seeded(i, 5) * 1.4,
        lean: (seeded(i, 6) - 0.5) * 0.15,
      });
    }
    return out;
  }, [cx, cz, count, radius]);

  const trunk = SCENE_PALETTE.woodDark;
  const canopy = darkness > 0.5 ? "#0f3d24" : "#1a5c32";
  const canopy2 = darkness > 0.5 ? "#0a2e1a" : "#247a42";

  return (
    <group>
      {/* understory shadow pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} receiveShadow>
        <circleGeometry args={[radius * 0.95, 24]} />
        <meshStandardMaterial color="#0d2818" roughness={1} transparent opacity={0.55} />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[t.lean, seeded(i, 7) * 6, 0]}>
          <mesh position={[0, t.h * 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.22, t.h * 0.7, 5]} />
            <meshStandardMaterial color={trunk} roughness={1} />
          </mesh>
          <mesh position={[0, t.h * 0.75, 0]} castShadow>
            <sphereGeometry args={[t.r, 6, 5]} />
            <meshStandardMaterial color={canopy} roughness={1} flatShading />
          </mesh>
          <mesh position={[t.r * 0.3, t.h * 0.85, t.r * 0.2]} castShadow>
            <sphereGeometry args={[t.r * 0.65, 5, 4]} />
            <meshStandardMaterial color={canopy2} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {/* low fog volume cue */}
      <mesh position={[cx, 1.2, cz]}>
        <cylinderGeometry args={[radius * 0.7, radius * 0.85, 2.2, 12, 1, true]} />
        <meshStandardMaterial color="#1a3d2a" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Meandering river ribbon */
function River({
  points,
  width = 3.2,
}: {
  points: [number, number][];
  width?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const shape = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0.04, z)),
      false,
      "catmullrom",
      0.35,
    );
    const radial = 5;
    const tubular = Math.max(32, points.length * 8);
    return new THREE.TubeGeometry(curve, tubular, width * 0.5, radial, false);
  }, [points, width]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const m = mesh.current.material as THREE.MeshStandardMaterial;
    if (m) m.emissiveIntensity = 0.08 + Math.sin(clock.elapsedTime * 0.7) * 0.03;
  });

  return (
    <mesh ref={mesh} geometry={shape} rotation={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={SCENE_PALETTE.waterDeep}
        roughness={0.25}
        metalness={0.15}
        emissive={SCENE_PALETTE.waterDeep}
        emissiveIntensity={0.1}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

/** Rocky mountain ridges */
function MountainRidge({
  cx,
  cz,
  peaks = 7,
  spread = 22,
  height = 14,
}: {
  cx: number;
  cz: number;
  peaks?: number;
  spread?: number;
  height?: number;
}) {
  const rocks = useMemo(() => {
    return Array.from({ length: peaks }, (_, i) => {
      const a = (i / peaks) * Math.PI * 1.4 - 0.4;
      const d = 2 + seeded(i, 11) * spread;
      return {
        x: cx + Math.cos(a) * d * 0.4 + (seeded(i, 12) - 0.5) * 6,
        z: cz + Math.sin(a) * d * 0.35 + (seeded(i, 13) - 0.5) * 5,
        h: height * (0.45 + seeded(i, 14) * 0.7),
        r: 3 + seeded(i, 15) * 5,
      };
    });
  }, [cx, cz, peaks, spread, height]);

  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, r.h * 0.35, r.z]} castShadow receiveShadow>
          <coneGeometry args={[r.r, r.h, 5]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? SCENE_PALETTE.stone : SCENE_PALETTE.stoneGrey}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
      {/* valley shadow between ridges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]} receiveShadow>
        <circleGeometry args={[spread * 0.55, 16]} />
        <meshStandardMaterial color="#3a342c" roughness={1} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/** Outer community: ring of bhungas + hearth */
function OuterCommunity({
  position,
  name,
  seed = 1,
  scale = 1,
  wetness = 0,
}: {
  position: [number, number, number];
  name: string;
  seed?: number;
  scale?: number;
  wetness?: number;
}) {
  const huts = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + seed;
      const d = 3.2 + seeded(i + seed, 20) * 1.4;
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        rot: a + Math.PI,
        s: 0.85 + seeded(i + seed, 21) * 0.35,
      };
    });
  }, [seed]);

  return (
    <group position={position}>
      <VillageHearth position={[0, 0, 0]} />
      {huts.map((h, i) => (
        <BhungaHut
          key={i}
          position={[h.x, 0, h.z]}
          rotation={h.rot}
          scale={h.s * scale}
          climateIntensity={wetness}
          windIntensity={0.35}
          band={i % 2 === 0}
        />
      ))}
      {/* name marker disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[1.2, 16]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/** Savannah tree scatter — mixed acacia / fig / baobab / bush silhouettes */
function SavannahTrees({ cx, cz, count = 40, radius = 30 }: { cx: number; cz: number; count?: number; radius?: number }) {
  const trees = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const a = seeded(i, 30) * Math.PI * 2;
      const d = 4 + Math.sqrt(seeded(i, 31)) * radius;
      const kind = Math.floor(seeded(i, 34) * 4); // 0 acacia, 1 fig, 2 baobab, 3 bush
      return {
        x: cx + Math.cos(a) * d,
        z: cz + Math.sin(a) * d,
        h: 2.0 + seeded(i, 32) * 2.8,
        s: 0.7 + seeded(i, 33) * 0.9,
        kind,
      };
    });
  }, [cx, cz, count, radius]);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          {t.kind === 2 ? (
            <>
              <mesh position={[0, t.h * 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.28, 0.38, t.h * 0.7, 7]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={1} />
              </mesh>
              <mesh position={[0, t.h * 0.75, 0]} castShadow>
                <sphereGeometry args={[t.s * 0.85, 6, 5]} />
                <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
              </mesh>
            </>
          ) : t.kind === 3 ? (
            <>
              <mesh position={[0, 0.4, 0]} castShadow>
                <sphereGeometry args={[t.s * 0.55, 5, 4]} />
                <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} flatShading />
              </mesh>
              <mesh position={[t.s * 0.2, 0.45, 0.1]} castShadow>
                <sphereGeometry args={[t.s * 0.35, 5, 4]} />
                <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
              </mesh>
            </>
          ) : t.kind === 0 ? (
            <>
              <mesh position={[0, t.h * 0.4, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.1, t.h * 0.8, 5]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
              </mesh>
              <mesh position={[0, t.h * 0.85, 0]} scale={[1.7, 0.35, 1.7]} castShadow>
                <sphereGeometry args={[t.s * 0.7, 6, 4]} />
                <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, t.h * 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.16, t.h * 0.7, 5]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
              </mesh>
              <mesh position={[0, t.h * 0.75, 0]} castShadow>
                <sphereGeometry args={[t.s, 6, 5]} />
                <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} flatShading />
              </mesh>
              <mesh position={[t.s * 0.3, t.h * 0.7, t.s * 0.15]} castShadow>
                <sphereGeometry args={[t.s * 0.55, 5, 4]} />
                <meshStandardMaterial color={"#246b38"} roughness={1} flatShading />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

export function ExpandedWorld({ wetness = 0 }: { wetness?: number }) {
  // River: from NW mountains down through valley past village toward SE rainforest / coast
  const riverPts: [number, number][] = useMemo(
    () => [
      [-55, -48],
      [-40, -35],
      [-28, -22],
      [-18, -12],
      [-10, -6],
      [-5.5, -5.2],
      [2, -8],
      [12, -14],
      [22, -18],
      [35, -12],
      [48, 5],
      [58, 22],
    ],
    [],
  );

  return (
    <group>
      {/* Deep rainforest — SE / S */}
      <RainforestPatch cx={42} cz={38} count={90} radius={32} darkness={0.7} />
      <RainforestPatch cx={58} cz={18} count={15} radius={22} darkness={0.6} />
      <RainforestPatch cx={28} cz={52} count={22} radius={18} darkness={0.75} />

      {/* Secondary forest belts */}
      <RainforestPatch cx={-35} cz={40} count={20} radius={16} darkness={0.45} />
      <RainforestPatch cx={-48} cz={-10} count={18} radius={14} darkness={0.5} />

      {/* Mountains — N / NE */}
      <MountainRidge cx={-40} cz={-45} peaks={8} spread={28} height={16} />
      <MountainRidge cx={45} cz={-40} peaks={6} spread={20} height={12} />
      <MountainRidge cx={-55} cz={15} peaks={5} spread={16} height={10} />

      {/* River spine */}
      <River points={riverPts} width={3.6} />

      {/* Savannah fill around village ring — denser canopy */}
      <SavannahTrees cx={0} cz={0} count={14} radius={42} />
      <SavannahTrees cx={25} cz={-25} count={15} radius={24} />
      <SavannahTrees cx={-30} cz={25} count={14} radius={22} />
      <SavannahTrees cx={18} cz={20} count={20} radius={16} />
      <SavannahTrees cx={-8} cz={-6} count={18} radius={14} />
      <SavannahTrees cx={12} cz={8} count={15} radius={12} />
      <SavannahTrees cx={-20} cz={10} count={16} radius={15} />
      <SavannahTrees cx={5} cz={-18} count={14} radius={14} />
      <SavannahTrees cx={8} cz={-12} count={22} radius={12} />
      <SavannahTrees cx={3} cz={-14} count={15} radius={10} />
      <SavannahTrees cx={20} cz={-16} count={25} radius={10} />

      {/* Outer communities */}
      <OuterCommunity position={[-32, 0, 18]} name="Upland Compound" seed={1} wetness={wetness} />
      <OuterCommunity position={[30, 0, -28]} name="Ridge Settlement" seed={2} scale={1.05} wetness={wetness} />
      <OuterCommunity position={[48, 0, 28]} name="Forest Edge" seed={3} scale={0.95} wetness={wetness} />
      <OuterCommunity position={[-28, 0, -32]} name="River Gate" seed={4} wetness={wetness} />
      <OuterCommunity position={[18, 0, 42]} name="Canopy Camp" seed={5} scale={0.9} wetness={wetness} />
      <OuterCommunity position={[-45, 0, 5]} name="Hill Kraal" seed={6} wetness={wetness} />
    </group>
  );
}

export default ExpandedWorld;
