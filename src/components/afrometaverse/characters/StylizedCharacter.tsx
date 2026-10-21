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
  /** idle | walk | run | ride — drives limb cycles */
  moveState?: "idle" | "walk" | "run" | "ride";
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

function SkinMat({ color, map }: { color: string; map?: THREE.Texture | null }) {
  return (
    <meshPhysicalMaterial
      color={color}
      map={map ?? undefined}
      roughness={0.38}
      metalness={0}
      clearcoat={0.35}
      clearcoatRoughness={0.45}
      sheen={0.55}
      sheenRoughness={0.4}
      sheenColor="#e8c4a8"
      specularIntensity={0.6}
      flatShading={false}
    />
  );
}

function ClothMat({
  color,
  soft = false,
  fur = false,
  denim = false,
}: {
  color: string;
  soft?: boolean;
  fur?: boolean;
  denim?: boolean;
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={fur ? 0.95 : denim ? 0.82 : soft ? 0.62 : 0.48}
      metalness={0}
      sheen={fur ? 0.85 : soft ? 0.5 : 0.28}
      sheenRoughness={fur ? 0.85 : 0.48}
      sheenColor={fur ? color : "#ffffff"}
      clearcoat={denim ? 0.05 : soft ? 0.12 : 0.18}
      clearcoatRoughness={0.55}
      flatShading={false}
    />
  );
}

/**
 * Maximum procedural fashion citizen for real-time R3F.
 * Physical materials, layered body, volume coats, dense hair clusters.
 */
export function StylizedCharacter({
  appearance,
  equipped,
  scale = 1,
  animate = true,
  detail = true,
  moveState = "idle",
}: Props) {
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
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
    appearance.height === "short" ? 0.88 : appearance.height === "tall" ? 1.14 : 1;

  const shape = appearance.bodyShape;
  const hip =
    (isFemale ? 1.15 : 1.02) *
    (shape === "curvy" ? 1.32 : shape === "broad" ? 1.2 : shape === "slim" ? 0.84 : shape === "athletic" ? 1.08 : 1);
  const shoulder =
    (isFemale ? 0.96 : 1.16) *
    (shape === "broad" || shape === "athletic" ? 1.22 : shape === "slim" ? 0.86 : 1);
  const waist =
    (isFemale ? 0.86 : 0.96) *
    (shape === "curvy" ? 0.88 : shape === "slim" ? 0.8 : shape === "broad" ? 1.1 : 1);
  const chest =
    (isFemale ? 1.1 : 1.04) *
    (shape === "curvy" ? 1.16 : shape === "athletic" ? 1.12 : shape === "broad" ? 1.18 : 1);

  const topC = itemColor(equipped.top, "#f8fafc");
  const bottomC = itemColor(equipped.bottom, "#2563eb");
  const shoeC = itemColor(equipped.shoes, "#e5e7eb");
  const outerC = equipped.outer ? itemColor(equipped.outer, "#6b7280") : null;
  const hatC = equipped.hat ? itemColor(equipped.hat, "#166534") : null;
  const acc = CLOTHING_CATALOG.find((c) => c.id === equipped.accessory);

  const isSkirt = equipped.bottom === "bottom-skirt";
  const isFur = equipped.outer === "outer-pink-fur" || equipped.outer === "outer-coral-coat";
  const isDenimBottom = equipped.bottom?.includes("jean") || equipped.bottom === "bottom-cargo";
  const isSoftTop = equipped.top === "top-white-tee" || equipped.top === "top-black-tee";

  const sleeveW =
    appearance.sleevePreference === "oversized" ? 1.3 : appearance.sleevePreference === "fitted" ? 0.82 : 1;
  const coatDrop =
    appearance.hemPreference === "cropped" ? 0.92 : appearance.hemPreference === "long" ? 0.55 : 0.72;

  const postureLean =
    appearance.posture === "confident"
      ? 0.055
      : appearance.posture === "shy"
        ? -0.07
        : appearance.posture === "upright"
          ? 0.02
          : 0;

  useFrame(({ clock }) => {
    if (!animate || !root.current) return;
    const t = clock.getElapsedTime();

    if (moveState === "ride") {
      // Seated-ish: legs tucked, slight vehicle bob
      root.current.position.y = Math.sin(t * 8) * 0.02;
      if (leftLeg.current) leftLeg.current.rotation.x = -0.85;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.85;
      if (leftArm.current) leftArm.current.rotation.x = -0.4;
      if (rightArm.current) rightArm.current.rotation.x = -0.4;
      if (torso.current) torso.current.rotation.x = 0.12;
      return;
    }

    const moving = moveState === "walk" || moveState === "run";
    const pace = moveState === "run" ? 11 : moveState === "walk" ? 7 : 1.4;
    const swing = moveState === "run" ? 0.85 : moveState === "walk" ? 0.55 : 0.08;
    const bob = moveState === "run" ? 0.045 : moveState === "walk" ? 0.025 : 0.012;

    root.current.position.y = Math.sin(t * pace) * bob;
    root.current.rotation.y = (moving ? 0 : Math.sin(t * 0.38) * 0.03) + postureLean;
    root.current.rotation.z = postureLean * 0.28 + (moving ? Math.sin(t * pace) * 0.03 : 0);

    const legA = Math.sin(t * pace) * swing;
    const legB = Math.sin(t * pace + Math.PI) * swing;
    const armA = Math.sin(t * pace + Math.PI) * swing * 0.75;
    const armB = Math.sin(t * pace) * swing * 0.75;

    if (leftLeg.current) leftLeg.current.rotation.x = legA;
    if (rightLeg.current) rightLeg.current.rotation.x = legB;
    if (leftArm.current) leftArm.current.rotation.x = armA;
    if (rightArm.current) rightArm.current.rotation.x = armB;
    if (torso.current) {
      torso.current.rotation.y = moving ? Math.sin(t * pace) * 0.06 : 0;
      torso.current.rotation.x = moveState === "run" ? 0.12 : 0;
    }
  });

  const eyeR =
    appearance.eyeShape === "wide"
      ? 0.044
      : appearance.eyeShape === "round"
        ? 0.041
        : appearance.eyeShape === "hooded"
          ? 0.033
          : 0.037;

  const hair = useMemo(
    () => <MaxHair style={appearance.hair} color={appearance.hairColor} />,
    [appearance.hair, appearance.hairColor],
  );

  return (
    <group
      ref={root}
      scale={scale * heightMul}
      position={[((appearance.detailSeed % 7) - 3) * 0.002, 0, 0]}
    >
      {/* ——— LOWER BODY ——— */}
      {isSkirt ? (
        <group>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.15 * hip, 0.34 * hip, 0.52, 20]} />
            <ClothMat color={bottomC} denim />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.34 * hip, 0.36 * hip, 0.04, 20]} />
            <ClothMat color={bottomC} denim />
          </mesh>
        </group>
      ) : (
        <group>
          {/* Pelvis */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <sphereGeometry args={[0.26 * hip, 28, 22]} />
            <ClothMat color={bottomC} denim={isDenimBottom} />
          </mesh>
          <group ref={leftLeg} position={[-0.12 * hip, 0.78, 0]}>
            <mesh position={[0, -0.23, 0]} castShadow>
              <capsuleGeometry args={[0.13 * hip, 0.26, 12, 24]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0, -0.42, 0.02]}>
              <sphereGeometry args={[0.1 * hip, 18, 16]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.01, -0.6, 0.03]} castShadow>
              <capsuleGeometry args={[0.095 * hip, 0.2, 12, 22]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.01, -0.7, 0.04]}>
              <sphereGeometry args={[0.07 * hip, 14, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
          </group>
          <group ref={rightLeg} position={[0.12 * hip, 0.78, 0]}>
            <mesh position={[0, -0.23, 0]} castShadow>
              <capsuleGeometry args={[0.13 * hip, 0.26, 12, 24]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0, -0.42, 0.02]}>
              <sphereGeometry args={[0.1 * hip, 18, 16]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.01, -0.6, 0.03]} castShadow>
              <capsuleGeometry args={[0.095 * hip, 0.2, 12, 22]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.01, -0.7, 0.04]}>
              <sphereGeometry args={[0.07 * hip, 14, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
          </group>
          {/* Seam + belt */}
          <mesh position={[0, 0.58, 0.13]}>
            <boxGeometry args={[0.012, 0.48, 0.01]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <torusGeometry args={[0.27 * hip, 0.022, 8, 28]} />
            <meshStandardMaterial color="#1c1917" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.8, 0.26]}>
            <boxGeometry args={[0.08, 0.055, 0.025]} />
            <meshStandardMaterial color="#d6d3d1" metalness={0.75} roughness={0.25} />
          </mesh>
          {/* Pockets */}
          <mesh position={[-0.15 * hip, 0.68, 0.14]} castShadow>
            <boxGeometry args={[0.12, 0.11, 0.02]} />
            <meshStandardMaterial color="#1e40af" roughness={0.85} />
          </mesh>
          <mesh position={[0.15 * hip, 0.68, 0.14]} castShadow>
            <boxGeometry args={[0.12, 0.11, 0.02]} />
            <meshStandardMaterial color="#1e40af" roughness={0.85} />
          </mesh>
          {/* Belt loops */}
          {[-0.12, 0, 0.12].map((x, i) => (
            <mesh key={i} position={[x * hip, 0.82, 0.14]}>
              <boxGeometry args={[0.028, 0.06, 0.02]} />
              <meshStandardMaterial color="#172554" />
            </mesh>
          ))}
        </group>
      )}

      {/* ——— SHOES ——— */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.11 * hip, 0, 0]}>
          <mesh position={[0, 0.055, 0.08]} castShadow>
            <boxGeometry args={[0.19, 0.1, 0.34]} />
            <meshPhysicalMaterial color={shoeC} roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.25} />
          </mesh>
          {/* rounded toe */}
          <mesh position={[0, 0.05, 0.24]} castShadow scale={[1, 0.7, 0.85]}>
            <sphereGeometry args={[0.095, 14, 12]} />
            <meshPhysicalMaterial color={shoeC} roughness={0.35} clearcoat={0.5} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[0, 0.02, 0.08]}>
            <boxGeometry args={[0.2, 0.04, 0.36]} />
            <meshStandardMaterial color="#0c0a09" />
          </mesh>
          {/* sole edge */}
          <mesh position={[0, 0.015, 0.08]}>
            <boxGeometry args={[0.21, 0.02, 0.38]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          <mesh position={[0, 0.09, -0.04]}>
            <boxGeometry args={[0.17, 0.08, 0.12]} />
            <meshPhysicalMaterial color={shoeC} roughness={0.35} clearcoat={0.4} />
          </mesh>
          {/* tongue */}
          <mesh position={[0, 0.12, 0.02]} castShadow>
            <boxGeometry args={[0.12, 0.04, 0.1]} />
            <meshPhysicalMaterial color={shoeC} roughness={0.45} />
          </mesh>
          {/* Laces */}
          {[0.02, 0.07, 0.12].map((z, i) => (
            <mesh key={i} position={[0, 0.115, z]}>
              <boxGeometry args={[0.1, 0.012, 0.012]} />
              <meshStandardMaterial color="#fafaf9" />
            </mesh>
          ))}
          {/* eyelets */}
          {[-0.045, 0.045].map((x, i) =>
            [0.02, 0.07, 0.12].map((z, j) => (
              <mesh key={`${i}-${j}`} position={[x, 0.11, z]}>
                <sphereGeometry args={[0.008, 8, 8]} />
                <meshStandardMaterial color="#a8a29e" metalness={0.8} roughness={0.2} />
              </mesh>
            )),
          )}
        </group>
      ))}

      {/* ——— TORSO ——— */}
      <group ref={torso}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.27 * waist, 0.4, 12, 28]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      <mesh position={[0, 1.18, 0.06]} castShadow>
        <sphereGeometry args={[0.24 * chest, 24, 20]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[-0.2 * shoulder, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.14 * shoulder, 20, 16]} />
        <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
      </mesh>
      <mesh position={[0.2 * shoulder, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.14 * shoulder, 20, 16]} />
        <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
      </mesh>
      <mesh position={[0, 1.34, 0]}>
        <boxGeometry args={[0.58 * shoulder, 0.1, 0.26]} />
        <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
      </mesh>
      {/* Crew neck */}
      <mesh position={[0, 1.38, 0.1]}>
        <torusGeometry args={[0.095, 0.03, 10, 24]} />
        <ClothMat color={topC} soft />
      </mesh>
      {/* collarbone hints */}
      <mesh position={[-0.1 * shoulder, 1.36, 0.12]} rotation={[0.2, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      <mesh position={[0.1 * shoulder, 1.36, 0.12]} rotation={[0.2, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      {/* sleeve seams / shoulder stitch lines */}
      <mesh position={[-0.22 * shoulder, 1.28, 0.12]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.01, 0.14, 0.01]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0.22 * shoulder, 1.28, 0.12]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.01, 0.14, 0.01]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.12} />
      </mesh>
      {/* chest pocket stitch */}
      <mesh position={[0.12, 1.12, 0.22]}>
        <boxGeometry args={[0.1, 0.1, 0.01]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.1} />
      </mesh>
      {/* Tee hem */}
      <mesh position={[0, 0.82, 0.05]}>
        <cylinderGeometry args={[0.28 * waist, 0.29 * waist, 0.04, 20]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      {/* hem ribbing */}
      <mesh position={[0, 0.8, 0.05]}>
        <torusGeometry args={[0.285 * waist, 0.012, 8, 24]} />
        <ClothMat color={topC} soft />
      </mesh>

      </group>
      {/* ——— OUTERWEAR ——— */}
      {outerC && (
        <group>
          <mesh position={[0, 1.08, 0]} castShadow>
            <capsuleGeometry args={[0.42 * shoulder, isFur ? 0.58 : 0.48, 12, 28]} />
            <ClothMat color={outerC} fur={isFur} soft={!isFur} />
          </mesh>
          {/* Body panels */}
          <mesh position={[0, coatDrop + 0.15, 0.05]} castShadow>
            <boxGeometry args={[0.78 * shoulder, isFur ? 1.05 : 0.9, 0.42]} />
            <ClothMat color={outerC} fur={isFur} soft={!isFur} />
          </mesh>
          {/* Open front gap */}
          <mesh position={[0, 1.05, 0.22]}>
            <boxGeometry args={[0.08, 0.7, 0.05]} />
            <ClothMat color={topC} soft />
          </mesh>
          {/* Lapels */}
          <mesh position={[-0.14, 1.28, 0.24]} rotation={[0.1, 0.15, 0.3]} castShadow>
            <boxGeometry args={[0.16, 0.4, 0.05]} />
            <ClothMat color={outerC} fur={isFur} />
          </mesh>
          <mesh position={[0.14, 1.28, 0.24]} rotation={[0.1, -0.15, -0.3]} castShadow>
            <boxGeometry args={[0.16, 0.4, 0.05]} />
            <ClothMat color={outerC} fur={isFur} />
          </mesh>
          {/* Collar */}
          <mesh position={[0, 1.42, 0.12]} castShadow>
            <boxGeometry args={[0.32 * shoulder, 0.08, 0.2]} />
            <ClothMat color={outerC} fur={isFur} />
          </mesh>
          {/* Buttons */}
          {[1.2, 1.05, 0.9].map((y, i) => (
            <mesh key={i} position={[0.12, y, 0.24]}>
              <sphereGeometry args={[0.025, 10, 10]} />
              <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          {/* Fur fluff clusters */}
          {isFur &&
            Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  position={[
                    Math.cos(a) * 0.38 * shoulder,
                    0.9 + (i % 4) * 0.15,
                    Math.sin(a) * 0.2,
                  ]}
                >
                  <sphereGeometry args={[0.08, 8, 8]} />
                  <ClothMat color={outerC} fur />
                </mesh>
              );
            })}
        </group>
      )}

      {/* ——— ARMS (animated) + detailed hands ——— */}
      <group ref={leftArm} position={[0, 1.32, 0]}>
        <mesh
          position={[-0.4 * shoulder, -0.27, 0]}
          rotation={[0.15, 0, -0.55]}
          scale={[sleeveW, 1, sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.095, 0.36, 14, 28]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        {/* elbow joint */}
        <mesh position={[-0.48 * shoulder, -0.48, 0.03]} castShadow>
          <sphereGeometry args={[0.085 * sleeveW, 16, 14]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        <mesh
          position={[-0.52 * shoulder, -0.6, 0.06]}
          rotation={[0.35, 0, -0.35]}
          scale={[sleeveW, 1, sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.08, 0.22, 14, 26]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        {/* cuff ring */}
        <mesh position={[-0.54 * shoulder, -0.72, 0.09]} rotation={[0.35, 0, -0.35]}>
          <torusGeometry args={[0.085, 0.012, 8, 16]} />
          <ClothMat color={outerC ?? topC} soft />
        </mesh>
        {/* hand + fingers */}
        <group position={[-0.55 * shoulder, -0.78, 0.12]} rotation={[0.2, 0.1, -0.4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.075, 16, 14]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0, -0.02, 0.06]} castShadow>
            <boxGeometry args={[0.09, 0.04, 0.1]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {[-0.035, -0.012, 0.012, 0.035].map((x, i) => (
            <mesh key={i} position={[x, -0.02, 0.12 + i * 0.002]} rotation={[0.35 + i * 0.05, 0, 0]} castShadow>
              <capsuleGeometry args={[0.012, 0.045 - i * 0.004, 6, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          ))}
          <mesh position={[-0.055, 0.01, 0.04]} rotation={[0.2, 0, 0.9]} castShadow>
            <capsuleGeometry args={[0.014, 0.04, 6, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        </group>
      </group>
      <group ref={rightArm} position={[0, 1.32, 0]}>
        <mesh
          position={[0.4 * shoulder, -0.27, 0]}
          rotation={[0.15, 0, 0.55]}
          scale={[sleeveW, 1, sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.095, 0.36, 14, 28]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        <mesh position={[0.48 * shoulder, -0.48, 0.03]} castShadow>
          <sphereGeometry args={[0.085 * sleeveW, 16, 14]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        <mesh
          position={[0.52 * shoulder, -0.6, 0.06]}
          rotation={[0.35, 0, 0.35]}
          scale={[sleeveW, 1, sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.08, 0.22, 14, 26]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
        <mesh position={[0.54 * shoulder, -0.72, 0.09]} rotation={[0.35, 0, 0.35]}>
          <torusGeometry args={[0.085, 0.012, 8, 16]} />
          <ClothMat color={outerC ?? topC} soft />
        </mesh>
        <group position={[0.55 * shoulder, -0.78, 0.12]} rotation={[0.2, -0.1, 0.4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.075, 16, 14]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0, -0.02, 0.06]} castShadow>
            <boxGeometry args={[0.09, 0.04, 0.1]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {[-0.035, -0.012, 0.012, 0.035].map((x, i) => (
            <mesh key={i} position={[x, -0.02, 0.12 + i * 0.002]} rotation={[0.35 + i * 0.05, 0, 0]} castShadow>
              <capsuleGeometry args={[0.012, 0.045 - i * 0.004, 6, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          ))}
          <mesh position={[0.055, 0.01, 0.04]} rotation={[0.2, 0, -0.9]} castShadow>
            <capsuleGeometry args={[0.014, 0.04, 6, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        </group>
      </group>

      {/* ——— NECK + HEAD ——— */}
      <mesh position={[0, 1.44, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.115, 0.18, 20]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      {/* jaw / chin volume */}
      <mesh position={[0, 1.48, 0.06]} castShadow scale={[0.9, 0.7, 0.85]}>
        <sphereGeometry args={[0.14, 20, 16]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow scale={[1, 1.12, 0.98]}>
        <sphereGeometry args={[0.255, 36, 28]} />
        <SkinMat color={appearance.skin} map={faceMap} />
      </mesh>

      {/* Photo face plate */}
      {faceMap && (
        <mesh position={[0, 1.62, 0.21]}>
          <circleGeometry args={[0.175, 32]} />
          <meshPhysicalMaterial
            map={faceMap}
            roughness={0.4}
            clearcoat={0.1}
            transparent
            opacity={0.96}
          />
        </mesh>
      )}

      {/* Cheek volume */}
      <mesh position={[-0.145, 1.55, 0.13]} castShadow>
        <sphereGeometry args={[0.095, 18, 16]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0.145, 1.55, 0.13]} castShadow>
        <sphereGeometry args={[0.095, 18, 16]} />
        <SkinMat color={appearance.skin} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.08, 1.64, 0.21]}>
        <sphereGeometry args={[eyeR, 20, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>
      <mesh position={[0.08, 1.64, 0.21]}>
        <sphereGeometry args={[eyeR, 20, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>
      <mesh position={[-0.08, 1.64, 0.248]}>
        <sphereGeometry args={[eyeR * 0.58, 16, 16]} />
        <meshStandardMaterial color={appearance.eyeColor || "#2c1810"} roughness={0.3} />
      </mesh>
      <mesh position={[0.08, 1.64, 0.248]}>
        <sphereGeometry args={[eyeR * 0.58, 16, 16]} />
        <meshStandardMaterial color={appearance.eyeColor || "#2c1810"} roughness={0.3} />
      </mesh>
      {/* Highlights */}
      <mesh position={[-0.07, 1.65, 0.265]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.09, 1.65, 0.265]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
      </mesh>
      {/* Brows */}
      <mesh position={[-0.08, 1.71, 0.2]} rotation={[0, 0, 0.14]}>
        <boxGeometry args={[0.11, 0.014 + appearance.browStrength * 0.022, 0.022]} />
        <meshStandardMaterial color={appearance.hairColor} roughness={0.9} />
      </mesh>
      <mesh position={[0.08, 1.71, 0.2]} rotation={[0, 0, -0.14]}>
        <boxGeometry args={[0.11, 0.014 + appearance.browStrength * 0.022, 0.022]} />
        <meshStandardMaterial color={appearance.hairColor} roughness={0.9} />
      </mesh>
      {/* Eyelids */}
      <mesh position={[-0.08, 1.655, 0.22]} rotation={[0.35, 0, 0.08]}>
        <boxGeometry args={[0.07, 0.012, 0.03]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0.08, 1.655, 0.22]} rotation={[0.35, 0, -0.08]}>
        <boxGeometry args={[0.07, 0.012, 0.03]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      {/* Nose bridge + tip */}
      <mesh
        position={[0, 1.58, appearance.noseShape === "strong" ? 0.26 : 0.24]}
        scale={[
          appearance.noseShape === "wide" ? 1.35 : appearance.noseShape === "narrow" ? 0.72 : 1,
          appearance.noseShape === "strong" ? 1.3 : 1,
          1.1,
        ]}
        castShadow
      >
        <sphereGeometry args={[0.04, 18, 18]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0, 1.60, 0.22]} castShadow scale={[0.7, 1.2, 0.6]}>
        <capsuleGeometry args={[0.018, 0.05, 6, 12]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      {/* Nostrils */}
      <mesh position={[-0.015, 1.565, 0.255]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#3d2314" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0.015, 1.565, 0.255]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#3d2314" transparent opacity={0.45} />
      </mesh>
      {/* Lips — rounded volume */}
      <mesh
        position={[0, 1.505, 0.235]}
        castShadow
        scale={[
          appearance.lipShape === "full" ? 1.2 : appearance.lipShape === "thin" ? 0.72 : 1,
          appearance.lipShape === "full" ? 1.25 : appearance.lipShape === "thin" ? 0.65 : 1,
          1.05,
        ]}
      >
        <capsuleGeometry args={[0.028, 0.05, 8, 16]} />
        <meshPhysicalMaterial
          color={isFemale ? "#c45c6a" : "#8b5a5a"}
          roughness={0.32}
          clearcoat={0.45}
          clearcoatRoughness={0.3}
          sheen={0.55}
          sheenColor="#e8a0a8"
        />
      </mesh>
      {appearance.gapTooth && (
        <mesh position={[0, 1.505, 0.24]}>
          <boxGeometry args={[0.015, 0.02, 0.01]} />
          <meshStandardMaterial color="#fafaf9" />
        </mesh>
      )}
      {/* Ears — flattened spheres read more like real ears */}
      <mesh position={[-0.25, 1.6, -0.01]} castShadow scale={[0.55, 1, 0.85]} rotation={[0, 0, 0.15]}>
        <sphereGeometry args={[0.07, 16, 14]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0.25, 1.6, -0.01]} castShadow scale={[0.55, 1, 0.85]} rotation={[0, 0, -0.15]}>
        <sphereGeometry args={[0.07, 16, 14]} />
        <SkinMat color={appearance.skin} />
      </mesh>

      {/* Marks */}
      {appearance.faceMark === "cheek-mole" && (
        <mesh position={[0.14, 1.52, 0.19]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#5c3317" />
        </mesh>
      )}
      {appearance.faceMark === "brow-scar" && (
        <mesh position={[-0.11, 1.72, 0.19]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.075, 0.01, 0.01]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
      )}
      {appearance.faceMark === "chin-dimple" && (
        <mesh position={[0, 1.42, 0.21]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#6b4423" transparent opacity={0.4} />
        </mesh>
      )}
      {appearance.faceMark === "temple-birthmark" && (
        <mesh position={[-0.2, 1.66, 0.06]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#7c2d12" transparent opacity={0.45} />
        </mesh>
      )}
      {appearance.faceMark === "freckles" &&
        [
          [0.1, 1.56, 0.21],
          [-0.11, 1.55, 0.2],
          [0.05, 1.53, 0.22],
          [-0.05, 1.57, 0.21],
          [0.13, 1.52, 0.19],
          [-0.08, 1.51, 0.2],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.007, 6, 6]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
        ))}

      {appearance.leftEarPiercing && (
        <mesh position={[-0.26, 1.52, 0.02]}>
          <sphereGeometry args={[0.017, 10, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.15} />
        </mesh>
      )}
      {appearance.rightEarPiercing && (
        <mesh position={[0.26, 1.52, 0.02]}>
          <sphereGeometry args={[0.017, 10, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.15} />
        </mesh>
      )}
      {appearance.nosePiercing && (
        <mesh position={[0.038, 1.57, 0.26]}>
          <sphereGeometry args={[0.013, 10, 10]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.12} />
        </mesh>
      )}

      {hair}

      {/* Hat */}
      {hatC && (
        <group position={[0, 1.82, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.29, 0.31, 0.26, 20]} />
            <ClothMat color={hatC} soft />
          </mesh>
          {equipped.hat === "hat-wide" && (
            <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.31, 0.55, 32]} />
              <meshStandardMaterial color={hatC} side={2} roughness={0.85} />
            </mesh>
          )}
          {equipped.hat === "hat-cap" && (
            <mesh position={[0, -0.04, 0.26]} rotation={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[0.26, 0.045, 0.18]} />
              <ClothMat color={hatC} soft />
            </mesh>
          )}
        </group>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.64, 0.23]}>
          <mesh position={[-0.09, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 20]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.2} />
          </mesh>
          <mesh position={[0.09, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 20]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.2} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.08, 0.012, 0.012]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.4} />
          </mesh>
          <mesh position={[-0.09, 0, 0.01]}>
            <circleGeometry args={[0.048, 16]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.12} />
          </mesh>
          <mesh position={[0.09, 0, 0.01]}>
            <circleGeometry args={[0.048, 16]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.12} />
          </mesh>
        </group>
      )}
      {acc?.id === "acc-shades" && (
        <mesh position={[0, 1.64, 0.23]}>
          <boxGeometry args={[0.34, 0.095, 0.045]} />
          <meshPhysicalMaterial color="#0f172a" metalness={0.7} roughness={0.2} clearcoat={0.5} />
        </mesh>
      )}
      {acc?.id === "acc-hoops" && (
        <>
          <mesh position={[-0.25, 1.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.065, 0.014, 8, 20]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.12} />
          </mesh>
          <mesh position={[0.25, 1.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.065, 0.014, 8, 20]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.12} />
          </mesh>
        </>
      )}
      {acc?.id === "acc-chain" && (
        <group>
          <mesh position={[0, 1.36, 0.15]}>
            <torusGeometry args={[0.13, 0.02, 8, 24]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh position={[0, 1.2, 0.17]}>
            <boxGeometry args={[0.05, 0.07, 0.025]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}
      {acc?.id === "acc-watch" && (
        <mesh position={[0.55 * shoulder, 0.72, 0.06]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.07, 0.05, 0.1]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

function MaxHair({ style, color }: { style: CharacterAppearance["hair"]; color: string }) {
  switch (style) {
    case "afro":
      return (
        <group>
          <mesh position={[0, 1.78, 0]} castShadow>
            <sphereGeometry args={[0.38, 20, 16]} />
            <meshPhysicalMaterial color={color} roughness={0.98} sheen={0.6} sheenRoughness={0.9} />
          </mesh>
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const y = 1.72 + (i % 4) * 0.06;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.32, y, Math.sin(a) * 0.32]}
                castShadow
              >
                <sphereGeometry args={[0.1, 10, 10]} />
                <meshPhysicalMaterial color={color} roughness={1} sheen={0.5} sheenRoughness={0.95} />
              </mesh>
            );
          })}
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.32, 18, 14]} />
            <meshPhysicalMaterial color={color} roughness={0.85} sheen={0.3} />
          </mesh>
          <mesh position={[0, 1.4, 0.02]} castShadow>
            <boxGeometry args={[0.58, 0.4, 0.42]} />
            <meshPhysicalMaterial color={color} roughness={0.85} />
          </mesh>
        </group>
      );
    case "braids":
      return (
        <group>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[0.28, 16, 14]} />
            <meshPhysicalMaterial color={color} roughness={0.9} />
          </mesh>
          {[-0.16, -0.06, 0.06, 0.16].map((x, i) => (
            <group key={i}>
              <mesh position={[x, 1.98, -0.05]} castShadow>
                <cylinderGeometry args={[0.04, 0.032, 0.55 + (i % 2) * 0.14, 10]} />
                <meshPhysicalMaterial color={color} roughness={0.9} />
              </mesh>
              <mesh position={[x, 1.7, -0.05]}>
                <torusGeometry args={[0.048, 0.012, 6, 14]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "bun":
      return (
        <group>
          <mesh position={[0, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.26, 16, 14]} />
            <meshPhysicalMaterial color={color} roughness={0.88} />
          </mesh>
          <mesh position={[0, 1.96, -0.05]} castShadow>
            <sphereGeometry args={[0.17, 16, 14]} />
            <meshPhysicalMaterial color={color} roughness={0.88} sheen={0.3} />
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <mesh position={[0, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.29, 16, 14]} />
            <meshPhysicalMaterial color={color} roughness={0.88} />
          </mesh>
          <mesh position={[0, 1.2, -0.12]} castShadow>
            <boxGeometry args={[0.5, 0.75, 0.26]} />
            <meshPhysicalMaterial color={color} roughness={0.9} sheen={0.25} />
          </mesh>
        </group>
      );
    case "bald":
      return null;
    default:
      return (
        <mesh position={[0, 1.74, 0]} castShadow>
          <sphereGeometry args={[0.27, 16, 14]} />
          <meshPhysicalMaterial color={color} roughness={0.9} />
        </mesh>
      );
  }
}

export default StylizedCharacter;
