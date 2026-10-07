import { useMemo } from "react";
import {
  CLOTHING_CATALOG,
  type CharacterAppearance,
  type EquippedLoadout,
} from "@/stores/characterStore";

type Props = {
  appearance: CharacterAppearance;
  equipped: EquippedLoadout;
  scale?: number;
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

/**
 * Beginner look: white tee + blue jeans.
 * Body shape / height / hair editable. Clothes from equipped loadout.
 */
export function StylizedCharacter({ appearance, equipped, scale = 1 }: Props) {
  const heightMul =
    appearance.height === "short" ? 0.92 : appearance.height === "tall" ? 1.08 : 1;

  const shape = appearance.bodyShape;
  const hip =
    shape === "curvy" ? 1.25 : shape === "broad" ? 1.2 : shape === "slim" ? 0.88 : shape === "athletic" ? 1.05 : 1;
  const shoulder =
    shape === "broad" || shape === "athletic" ? 1.2 : shape === "slim" ? 0.9 : shape === "curvy" ? 1.05 : 1;
  const waist =
    shape === "curvy" ? 0.92 : shape === "athletic" ? 0.95 : shape === "broad" ? 1.1 : shape === "slim" ? 0.85 : 1;

  const topC = itemColor(equipped.top, "#f8fafc");
  const bottomC = itemColor(equipped.bottom, "#2563eb");
  const shoeC = itemColor(equipped.shoes, "#e5e7eb");
  const outerC = equipped.outer ? itemColor(equipped.outer, "#6b7280") : null;
  const hatC = equipped.hat ? itemColor(equipped.hat, "#166534") : null;
  const acc = CLOTHING_CATALOG.find((c) => c.id === equipped.accessory);

  const isSkirt = equipped.bottom === "bottom-skirt";
  const isFur = equipped.outer === "outer-pink-fur" || equipped.outer === "outer-coral-coat";

  const hair = useMemo(() => {
    const c = appearance.hairColor;
    switch (appearance.hair) {
      case "afro":
        return (
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.32, 12, 12]} />
            <meshStandardMaterial color={c} roughness={0.95} />
          </mesh>
        );
      case "bob":
        return (
          <group>
            <mesh position={[0, 1.42, 0]}>
              <sphereGeometry args={[0.28, 12, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
            <mesh position={[0, 1.25, 0.05]}>
              <boxGeometry args={[0.48, 0.28, 0.35]} />
              <meshStandardMaterial color={c} />
            </mesh>
          </group>
        );
      case "braids":
        return (
          <group>
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[0.24, 10, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
            {[-0.12, 0, 0.12].map((x, i) => (
              <mesh key={i} position={[x, 1.68, -0.04]}>
                <cylinderGeometry args={[0.04, 0.03, 0.4, 6]} />
                <meshStandardMaterial color={c} />
              </mesh>
            ))}
          </group>
        );
      case "bun":
        return (
          <group>
            <mesh position={[0, 1.48, 0]}>
              <sphereGeometry args={[0.22, 10, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
            <mesh position={[0, 1.72, -0.05]}>
              <sphereGeometry args={[0.14, 10, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
          </group>
        );
      case "long":
        return (
          <group>
            <mesh position={[0, 1.45, 0]}>
              <sphereGeometry args={[0.24, 10, 10]} />
              <meshStandardMaterial color={c} />
            </mesh>
            <mesh position={[0, 1.15, -0.08]}>
              <boxGeometry args={[0.4, 0.5, 0.2]} />
              <meshStandardMaterial color={c} />
            </mesh>
          </group>
        );
      case "bald":
        return null;
      default:
        return (
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={c} />
          </mesh>
        );
    }
  }, [appearance.hair, appearance.hairColor]);

  return (
    <group scale={scale * heightMul}>
      {/* Legs / jeans or skirt */}
      {isSkirt ? (
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.2 * hip, 0.28 * hip, 0.45, 10]} />
          <meshStandardMaterial color={bottomC} />
        </mesh>
      ) : (
        <>
          <mesh position={[-0.11 * hip, 0.35, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.48, 4, 8]} />
            <meshStandardMaterial color={bottomC} />
          </mesh>
          <mesh position={[0.11 * hip, 0.35, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.48, 4, 8]} />
            <meshStandardMaterial color={bottomC} />
          </mesh>
        </>
      )}

      {/* Shoes */}
      <mesh position={[-0.11 * hip, 0.06, 0.04]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color={shoeC} />
      </mesh>
      <mesh position={[0.11 * hip, 0.06, 0.04]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color={shoeC} />
      </mesh>

      {/* White tee / top */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <capsuleGeometry args={[0.26 * waist, 0.38, 6, 10]} />
        <meshStandardMaterial color={topC} roughness={0.7} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.55 * shoulder, 0.16, 0.28]} />
        <meshStandardMaterial color={topC} />
      </mesh>

      {/* Outer layer */}
      {outerC && (
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.34 * shoulder, isFur ? 0.55 : 0.42, 6, 10]} />
          <meshStandardMaterial color={outerC} roughness={isFur ? 0.98 : 0.55} />
        </mesh>
      )}

      {/* Arms */}
      <mesh position={[-0.34 * shoulder, 0.9, 0]} rotation={[0, 0, 0.4]} castShadow>
        <capsuleGeometry args={[0.08, 0.38, 4, 8]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.65} />
      </mesh>
      <mesh position={[0.34 * shoulder, 0.9, 0]} rotation={[0, 0, -0.4]} castShadow>
        <capsuleGeometry args={[0.08, 0.38, 4, 8]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.65} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 14]} />
        <meshStandardMaterial color={appearance.skin} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[-0.07, 1.4, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 1.4, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {hair}

      {/* Hat */}
      {hatC && (
        <mesh position={[0, 1.58, 0]}>
          <cylinderGeometry args={[0.26, 0.28, 0.22, 12]} />
          <meshStandardMaterial color={hatC} roughness={0.9} />
        </mesh>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.4, 0.2]}>
          <mesh position={[-0.08, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 6, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.4} />
          </mesh>
          <mesh position={[0.08, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 6, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.4} />
          </mesh>
        </group>
      )}
      {acc?.id === "acc-shades" && (
        <mesh position={[0, 1.4, 0.2]}>
          <boxGeometry args={[0.28, 0.08, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
        </mesh>
      )}
      {acc?.id === "acc-hoops" && (
        <>
          <mesh position={[-0.2, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 6, 12]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} />
          </mesh>
          <mesh position={[0.2, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 6, 12]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} />
          </mesh>
        </>
      )}
      {acc?.id === "acc-chain" && (
        <mesh position={[0, 1.12, 0.15]}>
          <torusGeometry args={[0.1, 0.015, 6, 14]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

export default StylizedCharacter;
