import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DEFAULT_APPEARANCE } from "../../stores/characterStore";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  DISTRICT_WORLD,
  SAFEHOUSES,
  TRANSPORT_SPEED,
  useRoamStore,
  type TransportId,
} from "@/stores/roamStore";
import { INTERIOR_LIST, DOOR_RADIUS } from "@/data/interiors";
import { getProceduralPBR } from "@/lib/proceduralTextures";
import { undulatedGround } from "@/lib/groundRelief";
import { useInteriorStore, enterBuilding, type InteriorId } from "@/stores/interiorStore";
import { takeTouchLook, touchInput } from "@/lib/touchInput";

import { useCharacterStore } from "@/stores/characterStore";
import { DayNightSky } from "@/components/afrometaverse/DayNightSky";
import { ChunkedWorld } from "@/components/afrometaverse/ChunkedWorld";
import { ChunkVillageProps, StaticVillageProps } from "@/components/afrometaverse/VillageProps";
import { groupByChunk, chunksContaining, chunkOrigin } from "@/lib/chunkAssign";
import { NPC_SPECS, anchorFor, stepToward, reactToPlayer } from "@/lib/npcSim";
import { resolveCollision, villageObstacles } from "@/lib/villageCollision";
import { CHIEF_COMPOUND, NPC_RADIUS, PLAYER_RADIUS, POND, LANDMARK_POSITIONS, WORLD_BOUNDS, MAIN_ROAD_Z, type Pt } from "@/lib/villageLayout";

/** Ground footprint: the layout bounds (-24..22 x -20..18). */
const WORLD_W = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const WORLD_D = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
import { VILLAGE_HEARTHS, VILLAGE_HERITAGE } from "@/lib/villageProps";
import { chunkOf } from "@/lib/chunkStreaming";
import { currentRenderTier } from "@/lib/renderTier";
import { StylizedCharacter } from "@/components/afrometaverse/characters/StylizedCharacter";
import { FighterGLB, usesFighterGLB } from "@/components/afrometaverse/characters/FighterGLB";
import { tierForRole } from "@/lib/characterWardrobe";
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
import { SCENE_PALETTE } from "@/lib/scenePalette";

const DISTRICT_LAYOUT = {
  "town-market": { x: LANDMARK_POSITIONS["town-market"]!.x, z: LANDMARK_POSITIONS["town-market"]!.z, color: SCENE_PALETTE.amber, label: "Town Market", neon: SCENE_PALETTE.amberNeon },
  "civic-centre": { x: LANDMARK_POSITIONS["civic-centre"]!.x, z: LANDMARK_POSITIONS["civic-centre"]!.z, color: SCENE_PALETTE.teal, label: "Civic Centre", neon: SCENE_PALETTE.tealNeon },
  creekside: { x: LANDMARK_POSITIONS["creekside"]!.x, z: LANDMARK_POSITIONS["creekside"]!.z, color: SCENE_PALETTE.blue, label: "Creekside", neon: SCENE_PALETTE.blueNeon },
  port: { x: LANDMARK_POSITIONS["port"]!.x, z: LANDMARK_POSITIONS["port"]!.z, color: SCENE_PALETTE.orange, label: "The Port", neon: SCENE_PALETTE.orangeNeon },
} as const;

const BOUNDS = WORLD_BOUNDS;

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

/**
 * Image-based lighting: a PMREM-filtered studio environment gives every PBR material
 * (skin, cloth, clay walls, roofs) soft physically based reflections and bounce light.
 * Cheap to build once; the sun and sky still drive direct light and shadows.
 */
function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Daylight village sky — no neon city yet; players grow this settlement later */
function VillageDaySky() {
  return (
    <>
      <color attach="background" args={[SCENE_PALETTE.skyHaze]} />
      <fog attach="fog" args={[SCENE_PALETTE.fogSand, 22, 72]} />
      <ambientLight intensity={0.5} color="#f3dcc0" />
      {/* ground bounce: warm earth light from below fills shadow sides */}
      <hemisphereLight args={["#f2e2c4", "#8a5a3a", 0.55]} />
      <hemisphereLight args={[SCENE_PALETTE.skyPale, SCENE_PALETTE.groundBrown, 0.5]} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={1.7}
        color="#ffd29a"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-8, 6, -5]} intensity={0.42} color={SCENE_PALETTE.sunBlue} />
      <directionalLight position={[0, 8, -12]} intensity={0.35} color={SCENE_PALETTE.lavenderLight} />
    </>
  );
}

const GROUND_PBR = getProceduralPBR("dust", 512);
// built once: 64x64 grid, heights 0..0.18m, so the ground ripples under the light
const GROUND_RELIEF = undulatedGround(WORLD_W, WORLD_D, 64, 0.42, 3);

function NeonGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={N.earthDeep} roughness={1} />
      </mesh>
      {/* relief: low noise undulation so the dust catches light instead of a dead flat sheet */}
      <mesh geometry={GROUND_RELIEF} position={[-1, -0.015, -1]} receiveShadow>
        <meshStandardMaterial
          color={N.earth}
          roughness={0.95}
          map={GROUND_PBR?.map ?? null}
          normalMap={GROUND_PBR?.normal ?? null}
          normalScale={new THREE.Vector2(1.1, 1.1)}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.002, -1]} receiveShadow>
        <planeGeometry args={[WORLD_W - 8, WORLD_D - 8]} />
        <meshStandardMaterial color={N.dust} roughness={0.92} />
      </mesh>
      {/* outer savannah grass belts */}
      {(
        [
          [-1, 22, 56, 8],
          [-1, -24, 56, 8],
          [28, -1, 8, 52],
          [-30, -1, 8, 52],
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
  // Wider lanes (about 2.5 units) so people and carts can pass without crowding.
  // Mirrors villageLayout LANES: wide main road along MAIN_ROAD_Z, plus the district spurs.
  const segs = [
    { x: -1, z: MAIN_ROAD_Z, w: 46, d: 3.4 },
    { x: -3, z: 2.2, w: 2.6, d: 13 },
    { x: 4, z: -5.6, w: 2.6, d: 8.4 },
    { x: -5.5, z: -2.0, w: 2.4, d: 3.4 },
    { x: 13, z: 2.2, w: 2.6, d: 7.6 },
    { x: 14, z: 6.5, w: 2.6, d: 6.2 },
    { x: 3.0, z: 4.6, w: 2.2, d: 2.4 },
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
              <meshStandardMaterial color={SCENE_PALETTE.slate} />
            </mesh>
          ))}
          <mesh position={[0, 1.35, 0]} rotation={[0.15, 0, 0]}>
            <planeGeometry args={[0.8, 0.55]} />
            <meshStandardMaterial color={s.neon ?? "#ffffff"} emissive={s.neon ?? "#ffffff"} emissiveIntensity={0.7} side={2} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.7, 0.08, 0.5]} />
            <meshStandardMaterial color={SCENE_PALETTE.slateDark} />
          </mesh>
        </group>
      ))}
    </group>
  );
}


/** Simple mud / thatch / zinc hut — starting village fabric (players develop the city later) */
/** Door and interior anchors: their chunks never unload, so doors keep working. */
const VILLAGE_PINNED_CHUNKS = chunksContaining([
  ...INTERIOR_LIST.map((d) => d.door),
  { x: CHIEF_COMPOUND.x, z: CHIEF_COMPOUND.z },
]);

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
  const playerTier = useCharacterStore((s) => s.wardrobeTier);
  const moveState = useRoamStore((s) => s.moveState);
  void transport;
  if (usesFighterGLB(appearance, playerTier)) {
    return <FighterGLB appearance={appearance} tier={playerTier} scale={1} animate detail moveState={moveState} />;
  }
  return (
    <StylizedCharacter
      appearance={appearance}
      tier={playerTier}
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
      // huts, walls, trees and the pond: slide along them instead of walking through
      if (transport !== "ferry") {
        const resolved = resolveCollision(nextX, nextZ, PLAYER_RADIUS, villageObstacles());
        nextX = resolved.x;
        nextZ = resolved.z;
      }
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

// Purposeful NPCs: a fixed population (NPC_SPECS) with roles. Traders stand at stalls, fishers
// at the shore, guards walk their route, elders idle at the compound. Each NPC walks its lane
// towards its anchor, collision-resolved so it can't clip buildings, and steps aside from the player.
function NpcCrowd() {
  const npcs = useMemo(() => {
    const skins = [SCENE_PALETTE.skinDeep, SCENE_PALETTE.skinMid, SCENE_PALETTE.skinTan, SCENE_PALETTE.skinGold, SCENE_PALETTE.lateriteLight, SCENE_PALETTE.skinBrown];
    const shapes = ["slim", "average", "curvy", "athletic", "broad"] as const;
    return NPC_SPECS.map((spec, i) => ({
      spec,
      appearance: {
        ...DEFAULT_APPEARANCE,
        gender: (i % 2 === 0 ? "female" : "male") as "female" | "male",
        bodyShape: shapes[i % shapes.length] ?? "average",
        height: (["short", "average", "tall"] as const)[i % 3] ?? "average",
        skin: skins[i % skins.length] ?? SCENE_PALETTE.skinMid,
        hair: (["braids", "short", "afro", "bob", "bun", "long"] as const)[i % 6] ?? "short",
        hairColor: SCENE_PALETTE.ink,
        displayName: spec.id,
      },
      tier: tierForRole(spec.role),
    }));
  }, []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const sim = useRef(NPC_SPECS.map((s) => ({ x: s.home.x, z: s.home.z, yaw: s.face })));
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const player = playerFocusRef.current?.position ?? null;
    NPC_SPECS.forEach((spec, i) => {
      const st = sim.current[i]!;
      const g = refs.current[i];
      if (!g) return;
      const target = anchorFor(spec, t);
      let pos: Pt = stepToward({ x: st.x, z: st.z }, target, 1.1, dt);
      const shy = player ? reactToPlayer(pos, { x: player.x, z: player.z }) : null;
      if (shy) pos = resolveCollision(shy.x, shy.z, NPC_RADIUS);
      const moving = Math.hypot(target.x - pos.x, target.z - pos.z) > 0.05 || shy !== null;
      if (moving) st.yaw = Math.atan2(target.x - pos.x, target.z - pos.z);
      st.x = pos.x;
      st.z = pos.z;
      g.position.set(pos.x, 0, pos.z);
      g.rotation.y = st.yaw;
    });
  });
  return (
    <group>
      {npcs.map((n, i) => (
        <group
          key={n.spec.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[n.spec.home.x, 0, n.spec.home.z]}
        >
          {usesFighterGLB(n.appearance, n.tier) ? <FighterGLB appearance={n.appearance} tier={n.tier} scale={0.95} animate detail moveState="walk" /> : <StylizedCharacter appearance={n.appearance} tier={n.tier} scale={0.95} animate detail moveState="walk" />}
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
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 10, 15], fov: 45 }}
      style={{ width: "100%", height: "100%", background: SCENE_PALETTE.skyHaze }}
      tabIndex={0}
    >
      <SceneEnvironment />
      <DayNightSky dust={dust} />
      {/* Multi-biome heritage terrain (Day 2) — single draw call + climate tint */}
      <HeritageTerrain wetness={wetness} dust={dust} />
      {/* Keep a soft local dust pad under the village for road contrast */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[28, 24]} />
        <meshStandardMaterial color={N.dust} roughness={0.92} transparent opacity={0.55} />
      </mesh>
      <NeonRoads />
      <LivingWater type="pond" position={[POND.x, 0, POND.z]} radius={POND.r} />
      <BiomeFlora count={160} />
      {/* Always-loaded village dressing, merged once (was re-drawn in every loaded chunk). */}
      <StaticVillageProps />
      {/* Village huts, compound walls, trees and rocks stream per 64 m chunk; terrain, roads and props stay always-loaded. */}
      <ChunkedWorld
        tier={currentRenderTier()}
        focusRef={playerFocusRef}
        pinned={VILLAGE_PINNED_CHUNKS}
        bounds={WORLD_BOUNDS}
        buildChunk={(c) => <ChunkVillageProps chunk={c} />}
      />

      {/* Day 6 — tribal compounds + hearth */}
      {/* Spread out so paths stay open; compounds sit at the outer edges of the village. */}
      <YorubaCompound
        position={[VILLAGE_HERITAGE[0]!.x, 0, VILLAGE_HERITAGE[0]!.z]}
        climateIntensity={wetness}
        windIntensity={0.35 + dust * 0.4}
      />
      <IgboCompound
        position={[VILLAGE_HERITAGE[1]!.x, 0, VILLAGE_HERITAGE[1]!.z]}
        climateIntensity={wetness}
        windIntensity={0.35 + dust * 0.4}
      />
      {VILLAGE_HEARTHS.map(([hx, hz]) => (
        <VillageHearth key={hx + "," + hz} position={[hx, 0, hz]} />
      ))}

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
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
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


