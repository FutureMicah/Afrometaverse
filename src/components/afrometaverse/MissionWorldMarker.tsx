/**
 * 3D beacon over the active mission objective district.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRoamStore, DISTRICT_WORLD } from "@/stores/roamStore";

export function MissionWorldMarker() {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const activeMission = useRoamStore((s) => s.activeMission);

  const objective = (() => {
    if (!activeMission) return null;
    const step = activeMission.steps.find((s) => !s.done);
    if (!step) return null;
    const world = DISTRICT_WORLD[step.districtId];
    if (!world) return null;
    return { x: world.x, z: world.z, label: step.label, kind: activeMission.kind };
  })();

  useFrame(({ clock }) => {
    if (!objective) return;
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
      const mat = ring.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = 0.35 + Math.sin(t * 3) * 0.12;
    }
    if (beam.current) {
      beam.current.position.y = 2.2 + Math.sin(t * 2.2) * 0.15;
    }
  });

  if (!objective) return null;

  const color =
    objective.kind === "heat" ? "#f97316" : objective.kind === "grey" ? "#a78bfa" : "#34d399";

  return (
    <group position={[objective.x, 0, objective.z]}>
      <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.25, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={beam} position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.08, 0.22, 4.2, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.85}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      {/* ground pulse */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <meshStandardMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default MissionWorldMarker;
