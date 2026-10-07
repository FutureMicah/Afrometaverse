import { useMemo } from "react";
import type { CharacterPreset } from "@/stores/characterStore";
import { OUTFIT_COLORS } from "@/stores/characterStore";

type Props = {
  preset: CharacterPreset;
  /** Scale whole figure */
  scale?: number;
  /** Subtle idle bob phase offset */
  phase?: number;
};

/**
 * Fashion-forward stylized citizen — oversized coats, bold colour blocking,
 * rounded head. Procedural R3F stand-in for the 3D fashion ref direction.
 */
export function StylizedCharacter({ preset, scale = 1 }: Props) {
  const outfit = OUTFIT_COLORS[preset.outfit];
  const buildScale = preset.build === "broad" ? 1.15 : preset.build === "slim" ? 0.9 : 1;
  const shoulder = 0.42 * buildScale;
  const torsoW = 0.5 * buildScale;
  const legSpread = 0.12 * buildScale;

  const hairMesh = useMemo(() => {
    switch (preset.hair) {
      case "afro":
        return (
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.32, 12, 12]} />
            <meshStandardMaterial color={preset.hairColor} roughness={0.95} />
          </mesh>
        );
      case "bob":
        return (
          <group>
            <mesh position={[0, 1.42, 0]}>
              <sphereGeometry args={[0.28, 12, 10]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
            <mesh position={[0, 1.25, 0.05]}>
              <boxGeometry args={[0.48, 0.28, 0.35]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
          </group>
        );
      case "braids":
        return (
          <group>
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[0.24, 10, 10]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
            {[-0.12, 0, 0.12].map((x, i) => (
              <mesh key={i} position={[x, 1.65 + i * 0.02, -0.05]}>
                <cylinderGeometry args={[0.04, 0.03, 0.35, 6]} />
                <meshStandardMaterial color={preset.hairColor} />
              </mesh>
            ))}
          </group>
        );
      case "bun":
        return (
          <group>
            <mesh position={[0, 1.48, 0]}>
              <sphereGeometry args={[0.22, 10, 10]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
            <mesh position={[0, 1.72, -0.05]}>
              <sphereGeometry args={[0.14, 10, 10]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
          </group>
        );
      case "beanie":
        return (
          <group>
            <mesh position={[0, 1.52, 0]}>
              <cylinderGeometry args={[0.26, 0.28, 0.28, 12]} />
              <meshStandardMaterial color={preset.hairColor} roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.68, 0]}>
              <sphereGeometry args={[0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={preset.hairColor} />
            </mesh>
          </group>
        );
      default:
        return (
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color={preset.hairColor} />
          </mesh>
        );
    }
  }, [preset.hair, preset.hairColor]);

  const isFur = preset.outfit === "pink-fur" || preset.outfit === "coral-coat";
  const isLongCoat =
    preset.outfit === "pink-fur" ||
    preset.outfit === "coral-coat" ||
    preset.outfit === "olive-blazer";

  return (
    <group scale={scale}>
      {/* Legs / pants */}
      <mesh position={[-legSpread, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.45, 4, 8]} />
        <meshStandardMaterial color={outfit.secondary} />
      </mesh>
      <mesh position={[legSpread, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.45, 4, 8]} />
        <meshStandardMaterial color={outfit.secondary} />
      </mesh>
      {/* Shoes */}
      <mesh position={[-legSpread, 0.06, 0.04]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[legSpread, 0.06, 0.04]}>
        <boxGeometry args={[0.16, 0.1, 0.24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Oversized torso / coat */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[torsoW * 0.55, isLongCoat ? 0.55 : 0.4, 6, 10]} />
        <meshStandardMaterial
          color={outfit.primary}
          roughness={isFur ? 0.95 : 0.55}
          metalness={0}
        />
      </mesh>
      {/* Extra bulk for fashion volume */}
      {isLongCoat && (
        <mesh position={[0, 0.85, 0.05]} castShadow>
          <boxGeometry args={[torsoW * 1.35, 0.85, 0.45]} />
          <meshStandardMaterial color={outfit.primary} roughness={isFur ? 0.98 : 0.6} />
        </mesh>
      )}
      {/* Collar / inner */}
      <mesh position={[0, 1.15, 0.12]}>
        <boxGeometry args={[0.28, 0.2, 0.12]} />
        <meshStandardMaterial color={outfit.accent} />
      </mesh>

      {/* Arms */}
      <mesh position={[-shoulder, 0.95, 0]} rotation={[0, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        <meshStandardMaterial color={outfit.primary} roughness={isFur ? 0.95 : 0.55} />
      </mesh>
      <mesh position={[shoulder, 0.95, 0]} rotation={[0, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        <meshStandardMaterial color={outfit.primary} roughness={isFur ? 0.95 : 0.55} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 14]} />
        <meshStandardMaterial color={preset.skin} roughness={0.65} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 8]} />
        <meshStandardMaterial color={preset.skin} />
      </mesh>

      {/* Simple face — eyes */}
      <mesh position={[-0.07, 1.4, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 1.4, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Nose hint */}
      <mesh position={[0, 1.35, 0.2]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={preset.skin} />
      </mesh>

      {hairMesh}

      {/* Accessories */}
      {preset.accessory === "glasses" && (
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
      {preset.accessory === "shades" && (
        <mesh position={[0, 1.4, 0.2]}>
          <boxGeometry args={[0.28, 0.08, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} />
        </mesh>
      )}
      {preset.accessory === "hoops" && (
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
      {preset.accessory === "chain" && (
        <mesh position={[0, 1.12, 0.15]}>
          <torusGeometry args={[0.1, 0.015, 6, 14]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

export default StylizedCharacter;
