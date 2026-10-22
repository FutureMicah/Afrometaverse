import { useEffect, useMemo, type ReactElement } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import "./interiors.css";
import * as THREE from "three";
import { INTERIORS, type InteriorDef } from "@/data/interiors";
import type { InteriorId } from "@/stores/interiorStore";

/**
 * Built from primitives only (no imported models or textures), so it adds almost no
 * bundle weight. Lazy-loaded from the game only while the player is inside a building.
 */

const MUD = "#8a6a4a";
const MUD_DARK = "#6b4f36";
const THATCH = "#b08a4e";
const MAT = "#c9a46a";
const WOOD = "#5c4030";
const CLAY = "#a0623a";
const FLOOR = "#7d5c3e";

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
        <meshStandardMaterial color="#ff7a1a" emissive="#ff5a00" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 0.6, 0]} color="#ff8a3a" intensity={1.1} distance={4} />
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

function SafehouseRoom() {
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      <Hearth p={[-1.6, 0, -1.2]} />
      <Mat p={[1, 0, -1]} />
      <Stool p={[-1.2, 0, 0.6]} />
      <Stool p={[-0.4, 0, 0.9]} />
      <Pot p={[1.9, 0.22, -1.8]} />
      <Pot p={[2.3, 0.22, -1.6]} />
      <Bowl p={[0.5, 0.45, 0.2]} />
      {/* rest spot by the cooler */}
      <Mat p={[0, 0, -2.2]} />
    </group>
  );
}

function MarketShopRoom() {
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      {/* trader's counter */}
      <Table p={[0, 0, -1.6]} />
      <Pot p={[-1.6, 0.8, -1.6]} />
      <Pot p={[-1.2, 0.8, -1.6]} />
      <Bowl p={[0.6, 0.85, -1.6]} />
      <Bowl p={[1.0, 0.85, -1.6]} />
      {/* woven goods mat on the floor */}
      <Mat p={[1.6, 0, 1.2]} />
      <Stool p={[0, 0, -0.2]} />
      <Hearth p={[-2, 0, 1.4]} />
    </group>
  );
}

function WorkplaceRoom() {
  return (
    <group>
      <Shell w={6} d={5} h={2.8} />
      {/* craft/work table */}
      <Table p={[0, 0, -1.6]} />
      <Pot p={[1.6, 0.4, -1.8]} />
      <Pot p={[-1.8, 0.4, -1.8]} />
      <Stool p={[0, 0, -0.2]} />
      <Stool p={[1.6, 0, 0.6]} />
      <Mat p={[-1.4, 0, 1]} />
      <Hearth p={[2, 0, 1.4]} />
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

/** Interior room with exit plus the one meaningful action for this building. */
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (e.key === "Escape" || k === "f" || k === "e") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="am-interior">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 3.2, 5.6], fov: 55 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#1d1510");
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={0.6} castShadow />
        <Room />
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
