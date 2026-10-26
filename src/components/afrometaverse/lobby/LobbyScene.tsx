import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Suspense } from "react";
import { useCharacterStore } from "@/stores/characterStore";
import { FighterGLB } from "@/components/afrometaverse/characters/FighterGLB";
import { LOBBY_PALETTE as P } from "./lobbyPalette";

/** Cinematic night village: torch glow, warm embers, haze, red moon, fighter in the centre. */

function Hut({ x, z, s = 1, rot = 0 }: { x: number; z: number; s?: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} scale={s}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.25, 1.8, 14]} />
        <meshStandardMaterial color={P.hutWall} roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow>
        <coneGeometry args={[1.5, 1.2, 14]} />
        <meshStandardMaterial color={P.thatch} roughness={1} />
      </mesh>
      {/* warm doorway glow */}
      <mesh position={[0, 0.55, 1.22]}>
        <planeGeometry args={[0.42, 0.7]} />
        <meshStandardMaterial color={P.window} emissive={P.window} emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Torch({ x, z, phase }: { x: number; z: number; phase: number }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime + phase;
    light.current.intensity = 2.4 + Math.sin(t * 7.1) * 0.35 + Math.sin(t * 13.3) * 0.18;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.8, 8]} />
        <meshStandardMaterial color="#3a2616" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color={P.torch} emissive={P.ember} emissiveIntensity={2.4} />
      </mesh>
      <pointLight ref={light} position={[0, 1.95, 0]} color={P.torch} distance={9} decay={1.6} />
    </group>
  );
}

/** Slow drifting haze bank, reads as mist between the huts. */
function HazeBank({ y, z, opacity }: { y: number; z: number; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = Math.sin(clock.elapsedTime * 0.05) * 1.5;
  });
  return (
    <mesh ref={ref} position={[0, y, z]} rotation={[-0.1, 0, 0]}>
      <planeGeometry args={[26, 3.2]} />
      <meshBasicMaterial color={P.haze} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function Scene() {
  const appearance = useCharacterStore((s) => s.appearance);
  const moon = useMemo(() => new THREE.Color(P.moon), []);
  return (
    <>
      <color attach="background" args={[P.sky]} />
      <fog attach="fog" args={[P.sky, 18, 55]} />
      <ambientLight intensity={0.7} color="#ffd0a0" />
      <hemisphereLight args={["#3b2a4a", "#1a1008", 0.3]} />
      {/* red moon behind the village */}
      <mesh position={[-6, 9, -22]}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color={moon} fog={false} />
      </mesh>
      {/* golden-hour key sits behind and above the fighter: warm rim edge separates the silhouette from the huts */}
      <directionalLight position={[-2.5, 3.5, -3.5]} intensity={6} color={P.rim} />
      <directionalLight position={[2.5, 2.5, -4]} intensity={3.2} color="#ffb070" />
      <directionalLight position={[3, 4, 2]} intensity={1.6} color={P.rim} castShadow shadow-mapSize={[1024, 1024]} />
      {/* soft front fill so the face and cloth stay readable */}
      <directionalLight position={[0.6, 1.2, 3]} intensity={0.55} color="#ffe2bd" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={P.ground} roughness={0.98} />
      </mesh>

      <Hut x={-3.4} z={-3.2} s={1.15} rot={0.4} />
      <Hut x={3.6} z={-3.8} s={1.3} rot={-0.3} />
      <Hut x={-6.5} z={-6.5} s={1.0} rot={0.8} />
      <Hut x={6.8} z={-7} s={1.1} rot={-0.6} />
      <Hut x={0.2} z={-8.5} s={1.4} rot={0} />

      <Torch x={-1.8} z={0.6} phase={0} />
      <Torch x={1.9} z={0.4} phase={1.7} />
      <Torch x={-4.8} z={-1.2} phase={3.1} />
      <Torch x={5.1} z={-1.6} phase={4.4} />

      {/* warm embers rising from the torches */}
      <Sparkles count={70} scale={[9, 4.5, 9]} size={5} speed={0.35} color={P.ember} opacity={0.85} position={[0, 1.6, -1]} />
      <Sparkles count={30} scale={[6, 3, 6]} size={3} speed={0.2} color={P.torch} opacity={0.5} position={[0, 1, 0]} />

      <HazeBank y={0.7} z={-5} opacity={0.22} />
      <HazeBank y={1.4} z={-10} opacity={0.18} />

      {/* fighter, centred, full body, standing in idle */}
      <group position={[0, 0, 0]}>
        <Suspense fallback={null}>
          <FighterGLB appearance={appearance} tier="warrior" scale={1} animate moveState="idle" detail />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={3} blur={2.4} far={2} />
      </group>
    </>
  );
}

/** Camera rig: 'full' frames the whole body, 'close' frames the head and shoulders for checks. */
export function LobbyScene({ shot = "full" }: { shot?: "full" | "close" }) {
  // hero framing: camera low and close so the fighter reads big; full body fills most of the height
  const cam = shot === "close" ? { pos: [0, 1.42, 1.5] as const, target: [0, 1.42, 0] as const, fov: 28 } : { pos: [0, 0.92, 3.5] as const, target: [0, 0.86, 0] as const, fov: 32 };
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: cam.pos as unknown as [number, number, number], fov: cam.fov }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ camera }) => camera.lookAt(...cam.target)}
    >
      <Scene />
      <CameraLook target={cam.target} />
    </Canvas>
  );
}

function CameraLook({ target }: { target: readonly [number, number, number] }) {
  useFrame(({ camera }) => camera.lookAt(target[0], target[1], target[2]));
  return null;
}

export default LobbyScene;
