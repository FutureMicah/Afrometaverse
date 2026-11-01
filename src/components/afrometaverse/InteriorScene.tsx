import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import "./interiors.css";
import * as THREE from "three";
import { INTERIORS, type InteriorDef } from "@/data/interiors";
import { useInteriorStore, DECORABLE_ID, type InteriorId } from "@/stores/interiorStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { DECOR_CATALOG, type DecorItem } from "@/data/decor";
import { FLOOR_BOUNDS, GRID_STEP, checkPlacement, snap, type Placement, type PlaceRefusal } from "@/lib/hutGrid";
import {
  windStrength,
  rattleAmplitude,
  windAudioGain,
  rainAudioGain,
  openFraction,
  type Aperture,
  type RoomApertures,
} from "@/lib/interiorWeather";
import { InteriorAmbience } from "@/lib/interiorAudio";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { npcsForInterior, pickLine, type InteriorNpcDef, type NpcAction } from "@/data/interiorNpcs";
import { InteriorNpcMesh } from "@/components/afrometaverse/InteriorNpc";
import { useKowryStore } from "@/stores/kowryStore";
import { worldModifiers } from "@/lib/timeEffects";

/**
 * Built from primitives only (no imported models or textures), so it adds almost no
 * bundle weight. Lazy-loaded from the game only while the player is inside a building.
 */

const MUD = SCENE_PALETTE.mud;
const MUD_DARK = SCENE_PALETTE.mudDark;
const THATCH = SCENE_PALETTE.thatchGold;
const MAT = SCENE_PALETTE.matTan;
const WOOD = SCENE_PALETTE.woodDark;
const CLAY = SCENE_PALETTE.clay;
const FLOOR = SCENE_PALETTE.floorWood;

function Box({ p, s, c, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p} rotation={[0, r, 0]} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.95} />
    </mesh>
  );
}

function Cyl({ p, rt, rb, h, c }: { p: [number, number, number]; rt: number; rb: number; h: number; c: string }) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[rt, rb, h, 12]} />
      <meshStandardMaterial color={c} roughness={0.9} />
    </mesh>
  );
}

/**
 * Circular bhunga / rondavel interior: thick mud ring, radial rafters,
 * thatch underside, doorway on +Z (matches exterior door convention).
 */
function Shell({ radius = 3.2, h = 2.6 }: { radius?: number; h?: number; w?: number; d?: number }) {
  // w/d accepted for backward calls; ignored in favor of circular plan
  const r = radius;
  const segs = 24;
  return (
    <group>
      {/* packed earth floor */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r * 0.98, segs]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>
      {/* outer mud wall ring (slightly open at door) — full cylinder + door cut as dark recess */}
      <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[r, r * 1.01, h, segs, 1, true]} />
        <meshStandardMaterial color={MUD} roughness={0.98} side={THREE.DoubleSide} />
      </mesh>
      {/* white lime band inside */}
      <mesh position={[0, h * 0.4, 0]}>
        <cylinderGeometry args={[r * 0.995, r * 0.995, 0.22, segs, 1, true]} />
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* doorway opening visual on +Z */}
      <mesh position={[0, 1.05, r * 0.92]} castShadow>
        <boxGeometry args={[1.1, 2.1, 0.25]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} transparent opacity={0.15} />
      </mesh>
      {/* radial rafters under conical thatch */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r * 0.42, h * 0.55, Math.sin(a) * r * 0.42]}
            rotation={[0.55, -a, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.04, 0.03, r * 0.95, 5]} />
            <meshStandardMaterial color={WOOD} roughness={1} />
          </mesh>
        );
      })}
      {/* apex ring */}
      <mesh position={[0, h * 0.95, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.2, 8]} />
        <meshStandardMaterial color={WOOD} roughness={1} />
      </mesh>
      {/* thatch cone (outer) */}
      <mesh position={[0, h + 0.35, 0]} castShadow>
        <coneGeometry args={[r * 1.15, 1.5, 18]} />
        <meshStandardMaterial color={THATCH} roughness={1} flatShading />
      </mesh>
      {/* warm fill light from roof */}
      <pointLight position={[0, h * 0.7, 0]} intensity={0.35} distance={7} color="#ffd9a8" />
    </group>
  );
}

/** Curved mud banquette with cloth cushions (interior reference). */
function CurvedBench({
  yaw = 0,
  radius = 2.2,
  arc = 1.1,
}: {
  yaw?: number;
  radius?: number;
  arc?: number;
}) {
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.28, radius]} castShadow receiveShadow>
        <boxGeometry args={[arc, 0.55, 0.55]} />
        <meshStandardMaterial color={MUD} roughness={1} />
      </mesh>
      <mesh position={[0, 0.58, radius]} castShadow>
        <boxGeometry args={[arc * 0.92, 0.1, 0.48]} />
        <meshStandardMaterial color={SCENE_PALETTE.emberDeep} roughness={0.9} />
      </mesh>
      {/* cushions */}
      {[-0.28, 0.28].map((ox, i) => (
        <mesh key={i} position={[ox, 0.66, radius]} castShadow>
          <boxGeometry args={[0.32, 0.08, 0.28]} />
          <meshStandardMaterial color={i === 0 ? "#8b3a2a" : "#c4a574"} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Central stone fire ring with live flame glow. */
function CentralHearth() {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime;
    flame.current.scale.setScalar(0.9 + Math.sin(t * 7) * 0.12);
    const m = flame.current.material as THREE.MeshStandardMaterial;
    if (m) m.emissiveIntensity = 1.2 + Math.sin(t * 9) * 0.35;
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.28, 14]} />
        <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.12, 12]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>
      {/* logs */}
      <Box p={[-0.12, 0.28, 0.05]} s={[0.5, 0.1, 0.12]} c={WOOD} r={0.4} />
      <Box p={[0.1, 0.3, -0.05]} s={[0.45, 0.09, 0.11]} c={WOOD} r={-0.5} />
      <mesh ref={flame} position={[0, 0.48, 0]}>
        <coneGeometry args={[0.16, 0.4, 6]} />
        <meshStandardMaterial
          color={SCENE_PALETTE.ember}
          emissive={SCENE_PALETTE.emberDeep}
          emissiveIntensity={1.4}
          transparent
          opacity={0.9}
        />
      </mesh>
      <pointLight position={[0, 0.7, 0]} color={SCENE_PALETTE.emberLight} intensity={1.4} distance={5} />
    </group>
  );
}

function WallNiche({ yaw, pot = true }: { yaw: number; pot?: boolean }) {
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.1, 2.95]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.25]} />
        <meshStandardMaterial color={MUD_DARK} roughness={1} />
      </mesh>
      {pot && <Cyl p={[0, 0.85, 2.85]} rt={0.16} rb={0.12} h={0.35} c={CLAY} />}
    </group>
  );
}

function WallMask({ yaw }: { yaw: number }) {
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.55, 3.05]} castShadow>
        <boxGeometry args={[0.28, 0.45, 0.08]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.7, 3.08]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color={WOOD} roughness={0.8} />
      </mesh>
    </group>
  );
}


function Hearth({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.15, 0]} rt={0.5} rb={0.6} h={0.3} c={MUD_DARK} />
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} color={SCENE_PALETTE.emberLight} intensity={1.1} distance={4} />
    </group>
  );
}

function Stool({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.35, 0]} rt={0.28} rb={0.22} h={0.1} c={WOOD} />
      <Cyl p={[0, 0.17, 0]} rt={0.1} rb={0.12} h={0.34} c={WOOD} />
    </group>
  );
}

function Pot({ p }: { p: [number, number, number] }) {
  return <Cyl p={p} rt={0.22} rb={0.14} h={0.45} c={CLAY} />;
}

function Mat({ p }: { p: [number, number, number] }) {
  return <Box p={[p[0], 0.02, p[2]]} s={[1.8, 0.04, 1.2]} c={MAT} />;
}

function Table({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.5, 0]} s={[1.2, 0.08, 0.8]} c={WOOD} />
      <Box p={[-0.5, 0.25, -0.3]} s={[0.08, 0.5, 0.08]} c={WOOD} />
      <Box p={[0.5, 0.25, -0.3]} s={[0.08, 0.5, 0.08]} c={WOOD} />
      <Box p={[-0.5, 0.25, 0.3]} s={[0.08, 0.5, 0.08]} c={WOOD} />
      <Box p={[0.5, 0.25, 0.3]} s={[0.08, 0.5, 0.08]} c={WOOD} />
    </group>
  );
}

function Bowl({ p }: { p: [number, number, number] }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={WOOD} />
    </mesh>
  );
}

/** Firewood hearth: three stones with logs and a low flame, no modern fireplace. */
function FirewoodHearth({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[-0.2, 0.08, 0]} s={[0.5, 0.12, 0.1]} c={WOOD} r={0.4} />
      <Box p={[0.2, 0.08, 0.05]} s={[0.5, 0.12, 0.1]} c={WOOD} r={-0.5} />
      {([[-0.45, 0.3], [0.45, 0.3], [0, -0.4]] as [number, number][]).map((q, i) => (
        <Cyl key={i} p={[q[0], 0.07, q[1]]} rt={0.12} rb={0.14} h={0.14} c={MUD_DARK} />
      ))}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} color={SCENE_PALETTE.emberLight} intensity={1.1} distance={4} />
    </group>
  );
}

/** Clay water pot on a low stand, with a gourd lid. */
function WaterPot({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.22, 0]} rt={0.24} rb={0.15} h={0.45} c={CLAY} />
      <Cyl p={[0, 0.5, 0]} rt={0.12} rb={0.2} h={0.1} c={CLAY} />
    </group>
  );
}

/** Wooden bowl on the floor or a table. */
function WoodBowl({ p }: { p: [number, number, number] }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={WOOD} />
    </mesh>
  );
}

/** Goods piled on a mat: yams (tan ovals), kola (red nuts), salt (white heap), cloth bolt. */
function Goods({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[-0.35, 0.09, 0]} s={[0.5, 0.14, 0.3]} c={SCENE_PALETTE.woodWarm} />
      <Box p={[0.1, 0.09, 0.2]} s={[0.5, 0.14, 0.3]} c={SCENE_PALETTE.wood} r={0.3} />
      <mesh position={[0.45, 0.06, -0.2]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.brickRed} />
      </mesh>
      <mesh position={[0.6, 0.06, -0.05]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.brickRed} />
      </mesh>
      <Cyl p={[-0.1, 0.1, -0.35]} rt={0.14} rb={0.1} h={0.18} c={SCENE_PALETTE.creamPot} />
    </group>
  );
}

/** Woven cloth bolt on a rolled stick. */
function ClothBolt({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.1, 0]} rt={0.13} rb={0.13} h={0.3} c={SCENE_PALETTE.stoneBlue} />
      <Box p={[0, 0.1, 0]} s={[0.27, 0.02, 0.27]} c={SCENE_PALETTE.matTan} />
    </group>
  );
}

/**
 * A door or shutter leaf hinged in a wall. Open amount 0..1 swings the leaf inward.
 * A shut, unlatched leaf rattles when the wind is up (spec 17.3). Latched leaves show a bar.
 */
function Aperture({
  x,
  y,
  z,
  w,
  h,
  axis,
  aperture,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  axis: "x" | "z";
  aperture: Aperture;
}) {
  const leaf = useRef<THREE.Group>(null);
  const shown = useRef(aperture.open);
  useFrame(({ clock }, dt) => {
    shown.current += (aperture.open - shown.current) * Math.min(1, dt * 6);
    const strength = windStrength(useWeatherStore.getState().state.windSpeed);
    const rattle = rattleAmplitude(aperture, strength);
    if (leaf.current) {
      const shake = rattle > 0 ? Math.sin(clock.elapsedTime * 38) * 0.06 * rattle : 0;
      leaf.current.rotation.y = shown.current * (Math.PI / 2.2) + shake;
    }
  });
  // Hinge sits at the wall edge; the leaf extends w along the wall.
  const hinge: [number, number, number] = axis === "x" ? [x, y, z] : [x, y, z];
  return (
    <group position={hinge}>
      <group ref={leaf}>
        <mesh position={axis === "x" ? [w / 2, 0, 0] : [0, 0, w / 2]} castShadow>
          <boxGeometry args={axis === "x" ? [w, h, 0.06] : [0.06, h, w]} />
          <meshStandardMaterial color={aperture.latched ? SCENE_PALETTE.earth : WOOD} roughness={0.9} />
        </mesh>
      </group>
      {aperture.latched && (
        <mesh position={axis === "x" ? [w / 2, 0, 0.05] : [0.05, 0, w / 2]}>
          <boxGeometry args={[0.12, 0.12, 0.05]} />
          <meshStandardMaterial color={SCENE_PALETTE.matTan} />
        </mesh>
      )}
    </group>
  );
}

/** Placeholder block for a placed decor item, at its grid centre. Real models come later. */
function DecorMesh({ p, item, selected }: { p: Placement; item: DecorItem; selected: boolean }) {
  const turned = ((p.rot % 4) + 4) % 4 % 2 === 1;
  const w = turned ? item.depth : item.width;
  const d = turned ? item.width : item.depth;
  const flat = item.id === "woven-mat" || item.id === "leopard-rug" || item.id === "market-cloth";
  const h = flat ? 0.04 : item.id === "clay-pot" || item.id === "glazed-pot" ? 0.45 : item.id === "carved-stool" ? 0.4 : 0.3;
  return (
    <mesh position={[p.x, h / 2, p.z]} castShadow receiveShadow>
      <boxGeometry args={[w * 0.9, h, d * 0.9]} />
      <meshStandardMaterial
        color={item.color}
        roughness={0.9}
        emissive={selected ? SCENE_PALETTE.candleGold : SCENE_PALETTE.black}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}

/** Ghost of the item about to be placed, on the grid cell the cursor sits on. Green when it fits. */
function Ghost({ x, z, item, rot, valid }: { x: number; z: number; item: DecorItem; rot: number; valid: boolean }) {
  const turned = ((rot % 4) + 4) % 4 % 2 === 1;
  const w = turned ? item.depth : item.width;
  const d = turned ? item.width : item.depth;
  return (
    <mesh position={[x, 0.03, z]}>
      <boxGeometry args={[w * 0.95, 0.04, d * 0.95]} />
      <meshStandardMaterial color={valid ? SCENE_PALETTE.validGreen : SCENE_PALETTE.invalidRed} transparent opacity={0.6} />
    </mesh>
  );
}

/** Floor wet patch from rain through open apertures (spec 17.5). */
function WetFloor({ wetness }: { wetness: number }) {
  if (wetness <= 0.02) return null;
  return (
    <mesh position={[0.5, 0.01, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.6 * wetness, 3.2 * wetness]} />
      <meshStandardMaterial color={SCENE_PALETTE.darkWood} roughness={0.2} metalness={0.1} transparent opacity={0.45 * wetness} />
    </mesh>
  );
}

/**
 * Safehouse extras: the door and shutter, wet floor, placed decor and the placement ghost.
 * Reads the store directly so the room shell stays unchanged.
 */
function SafehouseLive({ ghost }: { ghost: { item: DecorItem; x: number; z: number; rot: number; valid: boolean } | null; selectedUid: string | null }) {
  const apertures = useInteriorStore((s) => s.apertures);
  const wetness = useInteriorStore((s) => s.wetness);
  const placements = useInteriorStore((s) => s.decorPlacements);
  return (
    <group>
      {/* Door: front wall gap runs x 0 to 2.4. Hinge at x 0, leaf 2.4 wide. */}
      <Aperture x={0} y={1.1} z={2.5} w={2.4} h={2.2} axis="x" aperture={apertures.door} />
      {/* Shutter: left wall at x -3, leaf 1.2 wide along z. */}
      <Aperture x={-3} y={1.5} z={-0.2} w={1.2} h={0.9} axis="z" aperture={apertures.shutter} />
      <WetFloor wetness={wetness} />
      {placements.map((p) => {
        const item = DECOR_CATALOG[p.itemId];
        if (!item) return null;
        return <DecorMesh key={p.uid} p={p} item={item} selected={false} />;
      })}
      {ghost && <Ghost x={ghost.x} z={ghost.z} item={ghost.item} rot={ghost.rot} valid={ghost.valid} />}
    </group>
  );
}

/**
 * Drives the store's weather step each frame and mirrors wind and rain into the audio levels.
 * Lives in the scene so the aperture physics runs only while the player is inside.
 */
function WeatherTick({ audio }: { audio: InteriorAmbience }) {
  const tick = useInteriorStore((s) => s.tickInteriorWeather);
  const blowCount = useInteriorStore((s) => s.blowOpenCount);
  const lastClack = useRef(blowCount);
  useEffect(() => {
    if (blowCount > lastClack.current) audio.clack();
    lastClack.current = blowCount;
  }, [blowCount, audio]);
  useFrame((_, dt) => {
    const w = useWeatherStore.getState();
    const windSpeed = w.state.windSpeed;
    const rainIntensity = w.config.rainIntensity;
    tick({ dt: Math.min(dt, 0.1), windSpeed, rainIntensity, roll: Math.random });
    const { apertures } = useInteriorStore.getState();
    const openFrac = openFraction([apertures.door, apertures.shutter]);
    audio.setLevels(windAudioGain(windStrength(windSpeed), openFrac), rainAudioGain(rainIntensity, openFrac));
  });
  return null;
}

function SafehouseRoom() {
  return (
    <group>
      <Shell radius={3.2} h={2.65} />
      <CentralHearth />
      <CurvedBench yaw={0.4} />
      <CurvedBench yaw={2.2} />
      <CurvedBench yaw={-1.6} />
      <WallNiche yaw={1.0} />
      <WallNiche yaw={-2.0} />
      <WallMask yaw={2.6} />
      <WallMask yaw={-0.8} />
      <WaterPot p={[2.2, 0, 1.0]} />
      <WaterPot p={[-2.3, 0, 0.6]} />
      <Mat p={[1.4, 0, -1.6]} />
      <Stool p={[-1.5, 0, 1.4]} />
    </group>
  );
}

function MarketShopRoom() {
  return (
    <group>
      <Shell radius={3.2} h={2.65} />
      <CentralHearth />
      <CurvedBench yaw={0.2} />
      <CurvedBench yaw={2.4} />
      <Mat p={[0, 0, -1.8]} />
      <Goods p={[-0.4, 0.04, -1.8]} />
      <Goods p={[0.5, 0.04, -1.6]} />
      <WoodBowl p={[1.1, 0.06, -1.5]} />
      <ClothBolt p={[-1.6, 0, -1.5]} />
      <WaterPot p={[2.2, 0, 0.2]} />
      <WaterPot p={[2.4, 0, -0.5]} />
      <WallNiche yaw={-1.2} />
      <WallMask yaw={1.8} />
      <Stool p={[-0.8, 0, 0.3]} />
    </group>
  );
}

function WorkplaceRoom() {
  return (
    <group>
      <Shell radius={3.2} h={2.65} />
      <CentralHearth />
      <Table p={[0, 0, -1.7]} />
      <Box p={[0.3, 0.6, -1.7]} s={[0.5, 0.04, 0.06]} c={MUD_DARK} r={0.2} />
      <Stool p={[0, 0, -0.5]} />
      <Stool p={[1.5, 0, 0.4]} />
      <CurvedBench yaw={2.0} />
      <WaterPot p={[2.1, 0, -1.2]} />
      <WaterPot p={[-2.1, 0, -1.0]} />
      <Mat p={[-1.5, 0, 1.2]} />
      <WallNiche yaw={-2.2} pot={false} />
      <WallMask yaw={1.2} />
    </group>
  );
}

function InteriorNpcs({
  id,
  activeId,
  onSelect,
}: {
  id: InteriorId;
  activeId: string | null;
  onSelect: (npc: InteriorNpcDef) => void;
}) {
  const list = npcsForInterior(id);
  return (
    <group>
      {list.map((npc) => (
        <InteriorNpcMesh
          key={npc.id}
          npc={npc}
          active={activeId === npc.id}
          onSelect={() => onSelect(npc)}
        />
      ))}
    </group>
  );
}

const ROOMS: Record<InteriorId, () => ReactElement> = {
  safehouse: SafehouseRoom,
  "market-shop": MarketShopRoom,
  workplace: WorkplaceRoom,
};

export interface InteriorGood {
  id: string;
  name: string;
  price: number;
  emoji: string;
  owned: boolean;
}

export interface InteriorHandlers {
  /** Current City Coins wallet, shown in shop and work rooms. */
  balance?: number;
  /** Shop: goods on the stall (same list as the Market screen). */
  goods?: InteriorGood[];
  onBuyGood?: (id: string) => void;
  /** Safehouse: rest by the hearth (cools heat). */
  onRest?: () => void;
  /** Workplace: start a shift (pays out the same way as the Work board). */
  onTakeShift?: () => void;
  /** Exit back to the street at the same spot. */
  onExit: () => void;
}

interface Props extends InteriorHandlers {
  id: InteriorId;
}

const REFUSAL_TEXT: Record<PlaceRefusal, string> = {
  "out-of-bounds": "That spot is off the floor.",
  hearth: "Too close to the hearth fire.",
  reserved: "Keep the door and the sleeping mat clear.",
  overlap: "Something is already there.",
};

/** Nearest placed item within half a grid step of the cursor, if any. */
function placementAt(placements: Placement[], x: number, z: number): Placement | undefined {
  let best: Placement | undefined;
  let bestD = GRID_STEP;
  for (const p of placements) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Interior room with exit, latch controls, and (safehouse only) decor placement. */
export default function InteriorScene({
  id,
  balance = 0,
  goods = [],
  onBuyGood,
  onRest,
  onTakeShift,
  onExit,
}: Props) {
  const def: InteriorDef = INTERIORS[id];
  const Room = useMemo(() => ROOMS[id], [id]);
  const decorable = id === DECORABLE_ID;

  const apertures = useInteriorStore((s) => s.apertures);
  const wetness = useInteriorStore((s) => s.wetness);
  const placements = useInteriorStore((s) => s.decorPlacements);
  const inventory = useInteriorStore((s) => s.decorInventory);
  const applyAperture = useInteriorStore((s) => s.applyAperture);
  const placeDecor = useInteriorStore((s) => s.placeDecor);
  const autoPlaceDecor = useInteriorStore((s) => s.autoPlaceDecor);
  const rotateDecor = useInteriorStore((s) => s.rotateDecor);
  const pickupDecor = useInteriorStore((s) => s.pickupDecor);

  // Audio: created once; starts only on the first user gesture (pointer down or key press).
  const [audio] = useState(() => new InteriorAmbience());
  useEffect(() => () => audio.stop(), [audio]);

  const [decorMode, setDecorMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ x: 0, z: 0 });
  const [rot, setRot] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeNpc, setActiveNpc] = useState<InteriorNpcDef | null>(null);
  const [dialogue, setDialogue] = useState<string | null>(null);
  const [haggleDiscount, setHaggleDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const timeOfDay = useWeatherStore((s) => s.state.timeOfDay);
  const hour = useWeatherStore((s) => s.state.hour);
  const weatherId = useWeatherStore((s) => s.state.weatherId);
  const kowrySpend = useKowryStore((s) => s.spend);
  const kowryEarn = useKowryStore((s) => s.earn);
  const kowryInfluence = useKowryStore((s) => s.addInfluence);
  const kowryBalance = useKowryStore((s) => s.balance);

  const ghostItem = decorable && decorMode && selectedItem ? DECOR_CATALOG[selectedItem] : undefined;
  const ghostValid = ghostItem ? checkPlacement(ghostItem, cursor.x, cursor.z, rot, placements, DECOR_CATALOG) === null : false;
  const ghost = ghostItem ? { item: ghostItem, x: cursor.x, z: cursor.z, rot, valid: ghostValid } : null;
  const under = placementAt(placements, cursor.x, cursor.z);

  function toggleLatch(name: "door" | "shutter") {
    const a = apertures[name];
    if (!a.latched && a.open > 0) {
      setMsg(`Shut the ${name} before you latch it.`);
      return;
    }
    applyAperture(name, a.latched ? "unlatch" : "latch");
    setMsg(a.latched ? `${name === "door" ? "Door" : "Shutter"} unlatched.` : `${name === "door" ? "Door" : "Shutter"} latched.`);
  }

  function moveCursor(dx: number, dz: number) {
    setCursor((c) => ({
      x: Math.min(FLOOR_BOUNDS.maxX, Math.max(FLOOR_BOUNDS.minX, snap(c.x + dx * GRID_STEP))),
      z: Math.min(FLOOR_BOUNDS.maxZ, Math.max(FLOOR_BOUNDS.minZ, snap(c.z + dz * GRID_STEP))),
    }));
  }

  function doPlace() {
    if (!selectedItem) {
      setMsg("Pick an item from your satchel first.");
      return;
    }
    const r = placeDecor(selectedItem, cursor.x, cursor.z, rot);
    if (r) {
      setMsg(REFUSAL_TEXT[r]);
      return;
    }
    const left = (useInteriorStore.getState().decorInventory[selectedItem] ?? 0);
    setMsg(left > 0 ? `Placed. ${left} left.` : "Placed. That was your last one.");
    if (left <= 0) setSelectedItem(null);
  }

  function doRotate() {
    if (!under) {
      setMsg("Move the cursor onto an item to turn it.");
      return;
    }
    const r = rotateDecor(under.uid);
    setMsg(r ? REFUSAL_TEXT[r] : "Turned.");
  }

  function doPickup() {
    if (!under) {
      setMsg("Nothing to pick up here.");
      return;
    }
    const name = DECOR_CATALOG[under.itemId]?.name ?? "item";
    if (pickupDecor(under.uid)) setMsg(`${name} back in your satchel.`);
  }

  function talkTo(npc: InteriorNpcDef) {
    setActiveNpc(npc);
    const line = pickLine(npc, timeOfDay, Math.floor(hour * 10) + npc.name.length);
    setDialogue(line);
    setMsg(null);
    audio.start();
  }

  function runNpcAction(action: NpcAction) {
    if (busy) return;
    const cost = action.kowryCost ?? 0;
    if (cost > 0) {
      if (!kowrySpend(cost, "spend", action.label)) {
        setMsg(`Need ${cost} KOWRY shells for that.`);
        return;
      }
    }
    setBusy(true);
    setDialogue(action.result);
    setMsg(action.result);

    if (action.id === "rest" && onRest) {
      onRest();
    } else if (action.id === "kola") {
      // extra cool via parent rest light path — influence only here if no rest
      kowryInfluence(1);
      onRest?.();
    } else if (action.id === "blessing") {
      kowryInfluence(2);
      kowryEarn(1, "grant", "Elder blessing");
    } else if (action.id === "haggle") {
      setHaggleDiscount(0.12);
      setMsg("Next purchase in this shop is 12% cheaper.");
    } else if (action.id === "gossip") {
      const tm = worldModifiers(timeOfDay, weatherId, hour);
      setDialogue(`${action.result} (${tm.vibe})`);
      kowryInfluence(1);
    } else if (action.id === "shift" && onTakeShift) {
      onTakeShift();
    } else if (action.id === "practice") {
      kowryInfluence(2);
      kowryEarn(2, "harvest", "Craft practice");
      setMsg("Practice lands. Hands remember. +2 KOWRY, influence up.");
    } else if (action.id === "buy") {
      setMsg("Pick a good below — or haggle first.");
    }

    window.setTimeout(() => setBusy(false), 600);
  }

  function buyWithHaggle(goodId: string) {
    if (!onBuyGood) return;
    // Parent buyGood handles price/time; haggle is informational + kowry already spent
    onBuyGood(goodId);
    if (haggleDiscount > 0) {
      setHaggleDiscount(0);
      setMsg("Haggle spent — Chike honours the cut on this deal.");
    }
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    audio.start();
    if (e.key === "Escape") {
      onExit();
      return;
    }
    if (k === "f" || k === "e") {
      if (!decorMode) onExit();
      return;
    }
    if (k === "1" && decorable) toggleLatch("door");
    if (k === "2" && decorable) toggleLatch("shutter");
    if (!decorMode || !decorable) return;
    if (e.key === "ArrowLeft") moveCursor(-1, 0);
    else if (e.key === "ArrowRight") moveCursor(1, 0);
    else if (e.key === "ArrowUp") moveCursor(0, -1);
    else if (e.key === "ArrowDown") moveCursor(0, 1);
    else if (k === "p") doPlace();
    else if (k === "r") doRotate();
    else if (e.key === "Backspace" || e.key === "Delete") doPickup();
    else return;
    e.preventDefault();
  }

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const owned = Object.entries(inventory).filter(([, n]) => n > 0);

  return (
    <div className="am-interior" onPointerDown={() => audio.start()} onTouchStart={() => audio.start()}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 3.2, 5.6], fov: 55 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SCENE_PALETTE.interiorBg);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={0.6} castShadow />
        <Room />
        {decorable && <SafehouseLive ghost={ghost} selectedUid={null} />}
        <InteriorNpcs
          id={id}
          activeId={activeNpc?.id ?? null}
          onSelect={talkTo}
        />
        <WeatherTick audio={audio} />
        <OrbitControls target={[0, 1.2, 0]} enablePan={false} maxPolarAngle={Math.PI / 2.1} minDistance={3} maxDistance={8} />
        <Html position={[0, 2.9, 2.4]} center>
          <div className="am-interior-tag">{def.name}</div>
        </Html>
      </Canvas>

      <div className="am-interior-hud">
        <p className="am-interior-blurb">{def.blurb}</p>
        <p className="am-panel-tip">
          🐚 {kowryBalance} KOWRY · Tap a person in the room to talk · {timeOfDay}
        </p>

        {activeNpc && (
          <div className="am-npc-panel">
            <div className="am-npc-panel-head">
              <strong>{activeNpc.name}</strong>
              <span className="am-npc-role">{activeNpc.role}</span>
              <button type="button" className="am-btn am-btn-ghost am-btn-sm" onClick={() => { setActiveNpc(null); setDialogue(null); }}>
                Close
              </button>
            </div>
            {dialogue && <p className="am-npc-line">"{dialogue}"</p>}
            <div className="am-interior-actions">
              {activeNpc.actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="am-btn am-btn-primary am-btn-sm"
                  disabled={busy}
                  onClick={() => runNpcAction(a)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!activeNpc && (
          <div className="am-interior-actions">
            {npcsForInterior(id).map((npc) => (
              <button
                key={npc.id}
                type="button"
                className="am-btn am-btn-ghost"
                onClick={() => talkTo(npc)}
              >
                Talk to {npc.name}
              </button>
            ))}
          </div>
        )}

        {id === "safehouse" && onRest && !activeNpc && (
          <div className="am-interior-actions">
            <button type="button" className="am-btn am-btn-primary" onClick={onRest}>
              Rest by the hearth (cool heat)
            </button>
          </div>
        )}

        {decorable && (
          <>
            <div className="am-interior-actions">
              <button type="button" className="am-btn am-btn-ghost" onClick={() => toggleLatch("door")}>
                {apertures.door.latched ? "Unlatch door (1)" : "Latch door (1)"}
              </button>
              <button type="button" className="am-btn am-btn-ghost" onClick={() => toggleLatch("shutter")}>
                {apertures.shutter.latched ? "Unlatch shutter (2)" : "Latch shutter (2)"}
              </button>
              <button
                type="button"
                className="am-btn am-btn-ghost"
                onClick={() => applyAperture("door", apertures.door.open > 0 ? "close" : "open")}
              >
                {apertures.door.open > 0 ? "Close door" : "Open door"}
              </button>
              <button
                type="button"
                className="am-btn am-btn-ghost"
                onClick={() => applyAperture("shutter", apertures.shutter.open > 0 ? "close" : "open")}
              >
                {apertures.shutter.open > 0 ? "Close shutter" : "Open shutter"}
              </button>
            </div>
            <p className="am-panel-tip">
              Wetness on the floor: {Math.round(wetness * 100)}%.
            </p>

            <div className="am-interior-actions">
              <button type="button" className="am-btn am-btn-primary" onClick={() => setDecorMode((m) => !m)}>
                {decorMode ? "Done decorating" : "Decorate my hut"}
              </button>
            </div>

            {decorMode && (
              <div className="am-decor-panel">
                <p className="am-panel-tip">
                  Cursor at {cursor.x.toFixed(1)}, {cursor.z.toFixed(1)} m, turned {rot} quarter turns. Arrow keys move on the 0.5 m grid.
                </p>
                {owned.length === 0 ? (
                  <p className="am-panel-tip">Nothing in your satchel yet. Craft, buy or earn decor and it shows up here.</p>
                ) : (
                  <ul className="am-interior-goods">
                    {owned.map(([itemId, n]) => (
                      <li key={itemId}>
                        <span>
                          {DECOR_CATALOG[itemId]?.name ?? itemId} x{n}
                        </span>
                        <button
                          type="button"
                          className={`am-btn ${selectedItem === itemId ? "am-btn-primary" : "am-btn-ghost"}`}
                          onClick={() => setSelectedItem(itemId)}
                        >
                          {selectedItem === itemId ? "Selected" : "Pick"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="am-interior-actions">
                  <button type="button" className="am-btn am-btn-ghost" onClick={() => moveCursor(-1, 0)}>Left</button>
                  <button type="button" className="am-btn am-btn-ghost" onClick={() => moveCursor(1, 0)}>Right</button>
                  <button type="button" className="am-btn am-btn-ghost" onClick={() => moveCursor(0, -1)}>Back</button>
                  <button type="button" className="am-btn am-btn-ghost" onClick={() => moveCursor(0, 1)}>Front</button>
                </div>
                <div className="am-interior-actions">
                  <button type="button" className="am-btn am-btn-primary" onClick={doPlace}>Place (P)</button>
                  <button type="button" className="am-btn am-btn-ghost" onClick={doRotate}>Rotate (R)</button>
                  <button type="button" className="am-btn am-btn-ghost" onClick={doPickup}>Pick up (Del)</button>
                  <button
                    type="button"
                    className="am-btn am-btn-ghost"
                    onClick={() => {
                      if (!selectedItem) {
                        setMsg("Pick an item first.");
                        return;
                      }
                      const r = autoPlaceDecor(selectedItem, rot);
                      setMsg(r ? REFUSAL_TEXT[r] : "Placed in the first free spot.");
                    }}
                  >
                    Auto place
                  </button>
                </div>
                {msg && <p className="am-panel-tip">{msg}</p>}
              </div>
            )}
          </>
        )}

        {id === "market-shop" && (
          <>
            <p className="am-panel-tip">
              Wallet: {balance.toLocaleString()} City Coins
              {haggleDiscount > 0 ? " · haggle active (−12%)" : ""}
            </p>
            <ul className="am-interior-goods">
              {goods.map((g) => (
                <li key={g.id}>
                  <span>
                    {g.emoji} {g.name}
                  </span>
                  <span className="am-coins">{g.price} coins</span>
                  <button
                    type="button"
                    className={`am-btn ${g.owned ? "am-btn-ghost" : "am-btn-primary"}`}
                    disabled={g.owned || !onBuyGood}
                    onClick={() => buyWithHaggle(g.id)}
                  >
                    {g.owned ? "In satchel" : "Buy"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {id === "workplace" && onTakeShift && (
          <>
            <p className="am-panel-tip">Wallet: {balance.toLocaleString()} City Coins</p>
            <div className="am-interior-actions">
              <button type="button" className="am-btn am-btn-primary" onClick={onTakeShift}>
                Start a shift
              </button>
            </div>
          </>
        )}

        <div className="am-interior-actions">
          <button type="button" className="am-btn am-btn-secondary" onClick={onExit}>
            Exit to street (F)
          </button>
        </div>
      </div>
    </div>
  );
}
