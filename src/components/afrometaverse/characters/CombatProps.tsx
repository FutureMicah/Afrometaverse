/**
 * Combat prop weapons — machete, staff, shield.
 * Parent to character hand / forearm groups; driven by combat activity.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CombatPropKind = "machete" | "staff" | "shield" | "none";

type Props = {
  /** Which prop to show */
  kind: CombatPropKind;
  /** Mirror for left hand (shield often left) */
  side?: "right" | "left";
  /** Extra local offset */
  offset?: [number, number, number];
  /** Animate a slight flourish while held */
  active?: boolean;
};

/** Curved machete / cutlass blade */
function MacheteMesh() {
  return (
    <group rotation={[0.15, 0, -0.35]} position={[0.02, -0.05, 0.08]}>
      {/* grip */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 0.14, 8]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>
      {/* guard */}
      <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.08, 6]} />
        <meshStandardMaterial color="#8a7a60" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* blade — long tapered box with slight curve via stacked segments */}
      <mesh position={[0.02, 0.28, 0]} rotation={[0, 0, 0.15]} castShadow>
        <boxGeometry args={[0.04, 0.42, 0.012]} />
        <meshStandardMaterial color="#b8c0c8" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0.05, 0.48, 0]} rotation={[0, 0, 0.35]} castShadow>
        <boxGeometry args={[0.055, 0.22, 0.01]} />
        <meshStandardMaterial color="#c5ced6" metalness={0.8} roughness={0.22} />
      </mesh>
      {/* tip hook */}
      <mesh position={[0.09, 0.58, 0]} rotation={[0, 0, 0.9]} castShadow>
        <boxGeometry args={[0.03, 0.1, 0.01]} />
        <meshStandardMaterial color="#aeb6be" metalness={0.78} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Ceremonial / combat staff */
function StaffMesh() {
  return (
    <group rotation={[0.4, 0, 0.1]} position={[0, -0.1, 0.05]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.022, 1.15, 8]} />
        <meshStandardMaterial color="#4a3220" roughness={0.9} />
      </mesh>
      {/* head ornament */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <coneGeometry args={[0.04, 0.1, 8]} />
        <meshStandardMaterial color="#a88720" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* grip wrap */}
      {[0.1, 0.18, 0.26].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.025, 0.008, 6, 10]} />
          <meshStandardMaterial color="#6b4423" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Round / kite shield with brass boss */
function ShieldMesh() {
  return (
    <group rotation={[0.2, 0.6, 0.15]} position={[-0.05, -0.05, 0.12]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.2, 16]} />
        <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshStandardMaterial color="#c9a227" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* rivets */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshStandardMaterial color="#a88720" metalness={0.8} roughness={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Attach near hand. `kind` switches mesh; slight idle sway when active.
 */
export function CombatProps({
  kind,
  side = "right",
  offset = [0, 0, 0],
  active = true,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const sign = side === "left" ? -1 : 1;

  useFrame(({ clock }) => {
    if (!ref.current || !active || kind === "none") return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 2.2) * 0.04 * sign;
    ref.current.rotation.x = Math.sin(t * 1.7) * 0.03;
  });

  if (kind === "none") return null;

  return (
    <group
      ref={ref}
      position={[offset[0] * sign, offset[1], offset[2]]}
      scale={[sign, 1, 1]}
    >
      {kind === "machete" && <MacheteMesh />}
      {kind === "staff" && <StaffMesh />}
      {kind === "shield" && <ShieldMesh />}
    </group>
  );
}

/** Map combat activity → held prop */
export function propForActivity(
  activity: string | null | undefined,
): { right: CombatPropKind; left: CombatPropKind } {
  switch (activity) {
    case "combat_slash":
    case "combat_overhead":
    case "combat_lunge":
    case "combat_combo":
    case "combat_ready":
      return { right: "machete", left: "none" };
    case "combat_staff":
      return { right: "staff", left: "none" };
    case "combat_guard":
    case "combat_block":
      return { right: "machete", left: "shield" };
    case "combat_kick":
    case "combat_dodge":
      return { right: "machete", left: "none" };
    default:
      return { right: "none", left: "none" };
  }
}

export default CombatProps;
