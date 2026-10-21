import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import {
  useCharacterStore,
  type CharacterAppearance,
  type EquippedLoadout,
} from "@/stores/characterStore";
import { StylizedCharacter } from "./StylizedCharacter";

type Props = {
  appearance?: CharacterAppearance;
  equipped?: EquippedLoadout;
  height?: number;
};

/**
 * Studio turntable — 360° + zoom with fashion-lighting.
 */
export function CharacterPreview({ appearance, equipped, height = 340 }: Props) {
  const storeAppearance = useCharacterStore((s) => s.appearance);
  const storeEquipped = useCharacterStore((s) => s.equipped);
  const a = appearance ?? storeAppearance;
  const e = equipped ?? storeEquipped;

  return (
    <div className="am-char-preview" style={{ height }}>
      <Canvas
        shadows
        camera={{ position: [0, 1.35, 3.1], fov: 32 }}
        gl={{ antialias: true, toneMappingExposure: 1.28 }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", borderRadius: 16 }}
      >
        <color attach="background" args={["#14101c"]} />
        <fog attach="fog" args={["#14101c", 6, 14]} />

        {/* Studio triple light */}
        <ambientLight intensity={0.42} />
        <hemisphereLight args={["#f5e6d3", "#1a1025", 0.45]} />
        <directionalLight
          position={[3.5, 5.5, 2.5]}
          intensity={1.55}
          color="#fff5eb"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 2.5, -1.5]} intensity={0.55} color="#c4b5fd" />
        <pointLight position={[0, 2.2, 2.2]} intensity={0.55} color="#fbbf24" distance={8} />
        <pointLight position={[1.5, 1.2, -2]} intensity={0.35} color="#22d3ee" distance={7} />
        {/* Rim */}
        <spotLight
          position={[0, 3, -3]}
          intensity={0.8}
          angle={0.5}
          penumbra={0.6}
          color="#e879f9"
        />

        <Suspense fallback={null}>
          <group position={[0, -0.02, 0]}>
            <StylizedCharacter appearance={a} equipped={e} scale={1.2} animate detail />
          </group>
          <ContactShadows
            position={[0, 0.001, 0]}
            opacity={0.55}
            scale={5}
            blur={2.8}
            far={3}
          />
          {/* Floor disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
            <circleGeometry args={[1.4, 48]} />
            <meshStandardMaterial color="#1e1830" roughness={0.85} metalness={0.1} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <ringGeometry args={[1.35, 1.42, 48]} />
            <meshStandardMaterial
              color="#a78bfa"
              emissive="#7c3aed"
              emissiveIntensity={0.35}
            />
          </mesh>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={1.35}
          maxDistance={5.5}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 1.8}
          target={[0, 1.05, 0]}
          rotateSpeed={0.9}
          zoomSpeed={0.95}
        />
      </Canvas>
      <div className="am-char-preview-hint">Drag 360° · scroll zoom · max detail mesh</div>
    </div>
  );
}

export default CharacterPreview;
