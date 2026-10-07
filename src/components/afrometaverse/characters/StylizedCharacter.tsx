import { useEffect, useRef, useState } from "react";
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
  /** Extra micro-detail for close-up / 360 preview */
  detail?: boolean;
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

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
    appearance.height === "short" ? 0.9 : appearance.height === "tall" ? 1.1 : 1;

  const shape = appearance.bodyShape;
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

  const postureLean =
    appearance.posture === "confident"
      ? 0.04
      : appearance.posture === "shy"
        ? -0.05
        : appearance.posture === "upright"
          ? 0.01
          : 0;

  useFrame(({ clock }) => {
    if (!animate || !root.current) return;
    const t = clock.getElapsedTime();
    root.current.position.y = Math.sin(t * 1.6) * 0.012;
    root.current.rotation.y = Math.sin(t * 0.45) * 0.03 + postureLean;
    root.current.rotation.z = postureLean * 0.3;
  });

  return (
    <group
      ref={root}
      scale={scale * heightMul}
      position={[((appearance.detailSeed % 7) - 3) * 0.002, 0, 0]}
    >
      {/* ——— Legs / jeans ——— */}
      {isSkirt ? (
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.18 * hip, 0.3 * hip, 0.48, 14]} />
          <meshStandardMaterial color={bottomC} />
        </mesh>
      ) : (
        <>
          <mesh position={[-0.12 * hip, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.1 * (isFemale ? 0.95 : 1.05), 0.5, 6, 10]} />
            <meshStandardMaterial color={bottomC} roughness={0.85} />
          </mesh>
          <mesh position={[0.12 * hip, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.1 * (isFemale ? 0.95 : 1.05), 0.5, 6, 10]} />
            <meshStandardMaterial color={bottomC} roughness={0.85} />
          </mesh>
          {/* Centre seam */}
          <mesh position={[0, 0.55, 0.105]}>
            <boxGeometry args={[0.015, 0.38, 0.015]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          {detail && (
            <>
              {/* Pocket stitches */}
              <mesh position={[-0.14 * hip, 0.62, 0.1]}>
                <boxGeometry args={[0.1, 0.09, 0.01]} />
                <meshStandardMaterial color="#1e40af" />
              </mesh>
              <mesh position={[0.14 * hip, 0.62, 0.1]}>
                <boxGeometry args={[0.1, 0.09, 0.01]} />
                <meshStandardMaterial color="#1e40af" />
              </mesh>
              {/* Belt loops */}
              {[-0.1, 0, 0.1].map((x, i) => (
                <mesh key={i} position={[x * hip, 0.72, 0.12]}>
                  <boxGeometry args={[0.03, 0.06, 0.02]} />
                  <meshStandardMaterial color="#1e3a8a" />
                </mesh>
              ))}
              {/* Belt */}
              <mesh position={[0, 0.72, 0]}>
                <torusGeometry args={[0.24 * hip, 0.018, 6, 20]} />
                <meshStandardMaterial color="#1c1917" />
              </mesh>
              {/* Belt buckle */}
              <mesh position={[0, 0.72, 0.22]}>
                <boxGeometry args={[0.06, 0.045, 0.02]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.3} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* ——— Shoes ——— */}
      <mesh position={[-0.12 * hip, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.28]} />
        <meshStandardMaterial color={shoeC} roughness={0.6} />
      </mesh>
      <mesh position={[0.12 * hip, 0.05, 0.05]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.28]} />
        <meshStandardMaterial color={shoeC} roughness={0.6} />
      </mesh>
      {detail && (
        <>
          {/* Sole */}
          <mesh position={[-0.12 * hip, 0.01, 0.05]}>
            <boxGeometry args={[0.18, 0.03, 0.3]} />
            <meshStandardMaterial color="#292524" />
          </mesh>
          <mesh position={[0.12 * hip, 0.01, 0.05]}>
            <boxGeometry args={[0.18, 0.03, 0.3]} />
            <meshStandardMaterial color="#292524" />
          </mesh>
          {/* Laces */}
          {[-0.12, 0.12].map((sx) =>
            [0.02, 0.06, 0.1].map((z, i) => (
              <mesh key={`${sx}-${i}`} position={[sx * hip, 0.1, z]}>
                <boxGeometry args={[0.08, 0.012, 0.012]} />
                <meshStandardMaterial color="#fafaf9" />
              </mesh>
            )),
          )}
        </>
      )}

      {/* Hips */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.22 * hip, 14, 12]} />
        <meshStandardMaterial color={bottomC} roughness={0.85} />
      </mesh>

      {/* ——— Torso / tee ——— */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.24 * waist, 0.4, 6, 14]} />
        <meshStandardMaterial color={topC} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.05, 0.04]} castShadow>
        <sphereGeometry args={[0.2 * chest, 14, 12]} />
        <meshStandardMaterial color={topC} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[0.58 * shoulder, 0.14, 0.26]} />
        <meshStandardMaterial color={topC} />
      </mesh>
      {detail && (
        <>
          {/* Crew neck rib */}
          <mesh position={[0, 1.2, 0.05]}>
            <torusGeometry args={[0.1, 0.025, 6, 16]} />
            <meshStandardMaterial color={topC} />
          </mesh>
          {/* Sleeve hems */}
          <mesh position={[-0.32 * shoulder, 0.95, 0]} rotation={[0, 0, 0.4]}>
            <torusGeometry args={[0.08, 0.015, 6, 12]} />
            <meshStandardMaterial color={topC} />
          </mesh>
          <mesh position={[0.32 * shoulder, 0.95, 0]} rotation={[0, 0, -0.4]}>
            <torusGeometry args={[0.08, 0.015, 6, 12]} />
            <meshStandardMaterial color={topC} />
          </mesh>
          {/* Tiny hem stitch line */}
          <mesh position={[0, 0.78, 0.12]}>
            <boxGeometry args={[0.35 * waist, 0.01, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        </>
      )}

      {/* Outer */}
      {outerC && (
        <group>
          <mesh position={[0, 0.98, 0]} castShadow>
            <capsuleGeometry args={[0.36 * shoulder, isFur ? 0.58 : 0.45, 6, 14]} />
            <meshStandardMaterial color={outerC} roughness={isFur ? 0.98 : 0.55} />
          </mesh>
          {detail && !isFur && (
            <>
              <mesh position={[0.12, 1.05, 0.2]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.6} />
              </mesh>
              <mesh position={[0.12, 0.95, 0.2]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.6} />
              </mesh>
              <mesh position={[0.12, 0.85, 0.2]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.6} />
              </mesh>
            </>
          )}
        </group>
      )}

      {/* Arms + hands */}
      <mesh position={[-0.36 * shoulder, 0.92, 0]} rotation={[0, 0, 0.45]} castShadow>
        <capsuleGeometry args={[0.075, 0.4, 4, 10]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.7} />
      </mesh>
      <mesh position={[0.36 * shoulder, 0.92, 0]} rotation={[0, 0, -0.45]} castShadow>
        <capsuleGeometry args={[0.075, 0.4, 4, 10]} />
        <meshStandardMaterial color={outerC ?? topC} roughness={isFur ? 0.95 : 0.7} />
      </mesh>
      <mesh position={[-0.48 * shoulder, 0.62, 0.05]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0.48 * shoulder, 0.62, 0.05]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      {detail && (
        <>
          {/* Fingers suggestion */}
          {[-0.48, 0.48].map((sx) =>
            [-0.03, 0, 0.03].map((oz, i) => (
              <mesh key={`${sx}-${i}`} position={[sx * shoulder, 0.55, 0.05 + oz]}>
                <capsuleGeometry args={[0.015, 0.04, 3, 5]} />
                <meshStandardMaterial color={appearance.skin} />
              </mesh>
              <mesh position={[sx * shoulder, 0.52, 0.07 + oz]}>
                <boxGeometry args={[0.012, 0.008, 0.01]} />
                <meshStandardMaterial color={appearance.nailColor || "#f8fafc"} />
              </mesh>
            )),
          )}
        </>
      )}

      {/* Neck + head */}
      <mesh position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.14, 12]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <sphereGeometry args={[0.23, 20, 18]} />
        <meshStandardMaterial
          color={appearance.skin}
          map={faceMap ?? undefined}
          roughness={0.55}
        />
      </mesh>
      {/* Photo face disc on front of head when texture present */}
      {faceMap && (
        <mesh position={[0, 1.4, 0.2]}>
          <circleGeometry args={[0.18, 24]} />
          <meshStandardMaterial map={faceMap} roughness={0.5} transparent opacity={0.92} />
        </mesh>
      )}

      {/* Face — always readable up close */}
      {/* Eyes — shape & colour unique per citizen */}
      {(() => {
        const eyeR =
          appearance.eyeShape === "wide"
            ? 0.048
            : appearance.eyeShape === "round"
              ? 0.045
              : appearance.eyeShape === "hooded"
                ? 0.036
                : 0.04;
        const pupil = appearance.eyeColor || "#2c1810";
        return (
          <>
            <mesh position={[-0.07, 1.42, 0.19]}>
              <sphereGeometry args={[eyeR, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0.07, 1.42, 0.19]}>
              <sphereGeometry args={[eyeR, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[-0.07, 1.42, 0.225]}>
              <sphereGeometry args={[eyeR * 0.55, 8, 8]} />
              <meshStandardMaterial color={pupil} />
            </mesh>
            <mesh position={[0.07, 1.42, 0.225]}>
              <sphereGeometry args={[eyeR * 0.55, 8, 8]} />
              <meshStandardMaterial color={pupil} />
            </mesh>
          </>
        );
      })()}
      {/* Eye highlight */}
      {detail && (
        <>
          <mesh position={[-0.06, 1.43, 0.24]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0.08, 1.43, 0.24]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        </>
      )}
      <mesh position={[-0.07, 1.48, 0.2]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.09, 0.01 + appearance.browStrength * 0.02, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      <mesh position={[0.07, 1.48, 0.2]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.09, 0.01 + appearance.browStrength * 0.02, 0.02]} />
        <meshStandardMaterial color={appearance.hairColor} />
      </mesh>
      <mesh
        position={[0, 1.36, appearance.noseShape === "strong" ? 0.24 : 0.22]}
        scale={[
          appearance.noseShape === "wide" ? 1.25 : appearance.noseShape === "narrow" ? 0.8 : 1,
          appearance.noseShape === "strong" ? 1.2 : 1,
          1,
        ]}
      >
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      {/* Nostrils hint */}
      {detail && (
        <>
          <mesh position={[-0.015, 1.345, 0.24]}>
            <sphereGeometry args={[0.008, 5, 5]} />
            <meshStandardMaterial color="#6b4423" transparent opacity={0.35} />
          </mesh>
          <mesh position={[0.015, 1.345, 0.24]}>
            <sphereGeometry args={[0.008, 5, 5]} />
            <meshStandardMaterial color="#6b4423" transparent opacity={0.35} />
          </mesh>
        </>
      )}
      <mesh position={[0, 1.28, 0.2]}>
        <boxGeometry
          args={[
            appearance.lipShape === "full" ? 0.1 : appearance.lipShape === "thin" ? 0.06 : 0.08,
            appearance.lipShape === "full" ? 0.032 : appearance.lipShape === "thin" ? 0.016 : 0.025,
            0.03,
          ]}
        />
        <meshStandardMaterial color={isFemale ? "#c45c6a" : "#8b5a5a"} />
      </mesh>
      {appearance.gapTooth && (
        <mesh position={[0, 1.285, 0.22]}>
          <boxGeometry args={[0.015, 0.02, 0.01]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      )}
      {/* Face marks */}
      {appearance.faceMark === "cheek-mole" && (
        <mesh position={[0.12, 1.32, 0.18]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#5c3317" />
        </mesh>
      )}
      {appearance.faceMark === "brow-scar" && (
        <mesh position={[-0.1, 1.5, 0.18]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.06, 0.008, 0.01]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
      )}
      {appearance.faceMark === "chin-dimple" && (
        <mesh position={[0, 1.22, 0.2]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#6b4423" transparent opacity={0.35} />
        </mesh>
      )}
      {appearance.faceMark === "temple-birthmark" && (
        <mesh position={[-0.18, 1.45, 0.05]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#7c2d12" transparent opacity={0.45} />
        </mesh>
      )}
      {appearance.faceMark === "freckles" &&
        [
          [0.08, 1.34, 0.2],
          [-0.09, 1.33, 0.19],
          [0.04, 1.31, 0.21],
          [-0.04, 1.35, 0.2],
          [0.11, 1.3, 0.18],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.006, 5, 5]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
        ))}
      {/* Piercings */}
      {appearance.leftEarPiercing && (
        <mesh position={[-0.24, 1.34, 0.02]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.85} />
        </mesh>
      )}
      {appearance.rightEarPiercing && (
        <mesh position={[0.24, 1.34, 0.02]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.85} />
        </mesh>
      )}
      {appearance.nosePiercing && (
        <mesh position={[0.03, 1.35, 0.24]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} />
        </mesh>
      )}
      {/* Ear */}
      <mesh position={[-0.22, 1.38, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>
      <mesh position={[0.22, 1.38, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={appearance.skin} />
      </mesh>

      <HairMesh style={appearance.hair} color={appearance.hairColor} detail={detail} />

      {hatC && (
        <group position={[0, 1.58, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.27, 0.29, 0.22, 16]} />
            <meshStandardMaterial color={hatC} roughness={0.9} />
          </mesh>
          {equipped.hat === "hat-wide" && (
            <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.28, 0.48, 24]} />
              <meshStandardMaterial color={hatC} side={2} />
            </mesh>
          )}
          {detail && equipped.hat === "hat-cap" && (
            <mesh position={[0, -0.02, 0.22]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[0.22, 0.04, 0.14]} />
              <meshStandardMaterial color={hatC} />
            </mesh>
          )}
        </group>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.42, 0.21]}>
          <mesh position={[-0.08, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh position={[0.08, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.06, 0.01, 0.01]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {detail && (
            <>
              <mesh position={[-0.08, 0, 0.01]}>
                <circleGeometry args={[0.045, 12]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} />
              </mesh>
              <mesh position={[0.08, 0, 0.01]}>
                <circleGeometry args={[0.045, 12]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} />
              </mesh>
            </>
          )}
        </group>
      )}
      {acc?.id === "acc-shades" && (
        <mesh position={[0, 1.42, 0.21]}>
          <boxGeometry args={[0.3, 0.09, 0.04]} />
          <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.25} />
        </mesh>
      )}
      {acc?.id === "acc-hoops" && (
        <>
          <mesh position={[-0.22, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.22, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 6, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
          </mesh>
        </>
      )}
      {acc?.id === "acc-chain" && (
        <group>
          <mesh position={[0, 1.14, 0.14]}>
            <torusGeometry args={[0.11, 0.015, 6, 18]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
          </mesh>
          {detail && (
            <mesh position={[0, 1.02, 0.16]}>
              <boxGeometry args={[0.04, 0.06, 0.02]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} />
            </mesh>
          )}
        </group>
      )}
      {acc?.id === "acc-watch" && detail && (
        <mesh position={[0.48 * shoulder, 0.7, 0.05]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.06, 0.04, 0.08]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
      )}
    </group>
  );
}

function HairMesh({
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
          <mesh position={[0, 1.55, 0]} castShadow>
            <sphereGeometry args={[0.34, 16, 14]} />
            <meshStandardMaterial color={color} roughness={0.98} />
          </mesh>
          {detail &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  position={[Math.cos(a) * 0.28, 1.55 + Math.sin(i) * 0.05, Math.sin(a) * 0.28]}
                >
                  <sphereGeometry args={[0.08, 6, 6]} />
                  <meshStandardMaterial color={color} roughness={1} />
                </mesh>
              );
            })}
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 1.45, 0]}>
            <sphereGeometry args={[0.28, 14, 12]} />
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
            <sphereGeometry args={[0.24, 12, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {[-0.14, -0.05, 0.05, 0.14].map((x, i) => (
            <group key={i}>
              <mesh position={[x, 1.72, -0.05]} castShadow>
                <cylinderGeometry args={[0.035, 0.028, 0.45 + (i % 2) * 0.1, 8]} />
                <meshStandardMaterial color={color} />
              </mesh>
              {detail && (
                <mesh position={[x, 1.5, -0.05]}>
                  <torusGeometry args={[0.04, 0.008, 4, 10]} />
                  <meshStandardMaterial color="#fbbf24" metalness={0.6} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.74, -0.04]} castShadow>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.25, 14, 12]} />
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
          <sphereGeometry args={[0.23, 14, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}

export default StylizedCharacter;
