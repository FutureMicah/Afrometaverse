import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  DISTRICT_WORLD,
  SAFEHOUSES,
  TRANSPORT_SPEED,
  useRoamStore,
  type TransportId,
} from "@/stores/roamStore";
import { INTERIOR_LIST, DOOR_RADIUS } from "@/data/interiors";
import { useInteriorStore, enterBuilding, type InteriorId } from "@/stores/interiorStore";
import { takeTouchLook, touchInput } from "@/lib/touchInput";

import { useCharacterStore } from "@/stores/characterStore";
import { DayNightSky } from "@/components/afrometaverse/DayNightSky";
import { ChunkedWorld } from "@/components/afrometaverse/ChunkedWorld";
import { ChunkVillageProps, StaticVillageProps } from "@/components/afrometaverse/VillageProps";
import { groupByChunk, chunksContaining, chunkOrigin } from "@/lib/chunkAssign";
import { chunkOf } from "@/lib/chunkStreaming";
import { currentRenderTier } from "@/lib/renderTier";
import { StylizedCharacter } from "@/components/afrometaverse/characters/StylizedCharacter";
import {
  HeritageTerrain,
  BiomeFlora,
  LivingWater,
} from "@/components/afrometaverse/HeritageTerrain";
import {
  YorubaCompound,
  IgboCompound,
  VillageHearth,
} from "@/components/afrometaverse/HeritageArchitecture";
import {
  DustMotes,
  SpiritFireflies,
  SavannahGrass,
  LightningFlash,
  SacredGroveMist,
} from "@/components/afrometaverse/AtmosphericLife";

const DISTRICT_LAYOUT = {
  "town-market": { x: -3, z: 2.5, color: "#f59e0b", label: "Town Market", neon: "#fbbf24" },
  "civic-centre": { x: 0, z: -1.5, color: "#14b8a6", label: "Civic Centre", neon: "#2dd4bf" },
  creekside: { x: -5.5, z: -3.5, color: "#3b82f6", label: "Creekside", neon: "#60a5fa" },
  port: { x: 5.5, z: 2.5, color: "#f97316", label: "The Port", neon: "#fb923c" },
} as const;

const BOUNDS = { minX: -14, maxX: 14, minZ: -11, maxZ: 12 };

/** Ground + road palette tuned to PH laterite / village dirt refs */
const N = {
  asphalt: "#1a1a22",
  asphaltLine: "#a78bfa",
  sidewalk: "#2a2a35",
  /** Red laterite carriageway (refs: rural PH roads) */
  laterite: "#b4532a",
  lateriteDark: "#8a3a1c",
  lateriteLight: "#d4a574",
  dust: "#c4a574",
  earth: "#6b4a2e",
  earthDeep: "#3d2a18",
  grassEdge: "#4a5c28",
  grassDry: "#7a8a3a",
  towerDark: "#12121a",
  towerMid: "#1e1e2e",
  towerWarm: "#2a1f28",
  neonPink: "#ff2d95",
  neonCyan: "#22d3ee",
  neonLime: "#a3e635",
  neonPurple: "#c084fc",
  neonAmber: "#fbbf24",
  neonOrange: "#fb923c",
  water: "#0c4a6e",
  fog: "#1a0a2e",
};

type TowerSpec = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: string;
  neon: string;
  windows?: boolean;
};

/** Dense skyline — tall mixed-use towers around the four hubs */
const TOWERS: TowerSpec[] = [
  // Market cluster
  { x: -4.5, z: 4.2, w: 1.4, d: 1.3, h: 4.2, hue: N.towerMid, neon: N.neonAmber },
  { x: -2.2, z: 4.5, w: 1.2, d: 1.1, h: 5.5, hue: N.towerDark, neon: N.neonPink },
  { x: -5.2, z: 2.0, w: 1.3, d: 1.4, h: 3.8, hue: N.towerWarm, neon: N.neonOrange },
  { x: -1.4, z: 1.8, w: 1.0, d: 1.0, h: 6.2, hue: N.towerDark, neon: N.neonCyan },
  { x: -3.5, z: 5.5, w: 1.1, d: 1.0, h: 3.2, hue: N.towerMid, neon: N.neonLime },
  // Civic
  { x: 1.8, z: -2.8, w: 1.5, d: 1.4, h: 5.0, hue: N.towerMid, neon: N.neonCyan },
  { x: -1.8, z: -3.0, w: 1.2, d: 1.2, h: 4.4, hue: N.towerDark, neon: N.neonPurple },
  { x: 2.6, z: -0.6, w: 1.1, d: 1.0, h: 7.0, hue: N.towerDark, neon: N.neonPink },
  { x: -2.4, z: -0.4, w: 1.0, d: 1.0, h: 4.8, hue: N.towerWarm, neon: N.neonAmber },
  { x: 0.9, z: -4.2, w: 1.3, d: 1.2, h: 5.8, hue: N.towerMid, neon: N.neonCyan },
  // Creek
  { x: -7.2, z: -2.0, w: 1.3, d: 1.2, h: 3.5, hue: N.towerWarm, neon: N.neonCyan },
  { x: -6.5, z: -4.8, w: 1.4, d: 1.3, h: 2.8, hue: N.towerMid, neon: N.neonCyan },
  { x: -8.0, z: -3.5, w: 1.1, d: 1.1, h: 4.0, hue: N.towerDark, neon: N.neonPurple },
  // Port industrial tall
  { x: 7.0, z: 1.4, w: 1.8, d: 1.5, h: 4.5, hue: N.towerDark, neon: N.neonOrange },
  { x: 4.5, z: 4.2, w: 1.4, d: 1.3, h: 6.5, hue: N.towerMid, neon: N.neonPink },
  { x: 7.5, z: 3.8, w: 1.3, d: 1.4, h: 3.6, hue: N.towerWarm, neon: N.neonAmber },
  { x: 8.8, z: 2.2, w: 1.2, d: 1.2, h: 5.2, hue: N.towerDark, neon: N.neonCyan },
  // Centre densification
  { x: 3.2, z: 1.2, w: 1.1, d: 1.0, h: 5.5, hue: N.towerMid, neon: N.neonLime },
  { x: -3.8, z: -1.0, w: 1.0, d: 1.0, h: 4.6, hue: N.towerDark, neon: N.neonPink },
  { x: 1.0, z: 2.0, w: 0.95, d: 0.95, h: 8.0, hue: N.towerDark, neon: N.neonPurple },
  { x: -0.5, z: 3.5, w: 1.0, d: 1.0, h: 3.9, hue: N.towerWarm, neon: N.neonAmber },
  { x: 4.0, z: -3.5, w: 1.2, d: 1.1, h: 4.2, hue: N.towerMid, neon: N.neonCyan },
  { x: 9.0, z: -1.0, w: 1.3, d: 1.2, h: 3.4, hue: N.towerDark, neon: N.neonOrange },
  { x: -8.5, z: 1.5, w: 1.2, d: 1.1, h: 3.0, hue: N.towerMid, neon: N.neonLime },
  { x: 6.0, z: -2.5, w: 1.1, d: 1.0, h: 5.0, hue: N.towerDark, neon: N.neonPink },
];

/** Daylight village sky — no neon city yet; players grow this settlement later */
function VillageDaySky() {
  return (
    <>
      <color attach="background" args={["#b8c9d4"]} />
      <fog attach="fog" args={["#cbb892", 16, 48]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#dfe8f0", "#7a5a32", 0.5]} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={1.45}
        color="#ffe8c8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-8, 6, -5]} intensity={0.42} color="#9eb6c8" />
      <directionalLight position={[0, 8, -12]} intensity={0.35} color="#f5d0fe" />
    </>
  );
}

function NeonGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={N.earthDeep} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
        <planeGeometry args={[48, 42]} />
        <meshStandardMaterial color={N.earth} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[30, 26]} />
        <meshStandardMaterial color={N.dust} roughness={0.92} />
      </mesh>
      {/* outer savannah grass belts */}
      {(
        [
          [0, 14, 18, 6],
          [0, -14, 18, 6],
          [16, 0, 6, 22],
          [-16, 0, 6, 22],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={i % 2 ? N.grassEdge : N.grassDry} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/** Laterite / red-dirt roads — dual tracks, soft shoulders, no neon centre lines */
function NeonRoads() {
  const segs = [
    { x: 0, z: 0.2, w: 26, d: 2.0 },
    { x: 0, z: 4.8, w: 18, d: 1.55 },
    { x: 0, z: -2.8, w: 20, d: 1.55 },
    { x: -3.2, z: 1.0, w: 1.55, d: 14 },
    { x: 2.8, z: 0.5, w: 1.55, d: 13 },
    { x: 5.5, z: 1.5, w: 1.45, d: 10 },
    { x: -5.5, z: -1.2, w: 1.4, d: 11 },
  ];
  return (
    <group>
      {segs.map((r, i) => {
        const alongX = r.w >= r.d;
        const shoulderW = alongX ? r.w + 0.7 : r.w + 0.55;
        const shoulderD = alongX ? r.d + 0.55 : r.d + 0.7;
        // dual tyre ruts
        const rutOffset = alongX ? r.d * 0.18 : r.w * 0.18;
        const rutW = alongX ? r.w * 0.96 : 0.22;
        const rutD = alongX ? 0.22 : r.d * 0.96;
        return (
          <group key={i}>
            {/* Soft dust shoulder */}
            <mesh position={[r.x, 0.02, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[shoulderW, shoulderD]} />
              <meshStandardMaterial color={N.dust} roughness={0.98} />
            </mesh>
            {/* Main laterite bed */}
            <mesh position={[r.x, 0.035, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[r.w, r.d]} />
              <meshStandardMaterial color={N.laterite} roughness={0.9} />
            </mesh>
            {/* Darker compacted centre */}
            <mesh position={[r.x, 0.038, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[r.w * 0.72, r.d * 0.72]} />
              <meshStandardMaterial color={N.lateriteDark} roughness={0.88} />
            </mesh>
            {/* Tyre tracks */}
            <mesh
              position={alongX ? [r.x, 0.04, r.z - rutOffset] : [r.x - rutOffset, 0.04, r.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[rutW, rutD]} />
              <meshStandardMaterial color={N.lateriteDark} roughness={0.95} />
            </mesh>
            <mesh
              position={alongX ? [r.x, 0.04, r.z + rutOffset] : [r.x + rutOffset, 0.04, r.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[rutW, rutD]} />
              <meshStandardMaterial color={N.lateriteDark} roughness={0.95} />
            </mesh>
            {/* Sparse dry grass edge strips */}
            <mesh
              position={alongX ? [r.x, 0.041, r.z - r.d * 0.55] : [r.x - r.w * 0.55, 0.041, r.z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={alongX ? [r.w * 0.9, 0.12] : [0.12, r.d * 0.9]} />
              <meshStandardMaterial color={N.grassDry} roughness={1} />
            </mesh>
            <mesh
              position={alongX ? [r.x, 0.041, r.z + r.d * 0.55] : [r.x + r.w * 0.55, 0.041, r.z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={alongX ? [r.w * 0.9, 0.12] : [0.12, r.d * 0.9]} />
              <meshStandardMaterial color={N.grassEdge} roughness={1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function NeonTower({ spec }: { spec: TowerSpec }) {
  const floors = Math.max(3, Math.floor(spec.h / 0.55));
  return (
    <group position={[spec.x, 0, spec.z]}>
      <mesh castShadow receiveShadow position={[0, spec.h / 2, 0]}>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
        <meshStandardMaterial color={spec.hue} metalness={0.25} roughness={0.55} />
      </mesh>
      {/* Window grid — emissive strips */}
      {Array.from({ length: floors }).map((_, fi) => {
        const y = 0.4 + fi * (spec.h / floors);
        const lit = (fi + Math.abs(Math.floor(spec.x * 3))) % 3 !== 0;
        return (
          <mesh key={fi} position={[0, y, spec.d / 2 + 0.02]}>
            <planeGeometry args={[spec.w * 0.78, 0.22]} />
            <meshStandardMaterial
              color={lit ? spec.neon : "#0f172a"}
              emissive={lit ? spec.neon : "#000000"}
              emissiveIntensity={lit ? 0.65 : 0}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}
      {/* Rooftop neon bar */}
      <mesh position={[0, spec.h + 0.12, 0]}>
        <boxGeometry args={[spec.w * 0.9, 0.1, spec.d * 0.9]} />
        <meshStandardMaterial color={spec.neon} emissive={spec.neon} emissiveIntensity={0.8} />
      </mesh>
      {/* Antenna */}
      {spec.h > 5 && (
        <mesh position={[0, spec.h + 0.7, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 5]} />
          <meshStandardMaterial color="#94a3b8" emissive={spec.neon} emissiveIntensity={0.3} />
        </mesh>
      )}
    </group>
  );
}

function NeonSign({
  x,
  y,
  z,
  w,
  h,
  color,
  rot = 0,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  color: string;
  rot?: number;
}) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rot, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} side={2} />
    </mesh>
  );
}

function DistrictHubNeon({
  position,
  color,
  neon,
  active,
  near,
  label,
}: {
  position: [number, number, number];
  color: string;
  neon: string;
  active: boolean;
  near: boolean;
  label: string;
}) {
  const lit = active || near;
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.2, 24]} />
        <meshStandardMaterial
          color="#1a1025"
          emissive={neon}
          emissiveIntensity={lit ? 0.25 : 0.08}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.6, 0]}>
        <boxGeometry args={[2.0, 3.2, 2.0]} />
        <meshStandardMaterial
          color={lit ? "#2a2035" : color}
          emissive={neon}
          emissiveIntensity={lit ? 0.45 : 0.12}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[2.2, 0.2, 2.2]} />
        <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={0.9} />
      </mesh>
      {/* Vertical neon edges */}
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 1.02, 1.6, sz * 1.02]}>
            <boxGeometry args={[0.06, 3.2, 0.06]} />
            <meshStandardMaterial color={neon} emissive={neon} emissiveIntensity={0.7} />
          </mesh>
        )),
      )}
      {near && (
        <mesh position={[0, 4.2, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.2} />
        </mesh>
      )}
      <NeonSign x={0} y={2.4} z={1.08} w={1.6} h={0.35} color={neon} />
    </group>
  );
}

function MarketNeonLane() {
  const stalls = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        x: -4.8 + (i % 5) * 0.85,
        z: 2.4 + Math.floor(i / 5) * 0.95,
        neon: [N.neonAmber, N.neonPink, N.neonCyan, N.neonLime, N.neonOrange][i % 5],
      })),
    [],
  );
  return (
    <group>
      <mesh position={[-3.2, 2.0, 2.9]} rotation={[0.05, 0, 0]}>
        <planeGeometry args={[4.5, 1.6]} />
        <meshStandardMaterial
          color={N.neonPink}
          emissive={N.neonPink}
          emissiveIntensity={0.25}
          transparent
          opacity={0.35}
          side={2}
        />
      </mesh>
      {stalls.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          {[ -0.35, 0.35 ].map((px, j) => (
            <mesh key={j} position={[px, 0.7, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 1.4, 5]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}
          <mesh position={[0, 1.35, 0]} rotation={[0.15, 0, 0]}>
            <planeGeometry args={[0.8, 0.55]} />
            <meshStandardMaterial color={s.neon} emissive={s.neon} emissiveIntensity={0.7} side={2} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.7, 0.08, 0.5]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/** Simple mud / thatch / zinc hut — starting village fabric (players develop the city later) */
/** Door and interior anchors: their chunks never unload, so doors keep working. */
const VILLAGE_PINNED_CHUNKS = chunksContaining(INTERIOR_LIST.map((d) => d.door));

/** Player focus for chunk streaming (set once; PlayerController moves the group). */
const playerFocusRef = { current: null as THREE.Object3D | null };

/** Huts, trees, walls and rocks for one streamed chunk, merged (see components/afrometaverse/VillageProps.tsx). */
function CreekWater() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.03 + Math.sin(clock.getElapsedTime() * 0.6) * 0.012;
    }
  });
  return (
    <group position={[-5.5, 0, -5.4]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.8, 28]} />
        <meshStandardMaterial
          color="#3d4a33"
          transparent
          opacity={0.88}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      {/* muddy bank ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.7, 4.4, 28]} />
        <meshStandardMaterial color={N.earth} roughness={1} />
      </mesh>
    </group>
  );
}

function PortNeon() {
  return (
    <group position={[6.5, 0, 2.8]}>
      <mesh position={[1.5, 3.0, 0]} castShadow>
        <boxGeometry args={[0.18, 6, 0.18]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[2.8, 3.0, 0]} castShadow>
        <boxGeometry args={[0.18, 6, 0.18]} />
        <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[2.15, 6.0, 0.6]} castShadow>
        <boxGeometry args={[2.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#fdba74" emissive="#f97316" emissiveIntensity={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.55 + (i % 2) * 0.7, 1.4 + i * 0.35]} castShadow>
          <boxGeometry args={[1.3, 0.7, 0.7]} />
          <meshStandardMaterial
            color={["#0ea5e9", "#eab308", "#a855f7"][i]}
            emissive={["#0ea5e9", "#eab308", "#a855f7"][i]}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function StreetLampsNeon() {
  const lamps: [number, number][] = [
    [-2, 0.9],
    [2.5, 0.9],
    [-3, 4.4],
    [3, 4.4],
    [-5, -2.2],
    [5.2, 2.0],
    [0, -2.4],
    [-6, -3.0],
    [7, 0],
    [-1, 5.5],
  ];
  return (
    <group>
      {lamps.map(([x, z], i) => {
        const c = [N.neonPink, N.neonCyan, N.neonPurple, N.neonAmber][i % 4];
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 2.8, 6]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0, 2.85, 0]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.4} />
            </mesh>
            <pointLight position={[0, 2.7, 0]} intensity={0.55} color={c} distance={6} />
          </group>
        );
      })}
    </group>
  );
}

function SimpleVehicle({
  position,
  color,
  kind,
}: {
  position: [number, number, number];
  color: string;
  kind: "bicycle" | "scooter" | "keke" | "okada" | "taxi" | "ferry";
}) {
  if (kind === "ferry") {
    return (
      <group position={position} scale={1.15}>
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 1.5, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      </group>
    );
  }
  if (kind === "okada" || kind === "scooter" || kind === "bicycle") {
    return (
      <group position={position} scale={kind === "bicycle" ? 0.85 : 0.9}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.45, 4, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.25, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.14, 0.035, 5, 10]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.25, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.14, 0.035, 5, 10]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    );
  }
  // keke / taxi
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.22, 0.2, 4, 8]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function PlayerAvatar({ transport }: { transport: TransportId }) {
  const appearance = useCharacterStore((s) => s.appearance);
  const equipped = useCharacterStore((s) => s.equipped);
  const moveState = useRoamStore((s) => s.moveState);
  void transport;
  return (
    <StylizedCharacter
      appearance={appearance}
      equipped={equipped}
      scale={1}
      animate
      detail
      moveState={moveState}
    />
  );
}

function nearestDistrict(x: number, z: number): string | null {
  let best: string | null = null;
  let bestDist = 3.2;
  for (const [id, pos] of Object.entries(DISTRICT_WORLD)) {
    const d = Math.hypot(x - pos.x, z - pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

// Reused every frame by PlayerController so the render loop does not allocate.
const cameraScratchDesired = new THREE.Vector3();
const cameraScratchLook = new THREE.Vector3();

function PlayerController({
  onDistrictChange,
}: {
  onDistrictChange?: (id: string | null) => void;
}) {
  const keys = useRef<Record<string, boolean>>({});
  const touchViewSeen = useRef(0);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    playerFocusRef.current = group.current;
    return () => {
      playerFocusRef.current = null;
    };
  }, []);
  const yawRef = useRef(0);
  const pitchRef = useRef(0.35);
  const pointerLocked = useRef(false);
  const { camera, gl } = useThree();
  const mode = useRoamStore((s) => s.mode);
  const transport = useRoamStore((s) => s.transport);
  const mountedVehicleId = useRoamStore((s) => s.mountedVehicleId);
  const setPosition = useRoamStore((s) => s.setPosition);
  const setFacing = useRoamStore((s) => s.setFacing);
  const setMoveState = useRoamStore((s) => s.setMoveState);
  const setNearDistrict = useRoamStore((s) => s.setNearDistrict);
  const setNearVehicle = useRoamStore((s) => s.setNearVehicle);
  const setInSafehouse = useRoamStore((s) => s.setInSafehouse);
  const updateMountedVehiclePose = useRoamStore((s) => s.updateMountedVehiclePose);
  const coolHeat = useRoamStore((s) => s.coolHeat);
  const worldVehicles = useRoamStore((s) => s.worldVehicles);
  const position = useRoamStore((s) => s.position);
  const heatTick = useRef(0);
  const jumpVel = useRef(0);
  const grounded = useRef(true);
  /** third = over-shoulder COD cam · first = through the eyes */
  const firstPerson = useRef(false);
  const fovRef = useRef(50);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === "Space") {
        e.preventDefault();
        keys.current["space"] = true;
      }
      if (e.key.toLowerCase() === "f" || e.key === "e") {
        const st = useRoamStore.getState();
        const ist = useInteriorStore.getState();
        if (ist.insideId) {
          // exit is handled by the interior overlay (it owns the room)
        } else if (st.mountedVehicleId) st.exitVehicle();
        else if (ist.nearDoorId) enterBuilding(ist.nearDoorId);
        else st.enterNearestVehicle();
      }
      // Click-to-lock hint: press R to request pointer lock
      if (e.key.toLowerCase() === "r" && mode !== "orbit") {
        gl.domElement.requestPointerLock?.();
      }
      // V toggles first-person (eyes) vs third-person (over shoulder)
      if (e.key.toLowerCase() === "v" && mode !== "orbit") {
        firstPerson.current = !firstPerson.current;
        // reset pitch comfort when switching
        if (firstPerson.current) pitchRef.current = 0;
        else pitchRef.current = 0.28;
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.code === "Space") keys.current["space"] = false;
    };
    const onLock = () => {
      pointerLocked.current = document.pointerLockElement === gl.domElement;
    };
    const onMove = (e: MouseEvent) => {
      if (mode === "orbit") return;
      if (document.pointerLockElement !== gl.domElement) return;
      const sens = firstPerson.current ? 0.0026 : 0.0022;
      yawRef.current -= e.movementX * sens;
      // third-person: limited orbit pitch · first-person: look nearly straight up/down
      const pMin = firstPerson.current ? -1.25 : 0.08;
      const pMax = firstPerson.current ? 1.35 : 1.2;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - e.movementY * sens,
        pMin,
        pMax,
      );
    };
    const onClick = () => {
      if (mode !== "orbit") gl.domElement.requestPointerLock?.();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("mousemove", onMove);
    gl.domElement.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("mousemove", onMove);
      gl.domElement.removeEventListener("click", onClick);
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock?.();
    };
  }, [gl, mode]);

  useFrame((_, dt) => {
    // Drain touch camera drag every frame (even in orbit) so it never piles up unseen.
    const touchLook = takeTouchLook();
    if (touchInput.viewToggles !== touchViewSeen.current) {
      touchViewSeen.current = touchInput.viewToggles;
      if (mode !== "orbit") {
        firstPerson.current = !firstPerson.current;
        pitchRef.current = firstPerson.current ? 0 : 0.28;
      }
    }
    if (mode === "orbit" || !group.current) return;

    // Touch look: same yaw/pitch math as the pointer-lock mousemove handler.
    if (touchLook.dx !== 0 || touchLook.dy !== 0) {
      const lookSens = firstPerson.current ? 0.0026 : 0.0022;
      yawRef.current -= touchLook.dx * lookSens;
      const pMin = firstPerson.current ? -1.25 : 0.08;
      const pMax = firstPerson.current ? 1.35 : 1.2;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - touchLook.dy * lookSens,
        pMin,
        pMax,
      );
    }

    const speedBase = TRANSPORT_SPEED[transport] ?? 4;
    const isFoot = transport === "foot";
    const sprint = !!(keys.current["shift"] || touchInput.sprint);
    const crouch = !!(keys.current["c"] || keys.current["control"] || touchInput.crouch);

    // COD-style: move relative to look yaw
    let inputX = 0;
    let inputZ = 0;
    if (keys.current["w"] || keys.current["arrowup"]) inputZ -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) inputZ += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) inputX -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) inputX += 1;
    // Virtual joystick (analog, already inside [-1, 1] after the deadzone)
    inputX += touchInput.move.x;
    inputZ += touchInput.move.y;
    inputX = THREE.MathUtils.clamp(inputX, -1, 1);
    inputZ = THREE.MathUtils.clamp(inputZ, -1, 1);

    const moving = inputX !== 0 || inputZ !== 0;
    let speedMul = 1;
    if (isFoot && sprint && moving && !crouch) speedMul = 1.85;
    if (isFoot && crouch) speedMul = 0.45;

    if (mountedVehicleId) setMoveState("ride");
    else if (!isFoot && moving) setMoveState("walk");
    else if (isFoot && moving) setMoveState(sprint && !crouch ? "run" : "walk");
    else setMoveState("idle");

    if (moving) {
      // Keys give a unit vector; the joystick keeps its analog magnitude (partial push = slower walk).
      const len = Math.hypot(inputX, inputZ);
      if (len > 1) {
        inputX /= len;
        inputZ /= len;
      }
      const yaw = yawRef.current;
      // Forward is -Z in look space
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const step = speedBase * speedMul * dt;
      let nextX = group.current.position.x + (forwardX * -inputZ + rightX * inputX) * step;
      let nextZ = group.current.position.z + (forwardZ * -inputZ + rightZ * inputX) * step;
      nextX = THREE.MathUtils.clamp(nextX, BOUNDS.minX, BOUNDS.maxX);
      nextZ = THREE.MathUtils.clamp(nextZ, BOUNDS.minZ, BOUNDS.maxZ);
      if (transport === "ferry") {
        nextZ = THREE.MathUtils.clamp(nextZ, -9, -2.5);
        nextX = THREE.MathUtils.clamp(nextX, -11, -2);
      }
      group.current.position.x = nextX;
      group.current.position.z = nextZ;
      // Body faces move direction when strafing mixed, else look yaw
      const faceYaw = Math.atan2(
        forwardX * -inputZ + rightX * inputX,
        forwardZ * -inputZ + rightZ * inputX,
      );
      group.current.rotation.y = faceYaw;
      setPosition([nextX, group.current.position.y, nextZ]);
      setFacing(faceYaw);
      if (mountedVehicleId) updateMountedVehiclePose([nextX, 0, nextZ], faceYaw);
      const near = nearestDistrict(nextX, nextZ);
      setNearDistrict(near);
      useInteriorStore.getState().setNearDoor(nearestDoor(nextX, nextZ));
      onDistrictChange?.(near);
    } else {
      group.current.rotation.y = yawRef.current;
      setFacing(yawRef.current);
    }

    // Jump (foot only)
    if (isFoot && !mountedVehicleId) {
      if ((keys.current["space"] || touchInput.jump) && grounded.current) {
        jumpVel.current = 4.2;
        grounded.current = false;
      }
      jumpVel.current -= 14 * dt;
      let y = group.current.position.y + jumpVel.current * dt;
      if (y <= (crouch ? 0.35 : 0.55)) {
        y = crouch ? 0.35 : 0.55;
        jumpVel.current = 0;
        grounded.current = true;
      }
      group.current.position.y = y;
    } else {
      group.current.position.y = 0.55;
    }

    const px = group.current.position.x;
    const pz = group.current.position.z;
    let bestV: string | null = null;
    let bestD = 1.6;
    for (const v of worldVehicles) {
      if (v.occupied) continue;
      const d = Math.hypot(px - v.position[0], pz - v.position[2]);
      if (d < bestD) {
        bestD = d;
        bestV = v.id;
      }
    }
    setNearVehicle(bestV);
    let sh: string | null = null;
    for (const s of SAFEHOUSES) {
      if (Math.hypot(px - s.x, pz - s.z) < s.radius) {
        sh = s.id;
        break;
      }
    }
    setInSafehouse(sh);
    heatTick.current += dt;
    if (sh && heatTick.current > 1) {
      heatTick.current = 0;
      const house = SAFEHOUSES.find((x) => x.id === sh);
      if (house) coolHeat(house.coolRate * 0.15);
    }

    // Camera: third-person over-shoulder OR first-person eyes
    const target = group.current.position;
    const cy = yawRef.current;
    const cp = pitchRef.current;
    const sprinting = !!((keys.current["shift"] || touchInput.sprint) && isFoot && moving && !crouch);
    const fp = firstPerson.current && !mountedVehicleId;

    // Hide body mesh in first-person so you don't see your own head
    if (group.current) {
      group.current.visible = !fp;
    }

    const desired = cameraScratchDesired;
    const look = cameraScratchLook;

    if (fp) {
      // Eyes height (crouch lower)
      const eyeY = target.y + (crouch ? 1.05 : 1.62);
      desired.set(target.x, eyeY, target.z);
      // Look direction from yaw/pitch (FPS style)
      const lookDist = 12;
      look.set(
        target.x - Math.sin(cy) * Math.cos(cp) * lookDist,
        eyeY + Math.sin(cp) * lookDist,
        target.z - Math.cos(cy) * Math.cos(cp) * lookDist,
      );
      // Snap to eye height every frame so the view never trails the body (no lag in FPS)
      camera.position.copy(desired);
    } else {
      // Third-person COD-style: distance + height + right-shoulder offset
      const dist = mountedVehicleId ? 9.5 : crouch ? 5.2 : sprinting ? 7.4 : 6.6;
      const height = mountedVehicleId ? 4.2 : crouch ? 2.6 : 3.35;
      const shoulder = mountedVehicleId ? 0.35 : 0.55; // offset to the right
      // Back vector from yaw/pitch
      const backX = Math.sin(cy) * Math.cos(cp);
      const backZ = Math.cos(cy) * Math.cos(cp);
      // Right vector (perpendicular on XZ)
      const rightX = Math.cos(cy);
      const rightZ = -Math.sin(cy);
      desired.set(
        target.x + backX * dist + rightX * shoulder,
        target.y + height + Math.sin(cp) * dist * 0.32,
        target.z + backZ * dist + rightZ * shoulder,
      );
      look.set(target.x + rightX * shoulder * 0.35, target.y + (crouch ? 1.05 : 1.4), target.z + rightZ * shoulder * 0.35);
      // Stronger follow lag = weightier COD feel
      const lag = sprinting ? 0.0025 : 0.0012;
      camera.position.lerp(desired, 1 - Math.pow(lag, dt));
    }

    camera.lookAt(look.x, look.y, look.z);

    // FOV: sprint widen, FPS slightly tighter, ADS-ready base
    const baseFov = fp ? 68 : 48;
    const targetFov = baseFov + (sprinting && !fp ? 8 : 0) + (mountedVehicleId ? 4 : 0);
    fovRef.current = THREE.MathUtils.lerp(fovRef.current, targetFov, 1 - Math.pow(0.002, dt));
    if ("fov" in camera) {
      (camera as THREE.PerspectiveCamera).fov = fovRef.current;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  useEffect(() => {
    if (group.current && mode !== "orbit") {
      const position = useRoamStore.getState().position;
      group.current.position.set(position[0], position[1], position[2]);
      yawRef.current = useRoamStore.getState().facing;
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "orbit") return null;

  const color =
    transport === "okada"
      ? "#f97316"
      : transport === "taxi"
        ? "#eab308"
        : transport === "ferry"
          ? "#0ea5e9"
          : transport === "keke"
            ? "#22c55e"
            : transport === "scooter"
              ? "#a855f7"
              : transport === "bicycle"
                ? "#64748b"
                : "#f8fafc";

  return (
    <group ref={group} position={position}>
      {mountedVehicleId && transport !== "foot" ? (
        <SimpleVehicle
          position={[0, 0, 0]}
          color={color}
          kind={transport as "bicycle" | "scooter" | "keke" | "okada" | "taxi" | "ferry"}
        />
      ) : (
        <PlayerAvatar transport={transport} />
      )}
    </group>
  );
}

function ParkedVehicles() {
  const worldVehicles = useRoamStore((s) => s.worldVehicles);
  const nearVehicleId = useRoamStore((s) => s.nearVehicleId);
  const colors: Record<string, string> = {
    bicycle: "#64748b",
    scooter: "#a855f7",
    keke: "#22c55e",
    okada: "#f97316",
    taxi: "#eab308",
    ferry: "#0ea5e9",
  };
  return (
    <group>
      {worldVehicles
        .filter((v) => !v.occupied)
        .map((v) => (
          <group key={v.id} position={v.position} rotation={[0, v.facing, 0]}>
            <SimpleVehicle position={[0, 0, 0]} color={colors[v.kind] ?? "#94a3b8"} kind={v.kind} />
            {nearVehicleId === v.id && (
              <mesh position={[0, 1.5, 0]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1} />
              </mesh>
            )}
          </group>
        ))}
    </group>
  );
}

const ROAD_PATHS: [number, number][][] = [
  [
    [-10, 0.2],
    [-5, 0.2],
    [0, 0.2],
    [5, 0.2],
    [10, 0.2],
  ],
  [
    [-5, 4.8],
    [0, 4.8],
    [5, 4.8],
    [5, 2],
    [2, 0.2],
  ],
  [
    [8, -2.8],
    [2, -2.8],
    [-3, -2.8],
    [-5.5, -3.5],
  ],
];

function TrafficFlow() {
  const vehicles = useMemo(
    () => [
      { path: 0, speed: 0.12, t0: 0, color: "#eab308", kind: "taxi" as const },
      { path: 0, speed: 0.18, t0: 0.4, color: "#f97316", kind: "okada" as const },
      { path: 1, speed: 0.15, t0: 0.2, color: "#a855f7", kind: "scooter" as const },
      { path: 1, speed: 0.2, t0: 0.65, color: "#22c55e", kind: "keke" as const },
      { path: 2, speed: 0.11, t0: 0.1, color: "#fbbf24", kind: "taxi" as const },
      { path: 2, speed: 0.17, t0: 0.55, color: "#fb923c", kind: "okada" as const },
    ],
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    vehicles.forEach((v, i) => {
      const g = refs.current[i];
      if (!g) return;
      const pts = ROAD_PATHS[v.path];
      const raw = (t * v.speed + v.t0) % 1;
      const f = raw * (pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, pts.length - 1);
      const local = f - i0;
      const [x0, z0] = pts[i0];
      const [x1, z1] = pts[i1];
      g.position.set(x0 + (x1 - x0) * local, 0, z0 + (z1 - z0) * local);
      g.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    });
  });
  return (
    <group>
      {vehicles.map((v, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <SimpleVehicle position={[0, 0, 0]} color={v.color} kind={v.kind} />
        </group>
      ))}
    </group>
  );
}

function NpcCrowd() {
  const npcs = useMemo(() => {
    const skins = ["#5c3317", "#8d5524", "#a0673f", "#c68642", "#d4a574", "#6b4423"];
    const shapes = ["slim", "average", "curvy", "athletic", "broad"] as const;
    return Array.from({ length: 8 }, (_, i) => ({
      appearance: {
        gender: (i % 2 === 0 ? "female" : "male") as "female" | "male",
        bodyShape: shapes[i % shapes.length],
        height: (["short", "average", "tall"] as const)[i % 3],
        skin: skins[i % skins.length],
        hair: (["braids", "short", "afro", "bob", "bun", "long"] as const)[i % 6],
        hairColor: "#1a1a1a",
        displayName: `Npc${i}`,
      },
      equipped: {
        top: "top-white-tee",
        bottom: "bottom-blue-jeans",
        outer: null,
        shoes: "shoes-basic",
        accessory: null,
        hat: null,
      },
      x: (i % 4) * 2.8 - 4.2,
      z: Math.floor(i / 4) * 3.2 - 0.5,
      phase: i * 0.85,
    }));
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    npcs.forEach((n, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x = n.x + Math.sin(t * 0.4 + n.phase) * 0.9;
      g.position.z = n.z + Math.cos(t * 0.35 + n.phase) * 0.55;
      g.rotation.y = t * 0.25 + n.phase;
    });
  });
  return (
    <group>
      {npcs.map((n, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[n.x, 0, n.z]}
        >
          <StylizedCharacter appearance={n.appearance} equipped={n.equipped} scale={0.95} animate detail moveState="walk" />
        </group>
      ))}
    </group>
  );
}

function WantedPatrols() {
  const wantedLevel = useRoamStore((s) => s.wantedLevel);
  const playerPos = useRoamStore((s) => s.position);
  const addHeat = useRoamStore((s) => s.addHeat);
  const pushLog = useRoamStore((s) => s.pushLog);
  const patrolCount = Math.min(5, wantedLevel + (wantedLevel > 0 ? 1 : 0));
  const refs = useRef<(THREE.Group | null)[]>([]);
  const alertCd = useRef(0);
  const seeds = useMemo(
    () =>
      [
        { x: 0, z: 0.2, phase: 0 },
        { x: -3, z: 2.5, phase: 1.2 },
        { x: 5, z: 1.5, phase: 2.1 },
        { x: -5, z: -2, phase: 0.6 },
        { x: 2, z: -2.5, phase: 1.7 },
      ],
    [],
  );
  useFrame(({ clock }, dt) => {
    if (patrolCount === 0) return;
    const t = clock.getElapsedTime();
    alertCd.current = Math.max(0, alertCd.current - dt);
    for (let i = 0; i < patrolCount; i++) {
      const g = refs.current[i];
      const s = seeds[i];
      if (!g || !s) continue;
      const spd = 0.35 + wantedLevel * 0.08;
      const ox = Math.sin(t * spd + s.phase) * (3.5 + wantedLevel * 0.4);
      const oz = Math.cos(t * spd * 0.85 + s.phase) * (2.8 + wantedLevel * 0.3);
      g.position.x = s.x + ox;
      g.position.z = s.z + oz;
      if (wantedLevel >= 2 && alertCd.current <= 0) {
        const d = Math.hypot(playerPos[0] - g.position.x, playerPos[2] - g.position.z);
        if (d < 2.2) {
          addHeat(3 + wantedLevel);
          pushLog("Patrol spotted you — heat up");
          alertCd.current = 4.5;
        }
      }
    }
  });
  if (patrolCount === 0) return null;
  return (
    <group>
      {seeds.slice(0, patrolCount).map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[s.x, 0, s.z]}
        >
          <mesh position={[0, 0.5, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.4, 4, 8]} />
            <meshStandardMaterial color="#0f766e" emissive="#14b8a6" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
          {wantedLevel >= 3 && (
            <mesh position={[0, 1.35, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.9} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function CityHotspots({ onInteract }: { onInteract?: (label: string) => void }) {
  const spots: { pos: [number, number, number]; r: number; label: string }[] = [
    { pos: [-3, 0, 2.5], r: 1.4, label: "Town Market" },
    { pos: [0, 0, -1.5], r: 1.3, label: "Civic Centre" },
    { pos: [-5.5, 0, -3.5], r: 1.3, label: "Creekside" },
    { pos: [5.5, 0, 2.5], r: 1.4, label: "The Port" },
  ];
  return (
    <group>
      {spots.map((s) => (
        <mesh
          key={s.label}
          position={[s.pos[0], 0.6, s.pos[2]]}
          onClick={(e) => {
            e.stopPropagation();
            onInteract?.(s.label);
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[s.r, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

export function AfroMetaverseScene({
  weather,
  selectedDistrict,
  onNearDistrict,
  onInteract,
}: {
  weather: {
    id: string;
    groundColor: string;
    fogColor: string;
    lightingMultiplier: number;
    rainIntensity: number;
    dustIntensity: number;
  };
  selectedDistrict: string | null;
  onNearDistrict?: (id: string | null) => void;
  onInteract?: (label: string) => void;
}) {
  const mode = useRoamStore((s) => s.mode);
  const nearDistrictId = useRoamStore((s) => s.nearDistrictId);
  const wetness = weather?.rainIntensity ?? 0;
  const dust = weather?.dustIntensity ?? 0;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 10, 15], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "#b8c9d4" }}
      tabIndex={0}
    >
      <DayNightSky dust={dust} />
      {/* Multi-biome heritage terrain (Day 2) — single draw call + climate tint */}
      <HeritageTerrain wetness={wetness} dust={dust} />
      {/* Keep a soft local dust pad under the village for road contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[28, 24]} />
        <meshStandardMaterial color={N.dust} roughness={0.92} transparent opacity={0.55} />
      </mesh>
      <NeonRoads />
      <LivingWater type="pond" position={[-5.5, 0, -5.4]} radius={3.8} />
      <BiomeFlora count={160} />
      {/* Always-loaded village dressing, merged once (was re-drawn in every loaded chunk). */}
      <StaticVillageProps />
      {/* Village huts, compound walls, trees and rocks stream per 64 m chunk; terrain, roads and props stay always-loaded. */}
      <ChunkedWorld
        tier={currentRenderTier()}
        focusRef={playerFocusRef}
        pinned={VILLAGE_PINNED_CHUNKS}
        buildChunk={(c) => <ChunkVillageProps chunk={c} />}
      />

      {/* Day 6 — tribal compounds + hearth */}
      <YorubaCompound
        position={[-9.5, 0, 4.5]}
        climateIntensity={wetness}
        windIntensity={0.35 + dust * 0.4}
      />
      <IgboCompound
        position={[9.0, 0, -4.5]}
        climateIntensity={wetness}
        windIntensity={0.35 + dust * 0.4}
      />
      <VillageHearth position={[-3.6, 0, 3.0]} />
      <VillageHearth position={[0.3, 0, -2.6]} />

      {/* Day 1 atmospheric life */}
      <DustMotes count={90} active={dust > 0.25 || wetness < 0.3} />
      <SpiritFireflies count={36} active={dust < 0.5} />
      <SavannahGrass count={200} windIntensity={0.35 + dust * 0.5} />
      <LightningFlash active={wetness > 0.55} />
      <SacredGroveMist position={[10, 0.6, -9]} />

      {/* Soft district markers — no neon towers; village grows into city later */}
      {Object.entries(DISTRICT_LAYOUT).map(([id, info]) => (
        <group key={id} position={[info.x, 0, info.z]}>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[selectedDistrict === id || nearDistrictId === id ? 1.1 : 0.75, 20]} />
            <meshStandardMaterial
              color={info.color}
              transparent
              opacity={selectedDistrict === id ? 0.45 : nearDistrictId === id ? 0.3 : 0.18}
              roughness={1}
            />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 1.8, 6]} />
            <meshStandardMaterial color="#5c4030" roughness={1} />
          </mesh>
          <mesh position={[0, 1.85, 0]}>
            <boxGeometry args={[0.55, 0.28, 0.06]} />
            <meshStandardMaterial color={info.color} roughness={0.7} />
          </mesh>
        </group>
      ))}

      <ParkedVehicles />
      <NpcCrowd />
      <WantedPatrols />
      <CityHotspots onInteract={onInteract} />
      <PlayerController onDistrictChange={onNearDistrict} />

      {mode === "orbit" && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={8}
          maxDistance={26}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1.2, 0]}
        />
      )}
    </Canvas>
  );
}

export default AfroMetaverseScene;
/** Nearest building door within DOOR_RADIUS (null if none). */
function nearestDoor(x: number, z: number): InteriorId | null {
  let best: InteriorId | null = null;
  let bestD = DOOR_RADIUS;
  for (const d of INTERIOR_LIST) {
    const dist = Math.hypot(x - d.door.x, z - d.door.z);
    if (dist < bestD) {
      bestD = dist;
      best = d.id;
    }
  }
  return best;
}


