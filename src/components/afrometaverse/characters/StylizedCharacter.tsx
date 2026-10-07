import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CLOTHING_CATALOG,
  type CharacterAppearance,
  type EquippedLoadout,
} from "@/stores/characterStore";

type Props = {
  appearance: CharacterAppearance;
  equipped: EquippedLoadout;
  scale?: number;
  /** Enable subtle idle breathing / sway */
  animate?: boolean;
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

/**
 * Stylized citizen figure.
 * Beginners: white tee + blue jeans. Body/hair editable; clothes from loadout.
 */
export function StylizedCharacter({
  appearance,
  equipped,
  scale = 1,
  animate = true,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const isFemale = appearance.gender === "female";

  const heightMul =
    appearance.height === "short" ? 0.9 : appearance.height === "tall" ? 1.1 : 1;

  const shape = appearance.bodyShape;
  // Gender-aware base proportions
  const hipBase = isFemale ? 1.08 : 0.98;
  const shoulderBase = isFemale ? 0.95 : 1.12;
  const chestBase = isFemale ? 1.05 : 1.0;

  const hip =
    hipBase *
    (shape === "curvy" ? 1.28 : shape === "broad" ? 1.15 : shape === "slim" ? 0.88 : shape === "athletic" ? 1.05 : 1);
  const shoulder =
    shoulderBase *
    (shape === "broad" || shape === "athletic" ? 1.18 : shape === "slim" ? 0.88 : shape === "curvy" ? 1.02 : 1);
  const waist =
    (isFemale ? 0.92 : 1) *
    (shape === "curvy" ? 0.9 : shape === "athletic" ? 0.92 : shape === "broad" ? 1.08 : shape === "slim" ? 0.82 : 1);
  const chest =
    chestBase * (shape === "curvy" ? 1.12 : shape === "athletic" ? 1.08 : shape === "broad" ? 1.15 : 1);

  const topC = itemColor(equipped.top, "#f8fafc");
  const bottomC = itemColor(equipped.bottom, "#2563eb");
  const shoeC = itemColor(equipped.shoes, "#e5e7eb");
  const outerC = equipped.outer ? itemColor(equipped.outer, "#6b7280") : null;
  const hatC = equipped.hat ? itemColor(equipped.hat, "#166534") : null;
  const acc = CLOTHING_CATALOG.find((c) => c.id === equipped.accessory);

  const isSkirt = equipped.bottom === "bottom-skirt";
  const isFur = equipped.outer === "outer-pink-fur" || equipped.outer === "outer-coral-coat";

  useFrame(({ clock }) => {
    if (!animate || !root.current) return;
    const t = clock.getElapsedTime();
    root.current.position.y = Math.sin(t * 1.6) * 0.015;
    root.current.rotation.y = Math.sin(t * 0.5) * 0.04;
  });

  return (
    <group ref={root} scale={scale * heightMul}>
      {/* Legs */}
      {isSkirt ? (
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.18 * hip, 0.3 * hip, 0.48, 12]} />
          <meshStandardMaterial color={bottomC} />
        </mesh>
      ) : (
        <>
          <mesh position={[-0.12 * hip, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.1 * (isFemale ? 0.95 : 1.05), 0.5, 4, 8]} />
            <meshStandardMaterial color={bottomC} />
          </mesh>
          <mesh position={[0.12 * hip, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.1 * (isFemale ? 0.95 : 1.05), 0.5, 4, 8]} />
            <meshStandardMaterial color={bottomC} />
          </mesh>
          {/* Jean seam hint */}
          <mesh position={[0, 0.55, 0.11]}>
            <boxGeometry args={[0.02, 0.35, 0.02]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
        </>
      )}

      {/* Shoes */}
      <mesh position={[-0.12 * hip, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.28]} />
        <meshStandardMaterial color={shoeC} />
      </mesh>
      <mesh position={[0.12 * hip, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.28]} />
        <meshStandardMaterial color={shoeC} />
      </mesh>

      {/* Hips / jeans waist */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.22 * hip, 12, 10]} />
        <meshStandardMaterial color={bottomC} />
      </mesh>

      {/* Torso — white tee */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.24 * waist, 0.4, 6, 12]} />
        <meshStandardMaterial color={topC} roughness={0.75} />
      </mesh>
      {/* Chest volume */}
      <mesh position={[0, 1.05, 0.04]} castShadow>
        <sphereGeometry args={[0.2 * chest, 12, 10]} />
        <meshStandardMaterial color={topC} roughness={0.75} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[0.58 * shoulder, 0.14, 0.26]} />
        <meshStandardMaterial color={topC} />
      </mesh>

      {/* Outerwear */}
      {outerC && (
        <mesh position={[0, 0.98, 0]} castShadow>
          <capsuleGeometry args={[0.36 * shoulder, isFur ? 0.58 : 0.45, 6, 12]} />
          <meshStandardMaterial color={outerC} roughness={isFur ? 0.98 : 0.55} />
        </mesh>
      )}

      {/* Arms */}
      <mesh position={[-0.36 * shoulder, 0.92, 0]} rotation={[0, 0, 0.45]} castShadow>
        <capsuleGeometry args={[0.075, 0.4, 4, 8]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.7} />
      </mesh>
      <mesh position={[0.36 * shoulder, 0.92, 0]} rotation={[0, 0, -0.45]} castShadow>
        <capsuleGeometry args={[0.075, 0.4, 4, 8]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.7} />
      </mesh>
      {/* Hands */}
      <mesh position={[-0.48 * shoulder, 0.62, 0.05]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0.48 * shoulder, 0.62, 0.05]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>

      {/* Neck + head */}
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.14, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <sphereGeometry args={[0.23, 18, 16]} />
        <meshStandardMaterial color={appearance.skin} roughness={0.6} />
      </mesh>

      {/* Face */}
      {/* Eyes white */}
      <mesh position={[-0.07, 1.42, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0.07, 1.42, 0.19]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.07, 1.42, 0.22]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 1.42, 0.22]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Brows */}
      <mesh position={[-0.07, 1.48, 0.2]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.09, 0.015, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      <mesh position={[0.07, 1.48, 0.2]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.09, 0.015, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 1.36, 0.22]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      {/* Lips */}
      <mesh position={[0, 1.28, 0.2]}>
        <boxGeometry args={[0.08, 0.025, 0.03]} />
        <meshStandardMaterial color={isFemale ? "#c45c6a" : "#8b5a5a"} />
      </mesh>

      {/* Hair */}
      <HairMesh style={appearance.hair} color={appearance.hairColor} />

      {/* Hat over hair */}
      {hatC && (
        <group position={[0, 1.58, 0]}>
          <mesh>
            <cylinderGeometry args={[0.27, 0.29, 0.22, 14]} />
            <meshStandardMaterial color={hatC} roughness={0.9} />
          </mesh>
          {equipped.hat === "hat-wide" && (
            <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.28, 0.48, 20]} />
              <meshStandardMaterial color={hatC} side={2} />
            </mesh>
          )}
        </group>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.42, 0.21]}>
          <mesh position={[-0.08, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh position={[0.08, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.01, 0.01]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        </group>
      )}
      {acc?.id === "acc-shades" && (
        <mesh position={[0, 1.42, 0.21]}>
          <boxGeometry args={[0.3, 0.09, 0.04]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} />
        </mesh>
      )}
      {acc?.id === "acc-hoops" && (
        <>
          <mesh position={[-0.22, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 14]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} />
          </mesh>
          <mesh position={[0.22, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 14]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.85} />
          </mesh>
        </>
      )}
      {acc?.id === "acc-chain" && (
        <mesh position={[0, 1.14, 0.14]}>
          <torusGeometry args={[0.11, 0.015, 6, 16]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

function HairMesh({
  style,
  color,
}: {
  style: CharacterAppearance["hair"];
  color: string;
}) {
  switch (style) {
    case "afro":
      return (
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.34, 14, 12]} />
          <meshStandardMaterial color={color} roughness={0.98} />
        </mesh>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 1.45, 0]}>
            <sphereGeometry args={[0.28, 12, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.22, 0.02]}>
            <boxGeometry args={[0.5, 0.32, 0.38]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "braids":
      return (
        <group>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.24, 10, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {[-0.14, -0.05, 0.05, 0.14].map((x, i) => (
            <mesh key={i} position={[x, 1.72, -0.05]} castShadow>
              <cylinderGeometry args={[0.035, 0.028, 0.45 + (i % 2) * 0.1, 6]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.74, -0.04]} castShadow>
            <sphereGeometry args={[0.15, 10, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.25, 12, 10]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.1, -0.1]} castShadow>
            <boxGeometry args={[0.42, 0.55, 0.22]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "bald":
      return null;
    default:
      return (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.23, 12, 10]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}

export default StylizedCharacter;
