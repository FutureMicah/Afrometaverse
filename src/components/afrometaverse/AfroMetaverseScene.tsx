import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DEFAULT_APPEARANCE } from "../../stores/characterStore";
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
import { useCameraSettingsStore } from "@/stores/cameraSettingsStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { worldModifiers } from "@/lib/timeEffects";
import { FirstPersonLimbs } from "@/components/afrometaverse/FirstPersonLimbs";
import { MissionWorldMarker } from "@/components/afrometaverse/MissionWorldMarker";

import { useCharacterStore } from "@/stores/characterStore";
import { DayNightSky } from "@/components/afrometaverse/DayNightSky";
import { ChunkedWorld } from "@/components/afrometaverse/ChunkedWorld";
import { ChunkVillageProps, StaticVillageProps } from "@/components/afrometaverse/VillageProps";
import { ExpandedWorld } from "@/components/afrometaverse/ExpandedWorld";
import { WorldChunk } from "@/components/afrometaverse/WorldChunk";
import { groupByChunk, chunksContaining, chunkOrigin } from "@/lib/chunkAssign";
import { chunkOf } from "@/lib/chunkStreaming";
import { currentRenderTier } from "@/lib/renderTier";
import { qualityBudget } from "@/lib/qualityBudget";
import { worldFogEnd } from "@/lib/worldConfig";
import { StylizedCharacter } from "@/components/afrometaverse/characters/StylizedCharacter";
import {
  HeritageTerrain,
  BiomeFlora,
  LivingWater,
} from "@/components/afrometaverse/HeritageTerrain";
import {
  VillageHearth,
  BhungaHut,
} from "@/components/afrometaverse/HeritageArchitecture";
import { Creature, Chicken, Duck, Heron, FlyingBird, Frog, Lizard, Gecko, Rat, Mouse, Beetle, Crab, Snake, Tortoise, Hare, Squirrel, Butterfly, Chameleon } from "@/components/afrometaverse/Creatures";
import {
  DustMotes,
  SpiritFireflies,
  SavannahGrass,
  LightningFlash,
  SacredGroveMist,
} from "@/components/afrometaverse/AtmosphericLife";
import { SCENE_PALETTE } from "@/lib/scenePalette";

const DISTRICT_LAYOUT = {
  "town-market": { x: 18, z: 20, color: SCENE_PALETTE.amber, label: "Town Market", neon: SCENE_PALETTE.amberNeon },
  "civic-centre": { x: 0, z: -1.5, color: SCENE_PALETTE.teal, label: "Council Grove", neon: SCENE_PALETTE.tealNeon },
  creekside: { x: -5.5, z: -3.5, color: SCENE_PALETTE.blue, label: "Creekside", neon: SCENE_PALETTE.blueNeon },
  port: { x: 5.5, z: 2.5, color: SCENE_PALETTE.orange, label: "River Landing", neon: SCENE_PALETTE.orangeNeon },
  "upland-compound": { x: -32, z: 18, color: SCENE_PALETTE.wallOchre, label: "Upland Compound", neon: SCENE_PALETTE.amberNeon },
  "ridge-settlement": { x: 30, z: -28, color: SCENE_PALETTE.stoneGrey, label: "Ridge Settlement", neon: SCENE_PALETTE.tealNeon },
  "forest-edge": { x: 48, z: 28, color: SCENE_PALETTE.grassEdge, label: "Forest Edge", neon: SCENE_PALETTE.limeNeon },
  "river-gate": { x: -28, z: -32, color: SCENE_PALETTE.waterDeep, label: "River Gate", neon: SCENE_PALETTE.blueNeon },
  "canopy-camp": { x: 18, z: 42, color: SCENE_PALETTE.earthDeep, label: "Canopy Camp", neon: SCENE_PALETTE.limeNeon },
  "hill-kraal": { x: -45, z: 5, color: SCENE_PALETTE.clayWall, label: "Hill Kraal", neon: SCENE_PALETTE.orangeNeon },
} as const;

const BOUNDS = { minX: -70, maxX: 70, minZ: -60, maxZ: 65 };

/** Ground + road palette tuned to PH laterite / village dirt refs */
const N = {
  asphalt: SCENE_PALETTE.asphalt,
  asphaltLine: SCENE_PALETTE.purpleNeonSoft,
  sidewalk: SCENE_PALETTE.sidewalk,
  /** Red laterite carriageway (refs: rural PH roads) */
  laterite: SCENE_PALETTE.laterite,
  lateriteDark: SCENE_PALETTE.lateriteDark,
  lateriteLight: SCENE_PALETTE.lateriteLight,
  dust: SCENE_PALETTE.dust,
  earth: SCENE_PALETTE.earth,
  earthDeep: SCENE_PALETTE.earthDeep,
  grassEdge: SCENE_PALETTE.grassEdge,
  grassDry: SCENE_PALETTE.grassDry,
  towerDark: SCENE_PALETTE.towerDark,
  towerMid: SCENE_PALETTE.towerMid,
  towerWarm: SCENE_PALETTE.towerWarm,
  neonPink: SCENE_PALETTE.pinkNeon,
  neonCyan: SCENE_PALETTE.cyanNeon,
  neonLime: SCENE_PALETTE.limeNeon,
  neonPurple: SCENE_PALETTE.purpleNeon,
  neonAmber: SCENE_PALETTE.amberNeon,
  neonOrange: SCENE_PALETTE.orangeNeon,
  water: SCENE_PALETTE.waterDeep,
  fog: SCENE_PALETTE.fogNight,
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

/** Daylight village sky — fog distance scales with the large-world render radius. */
function VillageDaySky() {
  const tier = currentRenderTier();
  const fogFar = Math.max(220, worldFogEnd(tier) * 0.95);
  const fogNear = Math.min(40, fogFar * 0.18);

  return (
    <>
      <color attach="background" args={[SCENE_PALETTE.skyHaze]} />
      <fog attach="fog" args={[SCENE_PALETTE.fogSand, fogNear, fogFar]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={[SCENE_PALETTE.skyPale, SCENE_PALETTE.groundBrown, 0.5]} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={1.45}
        color={SCENE_PALETTE.sunWarm}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-8, 6, -5]} intensity={0.42} color={SCENE_PALETTE.sunBlue} />
      <directionalLight position={[0, 8, -12]} intensity={0.35} color={SCENE_PALETTE.lavenderLight} />
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
              color={lit ? spec.neon : SCENE_PALETTE.nightSlate}
              emissive={lit ? spec.neon : SCENE_PALETTE.black}
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
          <meshStandardMaterial color={SCENE_PALETTE.neonSlate} emissive={spec.neon} emissiveIntensity={0.3} />
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
          color={SCENE_PALETTE.shadowPlum}
          emissive={neon}
          emissiveIntensity={lit ? 0.25 : 0.08}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.6, 0]}>
        <boxGeometry args={[2.0, 3.2, 2.0]} />
        <meshStandardMaterial
          color={lit ? SCENE_PALETTE.litGlassDark : color}
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
          <meshStandardMaterial color={SCENE_PALETTE.yellowLight} emissive={SCENE_PALETTE.yellowGlow} emissiveIntensity={1.2} />
        </mesh>
      )}
      <NeonSign x={0} y={2.4} z={1.08} w={1.6} h={0.35} color={neon} />
    </group>
  );
}

/** Pre-colonial market stalls — timber posts, woven/cloth canopies, no neon or metal. */
/** Pre-colonial market stalls — timber posts, cloth canopies. Configurable size/location. */
function TraditionalMarketStalls({
  originX = 18,
  originZ = 20,
  stallCount = 12,
  plazaRadius = 6.5,
  cols = 6,
}: {
  originX?: number;
  originZ?: number;
  stallCount?: number;
  plazaRadius?: number;
  cols?: number;
}) {
  const cloths = ["#8b3a2a", "#c4a574", "#1e6b4f", "#ca8a04", "#5c2e1f", "#2f5a7a"];
  const stalls = useMemo(() => {
    const rows = Math.ceil(stallCount / cols);
    return Array.from({ length: stallCount }, (_, i) => ({
      x: originX - (cols * 0.95) / 2 + (i % cols) * 0.95 + 0.4,
      z: originZ - (rows * 1.15) / 2 + Math.floor(i / cols) * 1.15 + 0.3,
      cloth: cloths[i % cloths.length],
    }));
  }, [originX, originZ, stallCount, cols]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[originX, 0.01, originZ]} receiveShadow>
        <circleGeometry args={[plazaRadius, 28]} />
        <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
      </mesh>
      {stalls.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          {[-0.4, 0.4].map((px, j) => (
            <mesh key={j} position={[px, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.055, 1.5, 6]} />
              <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.9, 5]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.35, 0]} rotation={[0.2, 0, 0]} castShadow>
            <planeGeometry args={[0.95, 0.7]} />
            <meshStandardMaterial color={s.cloth ?? SCENE_PALETTE.clothWarm} roughness={0.92} side={2} />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.85, 0.08, 0.55]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={0.95} />
          </mesh>
          <mesh position={[0.1, 0.55, 0.05]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshStandardMaterial color={i % 2 ? SCENE_PALETTE.clay : "#c4a030"} roughness={0.9} />
          </mesh>
          <mesh position={[-0.15, 0.52, -0.05]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color={SCENE_PALETTE.brickRed} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Multi-species pre-colonial flora: acacia, baobab, palm, banana, bush, undergrowth. */
type FloraSpecies = "acacia" | "baobab" | "palm" | "banana" | "bush" | "fig";

function FloraPlant({
  species,
  scale = 1,
}: {
  species: FloraSpecies;
  scale?: number;
}) {
  if (species === "baobab") {
    return (
      <group scale={scale}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 2.2, 8]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={1} />
        </mesh>
        <mesh position={[0, 2.35, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.42, 0.5, 8]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={1} />
        </mesh>
        {/* sparse high branches */}
        {[-0.5, 0.4, -0.15].map((ox, i) => (
          <mesh key={i} position={[ox, 2.7 + i * 0.15, (i - 1) * 0.3]} rotation={[0.3, i, 0.2]} castShadow>
            <cylinderGeometry args={[0.06, 0.1, 1.1, 5]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 3.3, 0]} castShadow>
          <sphereGeometry args={[1.1, 7, 5]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
        </mesh>
      </group>
    );
  }
  if (species === "palm") {
    return (
      <group scale={scale}>
        <mesh position={[0, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.16, 3.2, 6]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={0.95} />
        </mesh>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.35, 3.15, Math.sin(a) * 0.35]}
              rotation={[0.85, a, 0]}
              castShadow
            >
              <boxGeometry args={[0.12, 0.04, 1.4]} />
              <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
            </mesh>
          );
        })}
        <mesh position={[0, 3.2, 0]}>
          <sphereGeometry args={[0.2, 6, 5]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} />
        </mesh>
      </group>
    );
  }
  if (species === "banana") {
    return (
      <group scale={scale}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.18, 1.4, 6]} />
          <meshStandardMaterial color={"#4a6b28"} roughness={1} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.25, 1.35, Math.sin(a) * 0.25]}
              rotation={[0.5, a, 0.15]}
              castShadow
            >
              <boxGeometry args={[0.35, 0.05, 1.0]} />
              <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (species === "bush") {
    return (
      <group scale={scale}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <sphereGeometry args={[0.55, 6, 5]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} flatShading />
        </mesh>
        <mesh position={[0.25, 0.4, 0.1]} castShadow>
          <sphereGeometry args={[0.35, 5, 4]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
        </mesh>
      </group>
    );
  }
  if (species === "fig") {
    return (
      <group scale={scale}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.22, 2.0, 6]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
        </mesh>
        <mesh position={[0, 2.2, 0]} castShadow>
          <sphereGeometry args={[1.35, 7, 6]} />
          <meshStandardMaterial color={"#1a5c32"} roughness={1} flatShading />
        </mesh>
        <mesh position={[0.5, 2.0, 0.3]} castShadow>
          <sphereGeometry args={[0.7, 6, 5]} />
          <meshStandardMaterial color={"#246b38"} roughness={1} flatShading />
        </mesh>
      </group>
    );
  }
  // acacia — flat umbrella canopy
  return (
    <group scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 2.4, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
      </mesh>
      <mesh position={[0, 2.35, 0]} rotation={[0.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.8, 4]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
      </mesh>
      <mesh position={[0, 2.55, 0]} scale={[1.6, 0.35, 1.6]} castShadow>
        <sphereGeometry args={[0.85, 7, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function VillageTreeRing() {
  const plants = useMemo(() => {
    const out: { x: number; z: number; species: FloraSpecies; scale: number }[] = [];
    const push = (x: number, z: number, species: FloraSpecies, scale = 1) => {
      out.push({ x, z, species, scale });
    };
    // council ring — mostly fig + acacia
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = 5.2 + (i % 3) * 1.1;
      push(Math.cos(a) * d, Math.sin(a) * d - 1.2, i % 3 === 0 ? "fig" : "acacia", 0.9 + (i % 3) * 0.15);
    }
    // baobabs as landmarks
    push(-8, 3, "baobab", 1.1);
    push(5, -6, "baobab", 0.95);
    push(14, 12, "baobab", 1.05);
    push(-12, -5, "baobab", 0.9);
    // palms near water / landing
    ([[-6.5, -5], [-4, -7], [5.5, 1.5], [7, 3], [6, 0], [4.5, 2.8]] as const).forEach(([x, z], i) =>
      push(x, z, "palm", 0.85 + (i % 3) * 0.1),
    );
    // bananas near compounds / small market
    ([[-3, 5], [-1.5, 6.5], [0.5, 4.5], [-4.5, 4], [1.5, 7], [-2.5, 3]] as const).forEach(([x, z], i) =>
      push(x, z, "banana", 0.9 + (i % 2) * 0.15),
    );
    // bushes along paths
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      push(
        1 + t * 15 + ((i % 2) * 2 - 1) * 1.8,
        1.5 + t * 15 + ((i % 3) - 1) * 1.5,
        "bush",
        0.7 + (i % 4) * 0.12,
      );
    }
    // acacia / fig scatter residential west
    for (let i = 0; i < 18; i++) {
      const a = seededTree(i) * Math.PI * 2;
      const d = 7 + seededTree(i + 20) * 11;
      const sp: FloraSpecies = i % 5 === 0 ? "fig" : i % 4 === 0 ? "baobab" : "acacia";
      push(-5 + Math.cos(a) * d * 0.75, 1 + Math.sin(a) * d * 0.65, sp, 0.85 + seededTree(i + 40) * 0.35);
    }
    // more palms & bushes creekside
    for (let i = 0; i < 10; i++) {
      push(-9 + seededTree(i + 70) * 6, -3 - seededTree(i + 80) * 5, i % 2 ? "palm" : "bush", 0.8 + seededTree(i) * 0.3);
    }
    // market approach trees
    for (let i = 0; i < 8; i++) {
      push(15 + (i % 4) * 2.2, 16 + Math.floor(i / 4) * 3, i % 2 ? "acacia" : "fig", 0.95);
    }
    // grove densify — more trees around sacred area & waterfall
    for (let i = 0; i < 20; i++) {
      const a = seededTree(i + 100) * Math.PI * 2;
      const d = 3 + seededTree(i + 110) * 8;
      const sp: FloraSpecies = i % 4 === 0 ? "fig" : i % 3 === 0 ? "palm" : i % 5 === 0 ? "baobab" : "acacia";
      push(10 + Math.cos(a) * d, -10 + Math.sin(a) * d, sp, 0.8 + seededTree(i + 120) * 0.4);
    }
    for (let i = 0; i < 10; i++) {
      push(3 + seededTree(i + 130) * 5, -14 + seededTree(i + 140) * 4, i % 2 ? "palm" : "banana", 0.85);
    }
    return out;
  }, []);

  return (
    <group>
      {plants.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <FloraPlant species={p.species} scale={p.scale} />
        </group>
      ))}
    </group>
  );
}
function seededTree(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Landmark forest set pieces from reference: arch tree, ancient trunks, cave, sacred gate. */
function MossyRock({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh castShadow receiveShadow>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.15, 0.25, 0.1]} scale={[0.9, 0.4, 0.7]}>
        <sphereGeometry args={[0.45, 6, 5]} />
        <meshStandardMaterial color={"#3d5c28"} roughness={1} />
      </mesh>
    </group>
  );
}

/** Twisted living-wood arch over a path (ref: gnarled tree gateway). */
function TreeArch({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* left root mass on rock */}
      <mesh position={[-1.4, 0.6, 0]} castShadow>
        <dodecahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-1.2, 1.3, 0.1]} rotation={[0, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.22, 0.35, 2.2, 7]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={0.95} />
      </mesh>
      {/* right root mass */}
      <mesh position={[1.5, 0.55, 0.1]} castShadow>
        <dodecahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.3, 1.25, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.2, 0.32, 2.0, 7]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
      </mesh>
      {/* arching trunk spanning path */}
      <mesh position={[0, 2.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 3.4, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodWarm} roughness={0.92} />
      </mesh>
      {/* secondary twisted branch */}
      <mesh position={[0.3, 3.1, 0.4]} rotation={[0.4, 0.5, 0.8]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 2.2, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
      </mesh>
      {/* moss patches */}
      <mesh position={[-1.0, 1.5, 0.35]} scale={[0.5, 0.25, 0.4]}>
        <sphereGeometry args={[0.6, 5, 4]} />
        <meshStandardMaterial color={"#3a5a2a"} roughness={1} />
      </mesh>
      <mesh position={[1.1, 1.4, 0.3]} scale={[0.45, 0.2, 0.35]}>
        <sphereGeometry args={[0.55, 5, 4]} />
        <meshStandardMaterial color={"#3a5a2a"} roughness={1} />
      </mesh>
      {/* canopy above arch */}
      <mesh position={[-0.4, 3.8, 0.2]} castShadow>
        <sphereGeometry args={[1.2, 6, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} flatShading />
      </mesh>
      <mesh position={[0.6, 3.9, -0.1]} castShadow>
        <sphereGeometry args={[1.0, 6, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/** Ancient buttress-root tree (ref: mossy giant trunks). */
function AncientTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* flared buttress roots */}
      {[0, 1.2, 2.4, 3.6, 4.8].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7]}
          rotation={[0.5, a, 0]}
          castShadow
        >
          <boxGeometry args={[0.35, 1.3, 0.12]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.75, 4.2, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
      </mesh>
      {/* moss skirt */}
      <mesh position={[0, 0.35, 0]} scale={[1.4, 0.35, 1.4]}>
        <sphereGeometry args={[1.0, 7, 5]} />
        <meshStandardMaterial color={"#2f4a22"} roughness={1} />
      </mesh>
      <mesh position={[0, 5.0, 0]} castShadow>
        <sphereGeometry args={[2.2, 7, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} flatShading />
      </mesh>
      <mesh position={[1.0, 4.8, 0.6]} castShadow>
        <sphereGeometry args={[1.3, 6, 5]} />
        <meshStandardMaterial color={"#1a5c32"} roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.8, 5.2, -0.5]} castShadow>
        <sphereGeometry args={[1.1, 6, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassDry} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/** Cave mouth with stone steps and trickle (ref: cave entrance). */
function CaveMouth({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* rock mass */}
      <mesh position={[-2.2, 1.4, -0.5]} castShadow>
        <dodecahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[2.3, 1.5, -0.4]} castShadow>
        <dodecahedronGeometry args={[1.9, 0]} />
        <meshStandardMaterial color={"#6a6e68"} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0, 2.6, -1.2]} castShadow>
        <boxGeometry args={[5.2, 2.4, 2.2]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.98} />
      </mesh>
      {/* dark mouth */}
      <mesh position={[0, 1.5, 0.15]}>
        <boxGeometry args={[2.4, 2.6, 0.4]} />
        <meshStandardMaterial color={"#0a0c0a"} roughness={1} />
      </mesh>
      {/* steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.12 + i * 0.22, 0.9 - i * 0.35]} receiveShadow>
          <boxGeometry args={[1.6 - i * 0.15, 0.2, 0.5]} />
          <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={0.95} />
        </mesh>
      ))}
      {/* small pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.6]} receiveShadow>
        <circleGeometry args={[0.9, 16]} />
        <meshStandardMaterial color={SCENE_PALETTE.pondGreen} transparent opacity={0.75} roughness={0.2} />
      </mesh>
      {/* ferns / grass */}
      {[-1.8, -1.2, 1.3, 1.9].map((x, i) => (
        <mesh key={i} position={[x, 0.35, 0.8 + (i % 2) * 0.3]}>
          <coneGeometry args={[0.2, 0.7, 5]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Simple wooden sacred path gate (pre-colonial posts + lintel). */
function SacredPathGate({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1.1, 1.1].map((x, i) => (
        <mesh key={i} position={[x, 1.35, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.14, 2.7, 6]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 2.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.5, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
      </mesh>
      {/* hanging charms / cloth strips */}
      {[-0.5, 0, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 2.2, 0.08]}>
          <boxGeometry args={[0.04, 0.45, 0.02]} />
          <meshStandardMaterial color={i === 1 ? SCENE_PALETTE.amber : SCENE_PALETTE.clay} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Layered waterfall into a pool — cliff + falling sheets + mist. */
function Waterfall({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* cliff face */}
      <mesh position={[0, 2.2, -0.8]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 4.6, 1.6]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[-2.4, 1.6, -0.3]} castShadow>
        <dodecahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color={"#6a6e68"} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[2.5, 1.8, -0.4]} castShadow>
        <dodecahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.98} flatShading />
      </mesh>
      {/* upper ledge pool source */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.3, -0.3]}>
        <circleGeometry args={[1.1, 14]} />
        <meshStandardMaterial color={SCENE_PALETTE.waterDeep} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      {/* falling water sheets */}
      {[0, 0.35, -0.35].map((ox, i) => (
        <mesh key={i} position={[ox, 2.2, 0.15]} castShadow={false}>
          <boxGeometry args={[0.7 - i * 0.05, 4.0, 0.08]} />
          <meshStandardMaterial
            color={SCENE_PALETTE.waterDeep}
            transparent
            opacity={0.45 - i * 0.05}
            roughness={0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* foam at base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0.9]}>
        <circleGeometry args={[1.6, 16]} />
        <meshStandardMaterial color={"#d8e8f0"} transparent opacity={0.55} roughness={0.3} />
      </mesh>
      {/* lower pool */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.8]} receiveShadow>
        <circleGeometry args={[3.2, 24]} />
        <meshStandardMaterial color={SCENE_PALETTE.pondGreen} transparent opacity={0.8} roughness={0.15} />
      </mesh>
      {/* stream outflow toward creek */}
      <mesh rotation={[-Math.PI / 2, 0.15, 0]} position={[-1.2, 0.03, 3.5]}>
        <planeGeometry args={[1.4, 4.5]} />
        <meshStandardMaterial color={SCENE_PALETTE.riverTeal} transparent opacity={0.7} roughness={0.2} />
      </mesh>
      {/* spray mist */}
      <mesh position={[0, 1.2, 0.8]}>
        <sphereGeometry args={[1.4, 10, 10]} />
        <meshBasicMaterial color={SCENE_PALETTE.mistGreen} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 2, 1]} intensity={0.25} distance={8} color={SCENE_PALETTE.wispGreen} />
      {/* wet rocks + ferns */}
      {[-1.8, -0.6, 0.7, 1.9].map((x, i) => (
        <mesh key={i} position={[x, 0.25, 1.2 + (i % 2) * 0.4]} castShadow>
          <dodecahedronGeometry args={[0.35 + (i % 2) * 0.1, 0]} />
          <meshStandardMaterial color={SCENE_PALETTE.stoneGrey} roughness={0.9} flatShading />
        </mesh>
      ))}
      {[-2.2, -1.0, 1.1, 2.3].map((x, i) => (
        <mesh key={`f${i}`} position={[x, 0.4, 2.0 + (i % 3) * 0.2]}>
          <coneGeometry args={[0.18, 0.65, 5]} />
          <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function LandmarkGroves() {
  return (
    <group>
      {/* === Sacred Grove core (SE of village) === */}
      <group position={[10, 0, -10]}>
        {/* dense ring of ancient + fig trees */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          const d = 4.2 + (i % 3) * 0.6;
          return (
            <AncientTree
              key={`sg-t-${i}`}
              position={[Math.cos(a) * d, 0, Math.sin(a) * d]}
              scale={0.85 + (i % 3) * 0.12}
            />
          );
        })}
        {/* inner circle smaller trees */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          return (
            <group key={`sg-s-${i}`} position={[Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2]}>
              <FloraPlant species={i % 2 ? "fig" : "acacia"} scale={0.9} />
            </group>
          );
        })}
        {/* central shrine stone */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 1.1, 7]} />
          <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={0.6} />
        </mesh>
        {/* mossy rocks in grove */}
        {([[-2, 1.5], [2.2, -1], [-1.5, -2], [1.8, 2]] as const).map(([x, z], i) => (
          <group key={`sg-r-${i}`} position={[x, 0, z]}>
            <MossyRock scale={0.7 + i * 0.1} />
          </group>
        ))}
        {/* undergrowth bushes */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const d = 3 + (i % 4) * 0.5;
          return (
            <group key={`sg-b-${i}`} position={[Math.cos(a) * d, 0, Math.sin(a) * d]}>
              <FloraPlant species="bush" scale={0.7 + (i % 3) * 0.15} />
            </group>
          );
        })}
      </group>

      {/* Path into grove */}
      <TreeArch position={[8, 0, -8]} rotation={0.3} />
      <SacredPathGate position={[9.5, 0, -10.5]} rotation={0.25} />
      <group position={[8.2, 0, -7.2]}><MossyRock scale={1.2} /></group>
      <group position={[7.5, 0, -9]}><MossyRock scale={0.8} /></group>
      <group position={[10.5, 0, -8.5]}><MossyRock scale={1.0} /></group>
      <group position={[11.2, 0, -12]}><MossyRock scale={0.9} /></group>
      <group position={[5.5, 0, -10]}><MossyRock scale={1.1} /></group>

      {/* Waterfall feeding sacred pool / creek (west of grove) */}
      <Waterfall position={[3, 0, -14]} rotation={0.4} />
      <AncientTree position={[0.5, 0, -15]} scale={1.1} />
      <AncientTree position={[5.5, 0, -16]} scale={0.95} />
      <group position={[1.5, 0, -12.5]}><FloraPlant species="palm" scale={1.0} /></group>
      <group position={[4.5, 0, -12]}><FloraPlant species="palm" scale={0.9} /></group>

      {/* Cave near ridge */}
      <CaveMouth position={[22, 0, -16]} rotation={-0.6} />
      <AncientTree position={[20, 0, -18]} scale={1.2} />
      <AncientTree position={[24.5, 0, -14]} scale={0.9} />

      {/* Second arch on market approach + extra grove trees */}
      <TreeArch position={[10, 0, 12]} rotation={1.1} />
      <AncientTree position={[-14, 0, 8]} scale={1.05} />
      <AncientTree position={[16, 0, 8]} scale={1.0} />
      <AncientTree position={[14, 0, -6]} scale={1.15} />
      <AncientTree position={[7, 0, -15]} scale={1.0} />
      <AncientTree position={[12, 0, -14]} scale={0.9} />

      {/* Extra palms & bananas near waterfall stream */}
      {([[2, -11], [0, -13], [6, -12.5], [3.5, -10]] as const).map(([x, z], i) => (
        <group key={`wf-p-${i}`} position={[x, 0, z]}>
          <FloraPlant species={i % 2 ? "banana" : "palm"} scale={0.85 + i * 0.05} />
        </group>
      ))}
    </group>
  );
}

/** Sacred grove ecology — birds, monkeys, medicine plants, sacred log, wet floor. */
function GroveBird({ phase = 0 }: { phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.7 + phase;
    ref.current.position.y = 3.2 + Math.sin(t * 1.4) * 0.35 + Math.sin(t * 0.3) * 0.15;
    ref.current.position.x = Math.sin(t * 0.25) * 1.8;
    ref.current.position.z = Math.cos(t * 0.2) * 1.5;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <sphereGeometry args={[0.07, 6, 5]} />
        <meshStandardMaterial color={"#2a2a28"} roughness={0.8} />
      </mesh>
      <mesh position={[0.08, 0, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.12, 0.02, 0.06]} />
        <meshStandardMaterial color={"#3a3a38"} roughness={0.9} />
      </mesh>
    </group>
  );
}

function GroveMonkey({ phase = 0, base = [0, 0, 0] as [number, number, number] }: { phase?: number; base?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.35 + phase;
    ref.current.position.x = base[0] + Math.sin(t) * 0.6;
    ref.current.position.z = base[2] + Math.cos(t * 0.8) * 0.5;
    ref.current.position.y = base[1] + 1.6 + Math.abs(Math.sin(t * 2)) * 0.25;
    ref.current.rotation.y = Math.sin(t) * 0.5;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[0.14, 7, 6]} />
        <meshStandardMaterial color={"#6b4a32"} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.32, 0.05]} castShadow>
        <sphereGeometry args={[0.1, 6, 5]} />
        <meshStandardMaterial color={"#7a5a40"} roughness={0.85} />
      </mesh>
      <mesh position={[0.08, 0.05, 0]} rotation={[0.4, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.28, 5]} />
        <meshStandardMaterial color={"#6b4a32"} roughness={0.9} />
      </mesh>
      <mesh position={[-0.08, 0.05, 0]} rotation={[0.4, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.28, 5]} />
        <meshStandardMaterial color={"#6b4a32"} roughness={0.9} />
      </mesh>
    </group>
  );
}

function MedicinePlant({
  position,
  onPick,
}: {
  position: [number, number, number];
  onPick?: () => void;
}) {
  return (
    <group position={position}>
      {/* leafy medicinal herb cluster */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <coneGeometry args={[0.22, 0.55, 6]} />
        <meshStandardMaterial color={"#2d5a28"} roughness={1} />
      </mesh>
      <mesh position={[0.12, 0.2, 0.08]} castShadow>
        <coneGeometry args={[0.15, 0.4, 5]} />
        <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
      </mesh>
      <mesh position={[-0.1, 0.18, -0.05]}>
        <sphereGeometry args={[0.06, 5, 4]} />
        <meshStandardMaterial color={SCENE_PALETTE.amber} roughness={0.7} />
      </mesh>
      {/* invisible hit target */}
      <mesh
        position={[0, 0.4, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onPick?.();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function SacredFallenLog({
  position,
  rotation = 0,
  onTouch,
}: {
  position: [number, number, number];
  rotation?: number;
  onTouch?: () => void;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0.08]}>
      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]} position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 2.8, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.98} />
      </mesh>
      {/* moss on log — marks it sacred / not fuel */}
      <mesh position={[0.2, 0.42, 0.1]} scale={[1.2, 0.35, 0.6]}>
        <sphereGeometry args={[0.35, 6, 4]} />
        <meshStandardMaterial color={"#2f4a22"} roughness={1} />
      </mesh>
      <mesh position={[-0.4, 0.4, -0.05]} scale={[0.9, 0.3, 0.5]}>
        <sphereGeometry args={[0.3, 6, 4]} />
        <meshStandardMaterial color={"#3a5a2a"} roughness={1} />
      </mesh>
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onTouch?.();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[3, 0.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function GroveWetGround({ center = [10, 0, -10] as [number, number, number] }) {
  return (
    <group position={center}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[5.5, 28]} />
        <meshStandardMaterial color={"#3a4a32"} roughness={0.75} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[3.2, 20]} />
        <meshStandardMaterial color={"#2a3a28"} roughness={0.6} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function SacredGroveEcology({ onInteract }: { onInteract?: (label: string) => void }) {
  const cx = 10;
  const cz = -10;
  return (
    <group>
      <GroveWetGround center={[cx, 0, cz]} />
      {/* birds in canopy */}
      {Array.from({ length: 8 }, (_, i) => (
        <group key={`bird-${i}`} position={[cx, 0, cz]}>
          <GroveBird phase={i * 1.1} />
        </group>
      ))}
      {/* monkeys on branch height around grove */}
      <GroveMonkey phase={0} base={[cx + 2.5, 0, cz + 1.2]} />
      <GroveMonkey phase={2.1} base={[cx - 2.0, 0, cz - 1.5]} />
      <GroveMonkey phase={4.0} base={[cx + 1.0, 0, cz - 2.8]} />
      {/* medicinal forage */}
      {([
        [cx - 1.5, cz + 2.0],
        [cx + 2.0, cz + 1.5],
        [cx - 2.5, cz - 0.5],
        [cx + 1.2, cz - 2.2],
        [cx + 0.3, cz + 3.0],
        [cx - 0.8, cz - 3.0],
      ] as const).map(([x, z], i) => (
        <MedicinePlant
          key={`med-${i}`}
          position={[x, 0, z]}
          onPick={() => onInteract?.("Sacred leaf — for healing, not sale")}
        />
      ))}
      {/* sacred fallen log — not ordinary wood */}
      <SacredFallenLog
        position={[cx + 3.2, 0, cz + 0.5]}
        rotation={0.7}
        onTouch={() => onInteract?.("Sacred log — left for the grove, not taken")}
      />
      <SacredFallenLog
        position={[cx - 3.5, 0, cz - 1.8]}
        rotation={-0.4}
        onTouch={() => onInteract?.("Sacred log — the ancestors' resting timber")}
      />
      {/* soft zone marker for no-hunt / no-cut (visual only) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]}>
        <ringGeometry args={[4.8, 5.2, 32]} />
        <meshBasicMaterial color={SCENE_PALETTE.wispGreen} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Oil / resin torch posts — pre-colonial night light. */
function TorchPosts() {
  const posts: [number, number][] = [
    [-10, 2],
    [-5, 1.5],
    [0, -1],
    [9, -4],
    [11, 4],
    [16.5, 18.5],
    [19.5, 21],
    [17, 21.5],
    [20.5, 18],
    [-8, -4],
    // small local market
    [-2.5, 5.5],
    [0.5, 4.8],
    [-0.5, 6.5],
    // extra village paths
    [5, 6],
    [-12, 5],
    [14, 8],
  ];
  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial
              color={SCENE_PALETTE.ember}
              emissive={SCENE_PALETTE.emberDeep}
              emissiveIntensity={1.2}
            />
          </mesh>
          <pointLight position={[0, 1.5, 0]} intensity={0.45} distance={5} color={SCENE_PALETTE.emberLight} />
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
          color={SCENE_PALETTE.pondGreen}
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
        <meshStandardMaterial color={SCENE_PALETTE.orangeNeon} emissive={SCENE_PALETTE.orangeNeon} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[2.8, 3.0, 0]} castShadow>
        <boxGeometry args={[0.18, 6, 0.18]} />
        <meshStandardMaterial color={SCENE_PALETTE.orangeNeon} emissive={SCENE_PALETTE.orangeNeon} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[2.15, 6.0, 0.6]} castShadow>
        <boxGeometry args={[2.2, 0.2, 0.2]} />
        <meshStandardMaterial color={SCENE_PALETTE.orangeLight} emissive={SCENE_PALETTE.orange} emissiveIntensity={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.55 + (i % 2) * 0.7, 1.4 + i * 0.35]} castShadow>
          <boxGeometry args={[1.3, 0.7, 0.7]} />
          <meshStandardMaterial
            color={[SCENE_PALETTE.blueSky, SCENE_PALETTE.yellow, SCENE_PALETTE.purple][i] ?? SCENE_PALETTE.blueSky}
            emissive={[SCENE_PALETTE.blueSky, SCENE_PALETTE.yellow, SCENE_PALETTE.purple][i] ?? SCENE_PALETTE.blueSky}
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
    // Town Market quarter (northeast)
    [16.5, 18.5],
    [19.5, 21.0],
    [17.0, 21.5],
    [20.5, 18.0],
  ];
  return (
    <group>
      {lamps.map(([x, z], i) => {
        const c = [N.neonPink, N.neonCyan, N.neonPurple, N.neonAmber][i % 4] ?? N.neonPink;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.04, 0.06, 2.8, 6]} />
              <meshStandardMaterial color={SCENE_PALETTE.slate} />
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
          <meshStandardMaterial color={SCENE_PALETTE.nightSlate} />
        </mesh>
        <mesh position={[-0.25, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.14, 0.035, 5, 10]} />
          <meshStandardMaterial color={SCENE_PALETTE.nightSlate} />
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
        <meshStandardMaterial color={SCENE_PALETTE.glassGrey} transparent opacity={0.5} />
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
      scale={0.88}
      animate
      detail
      moveState={moveState}
    />
  );
}

function nearestDistrict(x: number, z: number): string | null {
  let best: string | null = null;
  let bestDist = 5.5;
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
  /** Realistic FP motion state */
  const velXZ = useRef({ x: 0, z: 0 });
  const bobPhase = useRef(0);
  const landPunch = useRef(0);
  const eyeHeight = useRef(1.62);
  const camRoll = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0.35);
  const wasGrounded = useRef(true);
  const fpActiveForLimbs = firstPerson; // shared ref

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
        if (firstPerson.current) {
          pitchRef.current = 0;
          targetPitch.current = 0;
        } else {
          pitchRef.current = 0.28;
          targetPitch.current = 0.28;
        }
        targetYaw.current = yawRef.current;
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
      const cam = useCameraSettingsStore.getState();
      const base = firstPerson.current ? 0.0035 : 0.0027;
      const sens = base * cam.lookSensitivity;
      const ySign = cam.invertY ? 1 : -1;
      const pMin = firstPerson.current ? -1.35 : 0.08;
      const pMax = firstPerson.current ? 1.4 : 1.2;
      // Accumulate into targets; FP applies smoothing in the frame loop
      targetYaw.current -= e.movementX * sens;
      targetPitch.current = THREE.MathUtils.clamp(
        targetPitch.current + e.movementY * sens * ySign,
        pMin,
        pMax,
      );
      if (!firstPerson.current || cam.lookSmoothing < 0.02) {
        yawRef.current = targetYaw.current;
        pitchRef.current = targetPitch.current;
      }
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
        targetPitch.current = pitchRef.current;
        targetYaw.current = yawRef.current;
      }
    }
    if (mode === "orbit" || !group.current) return;

    // Touch look → targets (smoothed below for FP)
    if (touchLook.dx !== 0 || touchLook.dy !== 0) {
      const cam = useCameraSettingsStore.getState();
      const lookSens = (firstPerson.current ? 0.0035 : 0.0027) * cam.touchSensitivity;
      const ySign = cam.invertY ? 1 : -1;
      const pMin = firstPerson.current ? -1.35 : 0.08;
      const pMax = firstPerson.current ? 1.4 : 1.2;
      targetYaw.current -= touchLook.dx * lookSens;
      targetPitch.current = THREE.MathUtils.clamp(
        targetPitch.current + touchLook.dy * lookSens * ySign,
        pMin,
        pMax,
      );
      if (!firstPerson.current || cam.lookSmoothing < 0.02) {
        yawRef.current = targetYaw.current;
        pitchRef.current = targetPitch.current;
      }
    }

    // Look smoothing — light ease, still responsive (higher smooth = more lag)
    {
      const cam = useCameraSettingsStore.getState();
      const smooth = firstPerson.current ? cam.lookSmoothing : 0;
      if (smooth > 0.01) {
        // Map 0..0.85 → blend rate that stays snappy at low values
        const rate = 28 / (1 + smooth * 10); // ~28 at 0, ~7 at 0.3, ~3 at 0.85
        const k = 1 - Math.exp(-rate * dt);
        yawRef.current += (targetYaw.current - yawRef.current) * k;
        pitchRef.current += (targetPitch.current - pitchRef.current) * k;
      } else {
        yawRef.current = targetYaw.current;
        pitchRef.current = targetPitch.current;
      }
    }

    const speedBase = TRANSPORT_SPEED[transport] ?? 4;
    const isFoot = transport === "foot";
    const sprint = !!(keys.current["shift"] || touchInput.sprint);
    const crouch = !!(keys.current["c"] || keys.current["control"] || touchInput.crouch);
    const fpMode = firstPerson.current && !mountedVehicleId;

    // Wish direction relative to look yaw
    let inputX = 0;
    let inputZ = 0;
    if (keys.current["w"] || keys.current["arrowup"]) inputZ -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) inputZ += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) inputX -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) inputX += 1;
    inputX += touchInput.move.x;
    inputZ += touchInput.move.y;
    inputX = THREE.MathUtils.clamp(inputX, -1, 1);
    inputZ = THREE.MathUtils.clamp(inputZ, -1, 1);

    const inputMag = Math.hypot(inputX, inputZ);
    const moving = inputMag > 0.04;
    let speedMul = 1;
    if (isFoot && sprint && moving && !crouch) speedMul = fpMode ? 1.72 : 1.85;
    if (isFoot && crouch) speedMul = fpMode ? 0.42 : 0.45;
    // Reduced air control while airborne
    if (!grounded.current && isFoot) speedMul *= 0.55;

    if (mountedVehicleId) setMoveState("ride");
    else if (!isFoot && moving) setMoveState("walk");
    else if (isFoot && moving) setMoveState(sprint && !crouch ? "run" : "walk");
    else setMoveState("idle");

    {
      const len = Math.max(inputMag, 0.0001);
      const nx = inputX / (inputMag > 1 ? len : 1);
      const nz = inputZ / (inputMag > 1 ? len : 1);
      const yaw = yawRef.current;
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const wishX = (forwardX * -nz + rightX * nx) * (inputMag > 1 ? 1 : inputMag);
      const wishZ = (forwardZ * -nz + rightZ * nx) * (inputMag > 1 ? 1 : inputMag);
      const wx = useWeatherStore.getState();
      const timeMods = worldModifiers(wx.state.timeOfDay, wx.state.weatherId, wx.state.hour);
      const maxSpeed = speedBase * speedMul * (isFoot ? timeMods.moveMul : 1);
      // Acceleration / friction — snappier on ground, softer in air
      const accel = grounded.current ? (fpMode ? 14 : 18) : 6;
      const friction = grounded.current ? (fpMode ? 10 : 12) : 1.5;
      if (moving) {
        velXZ.current.x += (wishX * maxSpeed - velXZ.current.x) * Math.min(1, accel * dt);
        velXZ.current.z += (wishZ * maxSpeed - velXZ.current.z) * Math.min(1, accel * dt);
      } else {
        const damp = Math.exp(-friction * dt);
        velXZ.current.x *= damp;
        velXZ.current.z *= damp;
        if (Math.hypot(velXZ.current.x, velXZ.current.z) < 0.02) {
          velXZ.current.x = 0;
          velXZ.current.z = 0;
        }
      }
      // Clamp to max speed
      const vLen = Math.hypot(velXZ.current.x, velXZ.current.z);
      if (vLen > maxSpeed && maxSpeed > 0) {
        velXZ.current.x = (velXZ.current.x / vLen) * maxSpeed;
        velXZ.current.z = (velXZ.current.z / vLen) * maxSpeed;
      }

      let nextX = group.current.position.x + velXZ.current.x * dt;
      let nextZ = group.current.position.z + velXZ.current.z * dt;
      nextX = THREE.MathUtils.clamp(nextX, BOUNDS.minX, BOUNDS.maxX);
      nextZ = THREE.MathUtils.clamp(nextZ, BOUNDS.minZ, BOUNDS.maxZ);
      if (transport === "ferry") {
        nextZ = THREE.MathUtils.clamp(nextZ, -9, -2.5);
        nextX = THREE.MathUtils.clamp(nextX, -11, -2);
      }
      group.current.position.x = nextX;
      group.current.position.z = nextZ;

      if (vLen > 0.08) {
        const faceYaw = Math.atan2(velXZ.current.x, velXZ.current.z);
        // In FP the body follows look more than velocity (true first-person)
        const bodyYaw = fpMode ? yawRef.current : faceYaw;
        group.current.rotation.y = bodyYaw;
        setFacing(bodyYaw);
      } else {
        group.current.rotation.y = yawRef.current;
        setFacing(yawRef.current);
      }
      setPosition([nextX, group.current.position.y, nextZ]);
      if (mountedVehicleId) updateMountedVehiclePose([nextX, 0, nextZ], yawRef.current);
      const near = nearestDistrict(nextX, nextZ);
      setNearDistrict(near);
      useInteriorStore.getState().setNearDoor(nearestDoor(nextX, nextZ));
      onDistrictChange?.(near);

      // Head-bob phase from horizontal speed
      const spd = Math.hypot(velXZ.current.x, velXZ.current.z);
      if (grounded.current && spd > 0.4 && isFoot) {
        const cadence = (sprint && !crouch ? 11.5 : 7.2) * (spd / Math.max(maxSpeed, 0.1));
        bobPhase.current += dt * cadence;
      }
    }

    // Jump + landing punch (foot only)
    if (isFoot && !mountedVehicleId) {
      if ((keys.current["space"] || touchInput.jump) && grounded.current) {
        jumpVel.current = fpMode ? 4.0 : 4.2;
        grounded.current = false;
      }
      jumpVel.current -= (fpMode ? 16 : 14) * dt;
      const floorY = crouch ? 0.35 : 0.55;
      let y = group.current.position.y + jumpVel.current * dt;
      if (y <= floorY) {
        if (!wasGrounded.current && jumpVel.current < -1.2) {
          // Landing impact scales with fall speed
          landPunch.current = Math.min(0.22, Math.abs(jumpVel.current) * 0.035);
        }
        y = floorY;
        jumpVel.current = 0;
        grounded.current = true;
      }
      wasGrounded.current = grounded.current;
      group.current.position.y = y;
    } else {
      group.current.position.y = 0.55;
      grounded.current = true;
      wasGrounded.current = true;
    }
    // Decay landing punch
    landPunch.current = Math.max(0, landPunch.current - dt * 1.8);

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
      if (house) {
        const wx = useWeatherStore.getState();
        const tm = worldModifiers(wx.state.timeOfDay, wx.state.weatherId, wx.state.hour);
        coolHeat(house.coolRate * 0.15 * tm.coolMul);
      }
    }

    // Camera: third-person over-shoulder OR first-person eyes
    const target = group.current.position;
    const cy = yawRef.current;
    const cp = pitchRef.current;
    const spdNow = Math.hypot(velXZ.current.x, velXZ.current.z);
    const sprinting = !!((keys.current["shift"] || touchInput.sprint) && isFoot && moving && !crouch && grounded.current);
    const fp = firstPerson.current && !mountedVehicleId;

    // Hide full body mesh in first-person (head would fill the lens).
    // Hands / legs are drawn by FirstPersonLimbs in camera space.
    if (group.current) {
      group.current.visible = !fp;
    }

    const camSettings = useCameraSettingsStore.getState();
    const desired = cameraScratchDesired;
    const look = cameraScratchLook;

    if (fp) {
      // Smooth crouch eye height
      const eyeTarget = crouch ? 1.08 : 1.64;
      eyeHeight.current = THREE.MathUtils.lerp(eyeHeight.current, eyeTarget, 1 - Math.exp(-12 * dt));

      // Head bob: vertical + slight lateral, scaled by speed and settings
      const bobAmp = camSettings.headBob * (sprinting ? 1.0 : 0.55) * THREE.MathUtils.clamp(spdNow / 5.5, 0, 1);
      const bobY = grounded.current ? Math.sin(bobPhase.current * 2) * 0.028 * bobAmp : 0;
      const bobX = grounded.current ? Math.cos(bobPhase.current) * 0.014 * bobAmp : 0;
      // Landing punch dips the camera
      const punch = landPunch.current;

      // Strafe lean (camera roll)
      const rightDot = Math.cos(cy) * velXZ.current.x + (-Math.sin(cy)) * velXZ.current.z;
      const leanTarget = THREE.MathUtils.clamp(-rightDot * 0.012, -0.04, 0.04);
      camRoll.current = THREE.MathUtils.lerp(camRoll.current, leanTarget, 1 - Math.pow(0.02, dt));

      const fwdX = -Math.sin(cy);
      const fwdZ = -Math.cos(cy);
      const rightX = Math.cos(cy);
      const rightZ = -Math.sin(cy);
      const eyeY = target.y + eyeHeight.current + bobY - punch;
      desired.set(
        target.x + fwdX * 0.14 + rightX * bobX,
        eyeY,
        target.z + fwdZ * 0.14 + rightZ * bobX,
      );
      const lookDist = 14;
      look.set(
        desired.x - Math.sin(cy) * Math.cos(cp) * lookDist,
        eyeY + Math.sin(cp) * lookDist,
        desired.z - Math.cos(cy) * Math.cos(cp) * lookDist,
      );
      camera.position.copy(desired);
      camera.lookAt(look.x, look.y, look.z);
      // Apply subtle roll after lookAt
      if (Math.abs(camRoll.current) > 0.0005) {
        camera.rotateZ(camRoll.current);
      }
    } else {
      camRoll.current = THREE.MathUtils.lerp(camRoll.current, 0, 1 - Math.pow(0.01, dt));
      // Third-person COD-style: distance + height + right-shoulder offset
      const dist = mountedVehicleId ? 9.5 : crouch ? 5.2 : sprinting ? 7.4 : 6.6;
      const height = mountedVehicleId ? 4.2 : crouch ? 2.6 : 3.35;
      const shoulder = mountedVehicleId ? 0.35 : 0.55;
      const backX = Math.sin(cy) * Math.cos(cp);
      const backZ = Math.cos(cy) * Math.cos(cp);
      const rightX = Math.cos(cy);
      const rightZ = -Math.sin(cy);
      desired.set(
        target.x + backX * dist + rightX * shoulder,
        target.y + height + Math.sin(cp) * dist * 0.32,
        target.z + backZ * dist + rightZ * shoulder,
      );
      look.set(target.x + rightX * shoulder * 0.35, target.y + (crouch ? 1.05 : 1.4), target.z + rightZ * shoulder * 0.35);
      const lag = sprinting ? 0.00035 : 0.00018;
      camera.position.lerp(desired, 1 - Math.pow(lag, dt));
      camera.lookAt(look.x, look.y, look.z);
    }

    // FOV: settings + sprint punch in FP + vehicle
    const baseFov = fp ? camSettings.fpsFov : camSettings.tpsFov;
    const sprintFov = fp ? (sprinting ? 7 : 0) : (sprinting ? 8 : 0);
    const targetFov = baseFov + sprintFov + (mountedVehicleId ? 4 : 0);
    fovRef.current = THREE.MathUtils.lerp(fovRef.current, targetFov, 1 - Math.exp(-10 * dt));
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
      targetYaw.current = yawRef.current;
      targetPitch.current = pitchRef.current;
      velXZ.current = { x: 0, z: 0 };
      landPunch.current = 0;
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "orbit") return null;

  const color =
    transport === "okada"
      ? SCENE_PALETTE.orange
      : transport === "taxi"
        ? SCENE_PALETTE.yellow
        : transport === "ferry"
          ? SCENE_PALETTE.blueSky
          : transport === "keke"
            ? SCENE_PALETTE.green
            : transport === "scooter"
              ? SCENE_PALETTE.purple
              : transport === "bicycle"
                ? SCENE_PALETTE.slateGrey
                : SCENE_PALETTE.white;

  return (
    <>
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
      <FirstPersonLimbs activeRef={firstPerson} pitchRef={pitchRef} />
    </>
  );
}

function ParkedVehicles() {
  const worldVehicles = useRoamStore((s) => s.worldVehicles);
  const nearVehicleId = useRoamStore((s) => s.nearVehicleId);
  const colors: Record<string, string> = {
    bicycle: SCENE_PALETTE.slateGrey,
    scooter: SCENE_PALETTE.purple,
    keke: SCENE_PALETTE.green,
    okada: SCENE_PALETTE.orange,
    taxi: SCENE_PALETTE.yellow,
    ferry: SCENE_PALETTE.blueSky,
  };
  return (
    <group>
      {worldVehicles
        .filter((v) => !v.occupied)
        .map((v) => (
          <group key={v.id} position={v.position} rotation={[0, v.facing, 0]}>
            <SimpleVehicle position={[0, 0, 0]} color={colors[v.kind] ?? SCENE_PALETTE.neonSlate} kind={v.kind} />
            {nearVehicleId === v.id && (
              <mesh position={[0, 1.5, 0]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshStandardMaterial color={SCENE_PALETTE.yellowLight} emissive={SCENE_PALETTE.yellowGlow} emissiveIntensity={1} />
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
      { path: 0, speed: 0.12, t0: 0, color: SCENE_PALETTE.yellow, kind: "taxi" as const },
      { path: 0, speed: 0.18, t0: 0.4, color: SCENE_PALETTE.orange, kind: "okada" as const },
      { path: 1, speed: 0.15, t0: 0.2, color: SCENE_PALETTE.purple, kind: "scooter" as const },
      { path: 1, speed: 0.2, t0: 0.65, color: SCENE_PALETTE.green, kind: "keke" as const },
      { path: 2, speed: 0.11, t0: 0.1, color: SCENE_PALETTE.amberNeon, kind: "taxi" as const },
      { path: 2, speed: 0.17, t0: 0.55, color: SCENE_PALETTE.orangeNeon, kind: "okada" as const },
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
      if (!pts || pts.length < 2) return;
      const raw = (t * v.speed + v.t0) % 1;
      const f = raw * (pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, pts.length - 1);
      const local = f - i0;
      const [x0 = 0, z0 = 0] = pts[i0] ?? [];
      const [x1 = 0, z1 = 0] = pts[i1] ?? [];
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

/** Domestic animals and birds scattered through the pre-colonial village. */
/** Dense small-animal life in sacred grove, waterfall, cave, and forest edge. */
function ForestCritters() {
  const pack = useMemo(() => {
    const frogs: { x: number; z: number; phase: number }[] = [];
    const lizards: { x: number; z: number; phase: number; color: string }[] = [];
    const geckos: { x: number; z: number; phase: number }[] = [];
    const rats: { x: number; z: number; phase: number }[] = [];
    const mice: { x: number; z: number; phase: number }[] = [];
    const beetles: { x: number; z: number; phase: number }[] = [];
    const crabs: { x: number; z: number; phase: number }[] = [];
    const colors = ["#6b8f3a", "#5a7a30", "#8a9a40", "#4a6a28", "#7a8a38"];

    // Sacred grove ring (~10, -10)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const d = 2.5 + (i % 4) * 0.7;
      frogs.push({ x: 10 + Math.cos(a) * d * 0.6, z: -10 + Math.sin(a) * d * 0.6, phase: i * 0.7 });
      beetles.push({ x: 10 + Math.cos(a + 0.3) * (d + 0.5), z: -10 + Math.sin(a + 0.3) * (d + 0.5), phase: i * 0.5 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      lizards.push({
        x: 10 + Math.cos(a) * 4.5,
        z: -10 + Math.sin(a) * 4.5,
        phase: i * 0.9,
        color: colors[i % colors.length]!,
      });
      geckos.push({ x: 10 + Math.cos(a) * 3.2, z: -10 + Math.sin(a) * 3.2, phase: i * 1.1 });
    }
    // Waterfall pool (~3, -14)
    for (let i = 0; i < 8; i++) {
      frogs.push({ x: 3 + (i % 4) * 0.7 - 1.2, z: -14 + Math.floor(i / 4) * 0.8 - 0.5, phase: i * 0.6 });
    }
    for (let i = 0; i < 4; i++) {
      crabs.push({ x: 2.5 + i * 0.6, z: -13.5 - (i % 2) * 0.5, phase: i * 0.8 });
    }
    // Cave mouth (~22, -16)
    for (let i = 0; i < 6; i++) {
      rats.push({ x: 21 + (i % 3) * 0.8, z: -15.5 - Math.floor(i / 3) * 0.7, phase: i * 0.9 });
      mice.push({ x: 22.5 + (i % 3) * 0.5, z: -16.5 + (i % 2) * 0.6, phase: i * 1.2 });
      geckos.push({ x: 22 + Math.cos(i) * 1.2, z: -16 + Math.sin(i) * 1.0, phase: i * 0.7 });
    }
    // Forest edge / rainforest approach (~40, 30) and secondary belts
    for (let i = 0; i < 6; i++) {
      const fx = 38 + (i % 6) * 2.2;
      const fz = 28 + Math.floor(i / 6) * 3.5;
      lizards.push({ x: fx, z: fz, phase: i * 0.55, color: colors[i % colors.length]! });
      beetles.push({ x: fx + 0.5, z: fz - 0.4, phase: i * 0.4 });
      if (i % 2 === 0) rats.push({ x: fx - 0.8, z: fz + 0.6, phase: i * 0.75 });
      if (i % 3 === 0) frogs.push({ x: fx + 1, z: fz + 1.2, phase: i * 0.5 });
    }
    // NW secondary forest
    for (let i = 0; i < 4; i++) {
      const fx = -35 + (i % 4) * 2;
      const fz = 38 + Math.floor(i / 4) * 2.5;
      lizards.push({ x: fx, z: fz, phase: i * 0.8, color: colors[(i + 2) % colors.length]! });
      geckos.push({ x: fx + 0.4, z: fz - 0.3, phase: i * 1.0 });
      mice.push({ x: fx - 0.5, z: fz + 0.5, phase: i * 0.6 });
    }
    // Path to grove understory
    for (let i = 0; i < 6; i++) {
      beetles.push({ x: 7 + i * 0.8, z: -7 - i * 0.5, phase: i * 0.45 });
      lizards.push({ x: 8 + i * 0.7, z: -8 - i * 0.4, phase: i * 0.7, color: colors[i % colors.length]! });
    }
    return { frogs, lizards, geckos, rats, mice, beetles, crabs };
  }, []);

  return (
    <group>
      {pack.frogs.map((c, i) => (
        <Frog key={`ff-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {pack.lizards.map((c, i) => (
        <Lizard key={`fl-${i}`} x={c.x} z={c.z} phase={c.phase} color={c.color} />
      ))}
      {pack.geckos.map((c, i) => (
        <Gecko key={`fg-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {pack.rats.map((c, i) => (
        <Rat key={`fr-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {pack.mice.map((c, i) => (
        <Mouse key={`fm-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {pack.beetles.map((c, i) => (
        <Beetle key={`fb-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {pack.crabs.map((c, i) => (
        <Crab key={`fc-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {/* Forest extras — snakes, hares, squirrels, butterflies, chameleons, tortoises */}
      {([
        [8, -12], [12, -14], [20, -17], [40, 30], [-34, 40], [6, -9],
      ] as const).map(([x, z], i) => (
        <Snake key={`fsn-${i}`} x={x} z={z} phase={i * 0.7} />
      ))}
      {([
        [9, -11], [15, -15], [38, 32], [-36, 38], [7, -8],
      ] as const).map(([x, z], i) => (
        <Chameleon key={`fch-${i}`} x={x} z={z} phase={i * 0.9} />
      ))}
      {([
        [5, -10], [14, 10], [36, 28], [-30, 36], [2, 6], [11, -5],
      ] as const).map(([x, z], i) => (
        <Hare key={`fha-${i}`} x={x} z={z} phase={i * 0.6} />
      ))}
      {([
        [10, -9], [13, -12], [42, 30], [-32, 42], [8, 4], [16, 8], [4, -7],
      ] as const).map(([x, z], i) => (
        <Squirrel key={`fsq-${i}`} x={x} z={z} phase={i * 0.55} />
      ))}
      {([
        [10, -10], [3, -14], [40, 35], [-35, 40], [0, 2], [18, 20], [8, -6], [12, 5],
      ] as const).map(([x, z], i) => (
        <Butterfly key={`fbu-${i}`} x={x} z={z} phase={i * 0.4} />
      ))}
      {([
        [7, -11], [22, -16], [35, 30], [-33, 39],
      ] as const).map(([x, z], i) => (
        <Tortoise key={`fto-${i}`} x={x} z={z} phase={i * 1.1} />
      ))}
    </group>
  );
}

function VillageAnimals() {
  const herd = useMemo(
    () => [
      // goats near residential west
      { kind: "goat" as const, x: -9.5, z: 3.5, phase: 0.2, scale: 0.95 },
      { kind: "goat" as const, x: -10.5, z: 4.2, phase: 1.1, scale: 0.85 },
      { kind: "goat" as const, x: -8.2, z: 5.0, phase: 2.0, scale: 0.9 },
      { kind: "goat" as const, x: -12.0, z: 2.0, phase: 0.7, scale: 0.88 },
      // sheep
      { kind: "sheep" as const, x: -6.0, z: 7.5, phase: 0.4, scale: 0.95 },
      { kind: "sheep" as const, x: -5.0, z: 8.2, phase: 1.5, scale: 0.9 },
      { kind: "sheep" as const, x: 2.0, z: 10.0, phase: 2.2, scale: 0.92 },
      // cattle near open fringe
      { kind: "cow" as const, x: -14.0, z: 6.0, phase: 0.3, scale: 1.05 },
      { kind: "cow" as const, x: -15.5, z: 4.5, phase: 1.8, scale: 1.0 },
      { kind: "cow" as const, x: 8.0, z: 14.0, phase: 0.9, scale: 1.08 },
      // dogs
      { kind: "dog" as const, x: -3.5, z: 2.5, phase: 0.5, scale: 0.9 },
      { kind: "dog" as const, x: 1.0, z: 4.0, phase: 1.3, scale: 0.85 },
      { kind: "dog" as const, x: 17.0, z: 18.5, phase: 2.4, scale: 0.88 },
      { kind: "dog" as const, x: 5.5, z: 1.5, phase: 0.1, scale: 0.9 },
      // pigs
      { kind: "pig" as const, x: -7.0, z: -2.0, phase: 0.6, scale: 0.9 },
      { kind: "pig" as const, x: -8.5, z: -3.5, phase: 1.9, scale: 0.85 },
      { kind: "pig" as const, x: 11.5, z: -3.0, phase: 0.8, scale: 0.92 },
      // antelope at forest edge / grove approach
      { kind: "antelope" as const, x: 6.0, z: -11.0, phase: 0.4, scale: 1.0 },
      { kind: "antelope" as const, x: 12.0, z: -13.0, phase: 1.6, scale: 0.95 },
      { kind: "antelope" as const, x: 4.0, z: -9.0, phase: 2.5, scale: 0.9 },
      // cats near huts
      { kind: "cat" as const, x: -4.5, z: 1.0, phase: 0.2, scale: 0.8 },
      { kind: "cat" as const, x: 12.5, z: 2.0, phase: 1.4, scale: 0.75 },
      { kind: "cat" as const, x: 18.5, z: 17.5, phase: 2.1, scale: 0.8 },
      // more roaming animals
      { kind: "goat" as const, x: -16, z: 3, phase: 0.5, scale: 0.9 },
      { kind: "goat" as const, x: 6, z: 12, phase: 1.4, scale: 0.92 },
      { kind: "sheep" as const, x: -2, z: 14, phase: 0.8, scale: 0.9 },
      { kind: "sheep" as const, x: 16, z: 8, phase: 1.6, scale: 0.88 },
      { kind: "cow" as const, x: -18, z: 8, phase: 0.4, scale: 1.05 },
      { kind: "cow" as const, x: 10, z: 16, phase: 1.2, scale: 1.0 },
      { kind: "dog" as const, x: 8, z: -4, phase: 0.9, scale: 0.88 },
      { kind: "dog" as const, x: -6, z: 10, phase: 1.7, scale: 0.9 },
      { kind: "antelope" as const, x: 18, z: -12, phase: 0.3, scale: 1.0 },
      { kind: "antelope" as const, x: -8, z: -10, phase: 1.5, scale: 0.95 },
      { kind: "pig" as const, x: 4, z: -6, phase: 0.6, scale: 0.9 },
      { kind: "cat" as const, x: -1, z: 5, phase: 1.0, scale: 0.78 },
    ],
    [],
  );

  const poultry = useMemo(
    () => [
      { x: -9.0, z: 1.0, phase: 0.1 },
      { x: -8.5, z: 1.6, phase: 0.8 },
      { x: -10.0, z: 0.5, phase: 1.5 },
      { x: -3.0, z: 3.5, phase: 0.4 },
      { x: -2.5, z: 4.0, phase: 1.2 },
      { x: 10.5, z: 3.5, phase: 0.6 },
      { x: 11.0, z: 4.2, phase: 1.9 },
      { x: 17.5, z: 19.0, phase: 0.3 },
      { x: 19.0, z: 18.5, phase: 1.1 },
      { x: 0.5, z: 5.5, phase: 2.0 },
      { x: -1.0, z: 6.0, phase: 0.7 },
      { x: 4.0, z: 2.5, phase: 1.4 },
    ],
    [],
  );

  const ducks = useMemo(
    () => [
      { x: -5.0, z: -5.0, phase: 0.2 },
      { x: -6.2, z: -5.5, phase: 1.0 },
      { x: -4.5, z: -6.0, phase: 1.8 },
      { x: -7.0, z: -4.5, phase: 0.5 },
      { x: 3.5, z: -13.5, phase: 1.2 },
      { x: 2.5, z: -14.0, phase: 2.0 },
    ],
    [],
  );

  const herons = useMemo(
    () => [
      { x: -6.5, z: -6.5, phase: 0.3 },
      { x: 4.0, z: -15.0, phase: 1.5 },
      { x: 5.5, z: 0.5, phase: 0.8 },
    ],
    [],
  );

  const birds = useMemo(
    () => [
      { x: 0, y: 8, z: 0, phase: 0.2 },
      { x: 10, y: 9, z: -8, phase: 1.1 },
      { x: 18, y: 7, z: 18, phase: 2.0 },
      { x: -10, y: 8, z: 5, phase: 0.6 },
      { x: 5, y: 10, z: -14, phase: 1.7 },
      { x: -5, y: 7, z: -5, phase: 2.4 },
    ],
    [],
  );

  const frogs = useMemo(
    () => [
      { x: -5.5, z: -5.2, phase: 0.2 },
      { x: -6.0, z: -6.0, phase: 1.1 },
      { x: -4.2, z: -5.8, phase: 2.0 },
      { x: 3.2, z: -13.5, phase: 0.5 },
      { x: 2.0, z: -14.2, phase: 1.5 },
      { x: 4.0, z: -12.8, phase: 2.3 },
      { x: -5.0, z: -4.5, phase: 0.8 },
      { x: 1.5, z: -13.0, phase: 1.9 },
    ],
    [],
  );

  const lizards = useMemo(
    () => [
      { x: -9.0, z: 2.0, phase: 0.3, color: "#6b8f3a" },
      { x: -11.0, z: 4.0, phase: 1.2, color: "#8a9a40" },
      { x: 11.0, z: 3.0, phase: 0.7, color: "#5a7a30" },
      { x: 18.0, z: 18.0, phase: 1.8, color: "#7a8a35" },
      { x: 8.0, z: -7.0, phase: 0.4, color: "#6b8f3a" },
      { x: 0.5, z: 6.0, phase: 2.1, color: "#9aaa50" },
      { x: 14.0, z: 10.0, phase: 1.0, color: "#5a7a30" },
      { x: -3.0, z: 9.0, phase: 1.6, color: "#6b8f3a" },
    ],
    [],
  );

  const geckos = useMemo(
    () => [
      { x: -10.2, z: 1.5, phase: 0.2 },
      { x: -4.5, z: 1.8, phase: 1.0 },
      { x: 12.0, z: 4.5, phase: 1.7 },
      { x: 17.5, z: 19.5, phase: 0.6 },
      { x: 9.0, z: -8.0, phase: 2.2 },
      { x: -1.0, z: 4.8, phase: 1.3 },
      { x: 5.5, z: 2.0, phase: 0.9 },
    ],
    [],
  );

  const rats = useMemo(
    () => [
      { x: -8.0, z: -1.5, phase: 0.4 },
      { x: -12.0, z: 0.5, phase: 1.3 },
      { x: 16.5, z: 17.0, phase: 0.8 },
      { x: 19.5, z: 21.0, phase: 2.0 },
      { x: 1.0, z: 4.0, phase: 1.5 },
      { x: 10.0, z: 12.0, phase: 0.2 },
      { x: -2.0, z: 7.0, phase: 1.8 },
      { x: 7.0, z: -3.0, phase: 0.7 },
    ],
    [],
  );

  const mice = useMemo(
    () => [
      { x: -9.5, z: 0.8, phase: 0.5 },
      { x: -3.5, z: 2.2, phase: 1.2 },
      { x: 11.5, z: 2.5, phase: 0.9 },
      { x: 18.2, z: 18.8, phase: 1.7 },
      { x: 0.0, z: 5.0, phase: 2.1 },
      { x: 4.5, z: 10.0, phase: 0.3 },
    ],
    [],
  );

  const beetles = useMemo(
    () => [
      { x: -7.0, z: 3.0, phase: 0.2 },
      { x: 9.0, z: -6.0, phase: 1.1 },
      { x: 3.0, z: -12.0, phase: 1.8 },
      { x: 15.0, z: 16.0, phase: 0.6 },
      { x: -4.0, z: 6.0, phase: 1.4 },
      { x: 12.0, z: 8.0, phase: 2.0 },
      { x: -11.0, z: -2.0, phase: 0.9 },
      { x: 6.0, z: 1.0, phase: 1.6 },
    ],
    [],
  );

  const crabs = useMemo(
    () => [
      { x: -6.5, z: -5.5, phase: 0.3 },
      { x: -4.8, z: -6.2, phase: 1.2 },
      { x: 5.2, z: 1.8, phase: 0.8 },
      { x: 6.0, z: 0.5, phase: 1.9 },
      { x: 3.0, z: -14.5, phase: 0.5 },
    ],
    [],
  );

  const snakes = useMemo(
    () => [
      { x: -8, z: -3, phase: 0.2 },
      { x: 9, z: -6, phase: 1.1 },
      { x: 4, z: 8, phase: 1.8 },
      { x: 15, z: 12, phase: 0.6 },
      { x: -12, z: 5, phase: 1.4 },
    ],
    [],
  );
  const tortoises = useMemo(
    () => [
      { x: -6, z: 4, phase: 0.3 },
      { x: 7, z: 2, phase: 1.2 },
      { x: 11, z: -4, phase: 0.8 },
      { x: 2, z: 10, phase: 1.7 },
    ],
    [],
  );
  const hares = useMemo(
    () => [
      { x: -10, z: 8, phase: 0.4 },
      { x: 5, z: -8, phase: 1.0 },
      { x: 14, z: 6, phase: 1.6 },
      { x: -3, z: 12, phase: 0.9 },
      { x: 8, z: 15, phase: 2.0 },
    ],
    [],
  );
  const squirrels = useMemo(
    () => [
      { x: -9, z: 2, phase: 0.5 },
      { x: 10, z: -7, phase: 1.3 },
      { x: 6, z: 5, phase: 0.7 },
      { x: 16, z: 17, phase: 1.5 },
      { x: 1, z: -2, phase: 2.1 },
      { x: -5, z: 7, phase: 0.2 },
    ],
    [],
  );
  const butterflies = useMemo(
    () => [
      { x: 0, z: 0, phase: 0.1 },
      { x: -4, z: 3, phase: 0.8 },
      { x: 8, z: -5, phase: 1.4 },
      { x: 12, z: 8, phase: 2.0 },
      { x: 18, z: 18, phase: 0.5 },
      { x: -8, z: 6, phase: 1.2 },
      { x: 3, z: -12, phase: 1.8 },
      { x: 10, z: -10, phase: 0.3 },
    ],
    [],
  );
  const chameleons = useMemo(
    () => [
      { x: 9, z: -9, phase: 0.4 },
      { x: 11, z: -11, phase: 1.1 },
      { x: -7, z: 3, phase: 1.7 },
      { x: 13, z: 4, phase: 0.9 },
    ],
    [],
  );

  return (
    <group>
      {herd.map((a, i) => (
        <Creature key={`h-${i}`} x={a.x} y={0} z={a.z} phase={a.phase} scale={a.scale} kind={a.kind} />
      ))}
      {poultry.map((c, i) => (
        <Chicken key={`c-${i}`} x={c.x} y={0} z={c.z} phase={c.phase} />
      ))}
      {ducks.map((d, i) => (
        <Duck key={`d-${i}`} x={d.x} y={0} z={d.z} phase={d.phase} />
      ))}
      {herons.map((h, i) => (
        <Heron key={`he-${i}`} x={h.x} y={0} z={h.z} phase={h.phase} />
      ))}
      {birds.map((b, i) => (
        <FlyingBird key={`fb-${i}`} x={b.x} y={b.y} z={b.z} phase={b.phase} />
      ))}
      {frogs.map((c, i) => (
        <Frog key={`fr-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {lizards.map((c, i) => (
        <Lizard key={`lz-${i}`} x={c.x} z={c.z} phase={c.phase} color={c.color} />
      ))}
      {geckos.map((c, i) => (
        <Gecko key={`gk-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {rats.map((c, i) => (
        <Rat key={`rt-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {mice.map((c, i) => (
        <Mouse key={`ms-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {beetles.map((c, i) => (
        <Beetle key={`bt-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {crabs.map((c, i) => (
        <Crab key={`cb-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {snakes.map((c, i) => (
        <Snake key={`sn-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {tortoises.map((c, i) => (
        <Tortoise key={`to-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {hares.map((c, i) => (
        <Hare key={`ha-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {squirrels.map((c, i) => (
        <Squirrel key={`sq-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {butterflies.map((c, i) => (
        <Butterfly key={`bu-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
      {chameleons.map((c, i) => (
        <Chameleon key={`ch-${i}`} x={c.x} z={c.z} phase={c.phase} />
      ))}
    </group>
  );
}

function NpcCrowd() {
  const playerPos = useRoamStore((s) => s.position);
  const npcs = useMemo(() => {
    const skins = [SCENE_PALETTE.skinDeep, SCENE_PALETTE.skinMid, SCENE_PALETTE.skinTan, SCENE_PALETTE.skinGold, SCENE_PALETTE.lateriteLight, SCENE_PALETTE.skinBrown];
    const shapes = ["slim", "average", "curvy", "athletic", "broad"] as const;
    const tops = ["top-ankara", "top-coral", "top-olive", "top-ankara"] as const;
    const bottoms = ["bottom-skirt", "bottom-white-wide", "bottom-skirt", "bottom-cargo"] as const;
    type Activity = "discuss" | "talk" | "wave" | "idle";
    type NpcSpec = {
      appearance: typeof DEFAULT_APPEARANCE & { gender: "female" | "male"; bodyShape: (typeof shapes)[number]; height: "short" | "average" | "tall"; skin: string; hair: "braids" | "short" | "afro" | "bob" | "bun" | "long"; hairColor: string; displayName: string };
      equipped: { top: string; bottom: string; outer: null; shoes: string; accessory: null; hat: null };
      x: number;
      z: number;
      phase: number;
      /** Simple elliptical roam */
      roam: boolean;
      /** Optional path waypoints — walks loop */
      path?: [number, number][];
      walkSpeed: number;
      activity: Activity;
      /** Activities to cycle through while standing */
      cycle?: Activity[];
      faceToward: [number, number] | null;
    };
    const make = (i: number, x: number, z: number, opts: Partial<NpcSpec> = {}): NpcSpec => ({
      appearance: {
        ...DEFAULT_APPEARANCE,
        gender: (i % 2 === 0 ? "female" : "male") as "female" | "male",
        bodyShape: shapes[i % shapes.length] ?? "average",
        height: (["short", "average", "tall"] as const)[i % 3] ?? "average",
        skin: skins[i % skins.length] ?? SCENE_PALETTE.skinMid,
        hair: (["braids", "short", "afro", "bob", "bun", "long"] as const)[i % 6] ?? "short",
        hairColor: SCENE_PALETTE.ink,
        displayName: `Npc${i}`,
      },
      equipped: {
        top: tops[i % tops.length] ?? "top-ankara",
        bottom: bottoms[i % bottoms.length] ?? "bottom-skirt",
        outer: null,
        shoes: "shoes-basic",
        accessory: null,
        hat: null,
      },
      x,
      z,
      phase: i * 0.85,
      roam: false,
      walkSpeed: 0.55 + (i % 5) * 0.08,
      activity: "idle",
      faceToward: null,
      ...opts,
    });

    const list: NpcSpec[] = [];
    // Town talk circle — cycle gestures
    for (let i = 0; i < 4; i++) {
      list.push(
        make(i, Math.cos((i / 4) * Math.PI * 2) * 1.15 - 1.5, Math.sin((i / 4) * Math.PI * 2) * 1.15 + 1.2, {
          activity: "discuss",
          cycle: ["discuss", "talk", "wave", "discuss"],
          faceToward: [-1.5, 1.2],
        }),
      );
    }
    list.push(make(4, -3.2, 3.4, { activity: "talk", cycle: ["talk", "discuss", "idle"], faceToward: [-2.75, 3.4] }));
    list.push(make(5, -2.3, 3.4, { activity: "talk", cycle: ["discuss", "talk", "wave"], faceToward: [-2.75, 3.4] }));

    // Path walkers — village loops
    list.push(
      make(6, -4, 0, {
        path: [[-4, 0], [-2, 2], [0, 1], [2, 3], [1, 5], [-1, 4], [-3, 2]],
        walkSpeed: 0.7,
        activity: "idle",
      }),
    );
    list.push(
      make(7, 2, -2, {
        path: [[2, -2], [4, 0], [6, 2], [5, 4], [3, 3], [1, 1]],
        walkSpeed: 0.65,
        activity: "idle",
      }),
    );
    list.push(
      make(8, -8, 2, {
        path: [[-8, 2], [-10, 4], [-12, 3], [-11, 1], [-9, 0], [-7, 1]],
        walkSpeed: 0.6,
        activity: "idle",
      }),
    );
    list.push(
      make(9, 3, 8, {
        path: [[3, 8], [6, 10], [9, 12], [12, 14], [14, 16], [16, 18], [14, 17], [10, 14], [6, 11]],
        walkSpeed: 0.75,
        activity: "idle",
      }),
    );

    const mx = 18;
    const mz = 20;
    list.push(make(10, mx - 1.4, mz + 0.3, { activity: "talk", cycle: ["talk", "discuss", "wave"], faceToward: [mx, mz] }));
    list.push(make(11, mx + 1.2, mz + 0.5, { activity: "discuss", cycle: ["discuss", "talk"], faceToward: [mx + 0.5, mz] }));
    list.push(make(12, mx - 0.2, mz - 1.5, { activity: "talk", cycle: ["talk", "idle", "discuss"], faceToward: [mx, mz - 0.5] }));
    list.push(make(13, mx + 1.6, mz - 1.0, { activity: "idle", cycle: ["idle", "wave", "talk"], faceToward: [mx, mz] }));
    list.push(make(14, mx - 0.8, mz + 1.4, { activity: "discuss", cycle: ["discuss", "talk"], faceToward: [mx - 1.0, mz + 0.6] }));
    list.push(make(15, mx - 0.2, mz + 1.6, { activity: "talk", cycle: ["talk", "discuss", "wave"], faceToward: [mx - 1.0, mz + 0.6] }));
    list.push(make(16, mx + 0.6, mz + 1.3, { activity: "talk", cycle: ["talk", "idle"], faceToward: [mx + 1.0, mz + 0.4] }));
    list.push(make(17, mx + 1.0, mz + 1.7, { activity: "discuss", cycle: ["discuss", "wave", "talk"], faceToward: [mx + 1.0, mz + 0.4] }));
    // Market path walkers
    list.push(
      make(18, mx - 2.2, mz + 0.8, {
        path: [[mx - 2.5, mz + 1], [mx - 1, mz + 2], [mx + 1, mz + 2.2], [mx + 2.5, mz + 0.5], [mx + 1.5, mz - 1], [mx - 1.5, mz - 1.2], [mx - 2.5, mz + 0.2]],
        walkSpeed: 0.7,
      }),
    );
    list.push(
      make(19, mx + 2.4, mz - 0.4, {
        path: [[mx + 2.5, mz], [mx + 0.5, mz + 2], [mx - 2, mz + 1], [mx - 1, mz - 1.5], [mx + 2, mz - 1.2]],
        walkSpeed: 0.8,
      }),
    );
    list.push(make(20, mx + 0.3, mz + 2.2, { roam: true, walkSpeed: 0.9, activity: "idle" }));
    list.push(make(21, mx - 1.8, mz - 1.6, { roam: true, walkSpeed: 0.75, activity: "wave" }));
    list.push(make(22, mx - 0.6, mz + 0.2, { activity: "discuss", cycle: ["discuss", "talk", "wave"], faceToward: [mx + 0.2, mz + 0.3] }));
    list.push(make(23, mx + 0.3, mz + 0.4, { activity: "talk", cycle: ["talk", "discuss"], faceToward: [mx - 0.4, mz + 0.1] }));

    const sx = -1.2;
    const sz = 5.2;
    list.push(make(24, sx - 0.8, sz + 0.4, { activity: "talk", cycle: ["talk", "discuss", "wave"], faceToward: [sx, sz] }));
    list.push(make(25, sx + 0.9, sz + 0.2, { activity: "discuss", cycle: ["discuss", "talk"], faceToward: [sx, sz] }));
    list.push(make(26, sx + 0.2, sz - 0.9, { activity: "idle", cycle: ["idle", "wave", "talk"], faceToward: [sx, sz] }));
    list.push(
      make(27, sx - 1.2, sz - 0.5, {
        path: [[sx - 1.5, sz], [sx + 1.2, sz + 1], [sx + 1.5, sz - 0.8], [sx - 0.5, sz - 1.2]],
        walkSpeed: 0.65,
      }),
    );
    list.push(make(28, sx + 1.4, sz + 1.0, { roam: true, walkSpeed: 0.7, activity: "wave" }));

    list.push(make(29, 0.8, -0.8, { activity: "discuss", cycle: ["discuss", "talk", "wave"], faceToward: [0, -1.2] }));
    list.push(make(30, -0.6, -1.0, { activity: "talk", cycle: ["talk", "discuss"], faceToward: [0, -1.2] }));
    list.push(make(31, 1.2, -2.0, { activity: "idle", cycle: ["idle", "wave", "talk"], faceToward: [0, -1.5] }));
    list.push(
      make(32, -1.5, -0.4, {
        path: [[-1.5, -0.4], [1, -2], [2, 0], [0, 2], [-2, 1]],
        walkSpeed: 0.7,
      }),
    );

    list.push(make(33, -5.0, -3.0, { activity: "talk", cycle: ["talk", "discuss"], faceToward: [-5.5, -4] }));
    list.push(make(34, -6.0, -4.0, { activity: "idle", cycle: ["idle", "wave"], faceToward: [-5.5, -5] }));
    list.push(
      make(35, -4.2, -4.5, {
        path: [[-4.2, -4.5], [-6, -5.5], [-7, -4], [-5.5, -3], [-4, -3.5]],
        walkSpeed: 0.6,
      }),
    );

    list.push(make(36, 5.0, 2.0, { activity: "discuss", cycle: ["discuss", "talk", "wave"], faceToward: [5.5, 2.5] }));
    list.push(make(37, 6.0, 3.0, { activity: "talk", cycle: ["talk", "discuss"], faceToward: [5.5, 2.5] }));
    list.push(
      make(38, 4.5, 3.5, {
        path: [[4.5, 3.5], [6.5, 4], [7, 2], [5, 1], [3.5, 2.5]],
        walkSpeed: 0.7,
      }),
    );

    list.push(make(39, -9.0, 1.5, { activity: "wave", cycle: ["wave", "talk", "idle"], faceToward: [-8, 2] }));
    list.push(make(40, -11.0, 3.0, { activity: "idle", cycle: ["idle", "wave"], faceToward: [-10, 2] }));
    list.push(
      make(41, -7.5, 6.0, {
        path: [[-7.5, 6], [-5, 8], [-3, 7], [-4, 5], [-7, 4.5]],
        walkSpeed: 0.65,
      }),
    );
    list.push(
      make(42, -4.0, 8.0, {
        path: [[-4, 8], [-1, 10], [2, 11], [4, 9], [1, 7], [-3, 7]],
        walkSpeed: 0.72,
      }),
    );
    list.push(make(43, 3.0, 9.0, { activity: "discuss", cycle: ["discuss", "talk"], faceToward: [4, 9] }));
    list.push(make(44, 4.2, 9.4, { activity: "talk", cycle: ["talk", "wave", "discuss"], faceToward: [4, 9] }));

    list.push(make(45, 7.0, -6.5, { activity: "idle", cycle: ["idle", "talk", "wave"], faceToward: [9, -9] }));
    list.push(make(46, 8.5, -7.5, { activity: "talk", cycle: ["talk", "discuss"], faceToward: [9, -9] }));
    list.push(
      make(47, 10.0, 3.0, {
        path: [[10, 3], [12, 5], [14, 4], [13, 1], [10, 2]],
        walkSpeed: 0.68,
      }),
    );
    list.push(make(48, 12.0, 1.0, { activity: "wave", cycle: ["wave", "talk", "idle"], faceToward: [11, 2] }));
    list.push(
      make(49, 8.0, -5.0, {
        path: [[8, -5], [9, -7], [11, -8], [10, -5], [8, -4]],
        walkSpeed: 0.6,
      }),
    );
    // Extra cross-village walkers
    list.push(
      make(50, -2, 6, {
        path: [[-2, 6], [2, 5], [6, 6], [8, 3], [4, 1], [0, 2], [-3, 4]],
        walkSpeed: 0.78,
      }),
    );
    list.push(
      make(51, 15, 15, {
        path: [[15, 15], [17, 18], [19, 20], [16, 21], [14, 18]],
        walkSpeed: 0.7,
      }),
    );
    list.push(
      make(52, -10, -1, {
        path: [[-10, -1], [-8, -3], [-5, -2], [-6, 1], [-9, 2]],
        walkSpeed: 0.62,
      }),
    );

    return list;
  }, []);

  const refs = useRef<(THREE.Group | null)[]>([]);
  /** Live locomotion state per NPC for moveState / activity */
  const live = useRef<{ moving: boolean; activity: string; pathIdx: number; leg: number }[]>(
    [],
  );
  if (live.current.length !== npcs.length) {
    live.current = npcs.map((n) => ({
      moving: !!(n.roam || n.path),
      activity: n.activity,
      pathIdx: 0,
      leg: 0,
    }));
  }

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const clampedDt = Math.min(dt, 0.05);
    const budget = qualityBudget();
    const animR2 = budget.animRadius * budget.animRadius;
    const px = playerPos[0];
    const pz = playerPos[2];
    npcs.forEach((n, i) => {
      const g = refs.current[i];
      const L = live.current[i];
      if (!g || !L) return;

      // Far NPCs: freeze locomotion/activity (still visible, cheap)
      const dx = g.position.x - px;
      const dz = g.position.z - pz;
      if (dx * dx + dz * dz > animR2) {
        L.moving = false;
        return;
      }

      // Cycle standing activities every few seconds
      if (n.cycle && n.cycle.length > 0 && !n.path && !n.roam) {
        const slot = Math.floor((t * 0.35 + n.phase) % n.cycle.length);
        L.activity = n.cycle[slot] ?? n.activity;
      }

      if (n.path && n.path.length > 1) {
        const pts = n.path;
        let idx = L.pathIdx % pts.length;
        const target = pts[idx]!;
        const dx = target[0] - g.position.x;
        const dz = target[1] - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35) {
          L.pathIdx = (idx + 1) % pts.length;
          // Brief pause gesture at waypoints
          if (idx % 2 === 0) {
            L.activity = "wave";
            L.moving = false;
            L.leg = 0.6; // pause timer
          }
        } else {
          if (L.leg > 0) {
            L.leg -= clampedDt;
            L.moving = false;
          } else {
            L.moving = true;
            L.activity = "idle";
            const sp = n.walkSpeed * clampedDt;
            const inv = dist > 0.001 ? sp / dist : 0;
            g.position.x += dx * inv;
            g.position.z += dz * inv;
            const targetYaw = Math.atan2(dx, dz);
            let diff = targetYaw - g.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            g.rotation.y += diff * Math.min(1, 8 * clampedDt);
          }
        }
      } else if (n.roam) {
        L.moving = true;
        const radius = 1.4 + (i % 3) * 0.35;
        const spd = 0.35 + n.walkSpeed * 0.25;
        const px = n.x + Math.sin(t * spd + n.phase) * radius;
        const pz = n.z + Math.cos(t * spd * 0.9 + n.phase) * radius * 0.75;
        const dx = px - g.position.x;
        const dz = pz - g.position.z;
        g.position.x += dx * Math.min(1, 3 * clampedDt);
        g.position.z += dz * Math.min(1, 3 * clampedDt);
        const targetYaw = Math.atan2(Math.cos(t * spd + n.phase), -Math.sin(t * spd * 0.9 + n.phase));
        let diff = targetYaw - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * 0.08;
        // Occasional wave while roaming
        L.activity = Math.sin(t * 0.4 + n.phase) > 0.85 ? "wave" : "idle";
      } else if (n.faceToward) {
        L.moving = false;
        const dx = n.faceToward[0] - g.position.x;
        const dz = n.faceToward[1] - g.position.z;
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * 0.06;
        // weight shift
        g.position.x = n.x + Math.sin(t * 0.45 + n.phase) * 0.05;
        g.position.z = n.z + Math.cos(t * 0.38 + n.phase) * 0.04;
      }

      // Face player when very close (overrides path facing briefly)
      const distP = Math.hypot(playerPos[0] - g.position.x, playerPos[2] - g.position.z);
      if (distP < 3.2 && !L.moving) {
        const dx = playerPos[0] - g.position.x;
        const dz = playerPos[2] - g.position.z;
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * 0.1;
        if (L.activity === "idle") L.activity = "talk";
      }
    });
  });

  return (
    <group>
      {npcs.map((n, i) => {
        const gx = refs.current[i]?.position.x ?? n.x;
        const gz = refs.current[i]?.position.z ?? n.z;
        const distToPlayer = Math.hypot(playerPos[0] - gx, playerPos[2] - gz);
        const nearPlayer = distToPlayer < 5.5;
        const L = live.current[i];
        const moving = L?.moving ?? !!(n.roam || n.path);
        let activity = (L?.activity as "discuss" | "talk" | "wave" | "idle") ?? n.activity;
        if (nearPlayer && activity === "idle") activity = "talk";
        const lookAt: [number, number, number] | null = nearPlayer
          ? [playerPos[0], playerPos[1] + 1.4, playerPos[2]]
          : n.faceToward
            ? [n.faceToward[0], 1.5, n.faceToward[1]]
            : null;
        return (
          <group
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[n.x, 0, n.z]}
          >
            <StylizedCharacter
              appearance={n.appearance}
              equipped={n.equipped}
              scale={0.82}
              animate={nearPlayer || distToPlayer < qualityBudget().animRadius}
              detail={qualityBudget().characterDetail && distToPlayer < qualityBudget().animRadius}
              moveState={moving && distToPlayer < qualityBudget().animRadius ? "walk" : "idle"}
              activity={distToPlayer < qualityBudget().animRadius ? activity : "idle"}
              lookAt={lookAt}
              motionPhase={n.phase}
            />
          </group>
        );
      })}
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
        { x: 18, z: 20, phase: 1.2 },
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
      const wx = useWeatherStore.getState();
      const tm = worldModifiers(wx.state.timeOfDay, wx.state.weatherId, wx.state.hour);
      const spd = (0.35 + wantedLevel * 0.08) * tm.patrolSpeedMul;
      const ox = Math.sin(t * spd + s.phase) * (3.5 + wantedLevel * 0.4);
      const oz = Math.cos(t * spd * 0.85 + s.phase) * (2.8 + wantedLevel * 0.3);
      g.position.x = s.x + ox;
      g.position.z = s.z + oz;
      if (wantedLevel >= 2 && alertCd.current <= 0) {
        const d = Math.hypot(playerPos[0] - g.position.x, playerPos[2] - g.position.z);
        const radius = 2.2 * tm.patrolRadiusMul;
        if (d < radius) {
          addHeat(Math.round((3 + wantedLevel) * tm.heatMul));
          pushLog(
            tm.heatMul > 1.2
              ? "Night patrol clocks you — heat spikes"
              : "Patrol spotted you — heat up",
          );
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
            <meshStandardMaterial color={SCENE_PALETTE.tealDeep} emissive={SCENE_PALETTE.teal} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color={SCENE_PALETTE.yellowPale} />
          </mesh>
          {wantedLevel >= 3 && (
            <mesh position={[0, 1.35, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color={SCENE_PALETTE.red} emissive={SCENE_PALETTE.redGlow} emissiveIntensity={0.9} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function CityHotspots({ onInteract }: { onInteract?: (label: string) => void }) {
  const spots: { pos: [number, number, number]; r: number; label: string }[] = [
    { pos: [18, 0, 20], r: 1.4, label: "Town Market" },
    { pos: [0, 0, -1.5], r: 1.3, label: "Council Grove" },
    { pos: [-5.5, 0, -3.5], r: 1.3, label: "Creekside" },
    { pos: [5.5, 0, 2.5], r: 1.4, label: "River Landing" },
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
      shadows={qualityBudget().shadows}
      dpr={[1, qualityBudget().characterDetail ? 1.5 : 1]}
      performance={{ min: 0.5 }}
      gl={{ powerPreference: "high-performance", antialias: qualityBudget().characterDetail }}
      camera={{ position: [0, 10, 15], fov: 45 }}
      style={{ width: "100%", height: "100%", background: SCENE_PALETTE.skyHaze }}
      tabIndex={0}
    >
      <DayNightSky dust={dust} />
      {/* Multi-biome heritage terrain (Day 2) — single draw call + climate tint */}
      <HeritageTerrain wetness={wetness} dust={dust} />
      <ExpandedWorld wetness={wetness} />
      {/* Keep a soft local dust pad under the village for road contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[28, 24]} />
        <meshStandardMaterial color={N.dust} roughness={0.92} transparent opacity={0.55} />
      </mesh>
      <NeonRoads />
      <LivingWater type="pond" position={[-5.5, 0, -5.4]} radius={3.8} />
      <BiomeFlora count={qualityBudget().floraCount} />
      <VillageTreeRing />
      {/* Always-loaded village dressing, merged once (was re-drawn in every loaded chunk). */}
      <StaticVillageProps />
      {/* Village huts, compound walls, trees and rocks stream per 64 m chunk; terrain, roads and props stay always-loaded. */}
      <ChunkedWorld
        tier={currentRenderTier()}
        focusRef={playerFocusRef}
        pinned={VILLAGE_PINNED_CHUNKS}
        buildChunk={(c) => <ChunkVillageProps chunk={c} />}
      />

      {/* High-polish 12 km world layer — 128 m chunks, continuous height + biome, streams with the player. */}
      <ChunkedWorld
        mode="world"
        tier={currentRenderTier()}
        focusRef={playerFocusRef}
        maxLoadsPerUpdate={qualityBudget().maxChunkLoads}
        buildChunk={(c) => <WorldChunk chunk={c} densityScale={qualityBudget().worldDensity} />}
      />

      {/* Village hearths */}
      <VillageHearth position={[-3.6, 0, 3.0]} />
      <VillageHearth position={[0.3, 0, -2.6]} />
      <VillageHearth position={[17.2, 0, 18.5]} />
      <VillageHearth position={[7.5, 0, 6.0]} />

      {/* Scattered pre-colonial huts — organic village fabric, no ethnic compounds */}
      {(
        [
          // west–centre residential scatter
          { p: [-10.5, 0, 2.0] as [number, number, number], r: 0.4, s: 1.0, c: undefined, band: true },
          { p: [-13.2, 0, -2.4], r: -0.6, s: 0.92, c: SCENE_PALETTE.clayWall, band: true },
          { p: [-8.0, 0, -4.8], r: 1.1, s: 0.95, c: SCENE_PALETTE.wallTan, band: false },
          { p: [-6.2, 0, 5.5], r: -1.2, s: 0.9, c: SCENE_PALETTE.wallSand, band: true },
          { p: [-12.0, 0, 6.8], r: 0.8, s: 0.88, c: SCENE_PALETTE.clayWall, band: false },
          { p: [-4.2, 0, -6.5], r: 2.0, s: 0.95, c: undefined, band: true },
          { p: [-15.5, 0, 1.2], r: -0.3, s: 0.85, c: SCENE_PALETTE.wallTan, band: true },
          { p: [-9.0, 0, 9.2], r: 1.5, s: 0.92, c: SCENE_PALETTE.wallSand, band: false },
          // south & east scatter
          { p: [2.5, 0, -8.0], r: 0.5, s: 0.9, c: SCENE_PALETTE.clayWall, band: true },
          { p: [6.8, 0, -5.5], r: -1.0, s: 1.0, c: undefined, band: true },
          { p: [11.0, 0, 4.2], r: -0.3, s: 1.0, c: undefined, band: true },
          { p: [13.5, 0, 0.8], r: 0.9, s: 0.88, c: SCENE_PALETTE.wallSand, band: true },
          { p: [9.5, 0, -7.5], r: 2.2, s: 1.05, c: undefined, band: true },
          { p: [14.2, 0, -4.0], r: -1.6, s: 0.9, c: SCENE_PALETTE.wallTan, band: false },
          { p: [8.0, 0, 8.5], r: 0.2, s: 0.95, c: SCENE_PALETTE.clayWall, band: true },
          { p: [3.2, 0, 7.0], r: 1.3, s: 0.87, c: undefined, band: false },
          // northern fringe (still short of market)
          { p: [-3.5, 0, 10.0], r: 0.2, s: 0.95, c: SCENE_PALETTE.clayWall, band: true },
          { p: [4.5, 0, 11.0], r: -1.0, s: 0.9, c: undefined, band: true },
          { p: [1.0, 0, 13.5], r: 0.7, s: 0.88, c: SCENE_PALETTE.wallTan, band: false },
          { p: [-7.5, 0, 12.0], r: -0.9, s: 0.92, c: SCENE_PALETTE.wallSand, band: true },
          { p: [10.5, 0, 12.8], r: 1.8, s: 0.9, c: undefined, band: true },
          // near council / centre
          { p: [-1.5, 0, 3.5], r: 0.15, s: 0.85, c: SCENE_PALETTE.wallTan, band: true },
          { p: [2.8, 0, -3.2], r: -0.5, s: 0.9, c: SCENE_PALETTE.clayWall, band: false },
          // Town Market quarter — separate (~18, 20)
          { p: [18.0, 0, 19.0], r: 0, s: 1.05, c: undefined, band: true },
          { p: [20.8, 0, 17.5], r: -0.7, s: 0.9, c: SCENE_PALETTE.wallTan, band: true },
          { p: [15.5, 0, 21.5], r: 0.9, s: 0.95, c: SCENE_PALETTE.clayWall, band: false },
          { p: [21.5, 0, 21.0], r: 1.4, s: 0.88, c: undefined, band: true },
          { p: [16.2, 0, 16.8], r: -1.1, s: 0.92, c: SCENE_PALETTE.wallSand, band: true },
          { p: [22.5, 0, 19.2], r: 0.4, s: 0.85, c: SCENE_PALETTE.clayWall, band: false },
          // more scattered dwellings
          { p: [-11.5, 0, -6.0], r: 0.6, s: 0.9, c: SCENE_PALETTE.wallTan, band: true },
          { p: [-14.0, 0, 4.0], r: -1.4, s: 0.87, c: undefined, band: false },
          { p: [-5.5, 0, 8.0], r: 1.0, s: 0.93, c: SCENE_PALETTE.clayWall, band: true },
          { p: [-2.0, 0, -9.5], r: -0.2, s: 0.88, c: SCENE_PALETTE.wallSand, band: true },
          { p: [0.5, 0, 5.5], r: 2.1, s: 0.86, c: undefined, band: false },
          { p: [5.0, 0, 2.0], r: 0.35, s: 0.95, c: SCENE_PALETTE.wallTan, band: true },
          { p: [7.2, 0, -2.0], r: -0.8, s: 0.9, c: SCENE_PALETTE.clayWall, band: true },
          { p: [12.0, 0, 7.5], r: 1.6, s: 0.92, c: undefined, band: false },
          { p: [15.0, 0, 5.0], r: -0.4, s: 0.88, c: SCENE_PALETTE.wallSand, band: true },
          { p: [16.5, 0, 10.0], r: 0.9, s: 0.9, c: SCENE_PALETTE.wallTan, band: true },
          { p: [12.8, 0, 14.0], r: -1.3, s: 0.87, c: SCENE_PALETTE.clayWall, band: false },
          { p: [-0.5, 0, 8.5], r: 0.5, s: 0.91, c: undefined, band: true },
          { p: [3.5, 0, -1.0], r: 1.7, s: 0.85, c: SCENE_PALETTE.wallTan, band: false },
          { p: [-16.5, 0, -1.5], r: 0.1, s: 0.9, c: SCENE_PALETTE.clayWall, band: true },
          { p: [18.5, 0, 14.0], r: -0.6, s: 0.88, c: undefined, band: true },
          { p: [8.5, 0, 15.0], r: 1.2, s: 0.9, c: SCENE_PALETTE.wallSand, band: false },
          // small local market edge huts (~ -1, 5)
          { p: [-2.8, 0, 4.2], r: 0.3, s: 0.9, c: SCENE_PALETTE.wallTan, band: true },
          { p: [0.8, 0, 6.2], r: -0.9, s: 0.88, c: SCENE_PALETTE.clayWall, band: false },
          { p: [-1.2, 0, 7.0], r: 1.1, s: 0.92, c: undefined, band: true },
        ] as { p: [number, number, number]; r: number; s: number; c?: string; band: boolean }[]
      ).map((h, i) => (
        <BhungaHut
          key={`hut-${i}`}
          position={h.p}
          rotation={h.r}
          scale={h.s}
          {...(h.c !== undefined ? { wallColor: h.c } : {})}
          band={h.band}
          climateIntensity={wetness}
          windIntensity={0.3 + dust * 0.35 + (i % 5) * 0.02}
        />
      ))}

      {/* Day 1 atmospheric life */}
      <DustMotes count={90} active={dust > 0.25 || wetness < 0.3} />
      <SpiritFireflies count={36} active={dust < 0.5} />
      <SavannahGrass count={200} windIntensity={0.35 + dust * 0.5} />
      <LightningFlash active={wetness > 0.55} />
      <SacredGroveMist position={[10, 0.6, -9]} />
      <SacredGroveMist position={[10, 0.8, -12]} />
      <SacredGroveMist position={[7, 0.5, -10]} />
      <SacredGroveMist position={[3, 0.7, -14]} />
      <LandmarkGroves />
      <SacredGroveEcology {...(onInteract ? { onInteract } : {})} />

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
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
          </mesh>
          <mesh position={[0, 1.85, 0]}>
            <boxGeometry args={[0.55, 0.28, 0.06]} />
            <meshStandardMaterial color={info.color} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Markets + torch light — no vehicles, neon, or patrol cars */}
      {/* Main Town Market (northeast, separate) */}
      <TraditionalMarketStalls originX={18} originZ={20} stallCount={14} plazaRadius={7} cols={7} />
      {/* Small local market near residential centre */}
      <TraditionalMarketStalls originX={-1.2} originZ={5.2} stallCount={6} plazaRadius={3.2} cols={3} />
      <VillageHearth position={[-1.0, 0, 4.5]} />
      <TorchPosts />
      <MissionWorldMarker />
      <VillageAnimals />
      <ForestCritters />
      <NpcCrowd />
      {onInteract && <CityHotspots onInteract={onInteract} />}
      {onNearDistrict ? <PlayerController onDistrictChange={onNearDistrict} /> : <PlayerController />}

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


