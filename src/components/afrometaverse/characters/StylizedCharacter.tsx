import { useEffect, useMemo, useRef, useState } from "react";
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
  animate?: boolean;
  detail?: boolean;
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

/**
 * Fashion-leaning stylized citizen — closer to mockup silhouette than bare capsules.
 * Still real-time R3F (not a scanned photo double), but with volume coats,
 * shaped legs, layered hair, and readable face.
 */
export function StylizedCharacter({
  appearance,
  equipped,
  scale = 1,
  animate = true,
  detail = false,
}: Props) {
  const root = useRef<THREE.Group>(null);
  const isFemale = appearance.gender === "female";
  const [faceMap, setFaceMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!appearance.facePhoto) {
      setFaceMap(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(appearance.facePhoto, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setFaceMap(tex);
    });
  }, [appearance.facePhoto]);

  const heightMul =
    appearance.height === "short" ? 0.9 : appearance.height === "tall" ? 1.12 : 1;

  const shape = appearance.bodyShape;
  const hip =
    (isFemale ? 1.12 : 1) *
    (shape === "curvy" ? 1.28 : shape === "broad" ? 1.18 : shape === "slim" ? 0.86 : shape === "athletic" ? 1.06 : 1);
  const shoulder =
    (isFemale ? 0.95 : 1.14) *
    (shape === "broad" || shape === "athletic" ? 1.2 : shape === "slim" ? 0.88 : 1);
  const waist =
    (isFemale ? 0.88 : 0.98) *
    (shape === "curvy" ? 0.9 : shape === "slim" ? 0.82 : shape === "broad" ? 1.08 : 1);
  const chest =
    (isFemale ? 1.08 : 1.02) *
    (shape === "curvy" ? 1.14 : shape === "athletic" ? 1.1 : shape === "broad" ? 1.16 : 1);

  const topC = itemColor(equipped.top, "#f8fafc");
  const bottomC = itemColor(equipped.bottom, "#2563eb");
  const shoeC = itemColor(equipped.shoes, "#e5e7eb");
  const outerC = equipped.outer ? itemColor(equipped.outer, "#6b7280") : null;
  const hatC = equipped.hat ? itemColor(equipped.hat, "#166534") : null;
  const acc = CLOTHING_CATALOG.find((c) => c.id === equipped.accessory);
  const isSkirt = equipped.bottom === "bottom-skirt";
  const isFur = equipped.outer === "outer-pink-fur" || equipped.outer === "outer-coral-coat";
  const isCoat = !!outerC;

  // Sleeve bulk from tailor preference
  const sleeveW =
    appearance.sleevePreference === "oversized" ? 1.25 : appearance.sleevePreference === "fitted" ? 0.85 : 1;
  const hemY =
    appearance.hemPreference === "cropped" ? 0.88 : appearance.hemPreference === "long" ? 0.72 : 0.8;

  const postureLean =
    appearance.posture === "confident"
      ? 0.05
      : appearance.posture === "shy"
        ? -0.06
        : appearance.posture === "upright"
          ? 0.015
          : 0;

  useFrame(({ clock }) => {
    if (!animate || !root.current) return;
    const t = clock.getElapsedTime();
    root.current.position.y = Math.sin(t * 1.5) * 0.012;
    root.current.rotation.y = Math.sin(t * 0.4) * 0.025 + postureLean;
    root.current.rotation.z = postureLean * 0.25;
  });

  const eyeR =
    appearance.eyeShape === "wide"
      ? 0.042
      : appearance.eyeShape === "round"
        ? 0.04
        : appearance.eyeShape === "hooded"
          ? 0.032
          : 0.036;

  const hair = useMemo(
    () => <Hair style={appearance.hair} color={appearance.hairColor} detail={detail} />,
    [appearance.hair, appearance.hairColor, detail],
  );

  return (
    <group
      ref={root}
      scale={scale * heightMul}
      position={[((appearance.detailSeed % 7) - 3) * 0.002, 0, 0]}
    >
      {/* Legs */}
      {isSkirt ? (
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.16 * hip, 0.32 * hip, 0.5, 16]} />
          <meshStandardMaterial color={bottomC} roughness={0.75} />
        </mesh>
      ) : (
        <>
          {/* Thighs */}
          <mesh position={[-0.11 * hip, 0.48, 0]} castShadow>
            <capsuleGeometry args={[0.12 * hip, 0.28, 6, 12]} />
            <meshStandardMaterial color={bottomC} roughness={0.8} />
          </mesh>
          <mesh position={[0.11 * hip, 0.48, 0]} castShadow>
            <capsuleGeometry args={[0.12 * hip, 0.28, 6, 12]} />
            <meshStandardMaterial color={bottomC} roughness={0.8} />
          </mesh>
          {/* Calves */}
          <mesh position={[-0.11 * hip, 0.18, 0.02]} castShadow>
            <capsuleGeometry args={[0.09 * hip, 0.22, 6, 10]} />
            <meshStandardMaterial color={bottomC} roughness={0.8} />
          </mesh>
          <mesh position={[0.11 * hip, 0.18, 0.02]} castShadow>
            <capsuleGeometry args={[0.09 * hip, 0.22, 6, 10]} />
            <meshStandardMaterial color={bottomC} roughness={0.8} />
          </mesh>
          {/* Jean waist */}
          <mesh position={[0, 0.72, 0]} castShadow>
            <sphereGeometry args={[0.24 * hip, 16, 12]} />
            <meshStandardMaterial color={bottomC} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.58, 0.12]}>
            <boxGeometry args={[0.014, 0.42, 0.012]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          {detail && (
            <>
              <mesh position={[-0.14 * hip, 0.64, 0.12]}>
                <boxGeometry args={[0.11, 0.1, 0.012]} />
                <meshStandardMaterial color="#1e40af" />
              </mesh>
              <mesh position={[0.14 * hip, 0.64, 0.12]}>
                <boxGeometry args={[0.11, 0.1, 0.012]} />
                <meshStandardMaterial color="#1e40af" />
              </mesh>
              <mesh position={[0, 0.74, 0]}>
                <torusGeometry args={[0.25 * hip, 0.02, 8, 24]} />
                <meshStandardMaterial color="#1c1917" />
              </mesh>
              <mesh position={[0, 0.74, 0.24]}>
                <boxGeometry args={[0.07, 0.05, 0.02]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.3} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* Shoes — chunkier fashion sneakers */}
      <group>
        <mesh position={[-0.11 * hip, 0.06, 0.06]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.32]} />
          <meshStandardMaterial color={shoeC} roughness={0.55} />
        </mesh>
        <mesh position={[0.11 * hip, 0.06, 0.06]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.32]} />
          <meshStandardMaterial color={shoeC} roughness={0.55} />
        </mesh>
        <mesh position={[-0.11 * hip, 0.02, 0.06]}>
          <boxGeometry args={[0.19, 0.04, 0.34]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
        <mesh position={[0.11 * hip, 0.02, 0.06]}>
          <boxGeometry args={[0.19, 0.04, 0.34]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
      </group>

      {/* Torso / tee with fashion volume */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.26 * waist, 0.42, 8, 14]} />
        <meshStandardMaterial color={topC} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.12, 0.05]} castShadow>
        <sphereGeometry args={[0.22 * chest, 14, 12]} />
        <meshStandardMaterial color={topC} roughness={0.72} />
      </mesh>
      {/* Soft shoulder line */}
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.28 * shoulder, 12, 10]} />
        <meshStandardMaterial color={topC} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <boxGeometry args={[0.62 * shoulder, 0.12, 0.28]} />
        <meshStandardMaterial color={topC} />
      </mesh>
      {/* Neckline */}
      <mesh position={[0, 1.3, 0.08]}>
        <torusGeometry args={[0.09, 0.028, 8, 16]} />
        <meshStandardMaterial color={topC} />
      </mesh>

      {/* Oversized outer — mockup energy */}
      {outerC && (
        <group>
          <mesh position={[0, 1.02, 0]} castShadow>
            <capsuleGeometry args={[0.4 * shoulder, isFur ? 0.62 : 0.5, 8, 14]} />
            <meshStandardMaterial
              color={outerC}
              roughness={isFur ? 0.98 : 0.5}
              metalness={isFur ? 0 : 0.05}
            />
          </mesh>
          {/* Coat panels */}
          <mesh position={[0, hemY, 0.08]} castShadow>
            <boxGeometry args={[0.72 * shoulder, isCoat ? 0.95 : 0.7, 0.38]} />
            <meshStandardMaterial color={outerC} roughness={isFur ? 0.98 : 0.55} />
          </mesh>
          {/* Lapels */}
          <mesh position={[-0.12, 1.2, 0.22]} rotation={[0, 0, 0.25]}>
            <boxGeometry args={[0.14, 0.35, 0.04]} />
            <meshStandardMaterial color={outerC} />
          </mesh>
          <mesh position={[0.12, 1.2, 0.22]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.14, 0.35, 0.04]} />
            <meshStandardMaterial color={outerC} />
          </mesh>
          {detail && !isFur && (
            <>
              {[1.15, 1.0, 0.85].map((y, i) => (
                <mesh key={i} position={[0.14, y, 0.22]}>
                  <sphereGeometry args={[0.022, 8, 8]} />
                  <meshStandardMaterial color="#a8a29e" metalness={0.65} />
                </mesh>
              ))}
            </>
          )}
        </group>
      )}

      {/* Arms with sleeve preference */}
      <mesh
        position={[-0.38 * shoulder, 0.98, 0]}
        rotation={[0, 0, 0.5]}
        castShadow
        scale={[sleeveW, 1, sleeveW]}
      >
        <capsuleGeometry args={[0.09, 0.42, 6, 10]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.65} />
      </mesh>
      <mesh
        position={[0.38 * shoulder, 0.98, 0]}
        rotation={[0, 0, -0.5]}
        castShadow
        scale={[sleeveW, 1, sleeveW]}
      >
        <capsuleGeometry args={[0.09, 0.42, 6, 10]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.65} />
      </mesh>
      {/* Hands */}
      <mesh position={[-0.52 * shoulder, 0.62, 0.06]} castShadow>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0.52 * shoulder, 0.62, 0.06]} castShadow>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      {detail &&
        [-0.52, 0.52].map((sx) =>
          [-0.03, 0, 0.03].map((oz, i) => (
            <group key={`${sx}-${i}`}>
              <mesh position={[sx * shoulder, 0.54, 0.06 + oz]}>
                <capsuleGeometry args={[0.016, 0.045, 4, 6]} />
                <meshStandardMaterial color={appearance.skin} />
              </mesh>
              <mesh position={[sx * shoulder, 0.51, 0.08 + oz]}>
                <boxGeometry args={[0.012, 0.008, 0.01]} />
                <meshStandardMaterial color={appearance.nailColor || "#f8fafc"} />
              </mesh>
            </group>
          )),
        )}

      {/* Neck */}
      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.075, 0.1, 0.14, 12]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>

      {/* Head — slightly elongated for fashion proportion */}
      <mesh position={[0, 1.52, 0]} castShadow scale={[1, 1.08, 0.95]}>
        <sphereGeometry args={[0.24, 24, 20]} />
        <meshStandardMaterial color={appearance.skin} roughness={0.5} map={faceMap ?? undefined} />
      </mesh>

      {faceMap && (
        <mesh position={[0, 1.52, 0.2]}>
          <circleGeometry args={[0.17, 28]} />
          <meshStandardMaterial map={faceMap} roughness={0.45} transparent opacity={0.95} />
        </mesh>
      )}

      {/* Face features */}
      <mesh position={[-0.075, 1.54, 0.2]}>
        <sphereGeometry args={[eyeR, 12, 12]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0.075, 1.54, 0.2]}>
        <sphereGeometry args={[eyeR, 12, 12]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[-0.075, 1.54, 0.235]}>
        <sphereGeometry args={[eyeR * 0.55, 10, 10]} />
        <meshStandardMaterial color={appearance.eyeColor || "#2c1810"} />
      </mesh>
      <mesh position={[0.075, 1.54, 0.235]}>
        <sphereGeometry args={[eyeR * 0.55, 10, 10]} />
        <meshStandardMaterial color={appearance.eyeColor || "#2c1810"} />
      </mesh>
      {detail && (
        <>
          <mesh position={[-0.065, 1.55, 0.25]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0.085, 1.55, 0.25]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.35} />
          </mesh>
        </>
      )}
      <mesh position={[-0.075, 1.6, 0.2]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.1, 0.012 + appearance.browStrength * 0.02, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      <mesh position={[0.075, 1.6, 0.2]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.1, 0.012 + appearance.browStrength * 0.02, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      <mesh
        position={[0, 1.48, appearance.noseShape === "strong" ? 0.25 : 0.23]}
        scale={[
          appearance.noseShape === "wide" ? 1.3 : appearance.noseShape === "narrow" ? 0.75 : 1,
          appearance.noseShape === "strong" ? 1.25 : 1,
          1,
        ]}
      >
        <sphereGeometry args={[0.038, 10, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0, 1.4, 0.21]}>
        <boxGeometry
          args={[
            appearance.lipShape === "full" ? 0.11 : appearance.lipShape === "thin" ? 0.065 : 0.085,
            appearance.lipShape === "full" ? 0.034 : appearance.lipShape === "thin" ? 0.015 : 0.024,
            0.03,
          ]}
        />
        <meshStandardMaterial color={isFemale ? "#c45c6a" : "#8b5a5a"} />
      </mesh>
      {appearance.gapTooth && (
        <mesh position={[0, 1.405, 0.23]}>
          <boxGeometry args={[0.014, 0.018, 0.01]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      )}
      {/* Ears */}
      <mesh position={[-0.23, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0.23, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>

      {/* Marks */}
      {appearance.faceMark === "cheek-mole" && (
        <mesh position={[0.13, 1.44, 0.18]}>
          <sphereGeometry args={[0.014, 6, 6]} />
          <meshStandardMaterial color="#5c3317" />
        </mesh>
      )}
      {appearance.faceMark === "brow-scar" && (
        <mesh position={[-0.1, 1.62, 0.18]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.07, 0.01, 0.01]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
      )}
      {appearance.faceMark === "chin-dimple" && (
        <mesh position={[0, 1.34, 0.2]}>
          <sphereGeometry args={[0.016, 6, 6]} />
          <meshStandardMaterial color="#6b4423" transparent opacity={0.4} />
        </mesh>
      )}
      {appearance.faceMark === "temple-birthmark" && (
        <mesh position={[-0.19, 1.56, 0.06]}>
          <sphereGeometry args={[0.032, 6, 6]} />
          <meshStandardMaterial color="#7c2d12" transparent opacity={0.45} />
        </mesh>
      )}
      {appearance.faceMark === "freckles" &&
        [
          [0.09, 1.46, 0.2],
          [-0.1, 1.45, 0.19],
          [0.05, 1.43, 0.21],
          [-0.05, 1.47, 0.2],
          [0.12, 1.42, 0.18],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.007, 5, 5]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
        ))}

      {appearance.leftEarPiercing && (
        <mesh position={[-0.25, 1.44, 0.02]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} />
        </mesh>
      )}
      {appearance.rightEarPiercing && (
        <mesh position={[0.25, 1.44, 0.02]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} />
        </mesh>
      )}
      {appearance.nosePiercing && (
        <mesh position={[0.035, 1.47, 0.25]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} />
        </mesh>
      )}

      {hair}

      {hatC && (
        <group position={[0, 1.72, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.3, 0.24, 16]} />
            <meshStandardMaterial color={hatC} roughness={0.88} />
          </mesh>
          {equipped.hat === "hat-wide" && (
            <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.52, 28]} />
              <meshStandardMaterial color={hatC} side={2} />
            </mesh>
          )}
          {equipped.hat === "hat-cap" && (
            <mesh position={[0, -0.03, 0.24]} rotation={[0.45, 0, 0]}>
              <boxGeometry args={[0.24, 0.04, 0.16]} />
              <meshStandardMaterial color={hatC} />
            </mesh>
          )}
        </group>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.54, 0.22]}>
          <mesh position={[-0.085, 0, 0]}>
            <torusGeometry args={[0.058, 0.012, 8, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh position={[0.085, 0, 0]}>
            <torusGeometry args={[0.058, 0.012, 8, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.07, 0.01, 0.01]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
        </group>
      )}
      {acc?.id === "acc-shades" && (
        <mesh position={[0, 1.54, 0.22]}>
          <boxGeometry args={[0.32, 0.09, 0.04]} />
          <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.25} />
        </mesh>
      )}
      {acc?.id === "acc-hoops" && (
        <>
          <mesh position={[-0.24, 1.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>
          <mesh position={[0.24, 1.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} />
          </mesh>
        </>
      )}
      {acc?.id === "acc-chain" && (
        <group>
          <mesh position={[0, 1.26, 0.14]}>
            <torusGeometry args={[0.12, 0.018, 8, 20]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
          </mesh>
          {detail && (
            <mesh position={[0, 1.12, 0.16]}>
              <boxGeometry args={[0.045, 0.065, 0.02]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} />
            </mesh>
          )}
        </group>
      )}
      {acc?.id === "acc-watch" && detail && (
        <mesh position={[0.52 * shoulder, 0.72, 0.05]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.065, 0.045, 0.09]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
      )}
    </group>
  );
}

function Hair({
  style,
  color,
  detail,
}: {
  style: CharacterAppearance["hair"];
  color: string;
  detail?: boolean;
}) {
  switch (style) {
    case "afro":
      return (
        <group>
          <mesh position={[0, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.36, 18, 14]} />
            <meshStandardMaterial color={color} roughness={0.98} />
          </mesh>
          {detail &&
            Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  position={[Math.cos(a) * 0.3, 1.68 + (i % 3) * 0.04, Math.sin(a) * 0.3]}
                >
                  <sphereGeometry args={[0.09, 8, 8]} />
                  <meshStandardMaterial color={color} roughness={1} />
                </mesh>
              );
            })}
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 1.58, 0]} castShadow>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.32, 0.02]} castShadow>
            <boxGeometry args={[0.54, 0.36, 0.4]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "braids":
      return (
        <group>
          <mesh position={[0, 1.62, 0]} castShadow>
            <sphereGeometry args={[0.26, 14, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
            <group key={i}>
              <mesh position={[x, 1.88, -0.04]} castShadow>
                <cylinderGeometry args={[0.038, 0.03, 0.5 + (i % 2) * 0.12, 8]} />
                <meshStandardMaterial color={color} />
              </mesh>
              {detail && (
                <mesh position={[x, 1.62, -0.04]}>
                  <torusGeometry args={[0.045, 0.01, 6, 12]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.7} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          <mesh position={[0, 1.58, 0]} castShadow>
            <sphereGeometry args={[0.24, 14, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.86, -0.05]} castShadow>
            <sphereGeometry args={[0.16, 14, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <mesh position={[0, 1.58, 0]} castShadow>
            <sphereGeometry args={[0.27, 14, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.15, -0.1]} castShadow>
            <boxGeometry args={[0.46, 0.65, 0.24]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "bald":
      return null;
    default:
      return (
        <mesh position={[0, 1.64, 0]} castShadow>
          <sphereGeometry args={[0.25, 14, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}

export default StylizedCharacter;
