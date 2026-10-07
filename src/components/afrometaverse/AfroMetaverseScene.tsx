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

const DISTRICT_LAYOUT = {
  "town-market": { x: -3, z: 2.5, color: "#f59e0b", label: "Town Market", neon: "#fbbf24" },
  "civic-centre": { x: 0, z: -1.5, color: "#14b8a6", label: "Civic Centre", neon: "#2dd4bf" },
  creekside: { x: -5.5, z: -3.5, color: "#3b82f6", label: "Creekside", neon: "#60a5fa" },
  port: { x: 5.5, z: 2.5, color: "#f97316", label: "The Port", neon: "#fb923c" },
} as const;

const BOUNDS = { minX: -14, maxX: 14, minZ: -11, maxZ: 12 };

/** Neon night palette — cyber-Afro densification */
const N = {
  asphalt: "#1a1a22",
  asphaltLine: "#a78bfa",
  sidewalk: "#2a2a35",
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

function NightSky() {
  return (
    <>
      <color attach="background" args={["#0b0618"]} />
      <fog attach="fog" args={["#1a0a2e", 18, 42]} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#4c1d95", "#0f172a", 0.35]} />
      <directionalLight position={[6, 14, 4]} intensity={0.35} color="#c4b5fd" castShadow />
      <pointLight position={[-3, 3, 2.5]} intensity={1.2} color={N.neonAmber} distance={12} />
      <pointLight position={[5.5, 4, 2.5]} intensity={1.0} color={N.neonOrange} distance={14} />
      <pointLight position={[0, 5, -1.5]} intensity={0.9} color={N.neonCyan} distance={12} />
      <pointLight position={[-5.5, 3, -3.5]} intensity={0.8} color={N.neonPurple} distance={10} />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#e879f9" distance={20} />
    </>
  );
}

function NeonGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0d0d14" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[28, 24]} />
        <meshStandardMaterial color={N.asphalt} />
      </mesh>
    </>
  );
}

function NeonRoads() {
  const segs = [
    { x: 0, z: 0.2, w: 26, d: 1.3 },
    { x: 0, z: 4.8, w: 18, d: 1.0 },
    { x: 0, z: -2.8, w: 20, d: 1.0 },
    { x: -3.2, z: 1.0, w: 1.0, d: 14 },
    { x: 2.8, z: 0.5, w: 1.0, d: 13 },
    { x: 5.5, z: 1.5, w: 0.95, d: 10 },
    { x: -5.5, z: -1.2, w: 0.9, d: 11 },
  ];
  return (
    <group>
      {segs.map((r, i) => (
        <group key={i}>
          <mesh position={[r.x, 0.03, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[r.w, r.d]} />
            <meshStandardMaterial color={N.asphalt} />
          </mesh>
          <mesh position={[r.x, 0.04, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[r.w * 0.92, 0.04]} />
            <meshStandardMaterial
              color={N.asphaltLine}
              emissive={N.asphaltLine}
              emissiveIntensity={0.55}
            />
          </mesh>
        </group>
      ))}
      {/* Elevated ring road */}
      <mesh position={[0, 3.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.5, 8.2, 48]} />
        <meshStandardMaterial color="#1e1b2e" emissive="#7c3aed" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 2.9, 8]} castShadow>
        <boxGeometry args={[0.35, 2.9, 0.35]} />
        <meshStandardMaterial color="#2a2a35" />
      </mesh>
      <mesh position={[0, 2.9, -8]} castShadow>
        <boxGeometry args={[0.35, 2.9, 0.35]} />
        <meshStandardMaterial color="#2a2a35" />
      </mesh>
      <mesh position={[8, 2.9, 0]} castShadow>
        <boxGeometry args={[0.35, 2.9, 0.35]} />
        <meshStandardMaterial color="#2a2a35" />
      </mesh>
      <mesh position={[-8, 2.9, 0]} castShadow>
        <boxGeometry args={[0.35, 2.9, 0.35]} />
        <meshStandardMaterial color="#2a2a35" />
      </mesh>
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

function NeonWater() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.04 + Math.sin(clock.getElapsedTime() * 0.9) * 0.02;
    }
  });
  return (
    <group position={[-5.5, 0, -5.4]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.5, 28]} />
        <meshStandardMaterial
          color={N.water}
          emissive="#0369a1"
          emissiveIntensity={0.25}
          transparent
          opacity={0.85}
          roughness={0.2}
          metalness={0.3}
        />
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
              : "#f8fafc";
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.55, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <pointLight position={[0, 1.4, 0]} intensity={0.4} color="#fef08a" distance={4} />
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
  const mountedVehicleId = useRoamStore((s) => s.mountedVehicleId);
  const setPosition = useRoamStore((s) => s.setPosition);
  const setFacing = useRoamStore((s) => s.setFacing);
  const setNearDistrict = useRoamStore((s) => s.setNearDistrict);
  const setNearVehicle = useRoamStore((s) => s.setNearVehicle);
  const setInSafehouse = useRoamStore((s) => s.setInSafehouse);
  const updateMountedVehiclePose = useRoamStore((s) => s.updateMountedVehiclePose);
  const coolHeat = useRoamStore((s) => s.coolHeat);
  const worldVehicles = useRoamStore((s) => s.worldVehicles);
  const position = useRoamStore((s) => s.position);
  const heatTick = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "f" || e.key === "e") {
        const st = useRoamStore.getState();
        if (st.mountedVehicleId) st.exitVehicle();
        else st.enterNearestVehicle();
      }
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
    const speed = TRANSPORT_SPEED[transport] ?? 4;
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
      let nextX = THREE.MathUtils.clamp(group.current.position.x + dx, BOUNDS.minX, BOUNDS.maxX);
      let nextZ = THREE.MathUtils.clamp(group.current.position.z + dz, BOUNDS.minZ, BOUNDS.maxZ);
      if (transport === "ferry") {
        nextZ = THREE.MathUtils.clamp(nextZ, -9, -2.5);
        nextX = THREE.MathUtils.clamp(nextX, -11, -2);
      }
      group.current.position.x = nextX;
      group.current.position.z = nextZ;
      const yaw = Math.atan2(dx, dz);
      group.current.rotation.y = yaw;
      setPosition([nextX, 0.6, nextZ]);
      setFacing(yaw);
      if (mountedVehicleId) updateMountedVehiclePose([nextX, 0, nextZ], yaw);
      const near = nearestDistrict(nextX, nextZ);
      setNearDistrict(near);
      onDistrictChange?.(near);
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
    const target = group.current.position;
    const camOffset = new THREE.Vector3(0, mountedVehicleId ? 7.5 : 6.8, mountedVehicleId ? 11 : 9.5);
    camera.position.lerp(target.clone().add(camOffset), 1 - Math.pow(0.001, dt));
    camera.lookAt(target.x, target.y + 1.3, target.z);
  });

  useEffect(() => {
    if (group.current && mode !== "orbit") {
      group.current.position.set(position[0], position[1], position[2]);
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
  const npcs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        x: (i % 6) * 2.2 - 5,
        z: Math.floor(i / 6) * 3 - 1,
        phase: i * 0.7,
        color: [N.neonPink, N.neonCyan, N.neonLime, N.neonAmber, N.neonPurple, N.neonOrange][i % 6],
      })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    npcs.forEach((n, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x = n.x + Math.sin(t * 0.45 + n.phase) * 1.1;
      g.position.z = n.z + Math.cos(t * 0.4 + n.phase) * 0.7;
      g.rotation.y = t * 0.3 + n.phase;
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
        >
          <mesh position={[0, 0.45, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.32, 4, 8]} />
            <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
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
  void weather; // night cyber look is intentional regardless of day weather UI

  return (
    <Canvas
      shadows
      camera={{ position: [0, 11, 16], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "#0b0618" }}
      tabIndex={0}
    >
      <NightSky />
      <NeonGround />
      <NeonRoads />
      <StreetLampsNeon />
      <NeonWater />
      <PortNeon />
      <MarketNeonLane />

      {TOWERS.map((spec, i) => (
        <NeonTower key={i} spec={{ ...spec, neon: spec.neon || N.neonCyan }} />
      ))}

      {Object.entries(DISTRICT_LAYOUT).map(([id, info]) => (
        <DistrictHubNeon
          key={id}
          position={[info.x, 0, info.z]}
          color={info.color}
          neon={info.neon}
          active={selectedDistrict === id}
          near={nearDistrictId === id}
          label={info.label}
        />
      ))}

      <NeonSign x={-4.2} y={3.2} z={4.9} w={1.4} h={0.4} color={N.neonPink} />
      <NeonSign x={2.8} y={6.5} z={-0.2} w={1.2} h={0.35} color={N.neonCyan} rot={0.3} />
      <NeonSign x={7.2} y={4.0} z={1.0} w={1.5} h={0.4} color={N.neonOrange} rot={-0.4} />
      <NeonSign x={-6.5} y={3.5} z={-2.5} w={1.1} h={0.3} color={N.neonPurple} rot={0.6} />

      <TrafficFlow />
      <ParkedVehicles />
      <NpcCrowd />
      <WantedPatrols />
      <CityHotspots onInteract={onInteract} />
      <PlayerController onDistrictChange={onNearDistrict} />

      {mode === "orbit" && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={10}
          maxDistance={28}
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 2, 0]}
        />
      )}
    </Canvas>
  );
}

export default AfroMetaverseScene;
