import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  DISTRICT_WORLD,
  TRANSPORT_SPEED,
  useRoamStore,
  type TransportId,
} from "@/stores/roamStore";

const DISTRICT_LAYOUT = {
  "town-market": { x: -3, z: 2.5, color: "#f59e0b", label: "Town Market" },
  "civic-centre": { x: 0, z: -1.5, color: "#34d399", label: "Civic Centre" },
  creekside: { x: -5.5, z: -3.5, color: "#60a5fa", label: "Creekside" },
  port: { x: 5.5, z: 2.5, color: "#f97316", label: "The Port" },
} as const;

const BOUNDS = { minX: -11, maxX: 11, minZ: -8, maxZ: 9 };

function CityGround({
  weather,
}: {
  weather: { groundColor: string; fogColor: string; lightingMultiplier: number };
}) {
  return (
    <>
      <ambientLight intensity={0.45 * weather.lightingMultiplier} />
      <directionalLight
        position={[8, 12, 7]}
        intensity={1.2 * weather.lightingMultiplier}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={weather.groundColor} />
      </mesh>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 0.9]} />
        <meshStandardMaterial color="#f8fafc" opacity={0.7} transparent />
      </mesh>

      <mesh position={[-2.2, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 0.7]} />
        <meshStandardMaterial color="#f8fafc" opacity={0.7} transparent />
      </mesh>

      <mesh position={[4.5, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 0.7]} />
        <meshStandardMaterial color="#f8fafc" opacity={0.7} transparent />
      </mesh>
    </>
  );
}

function DistrictBuilding({
  position,
  color,
  active,
  near,
}: {
  position: [number, number, number];
  color: string;
  active: boolean;
  near: boolean;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
        <boxGeometry args={[2.1, 2.4, 2.1]} />
        <meshStandardMaterial
          color={active || near ? "#fef3c7" : color}
          emissive={active || near ? color : "#000000"}
          emissiveIntensity={active || near ? 0.4 : 0.08}
        />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[1.3, 0.6, 1.3]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {near && (
        <mesh position={[0, 3.5, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Waterfront({ active }: { active: boolean }) {
  return (
    <group position={[-5.5, 0.1, -4.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 3.5]} />
        <meshStandardMaterial
          color={active ? "#0ea5e9" : "#1d4ed8"}
          transparent
          opacity={active ? 0.9 : 0.7}
        />
      </mesh>
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
      Array.from({ length: 120 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 8 + 2,
        z: (Math.random() - 0.5) * 16,
      })),
    [],
  );

  const dustDust = useMemo(
    () =>
      Array.from({ length: 40 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 18,
        y: Math.random() * 4 + 0.5,
        z: (Math.random() - 0.5) * 14,
      })),
    [],
  );

  return (
    <>
      {weather.rainIntensity > 0.1 &&
        rainDrops.map((drop) => (
          <mesh key={drop.key} position={[drop.x, drop.y, drop.z]}>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
            <meshStandardMaterial color="#dbeafe" transparent opacity={0.65} />
          </mesh>
        ))}

      {weather.dustIntensity > 0.1 &&
        dustDust.map((dust) => (
          <mesh key={dust.key} position={[dust.x, dust.y, dust.z]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#d6b77a" transparent opacity={0.4} />
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
  const scale = kind === "ferry" ? 1.4 : kind === "taxi" ? 1.1 : 0.75;
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[1.2, 0.45, 0.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.7, 0.35, 0.65]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}

function PlayerAvatar({ transport }: { transport: TransportId }) {
  const color =
    transport === "okada" ? "#f97316" : transport === "taxi" ? "#eab308" : transport === "ferry" ? "#0ea5e9" : "#f8fafc";
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.55, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
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

    // Follow camera — GTA-lite third person
    const target = group.current.position;
    const camOffset = new THREE.Vector3(0, 6.5, 9);
    const desired = target.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    camera.lookAt(target.x, target.y + 1.2, target.z);
  });

  // Sync external position when switching into walk mode
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

export function AfroMetaverseScene({
  weather,
  selectedDistrict,
  onNearDistrict,
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
}) {
  const mode = useRoamStore((s) => s.mode);
  const nearDistrictId = useRoamStore((s) => s.nearDistrictId);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 12], fov: 42 }}
      style={{ width: "100%", height: "100%", background: weather.groundColor }}
      tabIndex={0}
    >
      <CityGround weather={weather} />

      <group>
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 18]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.18} />
        </mesh>

        <Waterfront active={weather.id === "rainy"} />

        {Object.entries(DISTRICT_LAYOUT).map(([districtId, info]) => (
          <DistrictBuilding
            key={districtId}
            position={[info.x, 0, info.z] as [number, number, number]}
            color={info.color}
            active={selectedDistrict === districtId}
            near={nearDistrictId === districtId}
          />
        ))}

        {/* Roads */}
        <mesh position={[0, 0.05, 4.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[8, 1.6]} />
          <meshStandardMaterial color="#f8fafc" opacity={0.4} transparent />
        </mesh>
        <mesh position={[0, 0.05, -2.7]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 1.2]} />
          <meshStandardMaterial color="#f8fafc" opacity={0.35} transparent />
        </mesh>

        {/* Parked transport flavor */}
        <SimpleVehicle position={[-1.5, 0, 5.2]} color="#f97316" kind="okada" />
        <SimpleVehicle position={[2.2, 0, 5]} color="#eab308" kind="taxi" />
        <SimpleVehicle position={[-6.2, 0.05, -5.2]} color="#0ea5e9" kind="ferry" />
      </group>

      <AtmosphereEffects weather={weather} />
      <PlayerController onDistrictChange={onNearDistrict} />

      {mode === "orbit" && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1.2, 0]}
        />
      )}
    </Canvas>
  );
}

export default AfroMetaverseScene;
