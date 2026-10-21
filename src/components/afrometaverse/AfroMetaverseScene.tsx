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

import { useCharacterStore } from "@/stores/characterStore";
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
function VillageHut({
  x,
  z,
  rot = 0,
  w = 1.15,
  d = 1.05,
  h = 0.95,
  style = "thatch",
  wall = "#c4a06a",
}: {
  x: number;
  z: number;
  rot?: number;
  w?: number;
  d?: number;
  h?: number;
  style?: "thatch" | "zinc" | "round";
  wall?: string;
}) {
  const thatch = "#7a5c28";
  const thatchDark = "#5c4218";
  const zinc = "#7d8b96";
  const door = "#2a1c10";
  const isRound = style === "round";
  const roofY = h + (isRound ? 0.42 : 0.28);

  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      {/* packed earth pad under hut */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[Math.max(w, d) * 0.75, 12]} />
        <meshStandardMaterial color="#a87848" roughness={1} />
      </mesh>

      {/* walls */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.52, w * 0.55, h, 12]} />
        ) : (
          <boxGeometry args={[w, h, d]} />
        )}
        <meshStandardMaterial color={wall} roughness={0.98} />
      </mesh>

      {/* plaster band near base */}
      <mesh position={[0, 0.12, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.56, w * 0.56, 0.18, 12]} />
        ) : (
          <boxGeometry args={[w * 1.04, 0.18, d * 1.04]} />
        )}
        <meshStandardMaterial color="#d4b896" roughness={1} />
      </mesh>

      {/* door frame + dark opening */}
      <mesh position={[0, h * 0.38, isRound ? w * 0.52 : d / 2 + 0.015]} castShadow>
        <boxGeometry args={[0.32, h * 0.62, 0.04]} />
        <meshStandardMaterial color={door} roughness={1} />
      </mesh>
      <mesh position={[0, h * 0.72, isRound ? w * 0.54 : d / 2 + 0.03]}>
        <boxGeometry args={[0.38, 0.06, 0.05]} />
        <meshStandardMaterial color="#4a3420" roughness={1} />
      </mesh>

      {/* small window */}
      {!isRound && (
        <mesh position={[w * 0.35, h * 0.55, d / 2 + 0.012]}>
          <planeGeometry args={[0.18, 0.16]} />
          <meshStandardMaterial color="#1a1208" roughness={1} />
        </mesh>
      )}

      {/* roof */}
      {isRound ? (
        <>
          <mesh castShadow position={[0, roofY, 0]}>
            <coneGeometry args={[w * 0.78, 0.85, 12]} />
            <meshStandardMaterial color={thatch} roughness={0.95} />
          </mesh>
          <mesh position={[0, roofY + 0.28, 0]}>
            <coneGeometry args={[w * 0.35, 0.35, 8]} />
            <meshStandardMaterial color={thatchDark} roughness={1} />
          </mesh>
        </>
      ) : style === "zinc" ? (
        <>
          {/* simple gable: two tilted slabs */}
          <mesh
            castShadow
            position={[0, roofY + 0.05, d * 0.18]}
            rotation={[0.45, 0, 0]}
          >
            <boxGeometry args={[w * 1.2, 0.06, d * 0.7]} />
            <meshStandardMaterial color={zinc} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh
            castShadow
            position={[0, roofY + 0.05, -d * 0.18]}
            rotation={[-0.45, 0, 0]}
          >
            <boxGeometry args={[w * 1.2, 0.06, d * 0.7]} />
            <meshStandardMaterial color={zinc} roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh position={[0, roofY + 0.22, 0]}>
            <boxGeometry args={[w * 1.22, 0.05, 0.08]} />
            <meshStandardMaterial color="#5a6570" metalness={0.5} roughness={0.45} />
          </mesh>
        </>
      ) : (
        <>
          {/* thick thatch gable */}
          <mesh
            castShadow
            position={[0, roofY + 0.08, d * 0.16]}
            rotation={[0.42, 0, 0]}
          >
            <boxGeometry args={[w * 1.25, 0.22, d * 0.75]} />
            <meshStandardMaterial color={thatch} roughness={0.98} />
          </mesh>
          <mesh
            castShadow
            position={[0, roofY + 0.08, -d * 0.16]}
            rotation={[-0.42, 0, 0]}
          >
            <boxGeometry args={[w * 1.25, 0.22, d * 0.75]} />
            <meshStandardMaterial color={thatchDark} roughness={0.98} />
          </mesh>
          <mesh position={[0, roofY + 0.28, 0]}>
            <boxGeometry args={[w * 1.15, 0.12, 0.15]} />
            <meshStandardMaterial color="#6b4e20" roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

function VillageTree({
  x,
  z,
  scale = 1,
  kind = "acacia",
}: {
  x: number;
  z: number;
  scale?: number;
  kind?: "acacia" | "broad" | "palm";
}) {
  const s = scale;
  if (kind === "palm") {
    return (
      <group position={[x, 0, z]} scale={[s, s, s]}>
        <mesh castShadow position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.07, 0.11, 2.2, 6]} />
          <meshStandardMaterial color="#5c4030" roughness={1} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={i}
              castShadow
              position={[Math.cos(a) * 0.35, 2.15, Math.sin(a) * 0.35]}
              rotation={[0.6, a, 0]}
            >
              <boxGeometry args={[0.12, 0.04, 0.9]} />
              <meshStandardMaterial color="#3a6b28" roughness={0.9} />
            </mesh>
          );
        })}
      </group>
    );
  }
  const trunkH = kind === "broad" ? 1.8 : 1.45;
  return (
    <group position={[x, 0, z]} scale={[s, s, s]}>
      <mesh castShadow position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.14, trunkH, 7]} />
        <meshStandardMaterial color="#3f2a18" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, trunkH + 0.15, 0]}>
        <sphereGeometry args={[kind === "broad" ? 0.85 : 0.6, 9, 9]} />
        <meshStandardMaterial color="#355528" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0.35, trunkH + 0.35, 0.15]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#4a6b30" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-0.3, trunkH + 0.25, -0.2]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#2a451c" roughness={0.92} />
      </mesh>
      {kind === "broad" && (
        <mesh castShadow position={[0.1, trunkH + 0.55, -0.25]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color="#3d5c28" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Bush({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.32, 7, 7]} />
        <meshStandardMaterial color="#3a5a28" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0.18, 0.22, 0.1]}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshStandardMaterial color="#4a6b32" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[-0.14, 0.2, -0.08]}>
        <sphereGeometry args={[0.2, 6, 6]} />
        <meshStandardMaterial color="#2f4a20" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Rock({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={[x, 0.12 * scale, z]}
      scale={[scale, scale * 0.7, scale]}
      rotation={[0.1, scale * 2.1, 0.05]}
    >
      <dodecahedronGeometry args={[0.35, 0]} />
      <meshStandardMaterial color="#7a6a58" roughness={0.95} />
    </mesh>
  );
}

function GrainStack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.7, 10]} />
        <meshStandardMaterial color="#c4a05a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <coneGeometry args={[0.38, 0.25, 10]} />
        <meshStandardMaterial color="#a88840" roughness={1} />
      </mesh>
    </group>
  );
}

function ClayPot({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <mesh castShadow position={[x, 0.12 * s, z]} scale={[s, s, s]}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshStandardMaterial color="#8a5a3a" roughness={0.85} />
    </mesh>
  );
}

function CompoundWall({
  x,
  z,
  radius = 2.2,
  segments = 10,
}: {
  x: number;
  z: number;
  radius?: number;
  segments?: number;
}) {
  const posts = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return [x + Math.cos(a) * radius, z + Math.sin(a) * radius] as const;
  });
  return (
    <group>
      {posts.map(([px, pz], i) => {
        const [qx, qz] = posts[(i + 1) % posts.length];
        const mx = (px + qx) / 2;
        const mz = (pz + qz) / 2;
        const len = Math.hypot(qx - px, qz - pz);
        const ang = Math.atan2(qx - px, qz - pz);
        return (
          <mesh
            key={i}
            position={[mx, 0.4, mz]}
            rotation={[0, ang, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[0.14, 0.85, len * 0.95]} />
            <meshStandardMaterial color="#c9a66b" roughness={0.98} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Dense bush corridors along laterite roads (matches rural PH road refs) */
function RoadsideFlora() {
  const bushes: Array<[number, number, number]> = [];
  // along main E-W road
  for (let x = -12; x <= 12; x += 1.1) {
    bushes.push([x, 1.35, 0.7 + (Math.abs(x) % 3) * 0.08]);
    bushes.push([x + 0.4, -1.0, 0.65 + (Math.abs(x) % 2) * 0.1]);
  }
  // market road
  for (let x = -8; x <= 6; x += 1.3) {
    bushes.push([x, 5.7, 0.75]);
    bushes.push([x + 0.5, 4.0, 0.6]);
  }
  // south road
  for (let x = -8; x <= 7; x += 1.25) {
    bushes.push([x, -3.7, 0.7]);
    bushes.push([x, -2.0, 0.55]);
  }
  // N-S roads
  for (let z = -8; z <= 8; z += 1.2) {
    bushes.push([-4.1, z, 0.65]);
    bushes.push([-2.3, z + 0.3, 0.6]);
    bushes.push([1.9, z, 0.7]);
    bushes.push([3.6, z + 0.2, 0.55]);
    bushes.push([4.6, z, 0.6]);
    bushes.push([6.4, z + 0.15, 0.65]);
    bushes.push([-6.4, z, 0.7]);
    bushes.push([-4.7, z + 0.25, 0.55]);
  }

  return (
    <group>
      {bushes.map(([x, z, sc], i) => (
        <Bush key={i} x={x} z={z} scale={sc} />
      ))}
    </group>
  );
}

/** Starting settlement — denser, more lived-in village */
function StartingVillage() {
  const huts: Array<{
    x: number;
    z: number;
    rot?: number;
    style?: "thatch" | "zinc" | "round";
    wall?: string;
    w?: number;
    d?: number;
    h?: number;
  }> = [
    // Market compound
    { x: -4.4, z: 3.8, style: "thatch", wall: "#c9a66b", w: 1.25, d: 1.1 },
    { x: -3.0, z: 4.4, style: "zinc", wall: "#b8956a", w: 1.35, d: 1.15, h: 1.05 },
    { x: -5.2, z: 2.6, style: "thatch", wall: "#b8895c", rot: 0.35, w: 1.2 },
    { x: -3.5, z: 2.0, style: "round", wall: "#d2b48c", w: 1.35, h: 1.0 },
    { x: -2.0, z: 3.2, style: "zinc", wall: "#a89070", rot: -0.25 },
    { x: -4.8, z: 4.6, style: "round", wall: "#c4a06a", w: 1.1, h: 0.9 },
    { x: -5.5, z: 3.5, style: "thatch", wall: "#c9a66b", rot: 0.6, w: 1.05 },
    // Civic
    { x: -1.4, z: -2.6, style: "thatch", wall: "#c4a06a", w: 1.3, d: 1.15 },
    { x: 1.5, z: -3.0, style: "zinc", wall: "#b0a090", w: 1.45, d: 1.25, h: 1.1 },
    { x: 0.15, z: -3.8, style: "round", wall: "#d4b896", w: 1.3, h: 1.05 },
    { x: 2.4, z: -1.6, style: "thatch", wall: "#c9a66b", rot: 0.45 },
    { x: -2.2, z: -1.4, style: "zinc", wall: "#9a8b78", w: 1.2 },
    { x: 0.6, z: -2.0, style: "thatch", wall: "#b8895c", rot: -0.2 },
    { x: -0.5, z: -3.2, style: "round", wall: "#c4a06a", w: 1.15 },
    // Creekside
    { x: -6.8, z: -2.8, style: "round", wall: "#c4a06a", w: 1.4, h: 1.05 },
    { x: -7.6, z: -4.2, style: "thatch", wall: "#b8895c", rot: 0.2, w: 1.25 },
    { x: -5.4, z: -4.4, style: "zinc", wall: "#a89070", w: 1.2 },
    { x: -8.0, z: -1.8, style: "thatch", wall: "#d2b48c", rot: -0.45 },
    { x: -6.2, z: -1.5, style: "round", wall: "#c9a66b", w: 1.15 },
    { x: -7.0, z: -5.0, style: "thatch", wall: "#b8895c", w: 1.1 },
    // Port edge
    { x: 5.4, z: 3.6, style: "zinc", wall: "#8a8070", w: 1.55, d: 1.25, h: 1.1 },
    { x: 6.8, z: 2.5, style: "thatch", wall: "#c4a06a", w: 1.2 },
    { x: 4.7, z: 1.7, style: "zinc", wall: "#9a8b78", rot: 0.3, w: 1.3 },
    { x: 7.4, z: 3.9, style: "round", wall: "#b8956a", w: 1.2 },
    { x: 6.0, z: 4.5, style: "thatch", wall: "#b8895c", rot: 0.15 },
    { x: 8.0, z: 2.8, style: "zinc", wall: "#8a8070", w: 1.15 },
    // Path-side
    { x: 1.7, z: 2.5, style: "thatch", wall: "#c9a66b", rot: 0.12 },
    { x: -0.9, z: 1.3, style: "zinc", wall: "#a89070" },
    { x: 3.9, z: -0.5, style: "thatch", wall: "#b8895c" },
    { x: -4.5, z: -0.3, style: "round", wall: "#d2b48c", w: 1.05 },
    { x: 2.8, z: 1.2, style: "round", wall: "#c4a06a", w: 1.0 },
  ];

  const trees: Array<[number, number, number, "acacia" | "broad" | "palm"]> = [
    [-6.5, 4.5, 1.15, "broad"],
    [-1.5, 5.5, 1.0, "acacia"],
    [2.8, 5.2, 1.25, "broad"],
    [8.2, 1.2, 1.05, "acacia"],
    [7.8, -2.2, 1.2, "broad"],
    [3.5, -4.8, 0.95, "acacia"],
    [-3.8, -5.2, 1.1, "broad"],
    [-8.8, -3.2, 1.3, "broad"],
    [-8.5, 0.8, 0.9, "acacia"],
    [0.8, 0.2, 0.75, "acacia"],
    [4.2, 2.2, 0.85, "palm"],
    [-2.8, 0.4, 0.8, "acacia"],
    [8.8, 4.2, 1.15, "broad"],
    [-0.2, -5.5, 1.05, "broad"],
    [-9.2, -5.0, 1.2, "palm"],
    [9.0, -0.5, 1.0, "palm"],
    [-5.0, 6.0, 1.1, "broad"],
    [5.5, -3.5, 0.95, "acacia"],
    [-10, -1.0, 1.15, "broad"],
    [1.5, 6.2, 1.0, "acacia"],
  ];

  return (
    <group>
      {huts.map((h, i) => (
        <VillageHut key={i} {...h} />
      ))}

      <CompoundWall x={-3.8} z={3.4} radius={2.5} segments={12} />
      <CompoundWall x={0.2} z={-2.6} radius={2.7} segments={12} />
      <CompoundWall x={-6.8} z={-3.2} radius={2.35} segments={11} />
      <CompoundWall x={6.2} z={3.2} radius={2.4} segments={11} />

      {trees.map(([tx, tz, sc, kind], i) => (
        <VillageTree key={`t${i}`} x={tx} z={tz} scale={sc} kind={kind} />
      ))}

      <RoadsideFlora />

      {/* rocks near creek and slopes */}
      <Rock x={-4.2} z={-5.8} scale={1.2} />
      <Rock x={-3.5} z={-6.2} scale={0.8} />
      <Rock x={-7.5} z={-5.5} scale={1.4} />
      <Rock x={8.5} z={-3.0} scale={1.1} />
      <Rock x={-9.0} z={2.0} scale={0.9} />
      <Rock x={2.0} z={6.0} scale={0.7} />
      <Rock x={9.2} z={5.0} scale={1.0} />

      <GrainStack x={-3.2} z={2.8} />
      <GrainStack x={-4.6} z={3.2} />
      <GrainStack x={-6.0} z={-3.6} />
      <GrainStack x={1.0} z={-2.2} />
      <GrainStack x={5.8} z={2.0} />
      <GrainStack x={-7.2} z={-2.2} />

      <ClayPot x={-4.0} z={3.5} />
      <ClayPot x={-4.15} z={3.35} s={0.8} />
      <ClayPot x={-1.0} z={-2.3} />
      <ClayPot x={-6.4} z={-2.5} s={1.15} />
      <ClayPot x={5.0} z={3.2} />
      <ClayPot x={0.4} z={-3.4} s={0.9} />
      <ClayPot x={-3.2} z={1.9} s={0.85} />
      <ClayPot x={6.5} z={2.2} />

      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`f${i}`} position={[-3.2 + i * 0.35, 0.38, 5.15]} castShadow>
          <boxGeometry args={[0.05, 0.76, 0.05]} />
          <meshStandardMaterial color="#5c4030" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-1.95, 0.55, 5.15]}>
        <boxGeometry args={[2.6, 0.04, 0.04]} />
        <meshStandardMaterial color="#6b4e32" roughness={1} />
      </mesh>

      {[
        [-3.4, 3.15],
        [-2.4, 3.45],
        [-4.0, 2.7],
        [-2.9, 2.5],
      ].map(([mx, mz], i) => (
        <group key={`m${i}`} position={[mx, 0, mz]}>
          <mesh position={[0, 0.48, 0]} castShadow>
            <boxGeometry args={[0.95, 0.05, 0.48]} />
            <meshStandardMaterial color="#6b5340" roughness={0.9} />
          </mesh>
          {(
            [
              [-0.38, 0.15],
              [0.38, 0.15],
              [-0.38, -0.15],
              [0.38, -0.15],
            ] as const
          ).map(([lx, lz], j) => (
            <mesh key={j} position={[lx, 0.24, lz]}>
              <boxGeometry args={[0.05, 0.48, 0.05]} />
              <meshStandardMaterial color="#4a3728" />
            </mesh>
          ))}
        </group>
      ))}

      {[
        [-5.5, 1.5],
        [-1.0, 4.0],
        [2.0, -4.2],
        [7.0, 0.5],
        [-7.5, -0.5],
        [3.0, 1.0],
        [-8.0, 3.0],
        [4.5, -2.5],
        [0.0, 5.5],
        [-2.0, -4.5],
      ].map(([gx, gz], i) => (
        <mesh key={`g${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[gx, 0.02, gz]}>
          <circleGeometry args={[1.0 + (i % 3) * 0.25, 10]} />
          <meshStandardMaterial color={i % 2 ? N.grassDry : N.grassEdge} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

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

function PlayerController({
  onDistrictChange,
}: {
  onDistrictChange?: (id: string | null) => void;
}) {
  const keys = useRef<Record<string, boolean>>({});
  const group = useRef<THREE.Group>(null);
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
        if (st.mountedVehicleId) st.exitVehicle();
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
    if (mode === "orbit" || !group.current) return;

    const speedBase = TRANSPORT_SPEED[transport] ?? 4;
    const isFoot = transport === "foot";
    const sprint = !!(keys.current["shift"]);
    const crouch = !!(keys.current["c"] || keys.current["control"]);

    // COD-style: move relative to look yaw
    let inputX = 0;
    let inputZ = 0;
    if (keys.current["w"] || keys.current["arrowup"]) inputZ -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) inputZ += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) inputX -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) inputX += 1;

    const moving = inputX !== 0 || inputZ !== 0;
    let speedMul = 1;
    if (isFoot && sprint && moving && !crouch) speedMul = 1.85;
    if (isFoot && crouch) speedMul = 0.45;

    if (mountedVehicleId) setMoveState("ride");
    else if (!isFoot && moving) setMoveState("walk");
    else if (isFoot && moving) setMoveState(sprint && !crouch ? "run" : "walk");
    else setMoveState("idle");

    if (moving) {
      const len = Math.hypot(inputX, inputZ) || 1;
      inputX /= len;
      inputZ /= len;
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
      onDistrictChange?.(near);
    } else {
      group.current.rotation.y = yawRef.current;
      setFacing(yawRef.current);
    }

    // Jump (foot only)
    if (isFoot && !mountedVehicleId) {
      if (keys.current["space"] && grounded.current) {
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
    const sprinting = !!(keys.current["shift"] && isFoot && moving && !crouch);
    const fp = firstPerson.current && !mountedVehicleId;

    // Hide body mesh in first-person so you don't see your own head
    if (group.current) {
      group.current.visible = !fp;
    }

    let desired = new THREE.Vector3();
    let look = new THREE.Vector3();

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
      // Snap closer in FPS for responsive feel
      camera.position.lerp(desired, 1 - Math.pow(0.00002, dt));
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
      <VillageDaySky />
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
      <StartingVillage />

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
