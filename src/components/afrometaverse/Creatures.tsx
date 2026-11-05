/**
 * Living creatures for the large world — multi-part anatomy, physical materials,
 * and smooth idle motion. Designed to read as animals at a glance, not primitives.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { qualityBudget } from "@/lib/qualityBudget";
import * as THREE from "three";
import { sampleHeight } from "@/lib/worldGen";

function farFromCamera(cam: { position: { x: number; z: number } }, x: number, z: number, radius: number) {
  const dx = cam.position.x - x;
  const dz = cam.position.z - z;
  return dx * dx + dz * dz > radius * radius;
}

function FurMat({ color, rough = 0.92 }: { color: string; rough?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={0.02}
      flatShading={false}
    />
  );
}

function HideMat({ color }: { color: string }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={0.78}
      metalness={0.04}
      flatShading={false}
    />
  );
}

export type CreatureKind =
  | "goat"
  | "sheep"
  | "cow"
  | "dog"
  | "pig"
  | "antelope"
  | "cat";

export function Creature({
  x,
  y,
  z,
  phase,
  scale,
  kind,
}: {
  x: number;
  y: number;
  z: number;
  phase: number;
  scale: number;
  kind: CreatureKind;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legFL = useRef<THREE.Group>(null);
  const legFR = useRef<THREE.Group>(null);
  const legBL = useRef<THREE.Group>(null);
  const legBR = useRef<THREE.Group>(null);
  const cam = useThree((s) => s.camera);

  const speed =
    kind === "dog" || kind === "cat"
      ? 0.28
      : kind === "antelope"
        ? 0.18
        : kind === "cow"
          ? 0.07
          : kind === "pig"
            ? 0.12
            : 0.14;
  // Wide territory roam — animals cross village paths over time
  const roam =
    kind === "cow"
      ? 8.0
      : kind === "dog" || kind === "cat"
        ? 14.0
        : kind === "antelope"
          ? 18.0
          : kind === "pig"
            ? 7.0
            : 10.0;
  const roamZ = roam * (kind === "antelope" ? 0.95 : 0.8);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const budget = qualityBudget();
    // Cull far animals — still drawn, but skip roam math
    const cx = root.current.position.x;
    const cz = root.current.position.z;
    if (farFromCamera(cam, cx, cz, budget.cullRadius)) return;
    const t = clock.elapsedTime;
    // Lissajous-style path so they cover area, not a tight circle
    const ox = Math.sin(t * speed + phase) * roam + Math.sin(t * speed * 0.37 + phase * 1.7) * roam * 0.25;
    const oz = Math.cos(t * speed * 0.71 + phase) * roamZ + Math.cos(t * speed * 0.29 + phase * 1.3) * roamZ * 0.3;
    const px = x + ox;
    const pz = z + oz;
    root.current.position.set(px, sampleHeight(px, pz), pz);

    // Face movement direction smoothly
    const tx =
      Math.cos(t * speed + phase) * speed * roam +
      Math.cos(t * speed * 0.37 + phase * 1.7) * speed * 0.37 * roam * 0.25;
    const tz =
      -Math.sin(t * speed * 0.71 + phase) * speed * 0.71 * roamZ -
      Math.sin(t * speed * 0.29 + phase * 1.3) * speed * 0.29 * roamZ * 0.3;
    const targetYaw = Math.atan2(tx, tz);
    const cur = root.current.rotation.y;
    let diff = targetYaw - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    root.current.rotation.y = cur + diff * 0.08;

    // Gentle head motion
    if (head.current) {
      head.current.rotation.x =
        kind === "dog" || kind === "cat"
          ? Math.sin(t * 2.2 + phase) * 0.1
          : Math.sin(t * 1.4 + phase) * 0.12 - 0.12;
    }

    // Subtle walk cycle on legs
    const gait = Math.sin(t * speed * 6 + phase) * 0.18;
    if (legFL.current) legFL.current.rotation.x = gait;
    if (legFR.current) legFR.current.rotation.x = -gait;
    if (legBL.current) legBL.current.rotation.x = -gait;
    if (legBR.current) legBR.current.rotation.x = gait;
  });

  if (kind === "cow") return <CowMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  if (kind === "dog") return <DogMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  if (kind === "pig") return <PigMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  if (kind === "antelope") return <AntelopeMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  if (kind === "cat") return <CatMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  if (kind === "sheep") return <SheepMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
  return <GoatMesh root={root} head={head} legFL={legFL} legFR={legFR} legBL={legBL} legBR={legBR} scale={scale} x={x} y={y} z={z} />;
}

type MeshRefs = {
  root: React.RefObject<THREE.Group | null>;
  head: React.RefObject<THREE.Group | null>;
  legFL: React.RefObject<THREE.Group | null>;
  legFR: React.RefObject<THREE.Group | null>;
  legBL: React.RefObject<THREE.Group | null>;
  legBR: React.RefObject<THREE.Group | null>;
  scale: number;
  x: number;
  y: number;
  z: number;
};

function Leg({
  legRef,
  position,
  length,
  radius,
  color,
  paw = false,
}: {
  legRef: React.RefObject<THREE.Group | null>;
  position: [number, number, number];
  length: number;
  radius: number;
  color: string;
  /** true = soft paw with toes; false = hoof */
  paw?: boolean;
}) {
  const upper = length * 0.55;
  const lower = length * 0.45;
  return (
    <group ref={legRef} position={position}>
      {/* Upper leg */}
      <mesh position={[0, -upper * 0.5, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.05, radius, upper, 6]} />
        <HideMat color={color} />
      </mesh>
      {/* Knee / joint */}
      <mesh position={[0, -upper, 0]} castShadow>
        <sphereGeometry args={[radius * 0.95, 6, 5]} />
        <HideMat color={color} />
      </mesh>
      {/* Lower leg / ankle */}
      <mesh position={[0, -upper - lower * 0.5, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.85, radius * 0.7, lower, 6]} />
        <HideMat color={color} />
      </mesh>
      {/* Ankle bone cue */}
      <mesh position={[0, -length + radius * 0.3, 0.01]} castShadow>
        <sphereGeometry args={[radius * 0.75, 5, 4]} />
        <HideMat color={color} />
      </mesh>
      {paw ? (
        <group position={[0, -length - 0.01, 0.02]}>
          {/* Pad */}
          <mesh castShadow>
            <sphereGeometry args={[radius * 1.15, 6, 5]} />
            <HideMat color="#2a2218" />
          </mesh>
          {/* Toes + toenails */}
          {[
            [-radius * 0.7, radius * 0.55],
            [-radius * 0.25, radius * 0.7],
            [radius * 0.25, radius * 0.7],
          [radius * 0.7, radius * 0.55],
        ] as const).map(([tx, tz], i) => (
            <group key={i} position={[tx, -0.005, tz]}>
              <mesh castShadow>
                <sphereGeometry args={[radius * 0.35, 5, 4]} />
                <HideMat color="#2a2218" />
              </mesh>
              <mesh position={[0, -0.008, radius * 0.12]} castShadow>
                <boxGeometry args={[radius * 0.18, radius * 0.1, radius * 0.2]} />
                <HideMat color="#1a1410" />
              </mesh>
            </group>
          ))}
        </group>
      ) : (
        <group position={[0, -length - 0.015, 0.015]}>
          {/* Hoof */}
          <mesh castShadow>
            <boxGeometry args={[radius * 1.5, radius * 0.7, radius * 1.6]} />
            <HideMat color="#1a1410" />
          </mesh>
          {/* Cloven split cue */}
          <mesh position={[0, -0.005, radius * 0.2]}>
            <boxGeometry args={[radius * 0.15, radius * 0.4, radius * 0.8]} />
            <HideMat color="#0a0806" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function CowMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      {/* Torso */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.34, 0.58, 6, 10]} />
        <FurMat color="#6b5344" rough={0.9} />
      </mesh>
      {/* Belly lighter */}
      <mesh position={[0, 0.48, 0.04]} castShadow>
        <capsuleGeometry args={[0.26, 0.4, 5, 8]} />
        <FurMat color="#c8b8a0" rough={0.94} />
      </mesh>
      {/* Udder */}
      <mesh position={[0, 0.32, -0.05]} castShadow>
        <sphereGeometry args={[0.12, 7, 5]} />
        <HideMat color="#d4b8a0" />
      </mesh>
      <mesh position={[-0.04, 0.24, -0.05]} castShadow>
        <cylinderGeometry args={[0.02, 0.015, 0.06, 5]} />
        <HideMat color="#c4a890" />
      </mesh>
      <mesh position={[0.04, 0.24, -0.05]} castShadow>
        <cylinderGeometry args={[0.02, 0.015, 0.06, 5]} />
        <HideMat color="#c4a890" />
      </mesh>
      {/* Shoulder hump */}
      <mesh position={[0, 0.78, 0.12]} castShadow>
        <sphereGeometry args={[0.22, 8, 6]} />
        <FurMat color="#5e4a3c" rough={0.9} />
      </mesh>
      {/* Head */}
      <group ref={head} position={[0, 0.72, 0.52]}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.22, 0.3]} />
          <FurMat color="#5a4538" rough={0.88} />
        </mesh>
        <mesh position={[0, -0.04, 0.14]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.12]} />
          <FurMat color="#4a382c" rough={0.88} />
        </mesh>
        {/* Tongue tip */}
        <mesh position={[0, -0.07, 0.2]} castShadow>
          <boxGeometry args={[0.04, 0.02, 0.05]} />
          <HideMat color="#c05060" />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.08, 0.04, 0.12]}>
          <sphereGeometry args={[0.025, 6, 5]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[0.08, 0.04, 0.12]}>
          <sphereGeometry args={[0.025, 6, 5]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        {/* Horns */}
        <mesh position={[-0.1, 0.16, -0.02]} rotation={[0.35, 0, -0.45]} castShadow>
          <coneGeometry args={[0.035, 0.18, 6]} />
          <HideMat color="#e8e0d4" />
        </mesh>
        <mesh position={[0.1, 0.16, -0.02]} rotation={[0.35, 0, 0.45]} castShadow>
          <coneGeometry args={[0.035, 0.18, 6]} />
          <HideMat color="#e8e0d4" />
        </mesh>
        {/* Ears */}
        <mesh position={[-0.15, 0.06, 0]} rotation={[0, 0, 0.55]} castShadow>
          <boxGeometry args={[0.09, 0.05, 0.03]} />
          <FurMat color="#5a4538" />
        </mesh>
        <mesh position={[0.15, 0.06, 0]} rotation={[0, 0, -0.55]} castShadow>
          <boxGeometry args={[0.09, 0.05, 0.03]} />
          <FurMat color="#5a4538" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.18, 0.42, 0.2]} length={0.42} radius={0.05} color="#3d2e24" />
      <Leg legRef={legFR} position={[0.18, 0.42, 0.2]} length={0.42} radius={0.05} color="#3d2e24" />
      <Leg legRef={legBL} position={[-0.18, 0.42, -0.22]} length={0.42} radius={0.05} color="#3d2e24" />
      <Leg legRef={legBR} position={[0.18, 0.42, -0.22]} length={0.42} radius={0.05} color="#3d2e24" />
      {/* Tail */}
      <mesh position={[0, 0.58, -0.45]} rotation={[0.55, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.015, 0.35, 5]} />
        <FurMat color="#4a382c" />
      </mesh>
      <mesh position={[0, 0.42, -0.58]} castShadow>
        <sphereGeometry args={[0.05, 5, 4]} />
        <FurMat color="#3a2e24" />
      </mesh>
    </group>
  );
}

function GoatMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.17, 0.32, 6, 8]} />
        <FurMat color="#c4a574" rough={0.9} />
      </mesh>
      <mesh position={[0, 0.34, 0.02]} castShadow>
        <capsuleGeometry args={[0.12, 0.22, 5, 6]} />
        <FurMat color="#d8c4a0" rough={0.94} />
      </mesh>
      <group ref={head} position={[0, 0.48, 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.13, 0.18]} />
          <FurMat color="#b8956a" />
        </mesh>
        <mesh position={[0, -0.02, 0.1]} castShadow>
          <boxGeometry args={[0.08, 0.06, 0.08]} />
          <FurMat color="#a88860" />
        </mesh>
        <mesh position={[-0.05, 0.05, 0.08]}>
          <sphereGeometry args={[0.018, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[0.05, 0.05, 0.08]}>
          <sphereGeometry args={[0.018, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        {/* Curved horns */}
        <mesh position={[-0.06, 0.1, -0.02]} rotation={[0.25, 0, -0.55]} castShadow>
          <coneGeometry args={[0.028, 0.15, 6]} />
          <HideMat color="#e8e0d0" />
        </mesh>
        <mesh position={[0.06, 0.1, -0.02]} rotation={[0.25, 0, 0.55]} castShadow>
          <coneGeometry args={[0.028, 0.15, 6]} />
          <HideMat color="#e8e0d0" />
        </mesh>
        <mesh position={[-0.09, 0.04, 0]} rotation={[0, 0, 0.4]} castShadow>
          <boxGeometry args={[0.06, 0.04, 0.025]} />
          <FurMat color="#b8956a" />
        </mesh>
        <mesh position={[0.09, 0.04, 0]} rotation={[0, 0, -0.4]} castShadow>
          <boxGeometry args={[0.06, 0.04, 0.025]} />
          <FurMat color="#b8956a" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.09, 0.28, 0.12]} length={0.28} radius={0.032} color="#5c4a32" />
      <Leg legRef={legFR} position={[0.09, 0.28, 0.12]} length={0.28} radius={0.032} color="#5c4a32" />
      <Leg legRef={legBL} position={[-0.09, 0.28, -0.14]} length={0.28} radius={0.032} color="#5c4a32" />
      <Leg legRef={legBR} position={[0.09, 0.28, -0.14]} length={0.28} radius={0.032} color="#5c4a32" />
      <mesh position={[0, 0.4, -0.28]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.012, 0.16, 5]} />
        <FurMat color="#a88860" />
      </mesh>
    </group>
  );
}

function SheepMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      {/* Wool mass */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <FurMat color="#f0ece4" rough={1} />
      </mesh>
      <mesh position={[0, 0.4, 0.08]} castShadow>
        <sphereGeometry args={[0.22, 8, 6]} />
        <FurMat color="#e8e4dc" rough={1} />
      </mesh>
      <group ref={head} position={[0, 0.48, 0.28]}>
        <mesh castShadow>
          <boxGeometry args={[0.13, 0.12, 0.16]} />
          <FurMat color="#d8d4cc" />
        </mesh>
        <mesh position={[0, -0.02, 0.09]} castShadow>
          <boxGeometry args={[0.07, 0.05, 0.06]} />
          <FurMat color="#c8c0b4" />
        </mesh>
        <mesh position={[-0.04, 0.03, 0.07]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.03, 0.07]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[-0.09, 0.02, 0]} rotation={[0, 0, 0.65]} castShadow>
          <boxGeometry args={[0.07, 0.04, 0.025]} />
          <FurMat color="#d0c8bc" />
        </mesh>
        <mesh position={[0.09, 0.02, 0]} rotation={[0, 0, -0.65]} castShadow>
          <boxGeometry args={[0.07, 0.04, 0.025]} />
          <FurMat color="#d0c8bc" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.1, 0.26, 0.1]} length={0.26} radius={0.03} color="#4a4038" />
      <Leg legRef={legFR} position={[0.1, 0.26, 0.1]} length={0.26} radius={0.03} color="#4a4038" />
      <Leg legRef={legBL} position={[-0.1, 0.26, -0.12]} length={0.26} radius={0.03} color="#4a4038" />
      <Leg legRef={legBR} position={[0.1, 0.26, -0.12]} length={0.26} radius={0.03} color="#4a4038" />
    </group>
  );
}

function DogMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.13, 0.3, 5, 8]} />
        <FurMat color="#8a6b4a" rough={0.88} />
      </mesh>
      <mesh position={[0, 0.26, 0.02]} castShadow>
        <capsuleGeometry args={[0.1, 0.2, 4, 6]} />
        <FurMat color="#a88860" rough={0.92} />
      </mesh>
      <group ref={head} position={[0, 0.36, 0.26]}>
        <mesh castShadow>
          <boxGeometry args={[0.13, 0.12, 0.16]} />
          <FurMat color="#7a5e40" />
        </mesh>
        <mesh position={[0, -0.02, 0.1]} castShadow>
          <boxGeometry args={[0.08, 0.06, 0.09]} />
          <FurMat color="#6a5038" />
        </mesh>
        <mesh position={[-0.04, 0.03, 0.06]}>
          <sphereGeometry args={[0.018, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.25} />
        </mesh>
        <mesh position={[0.04, 0.03, 0.06]}>
          <sphereGeometry args={[0.018, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.25} />
        </mesh>
        {/* Upright ears */}
        <mesh position={[-0.06, 0.09, -0.02]} rotation={[0.1, 0, -0.25]} castShadow>
          <boxGeometry args={[0.04, 0.09, 0.02]} />
          <FurMat color="#6a5038" />
        </mesh>
        <mesh position={[0.06, 0.09, -0.02]} rotation={[0.1, 0, 0.25]} castShadow>
          <boxGeometry args={[0.04, 0.09, 0.02]} />
          <FurMat color="#6a5038" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.07, 0.2, 0.1]} length={0.2} radius={0.025} color="#5c4430" paw />
      <Leg legRef={legFR} position={[0.07, 0.2, 0.1]} length={0.2} radius={0.025} color="#5c4430" paw />
      <Leg legRef={legBL} position={[-0.07, 0.2, -0.12]} length={0.2} radius={0.025} color="#5c4430" paw />
      <Leg legRef={legBR} position={[0.07, 0.2, -0.12]} length={0.2} radius={0.025} color="#5c4430" paw />
      <mesh position={[0, 0.32, -0.24]} rotation={[0.65, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.012, 0.2, 5]} />
        <FurMat color="#6a5038" />
      </mesh>
    </group>
  );
}

function PigMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.22, 0.3, 6, 8]} />
        <HideMat color="#e8a090" />
      </mesh>
      <group ref={head} position={[0, 0.32, 0.28]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 8, 6]} />
          <HideMat color="#e09888" />
        </mesh>
        {/* Snout disc */}
        <mesh position={[0, -0.02, 0.11]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.05, 10]} />
          <HideMat color="#d08070" />
        </mesh>
        <mesh position={[-0.04, 0.03, 0.08]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.35} />
        </mesh>
        <mesh position={[0.04, 0.03, 0.08]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.35} />
        </mesh>
        <mesh position={[-0.09, 0.08, 0]} rotation={[0, 0, 0.5]} castShadow>
          <boxGeometry args={[0.06, 0.05, 0.02]} />
          <HideMat color="#d09080" />
        </mesh>
        <mesh position={[0.09, 0.08, 0]} rotation={[0, 0, -0.5]} castShadow>
          <boxGeometry args={[0.06, 0.05, 0.02]} />
          <HideMat color="#d09080" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.1, 0.2, 0.1]} length={0.2} radius={0.035} color="#c07060" />
      <Leg legRef={legFR} position={[0.1, 0.2, 0.1]} length={0.2} radius={0.035} color="#c07060" />
      <Leg legRef={legBL} position={[-0.1, 0.2, -0.12]} length={0.2} radius={0.035} color="#c07060" />
      <Leg legRef={legBR} position={[0.1, 0.2, -0.12]} length={0.2} radius={0.035} color="#c07060" />
      <mesh position={[0, 0.3, -0.26]} rotation={[0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.012, 0.14, 5]} />
        <HideMat color="#d08070" />
      </mesh>
    </group>
  );
}

function AntelopeMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.17, 0.42, 6, 8]} />
        <FurMat color="#c4a060" rough={0.88} />
      </mesh>
      <mesh position={[0, 0.44, 0.04]} castShadow>
        <capsuleGeometry args={[0.12, 0.3, 5, 6]} />
        <FurMat color="#e8d8b0" rough={0.92} />
      </mesh>
      <group ref={head} position={[0, 0.68, 0.34]}>
        <mesh castShadow>
          <boxGeometry args={[0.13, 0.15, 0.2]} />
          <FurMat color="#b89050" />
        </mesh>
        <mesh position={[0, -0.02, 0.1]} castShadow>
          <boxGeometry args={[0.07, 0.05, 0.08]} />
          <FurMat color="#a88048" />
        </mesh>
        <mesh position={[-0.04, 0.04, 0.08]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[0.04, 0.04, 0.08]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        {/* Long horns */}
        <mesh position={[-0.05, 0.2, -0.02]} rotation={[-0.35, 0, -0.12]} castShadow>
          <cylinderGeometry args={[0.022, 0.012, 0.3, 6]} />
          <HideMat color="#e8e0d0" />
        </mesh>
        <mesh position={[0.05, 0.2, -0.02]} rotation={[-0.35, 0, 0.12]} castShadow>
          <cylinderGeometry args={[0.022, 0.012, 0.3, 6]} />
          <HideMat color="#e8e0d0" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.1, 0.4, 0.14]} length={0.4} radius={0.03} color="#8a7040" />
      <Leg legRef={legFR} position={[0.1, 0.4, 0.14]} length={0.4} radius={0.03} color="#8a7040" />
      <Leg legRef={legBL} position={[-0.1, 0.4, -0.16]} length={0.4} radius={0.03} color="#8a7040" />
      <Leg legRef={legBR} position={[0.1, 0.4, -0.16]} length={0.4} radius={0.03} color="#8a7040" />
      <mesh position={[0, 0.52, -0.34]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.01, 0.22, 5]} />
        <FurMat color="#a88850" />
      </mesh>
    </group>
  );
}

function CatMesh({ root, head, legFL, legFR, legBL, legBR, scale, x, y, z }: MeshRefs) {
  return (
    <group ref={root} position={[x, y, z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.1, 0.22, 5, 7]} />
        <FurMat color="#c4a060" rough={0.86} />
      </mesh>
      <mesh position={[0, 0.24, 0.02]}>
        <boxGeometry args={[0.14, 0.025, 0.1]} />
        <FurMat color="#8a7040" />
      </mesh>
      <group ref={head} position={[0, 0.28, 0.18]}>
        <mesh castShadow>
          <sphereGeometry args={[0.085, 8, 6]} />
          <FurMat color="#c4a060" />
        </mesh>
        <mesh position={[-0.05, 0.08, 0]} rotation={[0, 0, -0.15]} castShadow>
          <coneGeometry args={[0.028, 0.07, 5]} />
          <FurMat color="#b89050" />
        </mesh>
        <mesh position={[0.05, 0.08, 0]} rotation={[0, 0, 0.15]} castShadow>
          <coneGeometry args={[0.028, 0.07, 5]} />
          <FurMat color="#b89050" />
        </mesh>
        <mesh position={[-0.03, 0.02, 0.06]}>
          <sphereGeometry args={[0.014, 5, 4]} />
          <meshStandardMaterial color="#2a1a08" roughness={0.25} />
        </mesh>
        <mesh position={[0.03, 0.02, 0.06]}>
          <sphereGeometry args={[0.014, 5, 4]} />
          <meshStandardMaterial color="#2a1a08" roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.01, 0.07]} castShadow>
          <boxGeometry args={[0.04, 0.03, 0.04]} />
          <FurMat color="#a88048" />
        </mesh>
      </group>
      <Leg legRef={legFL} position={[-0.05, 0.14, 0.07]} length={0.14} radius={0.016} color="#8a7040" paw />
      <Leg legRef={legFR} position={[0.05, 0.14, 0.07]} length={0.14} radius={0.016} color="#8a7040" paw />
      <Leg legRef={legBL} position={[-0.05, 0.14, -0.08]} length={0.14} radius={0.016} color="#8a7040" paw />
      <Leg legRef={legBR} position={[0.05, 0.14, -0.08]} length={0.14} radius={0.016} color="#8a7040" paw />
      <mesh position={[0, 0.26, -0.18]} rotation={[0.85, 0, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.01, 0.22, 5]} />
        <FurMat color="#c4a060" />
      </mesh>
    </group>
  );
}

/** Chicken with comb, wattle, wings, pecking motion */
export function Chicken({
  x,
  y,
  z,
  phase,
}: {
  x: number;
  y: number;
  z: number;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const cam = useThree((s) => s.camera);

  useFrame(({ clock }) => {
    if (!root.current) return;
    if (farFromCamera(cam, root.current.position.x, root.current.position.z, qualityBudget().cullRadius)) return;
    const t = clock.elapsedTime;
    const ox = Math.sin(t * 0.35 + phase) * 3.2 + Math.sin(t * 0.11 + phase * 2) * 1.2;
    const oz = Math.cos(t * 0.28 + phase) * 2.6 + Math.cos(t * 0.09 + phase * 1.5) * 1.0;
    const px = x + ox;
    const pz = z + oz;
    root.current.position.set(px, sampleHeight(px, pz), pz);
    const tx = Math.cos(t * 0.35 + phase) * 0.35 * 3.2;
    const tz = -Math.sin(t * 0.28 + phase) * 0.28 * 2.6;
    root.current.rotation.y = Math.atan2(tx, tz);
    if (head.current) head.current.rotation.x = Math.sin(t * 3.5 + phase) * 0.22 - 0.12;
  });

  const body = phase % 1 > 0.5 ? "#d4a84b" : "#c49a3c";

  return (
    <group ref={root} position={[x, y, z]} scale={0.7}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <sphereGeometry args={[0.13, 8, 6]} />
        <FurMat color={body} rough={0.86} />
      </mesh>
      <mesh position={[0, 0.2, -0.1]} rotation={[-0.55, 0, 0]} castShadow>
        <coneGeometry args={[0.07, 0.14, 6]} />
        <FurMat color="#8a6a30" />
      </mesh>
      <group ref={head} position={[0, 0.24, 0.1]}>
        <mesh castShadow>
          <sphereGeometry args={[0.065, 7, 5]} />
          <FurMat color={body} />
        </mesh>
        <mesh position={[0, 0.065, 0.01]} castShadow>
          <boxGeometry args={[0.025, 0.055, 0.045]} />
          <HideMat color="#c42828" />
        </mesh>
        <mesh position={[0, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.016, 0.045, 5]} />
          <HideMat color="#e07020" />
        </mesh>
        <mesh position={[0, -0.03, 0.04]}>
          <sphereGeometry args={[0.016, 5, 4]} />
          <HideMat color="#c42828" />
        </mesh>
        <mesh position={[-0.03, 0.02, 0.04]}>
          <sphereGeometry args={[0.012, 4, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
        <mesh position={[0.03, 0.02, 0.04]}>
          <sphereGeometry args={[0.012, 4, 4]} />
          <meshStandardMaterial color="#1a1208" roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[-0.1, 0.15, 0]} rotation={[0, 0, 0.3]} castShadow>
        <boxGeometry args={[0.09, 0.04, 0.11]} />
        <FurMat color="#b89038" />
      </mesh>
      <mesh position={[0.1, 0.15, 0]} rotation={[0, 0, -0.3]} castShadow>
        <boxGeometry args={[0.09, 0.04, 0.11]} />
        <FurMat color="#b89038" />
      </mesh>
      <mesh position={[-0.04, 0.05, 0.02]}>
        <cylinderGeometry args={[0.012, 0.01, 0.1, 5]} />
        <HideMat color="#c45c20" />
      </mesh>
      <mesh position={[0.04, 0.05, 0.02]}>
        <cylinderGeometry args={[0.012, 0.01, 0.1, 5]} />
        <HideMat color="#c45c20" />
      </mesh>
    </group>
  );
}

export function Duck({
  x,
  y,
  z,
  phase,
}: {
  x: number;
  y: number;
  z: number;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const cam = useThree((s) => s.camera);

  useFrame(({ clock }) => {
    if (!root.current) return;
    if (farFromCamera(cam, root.current.position.x, root.current.position.z, qualityBudget().cullRadius)) return;
    const t = clock.elapsedTime;
    const ox = Math.sin(t * 0.5 + phase) * 0.8;
    const oz = Math.cos(t * 0.42 + phase) * 0.6;
    const px = x + ox;
    const pz = z + oz;
    root.current.position.set(px, sampleHeight(px, pz), pz);
    root.current.rotation.y = Math.atan2(
      Math.cos(t * 0.5 + phase),
      -Math.sin(t * 0.42 + phase),
    );
    if (head.current) head.current.rotation.x = Math.sin(t * 2.2 + phase) * 0.15 - 0.08;
  });

  return (
    <group ref={root} position={[x, y, z]} scale={0.75}>
      <mesh position={[0, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.12, 8, 6]} />
        <FurMat color="#4a6a3a" rough={0.86} />
      </mesh>
      <mesh position={[0, 0.11, 0.06]} castShadow>
        <sphereGeometry args={[0.085, 7, 5]} />
        <FurMat color="#c8b070" />
      </mesh>
      <group ref={head} position={[0, 0.22, 0.1]}>
        <mesh castShadow>
          <sphereGeometry args={[0.055, 7, 5]} />
          <FurMat color="#3a5a2a" />
        </mesh>
        <mesh position={[0, -0.01, 0.06]} castShadow>
          <boxGeometry args={[0.045, 0.022, 0.075]} />
          <HideMat color="#e09030" />
        </mesh>
      </group>
      <mesh position={[-0.09, 0.13, 0]} rotation={[0, 0, 0.25]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.09]} />
        <FurMat color="#3a5a2a" />
      </mesh>
      <mesh position={[0.09, 0.13, 0]} rotation={[0, 0, -0.25]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.09]} />
        <FurMat color="#3a5a2a" />
      </mesh>
      <mesh position={[-0.03, 0.04, 0.02]}>
        <cylinderGeometry args={[0.01, 0.01, 0.08, 4]} />
        <HideMat color="#e09030" />
      </mesh>
      <mesh position={[0.03, 0.04, 0.02]}>
        <cylinderGeometry args={[0.01, 0.01, 0.08, 4]} />
        <HideMat color="#e09030" />
      </mesh>
    </group>
  );
}

export function Heron({
  x,
  y,
  z,
  phase,
}: {
  x: number;
  y: number;
  z: number;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const ox = Math.sin(t * 0.08 + phase) * 6.0 + Math.sin(t * 0.03 + phase * 1.5) * 2.0;
    const oz = Math.cos(t * 0.07 + phase) * 5.0 + Math.cos(t * 0.025 + phase) * 1.8;
    const px = x + ox;
    const pz = z + oz;
    root.current.position.set(px, sampleHeight(px, pz), pz);
    root.current.rotation.y = Math.atan2(
      Math.cos(t * 0.08 + phase) * 0.08 * 6,
      -Math.sin(t * 0.07 + phase) * 0.07 * 5,
    );
    root.current.rotation.y = phase + Math.sin(t * 0.07) * 0.25;
    if (neck.current) neck.current.rotation.x = Math.sin(t * 0.5 + phase) * 0.12 - 0.18;
  });

  return (
    <group ref={root} position={[x, y, z]} scale={0.9}>
      <mesh position={[0, 0.36, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.17, 5, 7]} />
        <FurMat color="#e8e4dc" rough={0.86} />
      </mesh>
      <group ref={neck} position={[0, 0.5, 0.04]}>
        <mesh position={[0, 0.12, 0.02]} castShadow>
          <cylinderGeometry args={[0.02, 0.025, 0.26, 6]} />
          <FurMat color="#e8e4dc" />
        </mesh>
        <mesh position={[0, 0.26, 0.04]} castShadow>
          <sphereGeometry args={[0.04, 6, 5]} />
          <FurMat color="#f0ece4" />
        </mesh>
        <mesh position={[0, 0.26, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.012, 0.13, 5]} />
          <HideMat color="#f0c040" />
        </mesh>
      </group>
      <mesh position={[-0.05, 0.37, -0.02]} rotation={[0.2, 0, 0.12]} castShadow>
        <boxGeometry args={[0.04, 0.08, 0.15]} />
        <FurMat color="#d8d4cc" />
      </mesh>
      <mesh position={[0.05, 0.37, -0.02]} rotation={[0.2, 0, -0.12]} castShadow>
        <boxGeometry args={[0.04, 0.08, 0.15]} />
        <FurMat color="#d8d4cc" />
      </mesh>
      <mesh position={[-0.03, 0.14, 0.02]}>
        <cylinderGeometry args={[0.012, 0.01, 0.28, 5]} />
        <HideMat color="#d09040" />
      </mesh>
      <mesh position={[0.03, 0.14, 0.02]}>
        <cylinderGeometry args={[0.012, 0.01, 0.28, 5]} />
        <HideMat color="#d09040" />
      </mesh>
    </group>
  );
}

export function FlyingBird({
  x,
  y,
  z,
  phase,
}: {
  x: number;
  y: number;
  z: number;
  phase: number;
}) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const cam = useThree((s) => s.camera);

  useFrame(({ clock }) => {
    if (!root.current) return;
    // Birds can be farther; still skip when very far
    if (farFromCamera(cam, root.current.position.x, root.current.position.z, qualityBudget().cullRadius * 1.4)) return;
    const t = clock.elapsedTime;
    const radius = 22 + (phase % 1) * 18;
    const spd = 0.16 + (phase % 1) * 0.1;
    root.current.position.x = x + Math.cos(t * spd + phase) * radius;
    root.current.position.z = z + Math.sin(t * spd + phase) * radius;
    root.current.position.y = y + Math.sin(t * 0.35 + phase) * 1.2;
    root.current.rotation.y = -t * spd + phase + Math.PI / 2;
    const flap = Math.sin(t * 7 + phase) * 0.4;
    if (wingL.current) wingL.current.rotation.z = 0.25 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.25 - flap;
  });

  return (
    <group ref={root} position={[x, y, z]} scale={0.75}>
      <mesh castShadow>
        <capsuleGeometry args={[0.04, 0.11, 4, 6]} />
        <FurMat color="#3a3a3a" rough={0.82} />
      </mesh>
      <mesh position={[0, 0.02, 0.08]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <FurMat color="#2a2a2a" />
      </mesh>
      <mesh ref={wingL} position={[-0.09, 0, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.2, 0.015, 0.09]} />
        <FurMat color="#4a4a4a" />
      </mesh>
      <mesh ref={wingR} position={[0.09, 0, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.2, 0.015, 0.09]} />
        <FurMat color="#4a4a4a" />
      </mesh>
      <mesh position={[0, 0, -0.09]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.04, 0.01, 0.08]} />
        <FurMat color="#333" />
      </mesh>
    </group>
  );
}


/** Small ground critters — more realistic proportions & motion */

function CritterMat({ color, rough = 0.9, metal = 0.03 }: { color: string; rough?: number; metal?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} />;
}

export function Frog({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    // idle breathe + rare hop cycle
    const cycle = (t * 0.55 + phase) % 4.5;
    const hopping = cycle > 3.6;
    const hopT = hopping ? (cycle - 3.6) / 0.9 : 0;
    const hopY = hopping ? Math.sin(hopT * Math.PI) * 0.22 : 0;
    const hopFwd = hopping ? hopT * 0.25 : 0;
    const wanderX = Math.sin(t * 0.12 + phase) * 3.5 + Math.sin(t * 0.05 + phase * 2) * 1.2;
    const wanderZ = Math.cos(t * 0.1 + phase) * 3.0 + Math.cos(t * 0.04 + phase) * 1.0;
    const baseX = x + wanderX;
    const baseZ = z + wanderZ;
    root.current.position.set(baseX + Math.sin(phase) * hopFwd, y + hopY + 0.02, baseZ);
    if (hopping) {
      root.current.rotation.y = Math.atan2(
        Math.cos(t * 0.12 + phase) * 0.12 * 3.5,
        -Math.sin(t * 0.1 + phase) * 0.1 * 3.0,
      );
    }
    root.current.rotation.x = hopping ? -hopT * 0.25 : Math.sin(t * 1.2 + phase) * 0.04;
    root.current.rotation.y = phase * 0.4 + (hopping ? hopT * 0.1 : 0);
    if (legL.current) legL.current.rotation.x = hopping ? hopT * 0.8 : 0.15;
    if (legR.current) legR.current.rotation.x = hopping ? hopT * 0.8 : 0.15;
  });
  // African bullfrog-ish olive body
  return (
    <group ref={root} position={[x, y, z]} scale={0.7}>
      {/* stout body */}
      <mesh position={[0, 0.05, 0]} scale={[1.1, 0.75, 1.25]} castShadow>
        <sphereGeometry args={[0.09, 8, 6]} />
        <CritterMat color="#4a6b28" rough={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.07, 0.08]} scale={[0.9, 0.7, 0.85]} castShadow>
        <sphereGeometry args={[0.065, 8, 6]} />
        <CritterMat color="#5a7a32" rough={0.85} />
      </mesh>
      {/* dorsolateral ridge suggestion */}
      <mesh position={[0, 0.1, 0.02]} scale={[0.35, 0.15, 0.9]}>
        <sphereGeometry args={[0.04, 5, 4]} />
        <CritterMat color="#3a5a20" />
      </mesh>
      {/* eyes raised */}
      <mesh position={[0.045, 0.12, 0.1]}>
        <sphereGeometry args={[0.022, 6, 5]} />
        <CritterMat color="#2a4018" />
      </mesh>
      <mesh position={[-0.045, 0.12, 0.1]}>
        <sphereGeometry args={[0.022, 6, 5]} />
        <CritterMat color="#2a4018" />
      </mesh>
      <mesh position={[0.045, 0.125, 0.115]}>
        <sphereGeometry args={[0.01, 5, 4]} />
        <meshStandardMaterial color="#1a1a08" roughness={0.4} />
      </mesh>
      <mesh position={[-0.045, 0.125, 0.115]}>
        <sphereGeometry args={[0.01, 5, 4]} />
        <meshStandardMaterial color="#1a1a08" roughness={0.4} />
      </mesh>
      {/* hind legs powerful */}
      <group ref={legL} position={[-0.07, 0.02, -0.04]}>
        <mesh rotation={[0.3, 0, -0.4]} castShadow>
          <capsuleGeometry args={[0.022, 0.06, 4, 5]} />
          <CritterMat color="#3d5a22" />
        </mesh>
        <mesh position={[-0.02, -0.02, 0.04]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.015, 0.05, 3, 4]} />
          <CritterMat color="#3d5a22" />
        </mesh>
      </group>
      <group ref={legR} position={[0.07, 0.02, -0.04]}>
        <mesh rotation={[0.3, 0, 0.4]} castShadow>
          <capsuleGeometry args={[0.022, 0.06, 4, 5]} />
          <CritterMat color="#3d5a22" />
        </mesh>
        <mesh position={[0.02, -0.02, 0.04]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.015, 0.05, 3, 4]} />
          <CritterMat color="#3d5a22" />
        </mesh>
      </group>
      {/* front legs */}
      <mesh position={[-0.05, 0.02, 0.07]} rotation={[0.5, 0, -0.3]}>
        <capsuleGeometry args={[0.012, 0.04, 3, 4]} />
        <CritterMat color="#4a6b28" />
      </mesh>
      <mesh position={[0.05, 0.02, 0.07]} rotation={[0.5, 0, 0.3]}>
        <capsuleGeometry args={[0.012, 0.04, 3, 4]} />
        <CritterMat color="#4a6b28" />
      </mesh>
    </group>
  );
}

export function Lizard({
  x,
  y = 0,
  z,
  phase = 0,
  color = "#6b8f3a",
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
  color?: string;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.45 + (phase % 1) * 0.25;
    // stop-start scuttle
    const burst = Math.sin(t * spd + phase);
    const moving = burst > 0.2;
    const px = x + Math.sin(t * spd * 0.25 + phase) * 5.5 + Math.sin(t * spd * 0.08 + phase * 2) * 2.0;
    const pz = z + Math.cos(t * spd * 0.22 + phase) * 4.5 + Math.cos(t * spd * 0.07 + phase) * 1.8;
    root.current.position.x += (px - root.current.position.x) * (moving ? 0.08 : 0.02);
    root.current.position.z += (pz - root.current.position.z) * (moving ? 0.08 : 0.02);
    root.current.position.y = y + 0.025;
    const dx = px - root.current.position.x;
    const dz = pz - root.current.position.z;
    if (moving && Math.hypot(dx, dz) > 0.01) {
      root.current.rotation.y = Math.atan2(dx, dz);
    }
    // body undulation
    root.current.rotation.z = Math.sin(t * 8 + phase) * (moving ? 0.12 : 0.03);
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.55}>
      {/* elongated body */}
      <mesh position={[0, 0.03, 0]} castShadow rotation={[0.05, 0, 0]}>
        <capsuleGeometry args={[0.028, 0.16, 5, 6]} />
        <CritterMat color={color} rough={0.88} />
      </mesh>
      {/* head slightly triangular */}
      <mesh position={[0, 0.035, 0.12]} scale={[0.85, 0.7, 1.1]} castShadow>
        <sphereGeometry args={[0.03, 6, 5]} />
        <CritterMat color={color} />
      </mesh>
      {/* eye dots */}
      <mesh position={[0.018, 0.045, 0.13]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#1a1a10" />
      </mesh>
      <mesh position={[-0.018, 0.045, 0.13]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#1a1a10" />
      </mesh>
      {/* long tapering tail */}
      <mesh position={[0, 0.025, -0.16]} rotation={[0.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.022, 0.2, 5]} />
        <CritterMat color={color} />
      </mesh>
      <mesh position={[0, 0.02, -0.28]} rotation={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.008, 0.1, 4]} />
        <CritterMat color={color} />
      </mesh>
      {/* legs splayed */}
      {[
        [-0.04, 0.05, 0.5],
        [0.04, 0.05, -0.5],
        [-0.04, -0.05, 0.5],
        [0.04, -0.05, -0.5],
      ].map(([s, zz, rz], i) => (
        <mesh key={i} position={[s, 0.01, zz]} rotation={[0.3, 0, rz]}>
          <capsuleGeometry args={[0.007, 0.035, 3, 4]} />
          <CritterMat color={color} />
        </mesh>
      ))}
    </group>
  );
}

export function Gecko({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    // climbs vertical-ish then sideways
    const climb = 0.2 + (Math.sin(t * 0.28 + phase) * 0.5 + 0.5) * 1.2;
    const side = Math.sin(t * 0.18 + phase) * 3.5 + Math.sin(t * 0.07 + phase * 2) * 1.2;
    root.current.position.set(x + side, y + climb, z + Math.cos(t * 0.15 + phase) * 2.5);
    root.current.rotation.z = Math.sin(t * 0.25 + phase) * 0.35;
    root.current.rotation.x = -0.4;
    root.current.rotation.y = phase + t * 0.15;
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.48}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <capsuleGeometry args={[0.025, 0.11, 4, 6]} />
        <CritterMat color="#c9a86c" rough={0.7} />
      </mesh>
      {/* wide head */}
      <mesh position={[0, 0.025, 0.08]} scale={[1.15, 0.75, 0.9]} castShadow>
        <sphereGeometry args={[0.028, 6, 5]} />
        <CritterMat color="#d4b87a" rough={0.7} />
      </mesh>
      {/* large eyes */}
      <mesh position={[0.02, 0.04, 0.09]}>
        <sphereGeometry args={[0.012, 5, 4]} />
        <meshStandardMaterial color="#2a2010" roughness={0.35} />
      </mesh>
      <mesh position={[-0.02, 0.04, 0.09]}>
        <sphereGeometry args={[0.012, 5, 4]} />
        <meshStandardMaterial color="#2a2010" roughness={0.35} />
      </mesh>
      {/* fat tail */}
      <mesh position={[0, 0.02, -0.12]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.02, 0.12, 5]} />
        <CritterMat color="#b89860" />
      </mesh>
      {/* toe pads */}
      {[
        [-0.035, 0.05],
        [0.035, 0.05],
        [-0.035, -0.04],
        [0.035, -0.04],
      ].map(([s, zz], i) => (
        <mesh key={i} position={[s, 0.005, zz]}>
          <sphereGeometry args={[0.014, 5, 4]} />
          <CritterMat color="#a88858" rough={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function Rat({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.7 + (phase % 1) * 0.35;
    // pause-dash-pause
    const wave = Math.sin(t * spd + phase);
    const dashing = wave > 0.15;
    const px = x + Math.sin(t * spd * 0.3 + phase) * 7.0 + Math.sin(t * spd * 0.11 + phase * 1.8) * 2.5;
    const pz = z + Math.cos(t * spd * 0.26 + phase) * 5.5 + Math.cos(t * spd * 0.09 + phase) * 2.0;
    const lerp = dashing ? 0.1 : 0.02;
    root.current.position.x += (px - root.current.position.x) * lerp;
    root.current.position.z += (pz - root.current.position.z) * lerp;
    root.current.position.y = y + 0.035;
    if (dashing) {
      root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
    }
    root.current.rotation.x = dashing ? Math.sin(t * 14) * 0.05 : 0;
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.5}>
      {/* body */}
      <mesh position={[0, 0.045, 0]} castShadow scale={[1, 0.85, 1.15]}>
        <capsuleGeometry args={[0.04, 0.1, 5, 6]} />
        <CritterMat color="#5c4a3e" rough={0.92} />
      </mesh>
      {/* head pointed */}
      <mesh position={[0, 0.05, 0.1]} scale={[0.8, 0.7, 1.15]} castShadow>
        <sphereGeometry args={[0.038, 6, 5]} />
        <CritterMat color="#6a5648" />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.04, 0.14]} scale={[0.5, 0.45, 0.7]}>
        <sphereGeometry args={[0.025, 5, 4]} />
        <CritterMat color="#7a6555" />
      </mesh>
      {/* ears rounded */}
      <mesh position={[0.035, 0.09, 0.08]} scale={[1, 1.1, 0.5]}>
        <sphereGeometry args={[0.02, 5, 4]} />
        <CritterMat color="#8a6a60" />
      </mesh>
      <mesh position={[-0.035, 0.09, 0.08]} scale={[1, 1.1, 0.5]}>
        <sphereGeometry args={[0.02, 5, 4]} />
        <CritterMat color="#8a6a60" />
      </mesh>
      {/* eyes */}
      <mesh position={[0.02, 0.06, 0.12]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#1a1008" />
      </mesh>
      <mesh position={[-0.02, 0.06, 0.12]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#1a1008" />
      </mesh>
      {/* long scaly tail */}
      <mesh position={[0, 0.03, -0.14]} rotation={[0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.014, 0.28, 5]} />
        <CritterMat color="#7a5a50" rough={0.8} />
      </mesh>
      {/* legs */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.035, 0.015, 0.04]} rotation={[0.2, 0, s * 0.2]}>
            <capsuleGeometry args={[0.01, 0.03, 3, 4]} />
            <CritterMat color="#4a3a30" />
          </mesh>
          <mesh position={[s * 0.035, 0.015, -0.05]} rotation={[0.2, 0, s * 0.2]}>
            <capsuleGeometry args={[0.01, 0.03, 3, 4]} />
            <CritterMat color="#4a3a30" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Mouse({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 1.0 + (phase % 1) * 0.4;
    const wave = Math.sin(t * spd + phase);
    const dashing = wave > 0;
    const px = x + Math.sin(t * spd * 0.35 + phase) * 4.0 + Math.sin(t * spd * 0.12 + phase * 2) * 1.5;
    const pz = z + Math.cos(t * spd * 0.3 + phase) * 3.2 + Math.cos(t * spd * 0.1 + phase) * 1.2;
    const lerp = dashing ? 0.12 : 0.03;
    root.current.position.x += (px - root.current.position.x) * lerp;
    root.current.position.z += (pz - root.current.position.z) * lerp;
    root.current.position.y = y + 0.02;
    if (dashing) root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.35}>
      <mesh position={[0, 0.03, 0]} castShadow scale={[1, 0.8, 1.1]}>
        <capsuleGeometry args={[0.028, 0.07, 4, 5]} />
        <CritterMat color="#8a7a6c" />
      </mesh>
      <mesh position={[0, 0.035, 0.06]} scale={[0.85, 0.75, 1]} castShadow>
        <sphereGeometry args={[0.028, 6, 5]} />
        <CritterMat color="#9a8a7c" />
      </mesh>
      <mesh position={[0.022, 0.06, 0.05]} scale={[1, 1.2, 0.45]}>
        <sphereGeometry args={[0.016, 5, 4]} />
        <CritterMat color="#b0a090" />
      </mesh>
      <mesh position={[-0.022, 0.06, 0.05]} scale={[1, 1.2, 0.45]}>
        <sphereGeometry args={[0.016, 5, 4]} />
        <CritterMat color="#b0a090" />
      </mesh>
      <mesh position={[0, 0.02, -0.1]} rotation={[0.45, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.01, 0.14, 4]} />
        <CritterMat color="#7a6a60" />
      </mesh>
    </group>
  );
}

export function Beetle({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    root.current.position.x = x + Math.sin(t * 0.2 + phase) * 2.8 + Math.sin(t * 0.07 + phase) * 1.0;
    root.current.position.z = z + Math.cos(t * 0.18 + phase) * 2.4 + Math.cos(t * 0.06 + phase) * 0.9;
    root.current.position.y = y + 0.015;
    root.current.rotation.y = t * 0.35 + phase;
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.32}>
      {/* elytra dome */}
      <mesh position={[0, 0.03, 0]} scale={[1, 0.65, 1.2]} castShadow>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color="#1c2818" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.03, 0.01]} scale={[0.15, 0.5, 1.1]}>
        <boxGeometry args={[0.02, 0.04, 0.08]} />
        <meshStandardMaterial color="#0a1208" roughness={0.5} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.025, 0.055]}>
        <sphereGeometry args={[0.025, 6, 5]} />
        <meshStandardMaterial color="#243020" roughness={0.5} metalness={0.25} />
      </mesh>
      {/* legs */}
      {[-1, 1].map((s) =>
        [0.03, 0, -0.03].map((zz, i) => (
          <mesh key={`${s}-${i}`} position={[s * 0.04, 0.01, zz]} rotation={[0, 0, s * 0.7]}>
            <cylinderGeometry args={[0.005, 0.005, 0.04, 4]} />
            <meshStandardMaterial color="#1a2018" />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Crab({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    // sideways crab walk
    root.current.position.x = x + Math.sin(t * 0.35 + phase) * 3.5 + Math.sin(t * 0.12 + phase) * 1.2;
    root.current.position.z = z + Math.cos(t * 0.2 + phase) * 2.0 + Math.cos(t * 0.08 + phase) * 0.8;
    root.current.position.y = y + 0.03;
    root.current.rotation.y = Math.PI / 2 + Math.sin(t * 0.55 + phase) * 0.15;
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.45}>
      {/* carapace */}
      <mesh position={[0, 0.04, 0]} scale={[1.3, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.07, 8, 5]} />
        <CritterMat color="#c45a30" rough={0.65} />
      </mesh>
      {/* claws */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1, 0.04, 0.06]}>
          <mesh rotation={[0, 0, s * 0.4]} castShadow>
            <boxGeometry args={[0.07, 0.03, 0.04]} />
            <CritterMat color="#d46a38" />
          </mesh>
          <mesh position={[s * 0.04, 0, 0.02]} rotation={[0, 0, s * 0.2]}>
            <boxGeometry args={[0.035, 0.02, 0.025]} />
            <CritterMat color="#e07a40" />
          </mesh>
        </group>
      ))}
      {/* walking legs */}
      {[-1, 1].map((s) =>
        [0.03, 0, -0.03, -0.06].map((zz, i) => (
          <mesh key={`${s}-${i}`} position={[s * 0.08, 0.015, zz]} rotation={[0.2, 0, s * (0.5 + i * 0.1)]}>
            <capsuleGeometry args={[0.008, 0.04, 3, 4]} />
            <CritterMat color="#a04a28" />
          </mesh>
        )),
      )}
      {/* eyestalks */}
      <mesh position={[0.025, 0.08, 0.03]}>
        <sphereGeometry args={[0.012, 5, 4]} />
        <meshStandardMaterial color="#1a1008" />
      </mesh>
      <mesh position={[-0.025, 0.08, 0.03]}>
        <sphereGeometry args={[0.012, 5, 4]} />
        <meshStandardMaterial color="#1a1008" />
      </mesh>
    </group>
  );
}


export function Snake({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const segs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.2 + (phase % 1) * 0.08;
    const px = x + Math.sin(t * spd + phase) * 9 + Math.sin(t * spd * 0.4 + phase * 2) * 3;
    const pz = z + Math.cos(t * spd * 0.85 + phase) * 7 + Math.cos(t * spd * 0.3 + phase) * 2.5;
    root.current.position.x += (px - root.current.position.x) * 0.04;
    root.current.position.z += (pz - root.current.position.z) * 0.04;
    root.current.position.y = y + 0.04;
    root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
    segs.current.forEach((s, i) => {
      if (!s) return;
      s.position.x = Math.sin(t * 6 + phase + i * 0.7) * 0.03;
    });
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.55}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} ref={(el) => { segs.current[i] = el; }} position={[0, 0.02, -i * 0.07]}>
          <mesh castShadow>
            <sphereGeometry args={[0.028 - i * 0.002, 6, 5]} />
            <meshStandardMaterial color={i % 2 ? "#4a6b28" : "#3a5a20"} roughness={0.75} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.03, 0.05]} scale={[0.9, 0.7, 1.1]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#5a7a30" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Tortoise({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.06 + (phase % 1) * 0.03;
    const px = x + Math.sin(t * spd + phase) * 5 + Math.sin(t * spd * 0.4 + phase) * 1.5;
    const pz = z + Math.cos(t * spd * 0.9 + phase) * 4 + Math.cos(t * spd * 0.35 + phase) * 1.2;
    root.current.position.x += (px - root.current.position.x) * 0.02;
    root.current.position.z += (pz - root.current.position.z) * 0.02;
    root.current.position.y = y + 0.05;
    root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.65}>
      <mesh position={[0, 0.08, 0]} scale={[1.2, 0.7, 1.4]} castShadow>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color="#5a4a28" roughness={0.95} />
      </mesh>
      {/* shell pattern bumps */}
      {[[0.05, 0.12, 0.04], [-0.05, 0.12, 0.04], [0, 0.13, -0.05]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} scale={[0.6, 0.4, 0.6]}>
          <sphereGeometry args={[0.05, 5, 4]} />
          <meshStandardMaterial color="#4a3a20" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0.14]} scale={[0.8, 0.6, 0.9]} castShadow>
        <sphereGeometry args={[0.05, 6, 5]} />
        <meshStandardMaterial color="#6a5a30" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.08, 0.03, 0.08]}>
            <capsuleGeometry args={[0.02, 0.04, 3, 4]} />
            <meshStandardMaterial color="#5a4a28" />
          </mesh>
          <mesh position={[s * 0.08, 0.03, -0.08]}>
            <capsuleGeometry args={[0.02, 0.04, 3, 4]} />
            <meshStandardMaterial color="#5a4a28" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Hare({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.35 + (phase % 1) * 0.15;
    const hop = Math.max(0, Math.sin(t * 3.5 + phase)) ** 4 * 0.25;
    const px = x + Math.sin(t * spd + phase) * 11 + Math.sin(t * spd * 0.4 + phase * 2) * 4;
    const pz = z + Math.cos(t * spd * 0.8 + phase) * 9 + Math.cos(t * spd * 0.3 + phase) * 3;
    root.current.position.x += (px - root.current.position.x) * 0.06;
    root.current.position.z += (pz - root.current.position.z) * 0.06;
    root.current.position.y = y + hop + 0.05;
    root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.5}>
      <mesh position={[0, 0.08, 0]} scale={[0.9, 0.8, 1.2]} castShadow>
        <sphereGeometry args={[0.08, 7, 6]} />
        <meshStandardMaterial color="#c4a878" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.1, 0.09]} scale={[0.85, 0.75, 0.9]} castShadow>
        <sphereGeometry args={[0.055, 6, 5]} />
        <meshStandardMaterial color="#d4b888" roughness={0.88} />
      </mesh>
      {/* long ears */}
      <mesh position={[0.025, 0.18, 0.08]} rotation={[0.2, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.015, 0.08, 3, 5]} />
        <meshStandardMaterial color="#c4a878" roughness={0.9} />
      </mesh>
      <mesh position={[-0.025, 0.18, 0.08]} rotation={[0.2, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.015, 0.08, 3, 5]} />
        <meshStandardMaterial color="#c4a878" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, -0.1]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.02, 0.1, 5]} />
        <meshStandardMaterial color="#b49868" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.04, 0.03, -0.05]}>
          <capsuleGeometry args={[0.015, 0.05, 3, 4]} />
          <meshStandardMaterial color="#b49868" />
        </mesh>
      ))}
    </group>
  );
}

export function Squirrel({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.4 + (phase % 1) * 0.2;
    const climb = Math.abs(Math.sin(t * 0.5 + phase)) * 1.4;
    const px = x + Math.sin(t * spd + phase) * 6 + Math.sin(t * spd * 0.35 + phase) * 2;
    const pz = z + Math.cos(t * spd * 0.85 + phase) * 5 + Math.cos(t * spd * 0.3 + phase) * 1.8;
    root.current.position.x += (px - root.current.position.x) * 0.07;
    root.current.position.z += (pz - root.current.position.z) * 0.07;
    root.current.position.y = y + 0.04 + climb;
    root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
  });
  return (
    <group ref={root} position={[x, y, z]} scale={0.4}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <sphereGeometry args={[0.06, 7, 5]} />
        <meshStandardMaterial color="#8a5a30" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0.06]} castShadow>
        <sphereGeometry args={[0.04, 6, 5]} />
        <meshStandardMaterial color="#9a6a40" roughness={0.88} />
      </mesh>
      {/* bushy tail */}
      <mesh position={[0, 0.12, -0.08]} scale={[0.8, 1.2, 0.7]} castShadow>
        <sphereGeometry args={[0.07, 6, 5]} />
        <meshStandardMaterial color="#7a4a28" roughness={0.95} />
      </mesh>
      <mesh position={[0.02, 0.11, 0.06]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#a07050" />
      </mesh>
      <mesh position={[-0.02, 0.11, 0.06]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#a07050" />
      </mesh>
    </group>
  );
}

export function Butterfly({
  x,
  y = 1.2,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.3 + (phase % 1) * 0.15;
    root.current.position.x = x + Math.sin(t * spd + phase) * 8 + Math.sin(t * 0.7 + phase) * 1.5;
    root.current.position.z = z + Math.cos(t * spd * 0.9 + phase) * 7 + Math.cos(t * 0.6 + phase) * 1.2;
    root.current.position.y = y + Math.sin(t * 1.5 + phase) * 0.8 + 0.5;
    root.current.rotation.y = t * spd + phase;
    const flap = Math.sin(t * 12 + phase) * 0.7;
    if (wingL.current) wingL.current.rotation.z = 0.4 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.4 - flap;
  });
  const wingColor = phase % 1 > 0.5 ? "#e8a020" : "#c04060";
  return (
    <group ref={root} position={[x, y, z]} scale={0.35}>
      <mesh>
        <capsuleGeometry args={[0.015, 0.04, 3, 4]} />
        <meshStandardMaterial color="#2a2a20" />
      </mesh>
      <mesh ref={wingL} position={[-0.04, 0, 0]} rotation={[0, 0, 0.4]}>
        <planeGeometry args={[0.1, 0.07]} />
        <meshStandardMaterial color={wingColor} side={2} transparent opacity={0.85} />
      </mesh>
      <mesh ref={wingR} position={[0.04, 0, 0]} rotation={[0, 0, -0.4]}>
        <planeGeometry args={[0.1, 0.07]} />
        <meshStandardMaterial color={wingColor} side={2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export function Chameleon({
  x,
  y = 0,
  z,
  phase = 0,
}: {
  x: number;
  y?: number;
  z: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    const spd = 0.1 + (phase % 1) * 0.05;
    const climb = 0.3 + Math.abs(Math.sin(t * 0.2 + phase)) * 1.0;
    const px = x + Math.sin(t * spd + phase) * 5 + Math.sin(t * spd * 0.4 + phase) * 1.5;
    const pz = z + Math.cos(t * spd * 0.85 + phase) * 4;
    root.current.position.x += (px - root.current.position.x) * 0.03;
    root.current.position.z += (pz - root.current.position.z) * 0.03;
    root.current.position.y = y + climb;
    root.current.rotation.y = Math.atan2(px - root.current.position.x, pz - root.current.position.z);
  });
  const hue = phase % 1 > 0.5 ? "#5a8a30" : "#3a7a50";
  return (
    <group ref={root} position={[x, y, z]} scale={0.5}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
        <meshStandardMaterial color={hue} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.05, 0.1]} scale={[1.1, 0.9, 1]} castShadow>
        <sphereGeometry args={[0.04, 6, 5]} />
        <meshStandardMaterial color={hue} roughness={0.85} />
      </mesh>
      {/* turret eyes */}
      <mesh position={[0.03, 0.07, 0.12]}>
        <sphereGeometry args={[0.015, 5, 4]} />
        <meshStandardMaterial color="#2a4018" />
      </mesh>
      <mesh position={[-0.03, 0.07, 0.12]}>
        <sphereGeometry args={[0.015, 5, 4]} />
        <meshStandardMaterial color="#2a4018" />
      </mesh>
      <mesh position={[0, 0.04, -0.12]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.025, 0.14, 5]} />
        <meshStandardMaterial color={hue} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.04, 0.02, 0.04]} rotation={[0, 0, s * 0.5]}>
            <capsuleGeometry args={[0.01, 0.04, 3, 4]} />
            <meshStandardMaterial color={hue} />
          </mesh>
          <mesh position={[s * 0.04, 0.02, -0.04]} rotation={[0, 0, s * 0.5]}>
            <capsuleGeometry args={[0.01, 0.04, 3, 4]} />
            <meshStandardMaterial color={hue} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
