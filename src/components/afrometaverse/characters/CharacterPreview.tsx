import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
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
  /** Taller preview in character editor */
  height?: number;
};

/**
 * 360° turntable + zoom so players can inspect clothing micro-detail.
 * Drag to orbit · scroll / pinch to zoom · right-drag or two-finger to pan slightly.
 */
export function CharacterPreview({ appearance, equipped, height = 320 }: Props) {
  const storeAppearance = useCharacterStore((s) => s.appearance);
  const storeEquipped = useCharacterStore((s) => s.equipped);
  const a = appearance ?? storeAppearance;
  const e = equipped ?? storeEquipped;

  return (
    <div className="am-char-preview" style={{ height }}>
      <Canvas
        camera={{ position: [0, 1.2, 2.8], fov: 35 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", borderRadius: 16 }}
      >
        <color attach="background" args={["#1a1520"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 2]} intensity={1.1} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#c4b5fd" />
        <pointLight position={[0, 2, 1.5]} intensity={0.4} color="#fbbf24" />

        <Suspense fallback={null}>
          <group position={[0, -0.05, 0]}>
            <StylizedCharacter appearance={a} equipped={e} scale={1.15} animate detail />
          </group>
          <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={4} blur={2.5} far={2} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={1.2}
          maxDistance={5}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 1.85}
          target={[0, 1.0, 0]}
          rotateSpeed={0.85}
          zoomSpeed={0.9}
        />
      </Canvas>
      <div className="am-char-preview-hint">Drag 360° · scroll zoom · inspect every detail</div>
    </div>
  );
}

export default CharacterPreview;
