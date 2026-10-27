import { subscribeWindGust } from "@/lib/weatherSystem";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import "./interiors.css";
import * as THREE from "three";
import { INTERIORS, type InteriorDef } from "@/data/interiors";
import { STARTER, type StarterItem } from "@/data/interiorStarter";
import { useInteriorStore, DECORABLE_ID, type InteriorId } from "@/stores/interiorStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { DECOR_CATALOG, type DecorItem } from "@/data/decor";
import { FLOOR_BOUNDS, GRID_STEP, checkPlacement, snap, type Placement, type PlaceRefusal } from "@/lib/hutGrid";
import {
  windStrength,
  BLOW_THRESHOLD,
  rattleAmplitude,
  windAudioGain,
  rainAudioGain,
  openFraction,
  type Aperture,
  type ApertureName,
  type RoomApertures,
} from "@/lib/interiorWeather";
import { InteriorAmbience } from "@/lib/interiorAudio";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { getProceduralPBR, type SurfaceKind } from "@/lib/proceduralTextures";

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

/**
 * Procedural PBR surface (albedo + normal map) from the shared proceduralTextures cache. `tint` multiplies
 * the albedo, so mud and thatch keep their palette colour while woven and carved surfaces stay white.
 */
function SurfMat({ kind, tint = "#ffffff", rough = 0.9 }: { kind: SurfaceKind; tint?: string; rough?: number }) {
  const pbr = useMemo(() => getProceduralPBR(kind), [kind]);
  const scale = useMemo(() => new THREE.Vector2(0.9, 0.9), []);
  return (
    <meshStandardMaterial
      map={pbr?.map ?? null}
      normalMap={pbr?.normal ?? null}
      normalScale={scale}
      color={tint}
      roughness={rough}
    />
  );
}

type Surf = { surf?: SurfaceKind; tint?: string };

function Box({ p, s, c, r = 0, surf, rough = 0.95 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; rough?: number } & Surf) {
  return (
    <mesh position={p} rotation={[0, r, 0]} castShadow receiveShadow>
      <boxGeometry args={s} />
      {surf ? <SurfMat kind={surf} tint={c} rough={rough} /> : <meshStandardMaterial color={c} roughness={rough} />}
    </mesh>
  );
}

function Cyl({ p, rt, rb, h, c, surf, rough = 0.9 }: { p: [number, number, number]; rt: number; rb: number; h: number; c: string; rough?: number } & Surf) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rt, rb, h, 14]} />
      {surf ? <SurfMat kind={surf} tint={c} rough={rough} /> : <meshStandardMaterial color={c} roughness={rough} />}
    </mesh>
  );
}

/** Round-bodied piece (bowl, gourd, ball) with an optional procedural surface. */
function Ball({ p, r, c, surf, rough = 0.9, seg = 12 }: { p: [number, number, number]; r: number; c: string; surf?: SurfaceKind; rough?: number; seg?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <sphereGeometry args={[r, seg, Math.max(6, seg - 4)]} />
      {surf ? <SurfMat kind={surf} tint={c} rough={rough} /> : <meshStandardMaterial color={c} roughness={rough} />}
    </mesh>
  );
}

/** Warm fire light with a slow, uneven flicker so the hearth reads as alive and throws moving shadows. */
function FireLight({ p, intensity, distance = 6 }: { p: [number, number, number]; intensity: number; distance?: number }) {
  const lt = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (lt.current) lt.current.intensity = intensity * (0.86 + 0.09 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 19.1 + 1.7));
  });
  return (
    <pointLight
      ref={lt}
      position={p}
      color={SCENE_PALETTE.emberLight}
      intensity={intensity}
      distance={distance}
      decay={2}
      castShadow
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.002}
    />
  );
}

/** Room shell: mud walls, floor, conical thatch roof, doorway opening at the front (+z). */
function Shell({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.05, d]} />
        <SurfMat kind="dust" tint={FLOOR} rough={1} />
      </mesh>
      {/* back and side walls: hand-daubed mud plaster */}
      <Box p={[0, h / 2, -d / 2]} s={[w, h, 0.2]} c={MUD} surf="mud" />
      <Box p={[-w / 2, h / 2, 0]} s={[0.2, h, d]} c={MUD_DARK} surf="mud" />
      <Box p={[w / 2, h / 2, 0]} s={[0.2, h, d]} c={MUD_DARK} surf="mud" />
      {/* front wall split for the doorway */}
      <Box p={[-w / 2 + 0.6, h / 2, d / 2]} s={[w - 1.2, h, 0.2]} c={MUD} surf="mud" />
      <Box p={[w / 2 - 0.3, h / 2, d / 2]} s={[0.6, h, 0.2]} c={MUD} surf="mud" />
      {/* thatch roof: palm-frond courses */}
      <mesh position={[0, h + 0.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.75, 1.4, 4]} />
        <SurfMat kind="thatch" rough={1} />
      </mesh>
    </group>
  );
}

function Hearth({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {/* clay and stone ring, ash bed, glowing coals */}
      <Cyl p={[0, 0.15, 0]} rt={0.5} rb={0.6} h={0.3} c="#ffffff" surf="mud" rough={1} />
      <Cyl p={[0, 0.31, 0]} rt={0.42} rb={0.42} h={0.02} c="#3a2a22" rough={1} />
      {[[0.14, 0.4, 0.06], [-0.12, 0.38, -0.1], [0.02, 0.4, 0.12]].map((q, i) => (
        <mesh key={i} position={q as [number, number, number]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={1.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={1.4} />
      </mesh>
      <FireLight p={[0, 0.7, 0]} intensity={2.4} distance={5} />
    </group>
  );
}

function Stool({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.35, 0]} rt={0.28} rb={0.22} h={0.1} c="#ffffff" surf="wood" />
      <Cyl p={[0, 0.17, 0]} rt={0.1} rb={0.12} h={0.34} c="#e2c9a6" surf="wood" />
    </group>
  );
}

function Pot({ p }: { p: [number, number, number] }) {
  return <Cyl p={p} rt={0.22} rb={0.14} h={0.45} c="#ffffff" surf="clay" />;
}

function Mat({ p }: { p: [number, number, number] }) {
  return <Box p={[p[0], 0.02, p[2]]} s={[1.8, 0.04, 1.2]} c="#ffffff" surf="mat" rough={0.95} />;
}

function Table({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.5, 0]} s={[1.2, 0.08, 0.8]} c="#ffffff" surf="wood" />
      <Box p={[-0.5, 0.25, -0.3]} s={[0.08, 0.5, 0.08]} c="#ffffff" surf="wood" />
      <Box p={[0.5, 0.25, -0.3]} s={[0.08, 0.5, 0.08]} c="#ffffff" surf="wood" />
      <Box p={[-0.5, 0.25, 0.3]} s={[0.08, 0.5, 0.08]} c="#ffffff" surf="wood" />
      <Box p={[0.5, 0.25, 0.3]} s={[0.08, 0.5, 0.08]} c="#ffffff" surf="wood" />
    </group>
  );
}

function Bowl({ p }: { p: [number, number, number] }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <SurfMat kind="wood" rough={0.85} />
    </mesh>
  );
}

/** Firewood hearth: three stones with logs and a low flame, no modern fireplace. */
function FirewoodHearth({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {/* stone ring with split logs laid over the coals */}
      {([[-0.45, 0.3], [0.45, 0.3], [0, -0.4], [-0.3, -0.3], [0.32, -0.25]] as [number, number][]).map((q, i) => (
        <Cyl key={i} p={[q[0], 0.07, q[1]]} rt={0.12} rb={0.14} h={0.14} c={i % 2 ? "#ffffff" : "#d6c4ad"} surf="mud" rough={1} />
      ))}
      <Log p={[-0.2, 0.14, 0]} len={0.6} r={0.09} rz={0.4} />
      <Log p={[0.18, 0.16, 0.06]} len={0.6} r={0.09} rz={-0.5} />
      <Log p={[0, 0.27, 0]} len={0.5} r={0.08} rz={0.1} />
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color={SCENE_PALETTE.ember} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={1.4} />
      </mesh>
      <FireLight p={[0, 0.7, 0]} intensity={2.4} distance={5} />
    </group>
  );
}

/** Clay water pot on a low stand, with a gourd lid. */
function WaterPot({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.22, 0]} rt={0.24} rb={0.15} h={0.45} c="#ffffff" surf="clay" />
      <Cyl p={[0, 0.5, 0]} rt={0.12} rb={0.2} h={0.1} c="#d9a27a" surf="clay" />
    </group>
  );
}

/** Wooden bowl on the floor or a table. */
function WoodBowl({ p }: { p: [number, number, number] }) {
  return <Bowl p={p} />;
}

/** Goods piled on a mat: yams (tan ovals), kola (red nuts), salt (white heap), cloth bolt. */
function Goods({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {/* yams: long tubers in a loose heap */}
      <Box p={[-0.35, 0.09, 0]} s={[0.5, 0.14, 0.3]} c="#e6c28a" surf="gourd" rough={0.9} />
      <Box p={[0.1, 0.09, 0.2]} s={[0.5, 0.14, 0.3]} c="#c8a070" surf="gourd" r={0.3} rough={0.9} />
      <Box p={[-0.05, 0.22, 0.05]} s={[0.4, 0.14, 0.26]} c="#d6b07a" surf="gourd" r={-0.2} rough={0.9} />
      {/* kola nuts */}
      <Ball p={[0.45, 0.06, -0.2]} r={0.1} c="#ffffff" surf="clay" seg={8} />
      <Ball p={[0.6, 0.06, -0.05]} r={0.1} c="#ffffff" surf="clay" seg={8} />
      <Ball p={[0.52, 0.05, 0.16]} r={0.09} c="#ffffff" surf="clay" seg={8} />
      {/* salt in a clay dish */}
      <Cyl p={[-0.1, 0.1, -0.35]} rt={0.14} rb={0.1} h={0.18} c={SCENE_PALETTE.creamPot} rough={1} />
    </group>
  );
}

/** Woven cloth bolt on a rolled stick. */
function ClothBolt({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.1, 0]} rt={0.13} rb={0.13} h={0.3} c="#ffffff" surf="cloth" rough={0.95} />
      <Box p={[0, 0.1, 0]} s={[0.27, 0.02, 0.27]} c="#ffffff" surf="wood" />
    </group>
  );
}

/**
 * A door or shutter leaf hinged in a wall. Open amount 0..1 swings the leaf inward.
 * A shut, unlatched leaf rattles when the wind is up (spec 17.3). Latched leaves show a bar.
 */
function Aperture({
  name,
  x,
  y,
  z,
  w,
  h,
  axis,
  aperture,
}: {
  name: ApertureName;
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
    // Gust swing: pushed open in proportion to gust strength, then eases closed.
    const sw = gustSwing[name];
    gustSwing[name] = sw * Math.exp(-GUST_SWING_DECAY * dt);
    const strength = windStrength(useWeatherStore.getState().state.windSpeed);
    const rattle = rattleAmplitude(aperture, strength);
    if (leaf.current) {
      const shake = rattle > 0 ? Math.sin(clock.elapsedTime * 38) * 0.06 * rattle : 0;
      leaf.current.rotation.y = shown.current * (Math.PI / 2.2) + shake + gustSwing[name] * (Math.PI / 3);
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
      <Aperture name="door" x={0} y={1.1} z={2.5} w={2.4} h={2.2} axis="x" aperture={apertures.door} />
      {/* Shutter: left wall at x -3, leaf 1.2 wide along z. */}
      <Aperture name="shutter" x={-3} y={1.5} z={-0.2} w={1.2} h={0.9} axis="z" aperture={apertures.shutter} />
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
/**
 * Door/shutter gust hook. Subscribes to the outdoor wind gust bus (weatherSystem.ts).
 * Stub: the gust strength is logged into the interior store as a pending kick; the existing
 * aperture physics (stepApertures) consumes wind speed each frame, so no extra physics here yet.
 */
function useGustHook() {
  useEffect(() => subscribeWindGust((g) => {
    // Only the door (unlatched) swings on a gust; latched leaves hold. Swing is cosmetic and eases shut.
    if (g.strength < BLOW_THRESHOLD) return;
    const latched = useInteriorStore.getState().apertures.door.latched;
    if (!latched) gustSwing.door = Math.max(gustSwing.door, g.strength);
  }), []);
}

/** Gust-driven swing per aperture (0..1). Set by gusts, decays each frame, visual only. */
const gustSwing = { door: 0, shutter: 0 };
const GUST_SWING_DECAY = 1.8;

function WeatherTick({ audio }: { audio: InteriorAmbience }) {
  useGustHook();
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

/** Basket of woven reed or yams, low and round. */
function Basket({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.14, 0]} rt={0.3} rb={0.22} h={0.28} c="#ffffff" surf="basket" rough={0.95} />
      <Cyl p={[0, 0.3, 0]} rt={0.31} rb={0.3} h={0.03} c="#c99a5c" surf="basket" rough={0.95} />
    </group>
  );
}

/** Calabash gourd on the floor, with a short neck. */
function Calabash({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Ball p={[0, 0.2, 0]} r={0.2} c="#ffffff" surf="gourd" rough={0.7} />
      <Cyl p={[0, 0.4, 0]} rt={0.06} rb={0.08} h={0.12} c="#ffffff" surf="gourd" rough={0.7} />
    </group>
  );
}

/** Tall palm oil jar in red clay. */
function PalmOilJar({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.3, 0]} rt={0.16} rb={0.2} h={0.6} c="#ffffff" surf="clay" />
      <Cyl p={[0, 0.66, 0]} rt={0.1} rb={0.13} h={0.08} c="#c27a4c" surf="clay" />
    </group>
  );
}

/** Talking drum: a waisted body with a hide head on top. */
function TalkingDrum({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.28, 0]} rt={0.14} rb={0.2} h={0.5} c="#ffffff" surf="wood" />
      <Cyl p={[0, 0.54, 0]} rt={0.18} rb={0.18} h={0.04} c={SCENE_PALETTE.matTan} rough={0.8} />
      <Cyl p={[0, 0.02, 0]} rt={0.2} rb={0.2} h={0.04} c="#6b4a2b" surf="wood" />
    </group>
  );
}

/** Small clay oil lamp on a stand, with a warm flame. */
function ClayLamp({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.2, 0]} rt={0.08} rb={0.12} h={0.4} c="#ffffff" surf="clay" />
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.candleGold} emissive={SCENE_PALETTE.emberDeep} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

/** Stack of split logs by the wall. */
function LogPile({ p }: { p: [number, number, number] }) {
  // stacked split logs, alternating direction, bark-brown and pale cut ends
  return (
    <group position={p}>
      <Log p={[0, 0.08, -0.14]} len={0.7} r={0.1} rz={0} />
      <Log p={[0, 0.08, 0.0]} len={0.7} r={0.1} rz={0} />
      <Log p={[0, 0.08, 0.14]} len={0.7} r={0.1} rz={0} />
      <Log p={[0, 0.2, -0.07]} len={0.7} r={0.1} rz={0} />
      <Log p={[0, 0.2, 0.07]} len={0.7} r={0.1} rz={0} />
      <Log p={[0, 0.32, 0]} len={0.7} r={0.1} rz={0} />
    </group>
  );
}

/** Wall rack holding an adze and chisels. */
function ToolRack({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.9, 0]} s={[0.06, 1.2, 0.8]} c="#ffffff" surf="wood" />
      <Box p={[0.06, 0.8, -0.2]} s={[0.04, 0.04, 0.3]} c="#c9b4a0" rough={0.5} />
      <Box p={[0.06, 1.0, 0.2]} s={[0.04, 0.04, 0.3]} c="#c9b4a0" rough={0.5} />
      <Box p={[0.06, 0.6, 0.0]} s={[0.04, 0.04, 0.36]} c="#c9b4a0" rough={0.5} />
    </group>
  );
}

/** Pile of carving blocks in soft wood. */
function BlockPile({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.15, 0]} s={[0.5, 0.3, 0.4]} c="#ffffff" surf="wood" />
      <Box p={[0.1, 0.42, -0.05]} s={[0.4, 0.22, 0.3]} c="#e6c9a2" surf="wood" r={0.3} />
    </group>
  );
}

/** Chisel resting on the bench top. */
function BenchTool({ p }: { p: [number, number, number] }) {
  return <Box p={p} s={[0.5, 0.04, 0.06]} c="#8a8a84" r={0.2} rough={0.4} />;
}

/** Balance scale with two pans on a post, for weighing goods. */
function TradeScale({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.5, 0]} s={[0.04, 0.9, 0.04]} c="#ffffff" surf="wood" />
      <Box p={[0, 0.94, 0]} s={[0.6, 0.04, 0.04]} c="#ffffff" surf="wood" />
      <Cyl p={[-0.28, 0.82, 0]} rt={0.14} rb={0.1} h={0.04} c="#ffffff" surf="basket" />
      <Cyl p={[0.28, 0.82, 0]} rt={0.14} rb={0.1} h={0.04} c="#ffffff" surf="basket" />
    </group>
  );
}

/** Low wall shelf holding pots and calabashes. Storage that reads as lived-in. */
function WallShelf({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.6, 0]} s={[0.9, 0.06, 0.4]} c="#ffffff" surf="wood" />
      <Cyl p={[-0.3, 0.8, 0]} rt={0.12} rb={0.09} h={0.3} c="#ffffff" surf="clay" />
      <Cyl p={[-0.02, 0.76, 0.02]} rt={0.1} rb={0.08} h={0.22} c="#d9a27a" surf="clay" />
      <Ball p={[0.25, 0.75, 0]} r={0.13} c="#ffffff" surf="gourd" />
      <Ball p={[0.02, 0.7, -0.08]} r={0.1} c="#ffffff" surf="gourd" />
    </group>
  );
}

/** Gourd or dried bundle hung from a roof beam by a cord. */
function HangingGourd({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.25, 6]} />
        <meshStandardMaterial color="#3a2a18" />
      </mesh>
      <Ball p={[0, -0.12, 0]} r={0.14} c="#ffffff" surf="gourd" rough={0.7} />
    </group>
  );
}

/** A single split log lying along x (rz tilts it), with a rough bark surface. */
function Log({ p, len, r, rz }: { p: [number, number, number]; len: number; r: number; rz: number }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2 + rz]} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, len, 12]} />
      <SurfMat kind="wood" tint="#e8d2b2" rough={0.9} />
    </mesh>
  );
}

/** Three clay pots of different sizes and fired tones, set close together. */
function PotCluster({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[-0.22, 0.2, 0.05]} rt={0.2} rb={0.13} h={0.4} c="#ffffff" surf="clay" />
      <Cyl p={[0.2, 0.14, -0.08]} rt={0.14} rb={0.1} h={0.28} c="#d9a27a" surf="clay" />
      <Cyl p={[0.02, 0.12, 0.22]} rt={0.11} rb={0.08} h={0.24} c="#b8805a" surf="clay" />
    </group>
  );
}

/** Stack of three wooden bowls, nested and staggered. */
function BowlStack({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Bowl p={[0, 0, 0]} />
      <mesh position={[0.02, 0.09, 0]}>
        <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <SurfMat kind="wood" tint="#d8b890" rough={0.85} />
      </mesh>
      <mesh position={[-0.01, 0.17, 0.01]}>
        <sphereGeometry args={[0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <SurfMat kind="wood" tint="#f0dcc0" rough={0.85} />
      </mesh>
    </group>
  );
}

/** Three calabashes on the floor, different sizes. */
function CalabashPile({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Ball p={[0, 0.16, 0]} r={0.16} c="#ffffff" surf="gourd" rough={0.7} />
      <Ball p={[0.26, 0.12, 0.08]} r={0.12} c="#e3c79a" surf="gourd" rough={0.7} />
      <Ball p={[-0.18, 0.1, 0.14]} r={0.1} c="#c9a774" surf="gourd" rough={0.7} />
    </group>
  );
}

/** Maps one starter entry to its mesh. Each kind uses the palette, no inline colours. */
function StarterPiece({ item }: { item: StarterItem }) {
  const p: [number, number, number] = [item.x, item.y ?? 0, item.z];
  switch (item.kind) {
    case "hearth":
      return <Hearth p={p} />;
    case "firewood":
      return <FirewoodHearth p={p} />;
    case "mat":
      return <Mat p={p} />;
    case "stool":
      return <Stool p={p} />;
    case "waterPot":
      return <WaterPot p={p} />;
    case "woodBowl":
      return <WoodBowl p={p} />;
    case "calabash":
      return <Calabash p={p} />;
    case "goods":
      return <Goods p={p} />;
    case "clothBolt":
      return <ClothBolt p={p} />;
    case "basket":
      return <Basket p={p} />;
    case "palmOilJar":
      return <PalmOilJar p={p} />;
    case "drum":
      return <TalkingDrum p={p} />;
    case "clayLamp":
      return <ClayLamp p={p} />;
    case "logPile":
      return <LogPile p={p} />;
    case "toolRack":
      return <ToolRack p={p} />;
    case "blockPile":
      return <BlockPile p={p} />;
    case "benchTable":
      return <Table p={p} />;
    case "benchTool":
      return <BenchTool p={p} />;
    case "scale":
      return <TradeScale p={p} />;
    case "shelf":
      return <WallShelf p={p} />;
    case "hangingGourd":
      return <HangingGourd p={p} />;
    case "matLayer":
      return <Mat p={[p[0], 0.02, p[2]]} />;
    case "potCluster":
      return <PotCluster p={p} />;
    case "bowlStack":
      return <BowlStack p={p} />;
    case "calabashPile":
      return <CalabashPile p={p} />;
    default:
      return null;
  }
}

/** One room: the shell plus every starter piece from data/interiorStarter.ts. */
function StarterRoom({ id }: { id: InteriorId }) {
  const items = STARTER[id].items;
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      {items.map((it) => (
        <StarterPiece key={it.id} item={it} />
      ))}
    </group>
  );
}

const ROOMS: Record<InteriorId, () => ReactElement> = {
  safehouse: () => <StarterRoom id="safehouse" />,
  "market-shop": () => <StarterRoom id="market-shop" />,
  workplace: () => <StarterRoom id="workplace" />,
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
        <ambientLight intensity={0.2} color="#ffe2b8" />
        <hemisphereLight args={["#fff1d6", "#3a2514", 0.3]} />
        {/* daylight through the doorway (front wall, +z): casts the door shadow across the floor */}
        <directionalLight
          position={[1.4, 3.6, 6]}
          intensity={0.95}
          color="#ffd9a6"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-camera-near={0.5}
          shadow-camera-far={14}
          shadow-bias={-0.0005}
        />
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
