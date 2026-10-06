import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  DISTRICT_WORLD,
  TRANSPORT_SPEED,
  useRoamStore,
  type TransportId,
} from "@/stores/roamStore";

const DISTRICT_LAYOUT = {
  "town-market": { x: -3, z: 2.5, color: "#e8a54b", label: "Town Market" },
  "civic-centre": { x: 0, z: -1.5, color: "#4db6a0", label: "Civic Centre" },
  creekside: { x: -5.5, z: -3.5, color: "#5b9fd4", label: "Creekside" },
  port: { x: 5.5, z: 2.5, color: "#e07a3a", label: "The Port" },
} as const;

const BOUNDS = { minX: -12, maxX: 12, minZ: -9, maxZ: 10 };

/** Warm Port Harcourt palette — dusty roads, ochre walls, teal roofs */
const PALETTE = {
  road: "#5c5346",
  roadLine: "#c4b59a",
  dirt: "#c4a574",
  lot: "#b8956a",
  lotMark: "#d4b896",
  wallWarm: "#d9b896",
  wallCoral: "#c97b63",
  wallTeal: "#5f9e8f",
  wallCream: "#efe2c8",
  roofTin: "#7a8b8c",
  roofClay: "#a65d3f",
  scaffold: "#c9a227",
  crane: "#e8a317",
  water: "#2a6f8f",
  waterDeep: "#1a4d66",
  green: "#5a7d4e",
  palm: "#3d6b3a",
  lamp: "#f0e6c8",
  concrete: "#9a958c",
  fence: "#6b6560",
};

type BuildingSpec = {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  roof?: string;
  kind?: "block" | "shed" | "tower";
};

/** Filled city fabric around the four hubs */
const CITY_BLOCKS: BuildingSpec[] = [
  // Town market cluster
  { x: -4.2, z: 3.8, w: 1.4, h: 1.4, d: 1.2, color: PALETTE.wallWarm, roof: PALETTE.roofTin },
  { x: -2.0, z: 4.0, w: 1.6, h: 1.8, d: 1.3, color: PALETTE.wallCoral, roof: PALETTE.roofClay },
  { x: -5.0, z: 1.6, w: 1.3, h: 1.2, d: 1.4, color: PALETTE.wallCream, roof: PALETTE.roofTin },
  { x: -1.2, z: 1.5, w: 1.1, h: 2.2, d: 1.1, color: PALETTE.wallTeal, roof: PALETTE.roofClay, kind: "tower" },
  { x: -3.2, z: 5.2, w: 1.0, h: 1.1, d: 1.0, color: PALETTE.wallCoral, roof: PALETTE.roofTin },
  { x: -0.5, z: 3.2, w: 0.9, h: 1.5, d: 0.9, color: PALETTE.wallWarm, roof: PALETTE.roofClay },
  // Civic neighbourhood
  { x: 1.8, z: -2.4, w: 1.5, h: 2.0, d: 1.4, color: PALETTE.wallCream, roof: PALETTE.roofTin },
  { x: -1.6, z: -2.8, w: 1.3, h: 1.6, d: 1.2, color: PALETTE.wallWarm, roof: PALETTE.roofClay },
  { x: 2.4, z: -0.4, w: 1.2, h: 1.5, d: 1.1, color: PALETTE.wallCoral, roof: PALETTE.roofTin },
  { x: -2.2, z: -0.2, w: 1.0, h: 1.3, d: 1.0, color: PALETTE.wallTeal, roof: PALETTE.roofClay },
  { x: 0.8, z: -4.0, w: 1.4, h: 1.8, d: 1.2, color: PALETTE.wallCream, roof: PALETTE.roofClay },
  { x: 3.2, z: -1.8, w: 1.0, h: 1.2, d: 1.0, color: PALETTE.wallWarm, roof: PALETTE.roofTin },
  // Creekside stilt / low sheds
  { x: -7.0, z: -2.2, w: 1.4, h: 1.0, d: 1.2, color: PALETTE.wallWarm, roof: PALETTE.roofTin, kind: "shed" },
  { x: -4.2, z: -4.6, w: 1.2, h: 1.1, d: 1.0, color: PALETTE.wallCream, roof: PALETTE.roofClay, kind: "shed" },
  { x: -6.8, z: -4.8, w: 1.5, h: 0.9, d: 1.3, color: PALETTE.wallCoral, roof: PALETTE.roofTin, kind: "shed" },
  { x: -8.2, z: -1.0, w: 1.1, h: 0.95, d: 1.1, color: PALETTE.wallTeal, roof: PALETTE.roofTin, kind: "shed" },
  // Port industrial
  { x: 7.2, z: 1.2, w: 2.0, h: 1.6, d: 1.5, color: PALETTE.concrete, roof: PALETTE.roofTin, kind: "shed" },
  { x: 4.2, z: 4.0, w: 1.6, h: 2.4, d: 1.4, color: PALETTE.wallWarm, roof: PALETTE.roofClay, kind: "tower" },
  { x: 7.0, z: 3.8, w: 1.4, h: 1.3, d: 1.6, color: PALETTE.concrete, roof: PALETTE.roofTin },
  { x: 8.5, z: 2.5, w: 1.2, h: 1.1, d: 1.3, color: "#6b7280", roof: PALETTE.roofTin, kind: "shed" },
  // Infill toward centre
  { x: 3.5, z: 1.0, w: 1.2, h: 1.7, d: 1.1, color: PALETTE.wallTeal, roof: PALETTE.roofClay },
  { x: -3.5, z: -0.8, w: 1.1, h: 1.4, d: 1.0, color: PALETTE.wallCream, roof: PALETTE.roofTin },
  { x: 1.2, z: 1.8, w: 0.95, h: 1.35, d: 0.95, color: PALETTE.wallCoral, roof: PALETTE.roofClay },
  { x: -0.8, z: -3.6, w: 1.05, h: 1.55, d: 1.0, color: PALETTE.wallWarm, roof: PALETTE.roofTin },
];

/** Empty lots / future development parcels */
const DEV_LOTS: { x: number; z: number; w: number; d: number; label: string }[] = [
  { x: 1.2, z: 3.2, w: 2.4, d: 2.0, label: "Future housing" },
  { x: -7.5, z: 1.0, w: 2.2, d: 1.8, label: "Market expansion" },
  { x: 3.8, z: -3.6, w: 2.6, d: 2.2, label: "Civic annex site" },
  { x: 8.2, z: -1.5, w: 2.0, d: 2.4, label: "Port logistics pad" },
  { x: -1.0, z: 6.2, w: 2.8, d: 1.6, label: "Transit corridor" },
];

/** Active construction sites */
const BUILD_SITES: { x: number; z: number; phase: "scaffold" | "foundation" | "crane" }[] = [
  { x: 1.0, z: 3.0, phase: "scaffold" },
  { x: 3.6, z: -3.4, phase: "foundation" },
  { x: 7.8, z: -1.2, phase: "crane" },
  { x: -7.2, z: 0.8, phase: "scaffold" },
];

const ROAD_SEGMENTS: { x: number; z: number; w: number; d: number; rot?: number }[] = [
  { x: 0, z: 0.2, w: 22, d: 1.1 },
  { x: 0, z: 4.6, w: 16, d: 0.85 },
  { x: 0, z: -2.8, w: 18, d: 0.9 },
  { x: -3.2, z: 1.0, w: 0.9, d: 12 },
  { x: 2.8, z: 0.5, w: 0.9, d: 11 },
  { x: 5.5, z: 1.5, w: 0.85, d: 8 },
  { x: -5.5, z: -1.5, w: 0.8, d: 9 },
];

function CityGround({
  weather,
}: {
  weather: { groundColor: string; fogColor: string; lightingMultiplier: number };
}) {
  return (
    <>
      <ambientLight intensity={0.42 * weather.lightingMultiplier} />
      <hemisphereLight args={["#f5e6c8", "#6b5a40", 0.35 * weather.lightingMultiplier]} />
      <directionalLight
        position={[10, 14, 6]}
        intensity={1.15 * weather.lightingMultiplier}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Earth / laterite base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial color={weather.groundColor || PALETTE.dirt} />
      </mesh>

      {/* Soft green patches */}
      {[
        [-8, 4.5],
        [9, -4],
        [-9, -5.5],
        [8, 6],
      ].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]} receiveShadow>
          <circleGeometry args={[1.6 + (i % 3) * 0.3, 16]} />
          <meshStandardMaterial color={PALETTE.green} opacity={0.55} transparent />
        </mesh>
      ))}
    </>
  );
}

function RoadNetwork() {
  return (
    <group>
      {ROAD_SEGMENTS.map((r, i) => (
        <group key={i}>
          <mesh
            position={[r.x, 0.03, r.z]}
            rotation={[-Math.PI / 2, 0, r.rot ?? 0]}
            receiveShadow
          >
            <planeGeometry args={[r.w, r.d]} />
            <meshStandardMaterial color={PALETTE.road} />
          </mesh>
          {/* Centre dashed suggestion */}
          <mesh position={[r.x, 0.04, r.z]} rotation={[-Math.PI / 2, 0, r.rot ?? 0]}>
            <planeGeometry args={[r.w * 0.9, 0.06]} />
            <meshStandardMaterial color={PALETTE.roadLine} opacity={0.35} transparent />
          </mesh>
        </group>
      ))}
      {/* Crosswalk bars */}
      {[-1.2, -0.6, 0, 0.6, 1.2].map((ox, i) => (
        <mesh key={`cw${i}`} position={[ox, 0.045, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.35, 1.0]} />
          <meshStandardMaterial color="#e7e0d0" opacity={0.7} transparent />
        </mesh>
      ))}
      {[-1.0, -0.4, 0.2, 0.8].map((oz, i) => (
        <mesh key={`cw2${i}`} position={[-3.2, 0.045, oz]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.3, 0.9]} />
          <meshStandardMaterial color="#e7e0d0" opacity={0.65} transparent />
        </mesh>
      ))}
      {/* Speed bump near market */}
      <mesh position={[-2.5, 0.08, 2.5]} castShadow>
        <boxGeometry args={[0.9, 0.1, 0.35]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
    </group>
  );
}

function StreetFurniture() {
  const lamps = useMemo(
    () =>
      [
        [-2, 0.8],
        [2.5, 0.8],
        [-3, 4.2],
        [3, 4.2],
        [-5, -2.4],
        [5.2, 2.0],
        [0, -2.4],
        [-6, -3.2],
      ] as [number, number][],
    [],
  );

  return (
    <group>
      {lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 2.2, 6]} />
            <meshStandardMaterial color={PALETTE.concrete} />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={PALETTE.lamp} emissive={PALETTE.lamp} emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      {/* Simple palm trunks */}
      {[
        [-8.5, -3],
        [-9, -4.2],
        [9.5, 3],
        [10, 4.2],
        [-4, 6.5],
      ].map(([x, z], i) => (
        <group key={`p${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 2.4, 6]} />
            <meshStandardMaterial color="#6b5344" />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <sphereGeometry args={[0.55, 8, 8]} />
            <meshStandardMaterial color={PALETTE.palm} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CityBlock({ spec }: { spec: BuildingSpec }) {
  const y = spec.h / 2;
  const isShed = spec.kind === "shed";
  const isTower = spec.kind === "tower";
  // Slight footprint irregularity so rows don't read as a grid of cubes
  const skew = ((spec.x * 7 + spec.z * 3) % 5) * 0.02;

  return (
    <group position={[spec.x, 0, spec.z]} rotation={[0, skew, 0]}>
      {/* Base plinth — wider, lower */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[spec.w * 1.08, 0.12, spec.d * 1.08]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>

      {/* Main volume — slightly tapered stack (two tiers) */}
      <mesh castShadow receiveShadow position={[0, y * 0.55, 0]}>
        <boxGeometry args={[spec.w, spec.h * 0.55, spec.d]} />
        <meshStandardMaterial color={spec.color} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, y * 1.15, 0]}>
        <boxGeometry args={[spec.w * 0.92, spec.h * 0.45, spec.d * 0.92]} />
        <meshStandardMaterial color={spec.color} />
      </mesh>

      {/* Side wing offset — breaks pure rectangle plan */}
      {!isShed && (
        <mesh position={[spec.w * 0.55, spec.h * 0.28, -spec.d * 0.1]} castShadow>
          <boxGeometry args={[spec.w * 0.35, spec.h * 0.5, spec.d * 0.55]} />
          <meshStandardMaterial color={spec.color} />
        </mesh>
      )}

      {/* Pitched roof — two planes, not a flat slab */}
      {spec.roof && !isShed && (
        <group position={[0, spec.h + 0.05, 0]}>
          <mesh position={[-spec.w * 0.22, 0.25, 0]} rotation={[0, 0, 0.4]} castShadow>
            <planeGeometry args={[spec.w * 0.75, spec.d * 1.15]} />
            <meshStandardMaterial color={spec.roof} side={2} metalness={0.15} roughness={0.7} />
          </mesh>
          <mesh position={[spec.w * 0.22, 0.25, 0]} rotation={[0, 0, -0.4]} castShadow>
            <planeGeometry args={[spec.w * 0.75, spec.d * 1.15]} />
            <meshStandardMaterial color={spec.roof} side={2} metalness={0.15} roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* Shed: lean-to mono-pitch */}
      {spec.roof && isShed && (
        <mesh
          position={[0, spec.h + 0.15, 0]}
          rotation={[0.25, 0, 0]}
          castShadow
        >
          <planeGeometry args={[spec.w * 1.1, spec.d * 1.15]} />
          <meshStandardMaterial color={spec.roof} side={2} metalness={0.25} roughness={0.55} />
        </mesh>
      )}

      {/* Cylindrical stair/water tower accent on taller buildings */}
      {isTower && (
        <mesh position={[spec.w * 0.45, spec.h * 0.7, spec.d * 0.4]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, spec.h * 0.9, 8]} />
          <meshStandardMaterial color={spec.color} />
        </mesh>
      )}

      {/* Window recesses as inset dark panels + circular vents */}
      <mesh position={[0, y * 0.9, spec.d / 2 + 0.02]}>
        <boxGeometry args={[spec.w * 0.55, Math.min(0.28, spec.h * 0.18), 0.04]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.75} />
      </mesh>
      {spec.h > 1.5 && (
        <mesh position={[spec.w * 0.2, y * 0.5, spec.d / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      )}

      {/* Arched door suggestion — cylinder slice + frame */}
      <mesh position={[0, 0.4, spec.d / 2 + 0.03]}>
        <boxGeometry args={[0.32, 0.7, 0.05]} />
        <meshStandardMaterial color="#2a221c" />
      </mesh>
      <mesh position={[0, 0.75, spec.d / 2 + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 10]} />
        <meshStandardMaterial color="#2a221c" />
      </mesh>

      {/* Rooftop water drum (cylinder) */}
      {spec.h > 1.5 && (
        <mesh position={[spec.w * 0.2, spec.h + 0.55, -spec.d * 0.15]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.4, 10]} />
          <meshStandardMaterial color="#64748b" metalness={0.3} roughness={0.5} />
        </mesh>
      )}

      {/* AC — rounded */}
      {!isShed && (
        <mesh position={[spec.w / 2 + 0.1, y * 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.28, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      )}

      {/* Balcony slab + rail cylinders */}
      {spec.h > 1.7 && (
        <group position={[0, y * 1.1, spec.d / 2 + 0.15]}>
          <mesh castShadow>
            <boxGeometry args={[spec.w * 0.5, 0.05, 0.3]} />
            <meshStandardMaterial color="#9a958c" />
          </mesh>
          {[-0.2, 0, 0.2].map((ox, i) => (
            <mesh key={i} position={[ox * spec.w, 0.15, 0.1]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3, 5]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          ))}
        </group>
      )}

      {/* Satellite dish on towers */}
      {isTower && (
        <group position={[-spec.w * 0.15, spec.h + 0.7, 0]}>
          <mesh rotation={[0.7, 0.4, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.035, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.25, 5]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function DistrictHub({
  position,
  color,
  active,
  near,
  label,
}: {
  position: [number, number, number];
  color: string;
  active: boolean;
  near: boolean;
  label: string;
}) {
  const lit = active || near;
  const isMarket = label === "Town Market";
  const isCivic = label === "Civic Centre";
  const isCreek = label === "Creekside";
  const isPort = label === "The Port";

  return (
    <group position={position}>
      {/* Ground apron — ellipse, not square */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.0, 20]} />
        <meshStandardMaterial color={lit ? "#efe2c8" : "#c4b59a"} transparent opacity={0.9} />
      </mesh>

      {/* Core: octagonal-ish by rotated boxes OR cylinder for civic dome base */}
      {isCivic ? (
        <>
          <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.15, 1.3, 2.0, 10]} />
            <meshStandardMaterial
              color={lit ? "#fef3c7" : color}
              emissive={lit ? color : "#000000"}
              emissiveIntensity={lit ? 0.3 : 0.05}
            />
          </mesh>
          {/* Dome */}
          <mesh position={[0, 2.35, 0]} castShadow>
            <sphereGeometry args={[0.95, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={PALETTE.wallCream} />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 0.4, 6]} />
            <meshStandardMaterial color={PALETTE.roofClay} />
          </mesh>
          {/* Colonnade posts */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.45, 0.7, Math.sin(a) * 1.45]} castShadow>
                <cylinderGeometry args={[0.08, 0.1, 1.4, 6]} />
                <meshStandardMaterial color={PALETTE.wallCream} />
              </mesh>
            );
          })}
        </>
      ) : isCreek ? (
        <>
          {/* Stilt house — elevated floor, wood posts, mono roof */}
          {[[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]].map(([px, pz], i) => (
            <mesh key={i} position={[px, 0.55, pz]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 1.1, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
          ))}
          <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.9, 0.12, 1.5]} />
            <meshStandardMaterial color="#6b5344" />
          </mesh>
          <mesh position={[0, 1.7, 0]} castShadow>
            <boxGeometry args={[1.7, 1.0, 1.3]} />
            <meshStandardMaterial
              color={lit ? "#fef3c7" : color}
              emissive={lit ? color : "#000000"}
              emissiveIntensity={lit ? 0.3 : 0.05}
            />
          </mesh>
          <mesh position={[0, 2.4, 0]} rotation={[0.3, 0, 0]} castShadow>
            <planeGeometry args={[2.2, 1.7]} />
            <meshStandardMaterial color={PALETTE.roofTin} side={2} metalness={0.25} roughness={0.55} />
          </mesh>
        </>
      ) : isPort ? (
        <>
          {/* Warehouse: long volume + barrel-vault suggestion via half-cylinder */}
          <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, 2.0, 1.8]} />
            <meshStandardMaterial
              color={lit ? "#fef3c7" : color}
              emissive={lit ? color : "#000000"}
              emissiveIntensity={lit ? 0.28 : 0.05}
            />
          </mesh>
          <mesh position={[0, 2.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.95, 0.95, 2.6, 12, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={PALETTE.roofTin} metalness={0.3} roughness={0.5} />
          </mesh>
          {/* Loading canopy */}
          <mesh position={[0, 1.4, 1.2]} rotation={[0.4, 0, 0]} castShadow>
            <planeGeometry args={[2.0, 1.0]} />
            <meshStandardMaterial color="#9a958c" side={2} />
          </mesh>
        </>
      ) : (
        <>
          {/* Default / market hall core */}
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 2.2, 1.8]} />
            <meshStandardMaterial
              color={lit ? "#fef3c7" : color}
              emissive={lit ? color : "#000000"}
              emissiveIntensity={lit ? 0.3 : 0.05}
            />
          </mesh>
          {/* Side cylinder stair tower */}
          <mesh position={[1.2, 1.2, -0.3]} castShadow>
            <cylinderGeometry args={[0.45, 0.5, 2.4, 10]} />
            <meshStandardMaterial color={PALETTE.wallWarm} />
          </mesh>
          <mesh position={[1.2, 2.5, -0.3]}>
            <coneGeometry args={[0.5, 0.4, 8]} />
            <meshStandardMaterial color={PALETTE.roofClay} />
          </mesh>
        </>
      )}

      {near && (
        <mesh position={[0, 3.6, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.9} />
        </mesh>
      )}

      {isMarket && (
        <>
          <mesh position={[0, 0.85, 1.15]}>
            <boxGeometry args={[1.5, 1.4, 0.06]} />
            <meshStandardMaterial color="#1a1510" transparent opacity={0.5} />
          </mesh>
          <mesh position={[-0.5, 2.9, 0.1]} rotation={[0, 0, 0.38]} castShadow>
            <planeGeometry args={[1.7, 2.2]} />
            <meshStandardMaterial color="#8a9a9b" side={2} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={[0.5, 2.9, 0.1]} rotation={[0, 0, -0.38]} castShadow>
            <planeGeometry args={[1.7, 2.2]} />
            <meshStandardMaterial color="#7a8b8c" side={2} metalness={0.3} roughness={0.5} />
          </mesh>
          {[-1.0, 1.0].map((px, i) => (
            <mesh key={i} position={[px, 0.85, 1.85]} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 1.7, 5]} />
              <meshStandardMaterial color="#5c4030" />
            </mesh>
          ))}
          <mesh position={[0, 1.75, 1.9]} rotation={[0.18, 0, 0]} castShadow>
            <planeGeometry args={[2.4, 1.2]} />
            <meshStandardMaterial color="#e8a54b" side={2} transparent opacity={0.82} />
          </mesh>
        </>
      )}
    </group>
  );
}

function DevelopmentLot({
  x,
  z,
  w,
  d,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.lot} />
      </mesh>
      {/* Survey stakes */}
      {[
        [-w / 2 + 0.15, -d / 2 + 0.15],
        [w / 2 - 0.15, -d / 2 + 0.15],
        [-w / 2 + 0.15, d / 2 - 0.15],
        [w / 2 - 0.15, d / 2 - 0.15],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[sx, 0.35, sz]}>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
          <meshStandardMaterial color={PALETTE.scaffold} />
        </mesh>
      ))}
      {/* Plot outline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[w * 0.92, d * 0.92]} />
        <meshStandardMaterial color={PALETTE.lotMark} opacity={0.4} transparent />
      </mesh>
      {/* Fence posts */}
      {Array.from({ length: 6 }).map((_, i) => {
        const t = i / 5;
        return (
          <mesh key={`f${i}`} position={[-w / 2 + t * w, 0.4, d / 2]}>
            <boxGeometry args={[0.05, 0.8, 0.05]} />
            <meshStandardMaterial color={PALETTE.fence} />
          </mesh>
        );
      })}
      {/* Site sign board */}
      <mesh position={[0, 0.9, d / 2 + 0.1]} castShadow>
        <boxGeometry args={[0.06, 1.4, 0.06]} />
        <meshStandardMaterial color={PALETTE.fence} />
      </mesh>
      <mesh position={[0.35, 1.4, d / 2 + 0.1]} castShadow>
        <boxGeometry args={[0.9, 0.45, 0.05]} />
        <meshStandardMaterial color="#efe2c8" />
      </mesh>
      <mesh position={[0.35, 1.4, d / 2 + 0.14]}>
        <boxGeometry args={[0.75, 0.3, 0.02]} />
        <meshStandardMaterial color="#c45c26" />
      </mesh>
      {/* Gravel scatter */}
      {[[-0.4, 0.2], [0.5, -0.3], [-0.2, -0.5]].map(([gx, gz], i) => (
        <mesh key={`g${i}`} position={[gx, 0.08, gz]}>
          <boxGeometry args={[0.25, 0.08, 0.2]} />
          <meshStandardMaterial color="#8a7f6e" />
        </mesh>
      ))}
    </group>
  );
}

function ConstructionSite({
  x,
  z,
  phase,
}: {
  x: number;
  z: number;
  phase: "scaffold" | "foundation" | "crane";
}) {
  return (
    <group position={[x, 0, z]}>
      {phase === "foundation" && (
        <>
          <mesh position={[0, 0.15, 0]} receiveShadow>
            <boxGeometry args={[2.0, 0.3, 1.8]} />
            <meshStandardMaterial color={PALETTE.concrete} />
          </mesh>
          <mesh position={[0.4, 0.5, 0]} castShadow>
            <boxGeometry args={[0.8, 0.5, 0.6]} />
            <meshStandardMaterial color="#8a8580" />
          </mesh>
        </>
      )}
      {phase === "scaffold" && (
        <>
          <mesh position={[0, 1.0, 0]} castShadow>
            <boxGeometry args={[1.6, 2.0, 1.4]} />
            <meshStandardMaterial color={PALETTE.wallCream} opacity={0.7} transparent />
          </mesh>
          {/* Scaffold poles */}
          {[
            [-0.9, -0.8],
            [0.9, -0.8],
            [-0.9, 0.8],
            [0.9, 0.8],
          ].map(([sx, sz], i) => (
            <mesh key={i} position={[sx, 1.2, sz]}>
              <cylinderGeometry args={[0.04, 0.04, 2.4, 5]} />
              <meshStandardMaterial color={PALETTE.scaffold} />
            </mesh>
          ))}
          <mesh position={[0, 2.4, 0]}>
            <boxGeometry args={[2.0, 0.08, 1.8]} />
            <meshStandardMaterial color={PALETTE.scaffold} />
          </mesh>
        </>
      )}
      {phase === "crane" && (
        <>
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <boxGeometry args={[1.8, 0.4, 1.8]} />
            <meshStandardMaterial color={PALETTE.concrete} />
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <boxGeometry args={[0.25, 6.2, 0.25]} />
            <meshStandardMaterial color={PALETTE.crane} />
          </mesh>
          <mesh position={[1.4, 6.0, 0]} castShadow>
            <boxGeometry args={[3.2, 0.18, 0.18]} />
            <meshStandardMaterial color={PALETTE.crane} />
          </mesh>
          <mesh position={[2.8, 5.2, 0]}>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color="#4a5568" />
          </mesh>
        </>
      )}
    </group>
  );
}

function Waterfront({ active }: { active: boolean }) {
  const waterRef = useRef<THREE.Mesh>(null);
  const canoeRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (waterRef.current) {
      waterRef.current.position.y = 0.05 + Math.sin(t * 0.8) * 0.03;
      waterRef.current.rotation.z = Math.sin(t * 0.35) * 0.01;
    }
    canoeRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = 0.12 + Math.sin(t * 1.2 + i) * 0.04;
      g.rotation.z = Math.sin(t * 0.9 + i * 0.7) * 0.04;
    });
  });

  return (
    <group position={[-5.5, 0.05, -5.2]}>
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.2, 24]} />
        <meshStandardMaterial
          color={active ? "#3b9bc7" : "#2a6f8f"}
          transparent
          opacity={0.88}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>
      {/* Jetty planks as thin cylinders laid flat-ish */}
      {[-0.8, -0.25, 0.3, 0.85].map((ox, i) => (
        <mesh key={i} position={[ox, 0.18, 1.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2.8, 6]} />
          <meshStandardMaterial color="#6b5344" />
        </mesh>
      ))}
      {[-1.2, 1.8].map((px, i) => (
        <mesh key={`p${i}`} position={[px, 0.4, 0.5]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.7, 5]} />
          <meshStandardMaterial color="#5a4638" />
        </mesh>
      ))}
      {[-2.5, -1.5, 2.2, 1.0, -3.2].map((mx, i) => (
        <mesh key={`m${i}`} position={[mx, 0.45, -1.5 - (i % 2) * 0.4]}>
          <sphereGeometry args={[0.35 + (i % 3) * 0.08, 7, 7]} />
          <meshStandardMaterial color={PALETTE.palm} />
        </mesh>
      ))}
      <group
        ref={(el) => {
          canoeRefs.current[0] = el;
        }}
        position={[1.2, 0.15, 0.3]}
        rotation={[0, 0.4, 0]}
      >
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.12, 0.9, 4, 8]} />
          <meshStandardMaterial color="#6b5344" />
        </mesh>
      </group>
      <group
        ref={(el) => {
          canoeRefs.current[1] = el;
        }}
        position={[-1.5, 0.12, -0.5]}
        rotation={[0, -0.6, 0]}
      >
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.1, 0.7, 4, 8]} />
          <meshStandardMaterial color="#5c5346" />
        </mesh>
      </group>
    </group>
  );
}

function PortInfrastructure() {
  return (
    <group position={[6.5, 0, 2.8]}>
      {/* Crane legs */}
      <mesh position={[1.5, 2.5, 0]} castShadow>
        <boxGeometry args={[0.2, 5, 0.2]} />
        <meshStandardMaterial color="#c45c26" />
      </mesh>
      <mesh position={[2.8, 2.5, 0]} castShadow>
        <boxGeometry args={[0.2, 5, 0.2]} />
        <meshStandardMaterial color="#c45c26" />
      </mesh>
      <mesh position={[2.15, 5.1, 0]} castShadow>
        <boxGeometry args={[2.0, 0.25, 0.25]} />
        <meshStandardMaterial color="#e07a3a" />
      </mesh>
      <mesh position={[2.15, 5.1, 1.2]} castShadow>
        <boxGeometry args={[0.15, 0.15, 2.4]} />
        <meshStandardMaterial color="#e07a3a" />
      </mesh>
      {/* Containers */}
      {[
        [0, 0.5, 1.5, "#1d6f8a"],
        [0, 0.5, 2.4, "#b45309"],
        [0, 1.3, 1.9, "#4b5563"],
      ].map(([x, y, z, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <boxGeometry args={[1.4, 0.9, 0.8]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

function DrainageChannel() {
  // Port Harcourt flood-aware civic infrastructure
  return (
    <group>
      <mesh position={[0.5, 0.06, 2.4]} rotation={[-Math.PI / 2, 0, 0.15]} receiveShadow>
        <planeGeometry args={[10, 0.35]} />
        <meshStandardMaterial color="#4a5568" opacity={0.7} transparent />
      </mesh>
      <mesh position={[-4.0, 0.06, -0.5]} rotation={[-Math.PI / 2, 0, 1.2]} receiveShadow>
        <planeGeometry args={[6, 0.3]} />
        <meshStandardMaterial color="#4a5568" opacity={0.65} transparent />
      </mesh>
    </group>
  );
}



/** Dense Mile-1 style market: poles, sagging tarps, tin, baskets — not clean boxes */
function TarpRoof({
  w,
  d,
  color,
  sag = 0.12,
}: {
  w: number;
  d: number;
  color: string;
  sag?: number;
}) {
  return (
    <group>
      {/* Two panels lean toward centre to suggest fabric sag */}
      <mesh position={[0, 0, -d * 0.15]} rotation={[sag, 0, 0]} castShadow>
        <planeGeometry args={[w, d * 0.55]} />
        <meshStandardMaterial color={color} side={2} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, -0.05, d * 0.18]} rotation={[-sag * 1.1, 0, 0.04]} castShadow>
        <planeGeometry args={[w * 0.98, d * 0.5]} />
        <meshStandardMaterial color={color} side={2} transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

function CorrugatedTin({ w, d, color = "#8a9a9b" }: { w: number; d: number; color?: string }) {
  const ridges = Math.max(4, Math.floor(w * 5));
  return (
    <group>
      {Array.from({ length: ridges }).map((_, i) => {
        const x = -w / 2 + (i + 0.5) * (w / ridges);
        return (
          <mesh key={i} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, d, 5]} />
            <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

function MarketPole({ h = 1.4, lean = 0 }: { h?: number; lean?: number }) {
  return (
    <mesh position={[0, h / 2, 0]} rotation={[0, 0, lean]} castShadow>
      <cylinderGeometry args={[0.035, 0.045, h, 5]} />
      <meshStandardMaterial color="#5c4030" />
    </mesh>
  );
}

function Basket({ scale = 1, color = "#c4a574" }: { scale?: number; color?: string }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.1, 0.14, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <torusGeometry args={[0.11, 0.015, 4, 10]} />
        <meshStandardMaterial color="#8b6914" />
      </mesh>
    </group>
  );
}

function ProduceMound({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.08, 0.06, 0.05]}>
        <sphereGeometry args={[0.07, 5, 5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.06, 0.05, -0.04]}>
        <sphereGeometry args={[0.06, 5, 5]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ClothBolt({ color, rot = 0 }: { color: string; rot?: number }) {
  return (
    <mesh rotation={[1.2, rot, 0.2]} castShadow>
      <cylinderGeometry args={[0.06, 0.06, 0.35, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function MarketStallUnit({
  position,
  rot = 0,
  tarp,
  width = 1.1,
  depth = 0.9,
  variant = 0,
}: {
  position: [number, number, number];
  rot?: number;
  tarp: string;
  width?: number;
  depth?: number;
  variant?: number;
}) {
  const leanL = variant % 2 === 0 ? -0.04 : 0.03;
  const leanR = variant % 2 === 0 ? 0.05 : -0.02;
  return (
    <group position={position} rotation={[0, rot, 0]}>
      {/* Poles — slightly irregular */}
      <group position={[-width * 0.42, 0, -depth * 0.35]}>
        <MarketPole h={1.35 + (variant % 3) * 0.05} lean={leanL} />
      </group>
      <group position={[width * 0.42, 0, -depth * 0.35]}>
        <MarketPole h={1.3 + (variant % 2) * 0.08} lean={leanR} />
      </group>
      <group position={[-width * 0.4, 0, depth * 0.35]}>
        <MarketPole h={1.25} lean={-leanR} />
      </group>
      <group position={[width * 0.4, 0, depth * 0.38]}>
        <MarketPole h={1.28} lean={leanL} />
      </group>

      {/* Cross beams */}
      <mesh position={[0, 1.22, -depth * 0.35]} rotation={[0, 0, 0.02]}>
        <boxGeometry args={[width * 0.85, 0.04, 0.04]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>
      <mesh position={[0, 1.18, depth * 0.35]} rotation={[0, 0, -0.03]}>
        <boxGeometry args={[width * 0.82, 0.04, 0.04]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>

      {/* Roof: tarp or tin */}
      <group position={[0, 1.28, 0]}>
        {variant % 3 === 1 ? (
          <CorrugatedTin w={width * 1.05} d={depth * 1.1} color={variant % 2 ? "#7a8b8c" : "#9aa7a8"} />
        ) : (
          <TarpRoof w={width * 1.05} d={depth * 1.05} color={tarp} sag={0.1 + (variant % 3) * 0.03} />
        )}
      </group>

      {/* Display table — plank, not cube counter */}
      <mesh position={[0, 0.42, 0.05]} rotation={[0.02, 0, 0.01]} castShadow>
        <boxGeometry args={[width * 0.75, 0.05, depth * 0.55]} />
        <meshStandardMaterial color="#a67c52" />
      </mesh>
      {/* Table legs thin */}
      {[[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.15], [0.3, 0.15]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx * width, 0.2, lz]}>
          <cylinderGeometry args={[0.025, 0.03, 0.4, 4]} />
          <meshStandardMaterial color="#5c4030" />
        </mesh>
      ))}

      {/* Ground mat / poly tarp underfoot */}
      <mesh position={[0, 0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0.1 * (variant % 3 - 1)]} receiveShadow>
        <planeGeometry args={[width * 0.7, depth * 0.5]} />
        <meshStandardMaterial color={variant % 2 ? "#5c5346" : "#3d6b3a"} transparent opacity={0.75} side={2} />
      </mesh>

      {/* Goods by variant */}
      {variant % 4 === 0 && (
        <>
          <group position={[-0.2, 0.48, 0.05]}>
            <ProduceMound color="#c45c26" scale={1.1} />
          </group>
          <group position={[0.15, 0.48, 0.1]}>
            <ProduceMound color="#5a7d4e" scale={0.9} />
          </group>
          <group position={[0.25, 0.45, -0.1]}>
            <Basket color="#c4a574" />
          </group>
        </>
      )}
      {variant % 4 === 1 && (
        <>
          <group position={[-0.15, 0.55, 0]}>
            <ClothBolt color="#c45c26" />
          </group>
          <group position={[0.05, 0.52, 0.08]}>
            <ClothBolt color="#1d6f8a" rot={0.4} />
          </group>
          <group position={[0.22, 0.5, -0.05]}>
            <ClothBolt color="#e8a54b" rot={-0.3} />
          </group>
        </>
      )}
      {variant % 4 === 2 && (
        <>
          <group position={[-0.2, 0.45, 0]}>
            <Basket scale={1.1} color="#b8956a" />
          </group>
          <group position={[0.1, 0.45, 0.12]}>
            <Basket scale={0.9} color="#8b6914" />
          </group>
          <mesh position={[0.25, 0.5, -0.05]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#f5f0e6" />
          </mesh>
        </>
      )}
      {variant % 4 === 3 && (
        <>
          <mesh position={[-0.15, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.2, 6]} />
            <meshStandardMaterial color="#7c2d12" />
          </mesh>
          <mesh position={[0.05, 0.48, 0.1]}>
            <cylinderGeometry args={[0.05, 0.05, 0.16, 6]} />
            <meshStandardMaterial color="#b45309" />
          </mesh>
          <group position={[0.22, 0.45, -0.08]}>
            <ProduceMound color="#dc2626" scale={0.75} />
          </group>
        </>
      )}

      {/* Hanging strip / price rag */}
      <mesh position={[width * 0.15, 1.0, depth * 0.2]} rotation={[0.2, 0, 0.15]}>
        <planeGeometry args={[0.2, 0.35]} />
        <meshStandardMaterial color={tarp} side={2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function MarketStalls() {
  /** Irregular rows — like Mile 1 / oil mill road density */
  const stalls: {
    x: number;
    z: number;
    rot: number;
    tarp: string;
    w?: number;
    d?: number;
    v: number;
  }[] = [
    { x: -4.4, z: 3.4, rot: 0.15, tarp: "#e8a54b", v: 0 },
    { x: -3.3, z: 3.55, rot: -0.08, tarp: "#c45c26", w: 1.0, v: 1 },
    { x: -2.25, z: 3.35, rot: 0.22, tarp: "#5f9e8f", v: 2 },
    { x: -4.55, z: 2.45, rot: 0.05, tarp: "#d97706", w: 0.95, v: 3 },
    { x: -3.45, z: 2.55, rot: -0.18, tarp: "#0d9488", v: 0 },
    { x: -2.4, z: 2.4, rot: 0.12, tarp: "#b45309", w: 1.15, v: 1 },
    { x: -5.35, z: 3.0, rot: 0.55, tarp: "#ca8a04", w: 0.9, d: 0.85, v: 2 },
    { x: -1.55, z: 2.85, rot: -0.45, tarp: "#dc2626", w: 0.95, v: 3 },
    { x: -4.0, z: 1.85, rot: 0.1, tarp: "#65a30d", v: 1 },
    { x: -2.9, z: 1.75, rot: -0.12, tarp: "#ea580c", w: 1.05, v: 2 },
    { x: -1.85, z: 1.95, rot: 0.28, tarp: "#0891b2", v: 0 },
    { x: -5.1, z: 1.9, rot: 0.7, tarp: "#a16207", w: 0.88, v: 3 },
  ];

  return (
    <group>
      {/* Packed laterite / stained ground under the market cluster */}
      <mesh position={[-3.3, 0.025, 2.7]} rotation={[-Math.PI / 2, 0, 0.05]} receiveShadow>
        <circleGeometry args={[2.8, 16]} />
        <meshStandardMaterial color="#9a7b52" />
      </mesh>
      <mesh position={[-3.5, 0.03, 2.9]} rotation={[-Math.PI / 2, 0, -0.2]} receiveShadow>
        <circleGeometry args={[1.6, 12]} />
        <meshStandardMaterial color="#8b6914" transparent opacity={0.5} />
      </mesh>

      {/* Shared shade spine — long irregular corridor of tarps */}
      <group position={[-3.3, 1.55, 2.85]}>
        <mesh rotation={[0.08, 0.1, 0]} castShadow>
          <planeGeometry args={[3.2, 1.4]} />
          <meshStandardMaterial color="#c45c26" side={2} transparent opacity={0.75} />
        </mesh>
      </group>
      <group position={[-3.2, 1.48, 2.2]}>
        <mesh rotation={[-0.06, -0.05, 0.02]} castShadow>
          <planeGeometry args={[2.6, 1.1]} />
          <meshStandardMaterial color="#e8a54b" side={2} transparent opacity={0.7} />
        </mesh>
      </group>

      {stalls.map((s, i) => (
        <MarketStallUnit
          key={i}
          position={[s.x, 0, s.z]}
          rot={s.rot}
          tarp={s.tarp}
          width={s.w}
          depth={s.d}
          variant={s.v}
        />
      ))}

      {/* Central aisle clutter: basins, sacks, stool */}
      <mesh position={[-3.35, 0.15, 2.95]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.25, 10]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-3.0, 0.12, 3.15]} castShadow>
        <sphereGeometry args={[0.16, 6, 6]} />
        <meshStandardMaterial color="#d6c6a1" />
      </mesh>
      <mesh position={[-3.55, 0.2, 2.55]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.35, 6]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
      {/* Smoke / suya grill suggestion */}
      <group position={[-4.7, 0, 3.55]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.35, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.06, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <coneGeometry args={[0.08, 0.25, 5]} />
          <meshStandardMaterial color="#6b7280" transparent opacity={0.35} />
        </mesh>
      </group>
    </group>
  );
}


function Billboard({
  x,
  z,
  rot = 0,
  title = "COMING SOON",
}: {
  x: number;
  z: number;
  rot?: number;
  title?: string;
}) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.08]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      <mesh position={[0.55, 1.1, 0]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.08]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      <mesh position={[0.28, 2.0, 0]} castShadow>
        <boxGeometry args={[1.3, 0.75, 0.06]} />
        <meshStandardMaterial color="#efe2c8" />
      </mesh>
      <mesh position={[0.28, 2.0, 0.04]}>
        <boxGeometry args={[1.1, 0.55, 0.02]} />
        <meshStandardMaterial color="#c45c26" emissive="#c45c26" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function PowerPoles() {
  const poles: [number, number][] = [
    [-6, 2],
    [-2, 2.2],
    [2, 2.2],
    [6, 2],
    [-4, -1.5],
    [1, -1.5],
    [5, -1.2],
  ];
  return (
    <group>
      {poles.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.0, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 4.0, 6]} />
            <meshStandardMaterial color="#5c5346" />
          </mesh>
          <mesh position={[0, 3.9, 0]}>
            <boxGeometry args={[0.7, 0.06, 0.06]} />
            <meshStandardMaterial color="#3f3a36" />
          </mesh>
        </group>
      ))}
      {/* Approximate wire spans */}
      {poles.slice(0, -1).map(([x, z], i) => {
        const [nx, nz] = poles[i + 1];
        const mx = (x + nx) / 2;
        const mz = (z + nz) / 2;
        const len = Math.hypot(nx - x, nz - z);
        const ang = Math.atan2(nx - x, nz - z);
        return (
          <mesh key={`w${i}`} position={[mx, 3.85, mz]} rotation={[0, ang, 0.05]}>
            <boxGeometry args={[0.02, 0.02, len]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        );
      })}
    </group>
  );
}

function DebrisAndProps() {
  return (
    <group>
      {/* Coil of rope / hose near port — torus, not crate */}
      <mesh position={[5.1, 0.12, 1.7]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.22, 0.05, 6, 14]} />
        <meshStandardMaterial color="#78716c" />
      </mesh>
      <mesh position={[5.35, 0.1, 1.95]} rotation={[Math.PI / 2, 0.3, 0]}>
        <torusGeometry args={[0.18, 0.04, 6, 12]} />
        <meshStandardMaterial color="#57534e" />
      </mesh>

      {/* Tyre pile near okada park */}
      {[0, 1, 2].map((i) => (
        <mesh key={`t${i}`} position={[-0.6 + i * 0.15, 0.12, 5.6]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.06, 6, 12]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}

      {/* Log bench near civic — cylinders */}
      <mesh position={[0.6, 0.22, -1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 1.0, 8]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>
      <mesh position={[0.2, 0.12, -1.0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.25, 6]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      <mesh position={[1.0, 0.12, -1.0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.25, 6]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>

      {/* Sandbags — soft sacks as elongated spheres */}
      {[-5.8, -5.4, -5.0].map((x, i) => (
        <mesh key={`s${i}`} position={[x, 0.1, -3.8]} scale={[1, 0.7, 0.85]} castShadow>
          <sphereGeometry args={[0.18, 6, 6]} />
          <meshStandardMaterial color="#a89968" />
        </mesh>
      ))}

      {/* Generator as rounded body */}
      <mesh position={[1.6, 0.28, 2.6]} castShadow>
        <capsuleGeometry args={[0.2, 0.25, 4, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      <mesh position={[1.6, 0.52, 2.6]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 6]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
    </group>
  );
}

function Sidewalks() {
  const paths = [
    { x: 0, z: 0.95, w: 20, d: 0.35 },
    { x: 0, z: -0.55, w: 18, d: 0.3 },
    { x: -2.6, z: 1.2, w: 0.3, d: 8 },
    { x: 3.4, z: 0.8, w: 0.3, d: 7 },
  ];
  return (
    <group>
      {paths.map((p, i) => (
        <mesh key={i} position={[p.x, 0.035, p.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[p.w, p.d]} />
          <meshStandardMaterial color="#9a958c" opacity={0.75} transparent />
        </mesh>
      ))}
    </group>
  );
}


function StreetLife() {
  return (
    <group>
      {/* Bus / keke shelter near civic */}
      <group position={[1.2, 0, -0.9]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[1.6, 0.08, 0.7]} />
          <meshStandardMaterial color="#4db6a0" />
        </mesh>
        <mesh position={[-0.7, 0.55, 0]}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
          <meshStandardMaterial color="#5c5346" />
        </mesh>
        <mesh position={[0.7, 0.55, 0]}>
          <boxGeometry args={[0.06, 1.1, 0.06]} />
          <meshStandardMaterial color="#5c5346" />
        </mesh>
        <mesh position={[0, 0.45, -0.3]} castShadow>
          <boxGeometry args={[1.4, 0.08, 0.3]} />
          <meshStandardMaterial color="#6b5344" />
        </mesh>
      </group>

      {/* Trash bins */}
      {[[-2.8, 1.2], [2.6, 0.6], [-5.2, -2.8], [5.8, 2.2]].map(([x, z], i) => (
        <mesh key={`bin${i}`} position={[x, 0.28, z]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.5, 8]} />
          <meshStandardMaterial color={i % 2 ? "#166534" : "#1e3a5f"} />
        </mesh>
      ))}

      {/* Wall mural slabs */}
      <mesh position={[-4.8, 0.9, 1.4]} castShadow>
        <boxGeometry args={[0.12, 1.6, 1.8]} />
        <meshStandardMaterial color="#c45c26" />
      </mesh>
      <mesh position={[-4.72, 1.1, 1.4]}>
        <boxGeometry args={[0.04, 0.9, 1.2]} />
        <meshStandardMaterial color="#f0e6c8" />
      </mesh>
      <mesh position={[6.2, 0.85, 0.3]} castShadow>
        <boxGeometry args={[0.12, 1.5, 1.5]} />
        <meshStandardMaterial color="#1d6f8a" />
      </mesh>

      {/* Laundry lines between creekside sheds */}
      <mesh position={[-6.5, 1.3, -3.5]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.8, 0.02, 0.02]} />
        <meshStandardMaterial color="#e7e0d0" />
      </mesh>
      {[-0.5, 0, 0.5].map((ox, i) => (
        <mesh key={`laun${i}`} position={[-6.5 + ox * 0.3, 1.15, -3.5 + ox * 0.2]}>
          <boxGeometry args={[0.25, 0.35, 0.04]} />
          <meshStandardMaterial color={["#e8a54b", "#5f9e8f", "#c97b63"][i]} />
        </mesh>
      ))}

      {/* Fuel / filling kiosk stub */}
      <group position={[6.8, 0, 5.0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[1.0, 1.2, 0.8]} />
          <meshStandardMaterial color="#efe2c8" />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[1.1, 0.15, 0.9]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0.6, 0.7, 0.2]}>
          <cylinderGeometry args={[0.06, 0.06, 1.0, 6]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>

      {/* Extra scrub vegetation */}
      {[
        [-9.5, 2.5],
        [-8.8, 5.5],
        [9.2, -3.5],
        [10.2, 1.5],
        [-1.5, 7.2],
        [2.5, 6.8],
      ].map(([x, z], i) => (
        <group key={`veg${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.4 + (i % 3) * 0.08, 6, 6]} />
            <meshStandardMaterial color={i % 2 ? "#4a7c45" : "#3d6b3a"} />
          </mesh>
          <mesh position={[0.3, 0.25, 0.2]}>
            <sphereGeometry args={[0.25, 6, 6]} />
            <meshStandardMaterial color="#5a7d4e" />
          </mesh>
        </group>
      ))}

      {/* Roundabout island centre */}
      <mesh position={[0, 0.06, 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.9, 16]} />
        <meshStandardMaterial color="#5a7d4e" opacity={0.8} transparent />
      </mesh>
      <mesh position={[0, 0.55, 0.2]}>
        <cylinderGeometry args={[0.08, 0.1, 1.0, 6]} />
        <meshStandardMaterial color="#9a958c" />
      </mesh>
      <mesh position={[0, 1.15, 0.2]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#4db6a0" />
      </mesh>

      {/* Stacked cement bags at foundation site */}
      {[0, 1, 2].map((i) => (
        <mesh key={`cem${i}`} position={[3.2 + (i % 2) * 0.25, 0.12 + Math.floor(i / 2) * 0.18, -3.1]} castShadow>
          <boxGeometry args={[0.35, 0.15, 0.25]} />
          <meshStandardMaterial color="#d6d3d1" />
        </mesh>
      ))}

      {/* Shipping container office at port edge */}
      <mesh position={[9.2, 0.55, 0.5]} castShadow>
        <boxGeometry args={[2.2, 1.1, 1.0]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      <mesh position={[9.2, 0.7, 1.02]}>
        <boxGeometry args={[0.5, 0.4, 0.05]} />
        <meshStandardMaterial color="#1e293b" opacity={0.7} transparent />
      </mesh>
    </group>
  );
}


function MicroDetails() {
  return (
    <group>
      {/* Manhole covers */}
      {[[-1.5, 0.5], [3.0, 0.3], [-4.0, -1.2], [5.5, 1.8], [0.5, 4.4]].map(([x, z], i) => (
        <mesh key={`mh${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0.2 * i]}>
          <circleGeometry args={[0.18, 10]} />
          <meshStandardMaterial color="#3f3a36" />
        </mesh>
      ))}

      {/* Potholes */}
      {[[1.8, 0.15], [-2.2, 4.5], [4.5, -2.6]].map(([x, z], i) => (
        <mesh key={`ph${i}`} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22 + i * 0.05, 8]} />
          <meshStandardMaterial color="#3d3429" />
        </mesh>
      ))}

      {/* Bollards */}
      {[
        [-0.8, 1.0],
        [0.8, 1.0],
        [-3.0, 2.8],
        [-2.4, 2.8],
        [5.0, 2.2],
      ].map(([x, z], i) => (
        <mesh key={`bol${i}`} position={[x, 0.25, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.5, 6]} />
          <meshStandardMaterial color={i % 2 ? "#c45c26" : "#efe2c8"} />
        </mesh>
      ))}

      {/* Plastic chairs at market */}
      {[
        [-3.9, 3.4],
        [-3.5, 3.5],
        [-2.9, 3.3],
      ].map(([x, z], i) => (
        <group key={`ch${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[0.28, 0.04, 0.28]} />
            <meshStandardMaterial color={["#e8a54b", "#5f9e8f", "#c97b63"][i]} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.22, 0.28, 0.04]} />
            <meshStandardMaterial color={["#e8a54b", "#5f9e8f", "#c97b63"][i]} />
          </mesh>
        </group>
      ))}

      {/* Cooler box */}
      <mesh position={[-4.3, 0.22, 3.0]} castShadow>
        <boxGeometry args={[0.4, 0.35, 0.3]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[-4.3, 0.42, 3.0]}>
        <boxGeometry args={[0.42, 0.06, 0.32]} />
        <meshStandardMaterial color="#93c5fd" />
      </mesh>

      {/* Umbrella poles + discs */}
      {[
        [-3.3, 2.55],
        [-2.4, 2.85],
      ].map(([x, z], i) => (
        <group key={`um${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.8, 5]} />
            <meshStandardMaterial color="#5c5346" />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <coneGeometry args={[0.55, 0.2, 8]} />
            <meshStandardMaterial color={i ? "#c45c26" : "#e8a54b"} />
          </mesh>
        </group>
      ))}

      {/* Flower pots / tyre planters */}
      {[
        [1.9, -2.0],
        [2.3, -2.1],
        [-1.4, -1.3],
        [0.3, -1.6],
      ].map(([x, z], i) => (
        <group key={`pot${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.25, 8]} />
            <meshStandardMaterial color={i % 2 ? "#1f2937" : "#7c2d12"} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.14, 6, 6]} />
            <meshStandardMaterial color="#4a7c45" />
          </mesh>
        </group>
      ))}

      {/* Door steps on a few buildings */}
      {[
        [-4.2, 3.8 + 0.65],
        [1.8, -2.4 + 0.75],
        [3.5, 1.0 + 0.6],
      ].map(([x, z], i) => (
        <mesh key={`st${i}`} position={[x, 0.08, z]} castShadow>
          <boxGeometry args={[0.5, 0.12, 0.25]} />
          <meshStandardMaterial color="#9a958c" />
        </mesh>
      ))}

      {/* Security bars on select facades (thin lattice) */}
      {[
        { x: -2.0, z: 4.0 + 0.66, y: 1.0 },
        { x: 1.8, z: -2.4 + 0.71, y: 1.3 },
      ].map((p, i) => (
        <group key={`bar${i}`} position={[p.x, p.y, p.z]}>
          {[-0.2, 0, 0.2].map((ox, j) => (
            <mesh key={j} position={[ox, 0, 0]}>
              <boxGeometry args={[0.03, 0.45, 0.03]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          ))}
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.03]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      ))}

      {/* Satellite dish already on towers; small rooftop rails */}
      {[
        { x: -1.2, z: 1.5, h: 2.2 },
        { x: 4.2, z: 4.0, h: 2.4 },
      ].map((b, i) => (
        <mesh key={`rail${i}`} position={[b.x, b.h + 0.35, b.z + 0.4]}>
          <boxGeometry args={[0.8, 0.04, 0.04]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}

      {/* Gutter strips along main road edge */}
      <mesh position={[0, 0.04, 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 0.12]} />
        <meshStandardMaterial color="#4a5568" opacity={0.5} transparent />
      </mesh>
      <mesh position={[0, 0.04, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 0.12]} />
        <meshStandardMaterial color="#4a5568" opacity={0.45} transparent />
      </mesh>

      {/* Firewood / stick pile */}
      {[-0.1, 0, 0.1].map((ox, i) => (
        <mesh key={`wood${i}`} position={[-7.3 + ox, 0.1, -2.0]} rotation={[0.2, 0.5 * i, 0.4]}>
          <cylinderGeometry args={[0.04, 0.04, 0.7, 5]} />
          <meshStandardMaterial color="#6b5344" />
        </mesh>
      ))}

      {/* Painted tyre rings as road edge markers */}
      {[
        [-5.5, 0.4],
        [5.5, 0.5],
        [-3.5, 4.7],
      ].map(([x, z], i) => (
        <mesh key={`tyre${i}`} position={[x, 0.12, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.05, 6, 10]} />
          <meshStandardMaterial color={i === 1 ? "#c45c26" : "#1f2937"} />
        </mesh>
      ))}

      {/* Small street name plate posts */}
      {[
        { x: -3.0, z: 0.6, rot: 0 },
        { x: 2.6, z: 0.6, rot: 0.1 },
        { x: 0.3, z: -2.5, rot: 1.4 },
      ].map((s, i) => (
        <group key={`sign${i}`} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 1.4, 5]} />
            <meshStandardMaterial color="#5c5346" />
          </mesh>
          <mesh position={[0.25, 1.25, 0]}>
            <boxGeometry args={[0.7, 0.22, 0.04]} />
            <meshStandardMaterial color="#efe2c8" />
          </mesh>
          <mesh position={[0.25, 1.25, 0.03]}>
            <boxGeometry args={[0.55, 0.12, 0.02]} />
            <meshStandardMaterial color="#1e3a5f" />
          </mesh>
        </group>
      ))}

      {/* Plastic bottles / micro clutter */}
      {[
        [-3.7, 2.5],
        [-2.5, 3.4],
        [5.2, 1.5],
        [0.4, 5.0],
      ].map(([x, z], i) => (
        <mesh key={`bot${i}`} position={[x, 0.1, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.16, 5]} />
          <meshStandardMaterial color={i % 2 ? "#22c55e" : "#38bdf8"} />
        </mesh>
      ))}

      {/* Cardboard boxes near stalls */}
      {[
        [-4.5, 3.2],
        [-3.1, 3.6],
      ].map(([x, z], i) => (
        <mesh key={`box${i}`} position={[x, 0.12, z]} castShadow>
          <boxGeometry args={[0.3, 0.2, 0.25]} />
          <meshStandardMaterial color="#a89968" />
        </mesh>
      ))}

      {/* Roof TV antenna thin rods on civic neighbour */}
      <group position={[1.8, 2.15, -2.4]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[0.15, 0.55, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.4, 0.02, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>

      {/* Chain barrier on one empty lot edge */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`chain${i}`} position={[1.2 - 1.0 + i * 0.5, 0.45, 3.2 + 1.0]}>
          <sphereGeometry args={[0.05, 5, 5]} />
          <meshStandardMaterial color="#78716c" />
        </mesh>
      ))}
    </group>
  );
}


/** Low-poly fauna common in Port Harcourt streets, markets and creekside */
function Goat({ position, rot = 0, scale = 1 }: { position: [number, number, number]; rot?: number; scale?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]} scale={scale}>
      {/* Body */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.55, 0.32, 0.28]} />
        <meshStandardMaterial color="#c4b59a" />
      </mesh>
      {/* Chest darker */}
      <mesh position={[0.18, 0.32, 0]}>
        <boxGeometry args={[0.2, 0.28, 0.26]} />
        <meshStandardMaterial color="#a89968" />
      </mesh>
      {/* Head */}
      <mesh position={[0.32, 0.48, 0]} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.16]} />
        <meshStandardMaterial color="#d4c4a8" />
      </mesh>
      {/* Horns */}
      <mesh position={[0.28, 0.62, -0.06]} rotation={[0.3, 0, -0.4]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 5]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      <mesh position={[0.28, 0.62, 0.06]} rotation={[-0.3, 0, -0.4]}>
        <cylinderGeometry args={[0.02, 0.015, 0.14, 5]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      {/* Ears */}
      <mesh position={[0.28, 0.52, -0.12]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.04]} />
        <meshStandardMaterial color="#b8956a" />
      </mesh>
      <mesh position={[0.28, 0.52, 0.12]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.04]} />
        <meshStandardMaterial color="#b8956a" />
      </mesh>
      {/* Legs */}
      {[[-0.18, -0.08], [-0.18, 0.08], [0.15, -0.08], [0.15, 0.08]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.12, lz]}>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
      ))}
      {/* Tail */}
      <mesh position={[-0.3, 0.4, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.12, 0.06, 0.05]} />
        <meshStandardMaterial color="#a89968" />
      </mesh>
    </group>
  );
}

function Chicken({
  position,
  rot = 0,
  rooster = false,
}: {
  position: [number, number, number];
  rot?: number;
  rooster?: boolean;
}) {
  const body = rooster ? "#c45c26" : "#efe2c8"
  const comb = rooster ? "#dc2626" : "#e11d48"
  return (
    <group position={position} rotation={[0, rot, 0]} scale={rooster ? 1.05 : 0.9}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <mesh position={[0.12, 0.3, 0]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color={body} />
      </mesh>
      {/* Beak */}
      <mesh position={[0.2, 0.28, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.025, 0.08, 5]} />
        <meshStandardMaterial color="#e8a54b" />
      </mesh>
      {/* Comb */}
      <mesh position={[0.1, 0.4, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.03]} />
        <meshStandardMaterial color={comb} />
      </mesh>
      {/* Tail feathers */}
      <mesh position={[-0.12, 0.28, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.1, 0.12, 0.04]} />
        <meshStandardMaterial color={rooster ? "#7c2d12" : "#d4c4a8"} />
      </mesh>
      {/* Legs */}
      <mesh position={[0.02, 0.08, -0.04]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#e8a54b" />
      </mesh>
      <mesh position={[0.02, 0.08, 0.04]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#e8a54b" />
      </mesh>
    </group>
  );
}

function StreetDog({ position, rot = 0 }: { position: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.45, 0.22, 0.22]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
      <mesh position={[0.25, 0.38, 0]} castShadow>
        <boxGeometry args={[0.16, 0.16, 0.14]} />
        <meshStandardMaterial color="#a89968" />
      </mesh>
      {/* Snout */}
      <mesh position={[0.36, 0.34, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>
      {/* Ears floppy */}
      <mesh position={[0.22, 0.48, -0.08]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[0.05, 0.1, 0.04]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>
      <mesh position={[0.22, 0.48, 0.08]} rotation={[-0.3, 0, -0.2]}>
        <boxGeometry args={[0.05, 0.1, 0.04]} />
        <meshStandardMaterial color="#6b5344" />
      </mesh>
      {[[-0.15, -0.07], [-0.15, 0.07], [0.12, -0.07], [0.12, 0.07]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.1, lz]}>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshStandardMaterial color="#5c5346" />
        </mesh>
      ))}
      {/* Tail up-curve suggestion */}
      <mesh position={[-0.26, 0.36, 0]} rotation={[0, 0, 0.8]}>
        <boxGeometry args={[0.14, 0.05, 0.05]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
    </group>
  );
}

function StreetCat({ position, rot = 0 }: { position: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]} scale={0.85}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.32, 0.16, 0.16]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      <mesh position={[0.18, 0.28, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Pointed ears */}
      <mesh position={[0.14, 0.4, -0.05]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      <mesh position={[0.14, 0.4, 0.05]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      {[[-0.1, -0.05], [-0.1, 0.05], [0.08, -0.05], [0.08, 0.05]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.08, lz]}>
          <boxGeometry args={[0.03, 0.14, 0.03]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      ))}
      <mesh position={[-0.2, 0.22, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.16, 0.04, 0.04]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
    </group>
  );
}

function AgamaLizard({ position, rot = 0 }: { position: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]} scale={0.7}>
      {/* Body — male agama orange head vibe */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.22, 0.06, 0.1]} />
        <meshStandardMaterial color="#3d6b3a" />
      </mesh>
      <mesh position={[0.12, 0.08, 0]}>
        <boxGeometry args={[0.1, 0.07, 0.09]} />
        <meshStandardMaterial color="#c45c26" />
      </mesh>
      {/* Long tail */}
      <mesh position={[-0.18, 0.05, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.2, 0.03, 0.04]} />
        <meshStandardMaterial color="#4a7c45" />
      </mesh>
      {/* Tiny legs */}
      {[[0.05, -0.06], [0.05, 0.06], [-0.05, -0.06], [-0.05, 0.06]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.03, lz]}>
          <boxGeometry args={[0.04, 0.02, 0.02]} />
          <meshStandardMaterial color="#2d4a2a" />
        </mesh>
      ))}
    </group>
  );
}

function Bird({
  position,
  rot = 0,
  kind = "pigeon",
}: {
  position: [number, number, number];
  rot?: number;
  kind?: "pigeon" | "egret" | "crow" | "weaver";
}) {
  const colors = {
    pigeon: { body: "#94a3b8", wing: "#64748b", leg: "#e8a54b" },
    egret: { body: "#f8fafc", wing: "#e2e8f0", leg: "#1e293b" },
    crow: { body: "#1f2937", wing: "#111827", leg: "#1f2937" },
    weaver: { body: "#e8a54b", wing: "#c45c26", leg: "#5c5346" },
  }[kind]
  const tall = kind === "egret"
  return (
    <group position={position} rotation={[0, rot, 0]} scale={kind === "egret" ? 1.15 : 0.85}>
      <mesh position={[0, tall ? 0.25 : 0.12, 0]} castShadow>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>
      <mesh position={[0.08, tall ? 0.3 : 0.16, 0]}>
        <sphereGeometry args={[0.045, 5, 5]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>
      <mesh position={[0.14, tall ? 0.28 : 0.14, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.015, 0.06, 4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Wings folded */}
      <mesh position={[-0.02, tall ? 0.25 : 0.12, 0.06]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.1, 0.03, 0.06]} />
        <meshStandardMaterial color={colors.wing} />
      </mesh>
      <mesh position={[-0.02, tall ? 0.25 : 0.12, -0.06]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.1, 0.03, 0.06]} />
        <meshStandardMaterial color={colors.wing} />
      </mesh>
      {tall && (
        <>
          <mesh position={[0.02, 0.1, -0.03]}>
            <boxGeometry args={[0.02, 0.2, 0.02]} />
            <meshStandardMaterial color={colors.leg} />
          </mesh>
          <mesh position={[0.02, 0.1, 0.03]}>
            <boxGeometry args={[0.02, 0.2, 0.02]} />
            <meshStandardMaterial color={colors.leg} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Duck({ position, rot = 0 }: { position: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#5c5346" />
      </mesh>
      <mesh position={[0.12, 0.2, 0]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#3f3a36" />
      </mesh>
      <mesh position={[0.2, 0.18, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.03, 0.08, 5]} />
        <meshStandardMaterial color="#e8a54b" />
      </mesh>
    </group>
  );
}

function AnimatedCreature({
  children,
  position,
  rot = 0,
  mode = "bob",
  phase = 0,
}: {
  children: ReactNode;
  position: [number, number, number];
  rot?: number;
  mode?: "bob" | "peck" | "pace" | "sway";
  phase?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phase;
    const g = ref.current;
    if (!g) return;
    if (mode === "bob") {
      g.position.y = position[1] + Math.sin(t * 2.2) * 0.03;
      g.rotation.y = rot + Math.sin(t * 0.7) * 0.08;
    } else if (mode === "peck") {
      g.position.y = position[1];
      g.rotation.x = Math.sin(t * 4.5) * 0.25;
      g.rotation.y = rot + Math.sin(t * 0.5) * 0.15;
    } else if (mode === "pace") {
      g.position.x = position[0] + Math.sin(t * 0.6) * 0.35;
      g.position.z = position[2] + Math.cos(t * 0.6) * 0.2;
      g.position.y = position[1];
      g.rotation.y = rot + t * 0.3;
    } else if (mode === "sway") {
      g.position.y = position[1];
      g.rotation.z = Math.sin(t * 1.5) * 0.12;
      g.rotation.y = rot;
    }
  });
  return (
    <group ref={ref} position={position} rotation={[0, rot, 0]}>
      {children}
    </group>
  );
}

function PortHarcourtAnimals() {
  return (
    <group>
      <AnimatedCreature position={[1.6, 0, 3.6]} rot={0.8} mode="bob" phase={0.2}>
        <Goat position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[0.9, 0, 3.9]} rot={-0.4} mode="bob" phase={1.1}>
        <Goat position={[0, 0, 0]} scale={0.85} />
      </AnimatedCreature>
      <AnimatedCreature position={[-7.0, 0, 1.4]} rot={2.2} mode="pace" phase={0.5}>
        <Goat position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[8.0, 0, -1.8]} rot={-1.2} mode="bob" phase={2}>
        <Goat position={[0, 0, 0]} scale={0.9} />
      </AnimatedCreature>

      <AnimatedCreature position={[-3.8, 0, 3.3]} rot={0.5} mode="peck" phase={0.3}>
        <Chicken position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[-3.4, 0, 3.5]} rot={-1.0} mode="peck" phase={1.4}>
        <Chicken position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[-2.7, 0, 2.9]} rot={2.0} mode="peck" phase={0.8}>
        <Chicken position={[0, 0, 0]} rooster />
      </AnimatedCreature>
      <AnimatedCreature position={[-4.4, 0, 2.6]} rot={0.2} mode="peck" phase={2.2}>
        <Chicken position={[0, 0, 0]} />
      </AnimatedCreature>

      <AnimatedCreature position={[2.5, 0, 0.9]} rot={-0.6} mode="pace" phase={0.1}>
        <StreetDog position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[-1.0, 0, 5.0]} rot={1.4} mode="bob" phase={0.7}>
        <StreetDog position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[6.0, 0, 3.2]} rot={3.0} mode="pace" phase={1.5}>
        <StreetDog position={[0, 0, 0]} />
      </AnimatedCreature>

      <AnimatedCreature position={[2.0, 1.55, -0.3]} rot={0.3} mode="sway" phase={0.4}>
        <StreetCat position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[-5.1, 0, 1.6]} rot={-0.8} mode="bob" phase={1.8}>
        <StreetCat position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[4.0, 0.08, 3.7]} rot={1.1} mode="sway" phase={0.9}>
        <StreetCat position={[0, 0, 0]} />
      </AnimatedCreature>

      <AnimatedCreature position={[-4.55, 0.5, 1.5]} rot={1.5} mode="sway" phase={0.2}>
        <AgamaLizard position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[6.35, 0.4, 0.35]} rot={-0.5} mode="sway" phase={1.0}>
        <AgamaLizard position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[0.2, 0.15, 0.5]} rot={0.9} mode="bob" phase={0.6}>
        <AgamaLizard position={[0, 0, 0]} />
      </AnimatedCreature>

      <AnimatedCreature position={[-0.5, 0.08, 0.5]} rot={0.4} mode="bob" phase={0.3}>
        <Bird position={[0, 0, 0]} kind="pigeon" />
      </AnimatedCreature>
      <AnimatedCreature position={[0.8, 0.08, 0.0]} rot={-1.2} mode="peck" phase={1.1}>
        <Bird position={[0, 0, 0]} kind="pigeon" />
      </AnimatedCreature>
      <AnimatedCreature position={[-2.5, 3.95, 2.0]} rot={0.2} mode="sway" phase={0.5}>
        <Bird position={[0, 0, 0]} kind="pigeon" />
      </AnimatedCreature>
      <AnimatedCreature position={[2.0, 3.95, 2.2]} rot={1.0} mode="bob" phase={2.0}>
        <Bird position={[0, 0, 0]} kind="pigeon" />
      </AnimatedCreature>

      <AnimatedCreature position={[-1.2, 2.5, 1.5]} rot={-0.5} mode="sway" phase={0.8}>
        <Bird position={[0, 0, 0]} kind="crow" />
      </AnimatedCreature>
      <AnimatedCreature position={[4.2, 2.7, 4.0]} rot={0.7} mode="bob" phase={1.3}>
        <Bird position={[0, 0, 0]} kind="crow" />
      </AnimatedCreature>

      <AnimatedCreature position={[-8.5, 0.15, 4.3]} rot={0.3} mode="peck" phase={0.4}>
        <Bird position={[0, 0, 0]} kind="weaver" />
      </AnimatedCreature>
      <AnimatedCreature position={[9.0, 0.15, -3.8]} rot={-0.9} mode="bob" phase={1.6}>
        <Bird position={[0, 0, 0]} kind="weaver" />
      </AnimatedCreature>

      <AnimatedCreature position={[-6.2, 0.05, -4.0]} rot={0.6} mode="pace" phase={0.2}>
        <Bird position={[0, 0, 0]} kind="egret" />
      </AnimatedCreature>
      <AnimatedCreature position={[-4.8, 0.05, -4.5]} rot={-0.3} mode="bob" phase={1.0}>
        <Bird position={[0, 0, 0]} kind="egret" />
      </AnimatedCreature>
      <AnimatedCreature position={[-5.5, 0.05, -3.5]} rot={1.2} mode="pace" phase={1.7}>
        <Bird position={[0, 0, 0]} kind="egret" />
      </AnimatedCreature>

      <AnimatedCreature position={[-5.0, 0.08, -5.0]} rot={0.5} mode="bob" phase={0.5}>
        <Duck position={[0, 0, 0]} />
      </AnimatedCreature>
      <AnimatedCreature position={[-4.4, 0.08, -5.3]} rot={-0.8} mode="bob" phase={1.2}>
        <Duck position={[0, 0, 0]} />
      </AnimatedCreature>
    </group>
  );
}

function AtmosphereEffects({




  weather,
}: {
  weather: { rainIntensity: number; dustIntensity: number };
}) {
  const rainDrops = useMemo(
    () =>
      Array.from({ length: 100 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 24,
        y: Math.random() * 8 + 2,
        z: (Math.random() - 0.5) * 18,
      })),
    [],
  );

  const dustDust = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 4 + 0.5,
        z: (Math.random() - 0.5) * 16,
      })),
    [],
  );

  const puddles = useMemo(
    () =>
      [
        [1.5, 0.3],
        [-2.0, 4.3],
        [-5.0, -3.0],
        [4.0, 1.5],
        [0.2, -2.5],
      ] as [number, number][],
    [],
  );

  return (
    <>
      {weather.rainIntensity > 0.1 &&
        rainDrops.map((drop) => (
          <mesh key={drop.key} position={[drop.x, drop.y, drop.z]}>
            <boxGeometry args={[0.04, 0.55, 0.04]} />
            <meshStandardMaterial color="#dbeafe" transparent opacity={0.6} />
          </mesh>
        ))}
      {weather.dustIntensity > 0.1 &&
        dustDust.map((dust) => (
          <mesh key={dust.key} position={[dust.x, dust.y, dust.z]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#d6b77a" transparent opacity={0.35} />
          </mesh>
        ))}
      {weather.rainIntensity > 0.1 &&
        puddles.map(([x, z], i) => (
          <mesh key={`puddle${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.35 + (i % 3) * 0.1, 10]} />
            <meshStandardMaterial color="#1e3a5f" transparent opacity={0.45} />
          </mesh>
        ))}
    </>
  );
}

function SimpleVehicle({
  position,
  color,
  kind,
}: {
  position: [number, number, number];
  color: string;
  kind: "okada" | "taxi" | "ferry";
}) {
  if (kind === "okada") {
    return (
      <group position={position} scale={0.85}>
        {/* Body */}
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0.05]} castShadow>
          <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Seat */}
        <mesh position={[-0.05, 0.48, 0]}>
          <boxGeometry args={[0.35, 0.08, 0.2]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* Wheels */}
        <mesh position={[0.28, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.16, 0.04, 6, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[-0.28, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.16, 0.04, 6, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {/* Handlebar */}
        <mesh position={[0.25, 0.55, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.35]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
    );
  }
  if (kind === "ferry") {
    return (
      <group position={position} scale={1.2}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[1.6, 0.25, 0.7]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Hull taper via angled side planes is heavy; use cylinder hull approx */}
        <mesh position={[0, 0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.35, 1.5, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.6, 0.3, 0.5]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      </group>
    );
  }
  // taxi / car — rounded body
  return (
    <group position={position} scale={1.0}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.55, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.25, 4, 8]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.85} />
      </mesh>
      {[[0.28, 0.18, 0.28], [0.28, 0.18, -0.28], [-0.28, 0.18, 0.28], [-0.28, 0.18, -0.28]].map(
        ([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.12, 0.04, 5, 10]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ),
      )}
    </group>
  );
}


function PlayerAvatar({ transport }: { transport: TransportId }) {
  const color =
    transport === "okada"
      ? "#f97316"
      : transport === "taxi"
        ? "#eab308"
        : transport === "ferry"
          ? "#0ea5e9"
          : "#f8fafc";
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.55, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
    </group>
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


const ROAD_PATHS: [number, number][][] = [
  // Main east-west
  [
    [-10, 0.2],
    [-5, 0.2],
    [0, 0.2],
    [5, 0.2],
    [10, 0.2],
  ],
  // North market loop
  [
    [-5, 4.6],
    [-2, 4.6],
    [0, 4.6],
    [2, 4.6],
    [5, 4.6],
    [5, 2],
    [2, 0.2],
  ],
  // South civic
  [
    [8, -2.8],
    [4, -2.8],
    [0, -2.8],
    [-3, -2.8],
    [-5, -1.5],
    [-5.5, -3.5],
  ],
];

function TrafficFlow() {
  const vehicles = useMemo(
    () => [
      { path: 0, speed: 0.12, t0: 0, color: "#eab308", kind: "taxi" as const },
      { path: 0, speed: 0.18, t0: 0.45, color: "#f97316", kind: "okada" as const },
      { path: 1, speed: 0.14, t0: 0.2, color: "#dc2626", kind: "taxi" as const },
      { path: 1, speed: 0.2, t0: 0.7, color: "#ea580c", kind: "okada" as const },
      { path: 2, speed: 0.1, t0: 0.15, color: "#ca8a04", kind: "taxi" as const },
      { path: 2, speed: 0.16, t0: 0.6, color: "#fb923c", kind: "okada" as const },
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
      const [x0, z0] = pts[i0];
      const [x1, z1] = pts[i1];
      const x = x0 + (x1 - x0) * local;
      const z = z0 + (z1 - z0) * local;
      g.position.set(x, 0, z);
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

function Interactable({
  position,
  radius = 0.9,
  label,
  onInteract,
}: {
  position: [number, number, number];
  radius?: number;
  label: string;
  onInteract?: (label: string) => void;
}) {
  return (
    <mesh
      position={[position[0], 0.6, position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onInteract?.(label);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[radius, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

function CityHotspots({ onInteract }: { onInteract?: (label: string) => void }) {
  return (
    <group>
      <Interactable position={[-3, 0, 2.5]} radius={1.4} label="Town Market" onInteract={onInteract} />
      <Interactable position={[0, 0, -1.5]} radius={1.3} label="Civic Centre" onInteract={onInteract} />
      <Interactable position={[-5.5, 0, -3.5]} radius={1.3} label="Creekside" onInteract={onInteract} />
      <Interactable position={[5.5, 0, 2.5]} radius={1.4} label="The Port" onInteract={onInteract} />
      <Interactable position={[-3.5, 0, 3.2]} radius={0.7} label="Market stall row" onInteract={onInteract} />
      <Interactable position={[-4.7, 0, 3.5]} radius={0.5} label="Suya grill" onInteract={onInteract} />
      <Interactable position={[1.2, 0, -0.9]} radius={0.6} label="Bus shelter" onInteract={onInteract} />
      <Interactable position={[6.5, 0, 2.8]} radius={0.8} label="Port crane yard" onInteract={onInteract} />
      <Interactable position={[1.2, 0, 3.2]} radius={0.7} label="Housing development lot" onInteract={onInteract} />
    </group>
  );
}

function PlayerController({
  onDistrictChange,
}: {
  onDistrictChange?: (id: string | null) => void;
}) {
  const keys = useRef<Record<string, boolean>>({});
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const mode = useRoamStore((s) => s.mode);
  const transport = useRoamStore((s) => s.transport);
  const setPosition = useRoamStore((s) => s.setPosition);
  const setFacing = useRoamStore((s) => s.setFacing);
  const setNearDistrict = useRoamStore((s) => s.setNearDistrict);
  const position = useRoamStore((s) => s.position);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    if (mode === "orbit" || !group.current) return;

    const speed = TRANSPORT_SPEED[transport];
    let dx = 0;
    let dz = 0;
    if (keys.current["w"] || keys.current["arrowup"]) dz -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) dz += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) dx -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz) || 1;
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;
      const nextX = THREE.MathUtils.clamp(group.current.position.x + dx, BOUNDS.minX, BOUNDS.maxX);
      const nextZ = THREE.MathUtils.clamp(group.current.position.z + dz, BOUNDS.minZ, BOUNDS.maxZ);
      group.current.position.x = nextX;
      group.current.position.z = nextZ;
      const yaw = Math.atan2(dx, dz);
      group.current.rotation.y = yaw;
      setPosition([nextX, 0.6, nextZ]);
      setFacing(yaw);

      const near = nearestDistrict(nextX, nextZ);
      setNearDistrict(near);
      onDistrictChange?.(near);
    }

    const target = group.current.position;
    const camOffset = new THREE.Vector3(0, 6.5, 9);
    const desired = target.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    camera.lookAt(target.x, target.y + 1.2, target.z);
  });

  useEffect(() => {
    if (group.current && mode !== "orbit") {
      group.current.position.set(position[0], position[1], position[2]);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "orbit") return null;

  return (
    <group ref={group} position={position}>
      <PlayerAvatar transport={transport} />
    </group>
  );
}


function LivingAmbience() {
  const lampRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    lampRefs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && "emissiveIntensity" in mat) {
        mat.emissiveIntensity = 0.25 + Math.sin(t * 2 + i) * 0.12;
      }
    });
  });
  // Soft pulse markers already in scene via materials; this is a no-op host for future
  return null;
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

  return (
    <Canvas
      shadows
      camera={{ position: [0, 9, 13], fov: 42 }}
      style={{ width: "100%", height: "100%", background: weather.groundColor }}
      tabIndex={0}
    >
      <CityGround weather={weather} />
      <RoadNetwork />
      <DrainageChannel />
      <StreetFurniture />

      <group>
        <Waterfront active={weather.id === "rainy"} />
        <PortInfrastructure />
        <Sidewalks />
        <MarketStalls />
        <PowerPoles />
        <DebrisAndProps />
        <StreetLife />
        <MicroDetails />
        <PortHarcourtAnimals />

        {Object.entries(DISTRICT_LAYOUT).map(([districtId, info]) => (
          <DistrictHub
            key={districtId}
            position={[info.x, 0, info.z] as [number, number, number]}
            color={info.color}
            active={selectedDistrict === districtId}
            near={nearDistrictId === districtId}
            label={info.label}
          />
        ))}

        {CITY_BLOCKS.map((spec, i) => (
          <CityBlock key={i} spec={spec} />
        ))}

        {DEV_LOTS.map((lot, i) => (
          <DevelopmentLot key={i} x={lot.x} z={lot.z} w={lot.w} d={lot.d} />
        ))}

        {BUILD_SITES.map((site, i) => (
          <ConstructionSite key={i} x={site.x} z={site.z} phase={site.phase} />
        ))}

        <Billboard x={1.5} z={4.0} rot={-0.3} />
        <Billboard x={-6.8} z={1.8} rot={0.5} />
        <Billboard x={8.0} z={-0.2} rot={-1.0} />
        <Billboard x={3.2} z={-4.5} rot={0.2} />

        {/* Ferry stays at creek — road traffic is path-driven */}
        <SimpleVehicle position={[-6.0, 0.05, -4.6]} color="#0ea5e9" kind="ferry" />
        <TrafficFlow />
        <CityHotspots onInteract={onInteract} />
      </group>

      <AtmosphereEffects weather={weather} />
      <LivingAmbience />
      <PlayerController onDistrictChange={onNearDistrict} />

      {mode === "orbit" && (
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={8}
          maxDistance={22}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 1.2, 0]}
        />
      )}
    </Canvas>
  );
}

export default AfroMetaverseScene;
