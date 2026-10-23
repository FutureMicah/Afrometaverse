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

/** Room shell: mud walls, floor, conical thatch roof, doorway opening at the front (+z). */
function Shell({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.05, d]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>
      {/* back and side walls */}
      <Box p={[0, h / 2, -d / 2]} s={[w, h, 0.2]} c={MUD} />
      <Box p={[-w / 2, h / 2, 0]} s={[0.2, h, d]} c={MUD_DARK} />
      <Box p={[w / 2, h / 2, 0]} s={[0.2, h, d]} c={MUD_DARK} />
      {/* front wall split for the doorway */}
      <Box p={[-w / 2 + 0.6, h / 2, d / 2]} s={[w - 1.2, h, 0.2]} c={MUD} />
      <Box p={[w / 2 - 0.3, h / 2, d / 2]} s={[0.6, h, 0.2]} c={MUD} />
      {/* thatch roof */}
      <mesh position={[0, h + 0.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.75, 1.4, 4]} />
        <meshStandardMaterial color={THATCH} roughness={1} />
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
      <Shell w={6} d={5} h={2.8} />
      <FirewoodHearth p={[-1.6, 0, -1.2]} />
      <Mat p={[1, 0, -1]} />
      <Stool p={[-1.2, 0, 0.6]} />
      <Stool p={[-0.4, 0, 0.9]} />
      <WaterPot p={[1.9, 0, -1.8]} />
      <WaterPot p={[2.4, 0, -1.6]} />
      <WoodBowl p={[0.5, 0.45, 0.2]} />
      {/* rest spot by the hearth */}
      <Mat p={[0, 0, -2.2]} />
    </group>
  );
}

function MarketShopRoom() {
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      {/* trader's mat with goods on it, at the back */}
      <Mat p={[0, 0, -1.6]} />
      <Goods p={[-0.4, 0.04, -1.6]} />
      <WoodBowl p={[0.9, 0.06, -1.7]} />
      <WoodBowl p={[1.3, 0.06, -1.5]} />
      <ClothBolt p={[-1.7, 0, -1.7]} />
      {/* pottery stacked by the wall */}
      <WaterPot p={[1.8, 0, -0.2]} />
      <WaterPot p={[2.3, 0, -0.2]} />
      {/* woven mat for displays by the door */}
      <Mat p={[1.6, 0, 1.2]} />
      <Goods p={[1.6, 0.04, 1.2]} />
      <Stool p={[-0.6, 0, -0.2]} />
      <FirewoodHearth p={[-2, 0, 1.4]} />
    </group>
  );
}

function WorkplaceRoom() {
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      {/* carver's bench and tools (wooden) */}
      <Table p={[0, 0, -1.6]} />
      <Box p={[0.3, 0.6, -1.6]} s={[0.5, 0.04, 0.06]} c={MUD_DARK} r={0.2} />
      <WaterPot p={[1.6, 0, -1.8]} />
      <WaterPot p={[-1.8, 0, -1.8]} />
      <Stool p={[0, 0, -0.2]} />
      <Stool p={[1.6, 0, 0.6]} />
      <Mat p={[-1.4, 0, 1]} />
      <FirewoodHearth p={[2, 0, 1.4]} />
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
        {decorable && <WeatherTick audio={audio} />}
        <OrbitControls target={[0, 1.2, 0]} enablePan={false} maxPolarAngle={Math.PI / 2.1} minDistance={3} maxDistance={8} />
        <Html position={[0, 2.9, 2.4]} center>
          <div className="am-interior-tag">{def.name}</div>
        </Html>
      </Canvas>

      <div className="am-interior-hud">
        <p className="am-interior-blurb">{def.blurb}</p>

        {id === "safehouse" && onRest && (
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
            <p className="am-panel-tip">Wallet: {balance.toLocaleString()} City Coins</p>
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
                    onClick={() => onBuyGood?.(g.id)}
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
