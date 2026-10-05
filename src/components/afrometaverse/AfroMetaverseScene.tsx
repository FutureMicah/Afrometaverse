import { Canvas, type ThreeElements } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";

const DISTRICT_LAYOUT = {
  "town-market": { x: -3, z: 2.5, color: "#f59e0b", label: "Town Market" },
  "civic-centre": { x: 0, z: -1.5, color: "#34d399", label: "Civic Centre" },
  creekside: { x: -5.5, z: -3.5, color: "#60a5fa", label: "Creekside" },
  port: { x: 5.5, z: 2.5, color: "#f97316", label: "The Port" },
} as const;

function CityGround({ weather }: { weather: { groundColor: string; fogColor: string; lightingMultiplier: number } }) {
  return (
    <>
      <color attach="background" args={[weather.groundColor]} />
      <fog attach="fog" args={[weather.fogColor, 12, 32]} />
      <ambientLight intensity={0.7 * weather.lightingMultiplier} />
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
}: {
  position: [number, number, number];
  color: string;
  active: boolean;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
        <boxGeometry args={[2.1, 2.4, 2.1]} />
        <meshStandardMaterial
          color={active ? "#fef3c7" : color}
          emissive={active ? color : "#000000"}
          emissiveIntensity={active ? 0.35 : 0.08}
        />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[1.3, 0.6, 1.3]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
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

function AtmosphereEffects({ weather }: { weather: { rainIntensity: number; dustIntensity: number } }) {
  const rainDrops = useMemo(
    () =>
      Array.from({ length: 120 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 8 + 2,
        z: (Math.random() - 0.5) * 16,
        speed: 0.5 + Math.random() * 2,
      })),
    [],
  );

  const dustDust = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        key: index,
        x: (Math.random() - 0.5) * 18,
        y: Math.random() * 4 + 1,
        z: (Math.random() - 0.5) * 18,
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

export function AfroMetaverseScene({
  weather,
  selectedDistrict,
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
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 12], fov: 42 }}
      style={{ width: "100%", height: "100%", background: weather.groundColor }}
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
          />
        ))}

        <mesh position={[0, 0.05, 4.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[8, 1.6]} />
          <meshStandardMaterial color="#f8fafc" opacity={0.4} transparent />
        </mesh>

        <mesh position={[0, 0.05, -2.7]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 1.2]} />
          <meshStandardMaterial color="#f8fafc" opacity={0.35} transparent />
        </mesh>
      </group>

      <AtmosphereEffects weather={weather} />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 1.2, 0]}
      />
    </Canvas>
  );
}

export default AfroMetaverseScene;
