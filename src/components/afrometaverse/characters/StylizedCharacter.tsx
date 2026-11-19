import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CLOTHING_CATALOG,
  DEFAULT_APPEARANCE,
  type CharacterAppearance,
  type EquippedLoadout,
} from "@/stores/characterStore";
import { CombatProps, propForActivity } from "@/components/afrometaverse/characters/CombatProps";
import { idleFaceProxy } from "@/lib/arkitFaceMap";
import { useFaceTrackStore } from "@/stores/faceTrackStore";

const DEFAULT_EQUIPPED_SAFE: EquippedLoadout = {
  top: "top-white-tee",
  bottom: "bottom-blue-jeans",
  outer: null,
  shoes: "shoes-basic",
  accessory: null,
  hat: null,
};

type Props = {
  /** Full appearance; falls back to DEFAULT_APPEARANCE if missing (e.g. incomplete NPC specs). */
  appearance?: CharacterAppearance | null;
  equipped?: EquippedLoadout | null;
  scale?: number;
  animate?: boolean;
  detail?: boolean;
  /** idle | walk | run | ride — drives limb cycles */
  moveState?: "idle" | "walk" | "run" | "ride";
  /**
   * Social / secondary motion layer on top of locomotion.
   * talk / discuss drive head nods + arm gestures; wave is a one-sided hello.
   * sit / sit_bench / confident / dance / dance_kick / crouch / reach
   * + full combat set from the character design pose sheet.
   */
  activity?:
    | "none"
    | "idle"
    | "talk"
    | "discuss"
    | "wave"
    | "sit"
    | "sit_bench"
    | "confident"
    | "dance"
    | "dance_kick"
    | "crouch"
    | "reach"
    | "combat_ready"
    | "combat_lunge"
    | "combat_staff"
    | "combat_guard"
    | "combat_slash"
    | "combat_kick"
    | "combat_overhead"
    | "combat_block"
    | "combat_dodge"
    | "combat_combo";
  /** World-space point to glance toward (player, speaker). Head yaw/pitch only. */
  lookAt?: [number, number, number] | null;
  /** Unique phase so crowds don't sync their micro-motions */
  motionPhase?: number;
  /** Show combat prop weapons when activity is combat_* */
  showWeapons?: boolean;
  /** Hide capsule body (when AnatomyBody is used underneath) */
  hideCapsuleBody?: boolean;
};

function itemColor(id: string | null | undefined, fallback: string) {
  if (!id) return fallback;
  return CLOTHING_CATALOG.find((c) => c.id === id)?.color ?? fallback;
}

function SkinMat({ color, map }: { color: string; map?: THREE.Texture | null }) {
  return (
    <meshPhysicalMaterial
      color={color}
      {...(map ? { map } : {})}
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
  appearance: appearanceProp,
  equipped: equippedProp,
  scale = 1,
  animate = true,
  detail = true,
  moveState = "idle",
  activity = "none",
  lookAt = null,
  motionPhase = 0,
  showWeapons = false,
  hideCapsuleBody = false,
}: Props) {
  // Guard: NPCs / previews must never crash when appearance or loadout is missing
  const appearance: CharacterAppearance = appearanceProp
    ? { ...DEFAULT_APPEARANCE, ...appearanceProp }
    : DEFAULT_APPEARANCE;
  const equipped: EquippedLoadout = equippedProp
    ? { ...DEFAULT_EQUIPPED_SAFE, ...equippedProp }
    : DEFAULT_EQUIPPED_SAFE;
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jawRef = useRef<THREE.Group>(null);
  const lidLRef = useRef<THREE.Mesh>(null);
  const lidRRef = useRef<THREE.Mesh>(null);
  const liveFace = useFaceTrackStore((s) => (s.tracking ? s.proxy : null));
  const isFemale = appearance.gender === "female";
  const [faceMap, setFaceMap] = useState<THREE.Texture | null>(null);
  const lookSmooth = useRef({ yaw: 0, pitch: 0 });
  const phase = useRef(motionPhase || Math.random() * Math.PI * 2);

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

  // Game-character proportions (pose-sheet athletic silhouette)
  const heightMul =
    appearance.height === "short" ? 0.9 : appearance.height === "tall" ? 1.12 : 1;

  const shape = appearance.bodyShape;
  const hip =
    (isFemale ? 1.22 : 1.0) *
    (shape === "curvy" ? 1.28 : shape === "broad" ? 1.18 : shape === "slim" ? 0.86 : shape === "athletic" ? 1.06 : 1);
  const shoulder =
    (isFemale ? 0.98 : 1.22) *
    (shape === "broad" || shape === "athletic" ? 1.2 : shape === "slim" ? 0.88 : 1);
  const waist =
    (isFemale ? 0.78 : 0.9) *
    (shape === "curvy" ? 0.86 : shape === "slim" ? 0.78 : shape === "broad" ? 1.08 : shape === "athletic" ? 0.92 : 1);
  const chest =
    (isFemale ? 1.12 : 1.1) *
    (shape === "curvy" ? 1.18 : shape === "athletic" ? 1.16 : shape === "broad" ? 1.2 : 1);

  const topC = itemColor(equipped.top, "#f8fafc");
  const bottomC = itemColor(equipped.bottom, "#2563eb");
  const shoeC = itemColor(equipped.shoes, "#e5e7eb");
  const outerC = equipped.outer ? itemColor(equipped.outer, "#6b7280") : null;
  const hatC = equipped.hat ? itemColor(equipped.hat, "#166534") : null;
  const acc = CLOTHING_CATALOG.find((c) => c.id === equipped.accessory);

  const isSkirt =
    equipped.bottom === "bottom-skirt" ||
    equipped.bottom === "bottom-wrap-skirt" ||
    equipped.bottom === "bottom-pattern-wrap";
  const isWrap =
    equipped.bottom === "bottom-wrap-skirt" || equipped.bottom === "bottom-pattern-wrap";
  const isFringeKilt = equipped.bottom === "bottom-fringe-kilt";
  const isBeadedTop = equipped.top === "top-bead-chest" || equipped.top === "top-mask-bearer";
  const isMaskBearer = equipped.top === "top-mask-bearer" || equipped.outer === "outer-gold-pauldron";
  const isLeatherArmor = equipped.top === "top-leather-armor";
  const isBareTorso = equipped.top === "top-bare-wrap" || isBeadedTop || isMaskBearer;
  const isGoldPauldron = equipped.outer === "outer-gold-pauldron";
  const isFurGreaves = equipped.shoes === "shoes-fur-greaves";
  const isRedBand = equipped.hat === "hat-red-band";
  /** Stronger V-taper for warrior bare-torso look */
  const bodyAthlete = isMaskBearer || shape === "athletic" || shape === "broad";
  const chestMul = bodyAthlete ? 1.12 : 1;
  const shoulderMul = bodyAthlete ? 1.1 : 1;
  const waistMul = bodyAthlete ? 0.92 : 1;

  const isFur =
    equipped.outer === "outer-pink-fur" ||
    equipped.outer === "outer-coral-coat" ||
    equipped.outer === "outer-fur-shoulder";
  const isRedCape = equipped.outer === "outer-red-cape";
  const isDenimBottom = equipped.bottom?.includes("jean") || equipped.bottom === "bottom-cargo";
  const isSoftTop =
    equipped.top === "top-white-tee" ||
    equipped.top === "top-black-tee" ||
    isBareTorso;
  const isSandals = equipped.shoes === "shoes-sandals" || equipped.shoes === "shoes-warrior-boots";
  const isWarriorHelm = equipped.hat === "hat-warrior-helm";
  const isBeadCrown = equipped.hat === "hat-bead-crown";
  const isFeatherBand = equipped.hat === "hat-feather-band";

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
    const t = clock.getElapsedTime() + phase.current;

    // Face proxy: live webcam (Face Studio) or seeded idle / talk
    if (jawRef.current || lidLRef.current || lidRRef.current || head.current) {
      const talk =
        activity === "talk" || activity === "discuss"
          ? 0.12 + Math.abs(Math.sin(t * 6.5)) * 0.2
          : 0;
      const proxy = liveFace ?? idleFaceProxy(t, appearance.detailSeed);
      if (jawRef.current) {
        jawRef.current.rotation.x = talk + proxy.jawOpen * 0.35;
      }
      if (lidLRef.current) {
        lidLRef.current.rotation.x = 0.15 + proxy.blinkL * 1.05;
      }
      if (lidRRef.current) {
        lidRRef.current.rotation.x = 0.15 + proxy.blinkR * 1.05;
      }
    }

    const social =
      activity === "talk" ||
      activity === "discuss" ||
      activity === "wave" ||
      activity === "sit" ||
      activity === "sit_bench" ||
      activity === "confident" ||
      activity === "dance" ||
      activity === "dance_kick" ||
      activity === "crouch" ||
      activity === "reach" ||
      activity === "combat_ready" ||
      activity === "combat_lunge" ||
      activity === "combat_staff" ||
      activity === "combat_guard" ||
      activity === "combat_slash" ||
      activity === "combat_kick" ||
      activity === "combat_overhead" ||
      activity === "combat_block" ||
      activity === "combat_dodge" ||
      activity === "combat_combo"
        ? activity
        : activity === "idle"
          ? "idle"
          : "none";

    if (moveState === "ride") {
      root.current.position.y = Math.sin(t * 8) * 0.02;
      if (leftLeg.current) leftLeg.current.rotation.x = -0.85;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.85;
      if (leftArm.current) leftArm.current.rotation.x = -0.4;
      if (rightArm.current) rightArm.current.rotation.x = -0.4;
      if (torso.current) torso.current.rotation.x = 0.12;
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.55) * 0.06;
        head.current.rotation.x = Math.sin(t * 0.9) * 0.03;
      }
      return;
    }

    // Full-body pose overrides (from character design pose sheet)
    if (social === "sit") {
      // Ground sit — one knee up / side sit energy, relaxed arms
      root.current.position.y = -0.42 + Math.sin(t * 1.1) * 0.01;
      root.current.rotation.y = postureLean + Math.sin(t * 0.35) * 0.04;
      root.current.rotation.z = 0.04;
      if (leftLeg.current) {
        leftLeg.current.rotation.x = -1.35;
        leftLeg.current.rotation.z = 0.35;
      }
      if (rightLeg.current) {
        rightLeg.current.rotation.x = -0.55;
        rightLeg.current.rotation.z = -0.15;
      }
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.55 + Math.sin(t * 0.7) * 0.05;
        leftArm.current.rotation.z = 0.45;
        leftArm.current.rotation.y = 0.15;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.4 + Math.sin(t * 0.65) * 0.04;
        rightArm.current.rotation.z = -0.25;
        rightArm.current.rotation.y = -0.1;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.18;
        torso.current.rotation.y = Math.sin(t * 0.4) * 0.06;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.45) * 0.12;
        head.current.rotation.x = -0.08 + Math.sin(t * 0.6) * 0.04;
      }
      return;
    }

    if (social === "crouch") {
      // Ready / low crouch — weight forward, arms braced
      root.current.position.y = -0.28 + Math.sin(t * 2.2) * 0.012;
      root.current.rotation.y = postureLean;
      root.current.rotation.z = Math.sin(t * 1.8) * 0.02;
      if (leftLeg.current) leftLeg.current.rotation.x = -1.05;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.95;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.85;
        leftArm.current.rotation.z = 0.35;
        leftArm.current.rotation.y = 0.2;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.9;
        rightArm.current.rotation.z = -0.3;
        rightArm.current.rotation.y = -0.15;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.35;
        torso.current.rotation.y = Math.sin(t * 1.5) * 0.04;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.9) * 0.08;
        head.current.rotation.x = 0.12;
      }
      return;
    }

    if (social === "confident") {
      // Hands-on-hips / crossed-arms confident stance
      root.current.position.y = Math.sin(t * 1.2) * 0.008;
      root.current.rotation.y = postureLean + 0.04;
      root.current.rotation.z = 0.03;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.08;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.06;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.25;
        leftArm.current.rotation.z = 0.75;
        leftArm.current.rotation.y = 0.45;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.25;
        rightArm.current.rotation.z = -0.75;
        rightArm.current.rotation.y = -0.45;
      }
      if (torso.current) {
        torso.current.rotation.x = -0.04;
        torso.current.rotation.y = Math.sin(t * 0.4) * 0.03;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.35) * 0.06;
        head.current.rotation.x = -0.05;
      }
      return;
    }

    if (social === "dance") {
      // High-energy heritage / Afrobeats step — strong line of action, one leg lifted
      const beat = Math.sin(t * 6.2);
      const beat2 = Math.sin(t * 6.2 + 1.1);
      root.current.position.y = 0.04 + Math.abs(beat) * 0.06;
      root.current.rotation.y = beat * 0.18 + postureLean;
      root.current.rotation.z = beat2 * 0.08;
      if (leftLeg.current) leftLeg.current.rotation.x = -0.15 + beat * 0.55;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.9 + Math.abs(beat2) * 0.35;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.4 + beat * 0.5;
        leftArm.current.rotation.z = 0.2 + beat2 * 0.35;
        leftArm.current.rotation.y = beat * 0.4;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.6 + beat2 * 0.7;
        rightArm.current.rotation.z = -0.35 - beat * 0.25;
        rightArm.current.rotation.y = -beat * 0.3;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.08 + beat * 0.06;
        torso.current.rotation.y = beat * 0.12;
      }
      if (head.current) {
        head.current.rotation.y = beat * 0.15;
        head.current.rotation.x = -0.05 + beat2 * 0.08;
      }
      return;
    }

    if (social === "reach") {
      // Reaching / pointing / calling out
      root.current.position.y = Math.sin(t * 1.4) * 0.01;
      root.current.rotation.y = postureLean + 0.12;
      root.current.rotation.z = -0.04;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.12;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.18;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.2;
        leftArm.current.rotation.z = 0.15;
        leftArm.current.rotation.y = 0.05;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.65 + Math.sin(t * 2.2) * 0.08;
        rightArm.current.rotation.z = -0.15;
        rightArm.current.rotation.y = 0.35;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.15;
        torso.current.rotation.y = 0.18;
      }
      if (head.current) {
        head.current.rotation.y = 0.25 + Math.sin(t * 0.7) * 0.05;
        head.current.rotation.x = 0.1;
      }
      return;
    }

    if (social === "sit_bench") {
      // Bench / stool sit — upright torso, feet planted, hands on thighs
      root.current.position.y = -0.28 + Math.sin(t * 0.9) * 0.008;
      root.current.rotation.y = postureLean + Math.sin(t * 0.3) * 0.03;
      root.current.rotation.z = 0;
      if (leftLeg.current) {
        leftLeg.current.rotation.x = -1.05;
        leftLeg.current.rotation.z = 0.08;
      }
      if (rightLeg.current) {
        rightLeg.current.rotation.x = -1.05;
        rightLeg.current.rotation.z = -0.08;
      }
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.55 + Math.sin(t * 0.6) * 0.04;
        leftArm.current.rotation.z = 0.2;
        leftArm.current.rotation.y = 0.1;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.55 + Math.sin(t * 0.55 + 0.4) * 0.04;
        rightArm.current.rotation.z = -0.2;
        rightArm.current.rotation.y = -0.1;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.06;
        torso.current.rotation.y = Math.sin(t * 0.35) * 0.04;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.4) * 0.1;
        head.current.rotation.x = -0.04 + Math.sin(t * 0.5) * 0.03;
      }
      return;
    }

    if (social === "dance_kick") {
      // High kick / sharp step — strong silhouette from the pose sheet
      const kick = Math.max(0, Math.sin(t * 5.4));
      const swing = Math.sin(t * 5.4 + 0.9);
      root.current.position.y = 0.05 + kick * 0.08;
      root.current.rotation.y = swing * 0.22 + postureLean;
      root.current.rotation.z = swing * 0.1;
      if (leftLeg.current) leftLeg.current.rotation.x = -0.2 + swing * 0.35;
      if (rightLeg.current) rightLeg.current.rotation.x = -1.55 + kick * 0.9; // high kick
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.2 + swing * 0.45;
        leftArm.current.rotation.z = 0.25 + kick * 0.3;
        leftArm.current.rotation.y = swing * 0.35;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.5 - kick * 0.4;
        rightArm.current.rotation.z = -0.4 - swing * 0.2;
        rightArm.current.rotation.y = -swing * 0.25;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.1 + kick * 0.08;
        torso.current.rotation.y = swing * 0.15;
      }
      if (head.current) {
        head.current.rotation.y = swing * 0.18;
        head.current.rotation.x = -0.06 + kick * 0.1;
      }
      return;
    }

    if (social === "combat_ready") {
      // Low ready stance — weight on back leg, hands up, alert
      root.current.position.y = -0.06 + Math.sin(t * 2.8) * 0.01;
      root.current.rotation.y = postureLean;
      root.current.rotation.z = Math.sin(t * 1.6) * 0.015;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.25;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.55;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.05;
        leftArm.current.rotation.z = 0.45;
        leftArm.current.rotation.y = 0.35;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.15;
        rightArm.current.rotation.z = -0.4;
        rightArm.current.rotation.y = -0.3;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.22;
        torso.current.rotation.y = Math.sin(t * 1.3) * 0.04;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 0.9) * 0.07;
        head.current.rotation.x = 0.08;
      }
      return;
    }

    if (social === "combat_lunge") {
      // Aggressive forward lunge / strike
      const lunge = 0.55 + Math.sin(t * 3.2) * 0.08;
      root.current.position.y = -0.04 + Math.sin(t * 4) * 0.015;
      root.current.rotation.y = postureLean + 0.08;
      root.current.rotation.z = -0.06;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.45;
      if (rightLeg.current) rightLeg.current.rotation.x = -1.15;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.4;
        leftArm.current.rotation.z = 0.3;
        leftArm.current.rotation.y = 0.15;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.85 + Math.sin(t * 3.2) * 0.12;
        rightArm.current.rotation.z = -0.2;
        rightArm.current.rotation.y = 0.45;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.28 + lunge * 0.08;
        torso.current.rotation.y = 0.2;
      }
      if (head.current) {
        head.current.rotation.y = 0.15;
        head.current.rotation.x = 0.12;
      }
      return;
    }

    if (social === "combat_staff") {
      // Two-hand staff / spear ready (from the pose sheet bottom row)
      root.current.position.y = Math.sin(t * 1.8) * 0.01;
      root.current.rotation.y = postureLean - 0.06;
      root.current.rotation.z = 0.03;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.15;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.35;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.95;
        leftArm.current.rotation.z = 0.55;
        leftArm.current.rotation.y = 0.55;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.25;
        rightArm.current.rotation.z = -0.25;
        rightArm.current.rotation.y = 0.15;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.1;
        torso.current.rotation.y = -0.12 + Math.sin(t * 1.1) * 0.03;
      }
      if (head.current) {
        head.current.rotation.y = -0.1 + Math.sin(t * 0.7) * 0.05;
        head.current.rotation.x = 0.05;
      }
      return;
    }

    if (social === "combat_guard") {
      // Defensive high guard — arms protecting, slight lean back
      root.current.position.y = -0.03 + Math.sin(t * 2.4) * 0.01;
      root.current.rotation.y = postureLean;
      root.current.rotation.z = Math.sin(t * 1.5) * 0.02;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.2;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.4;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.45;
        leftArm.current.rotation.z = 0.65;
        leftArm.current.rotation.y = 0.5;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.55;
        rightArm.current.rotation.z = -0.55;
        rightArm.current.rotation.y = -0.45;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.18;
        torso.current.rotation.y = Math.sin(t * 1.4) * 0.05;
      }
      if (head.current) {
        head.current.rotation.y = Math.sin(t * 1.1) * 0.08;
        head.current.rotation.x = 0.1;
      }
      return;
    }

    if (social === "combat_slash") {
      // Horizontal / diagonal slash — sweeping arm arc
      const slash = Math.sin(t * 4.6);
      const windup = Math.sin(t * 4.6 + 1.2);
      root.current.position.y = -0.02 + Math.abs(slash) * 0.02;
      root.current.rotation.y = postureLean + slash * 0.25;
      root.current.rotation.z = slash * 0.08;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.2 + windup * 0.1;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.45 - windup * 0.12;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.5;
        leftArm.current.rotation.z = 0.25;
        leftArm.current.rotation.y = 0.1;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.4 + slash * 0.7;
        rightArm.current.rotation.z = -0.35 + slash * 0.55;
        rightArm.current.rotation.y = 0.2 - slash * 0.6;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.15;
        torso.current.rotation.y = slash * 0.28;
      }
      if (head.current) {
        head.current.rotation.y = slash * 0.2;
        head.current.rotation.x = 0.08;
      }
      return;
    }

    if (social === "combat_kick") {
      // Forward / roundhouse kick
      const kick = Math.max(0, Math.sin(t * 4.2));
      const plant = Math.sin(t * 4.2 + 1.4);
      root.current.position.y = 0.02 + kick * 0.06;
      root.current.rotation.y = postureLean + plant * 0.15;
      root.current.rotation.z = plant * 0.06;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.15 - plant * 0.1;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.3 - kick * 1.35;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.9 - kick * 0.3;
        leftArm.current.rotation.z = 0.4;
        leftArm.current.rotation.y = 0.25;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.6 + kick * 0.35;
        rightArm.current.rotation.z = -0.3;
        rightArm.current.rotation.y = -0.15;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.12 + kick * 0.1;
        torso.current.rotation.y = plant * 0.12;
      }
      if (head.current) {
        head.current.rotation.y = plant * 0.1;
        head.current.rotation.x = 0.05 + kick * 0.08;
      }
      return;
    }

    if (social === "combat_overhead") {
      // Overhead downward strike
      const smash = Math.sin(t * 3.8);
      const raise = Math.max(0, -smash);
      root.current.position.y = -0.03 + raise * 0.03;
      root.current.rotation.y = postureLean;
      root.current.rotation.z = smash * 0.04;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.25;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.5;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.1 - raise * 0.5;
        leftArm.current.rotation.z = 0.35;
        leftArm.current.rotation.y = 0.2;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.6 - raise * 0.7 + Math.max(0, smash) * 0.9;
        rightArm.current.rotation.z = -0.25;
        rightArm.current.rotation.y = -0.1 + raise * 0.2;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.2 + Math.max(0, smash) * 0.15;
        torso.current.rotation.y = smash * 0.06;
      }
      if (head.current) {
        head.current.rotation.y = smash * 0.05;
        head.current.rotation.x = 0.1 - raise * 0.08;
      }
      return;
    }

    if (social === "combat_block") {
      // Active block — arms cross high, weight shifts with impact feel
      const hit = Math.sin(t * 5.5);
      root.current.position.y = -0.04 + Math.abs(hit) * 0.015;
      root.current.rotation.y = postureLean + hit * 0.04;
      root.current.rotation.z = hit * 0.03;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.3;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.35;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.55 + hit * 0.08;
        leftArm.current.rotation.z = 0.7;
        leftArm.current.rotation.y = 0.55;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.6 + hit * 0.08;
        rightArm.current.rotation.z = -0.65;
        rightArm.current.rotation.y = -0.5;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.2 + Math.abs(hit) * 0.04;
        torso.current.rotation.y = hit * 0.06;
      }
      if (head.current) {
        head.current.rotation.y = hit * 0.06;
        head.current.rotation.x = 0.12;
      }
      return;
    }

    if (social === "combat_dodge") {
      // Sidestep / lean evade
      const dodge = Math.sin(t * 3.6);
      root.current.position.y = -0.02 + Math.abs(dodge) * 0.02;
      root.current.rotation.y = postureLean + dodge * 0.35;
      root.current.rotation.z = dodge * 0.18;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.35 + dodge * 0.15;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.55 - dodge * 0.2;
      if (leftArm.current) {
        leftArm.current.rotation.x = -0.7;
        leftArm.current.rotation.z = 0.45 + Math.abs(dodge) * 0.2;
        leftArm.current.rotation.y = 0.3;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -0.8;
        rightArm.current.rotation.z = -0.4 - Math.abs(dodge) * 0.15;
        rightArm.current.rotation.y = -0.25;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.15;
        torso.current.rotation.y = dodge * 0.2;
      }
      if (head.current) {
        head.current.rotation.y = -dodge * 0.25;
        head.current.rotation.x = 0.08;
      }
      return;
    }

    if (social === "combat_combo") {
      // Multi-hit combo cycle: jab → cross → kick feel
      const cycle = (t * 2.8) % (Math.PI * 2);
      const jab = Math.sin(cycle);
      const cross = Math.sin(cycle + 2.1);
      const kickPhase = Math.max(0, Math.sin(cycle + 4.0));
      root.current.position.y = -0.02 + kickPhase * 0.05;
      root.current.rotation.y = postureLean + jab * 0.12 + cross * 0.1;
      root.current.rotation.z = (jab - cross) * 0.04;
      if (leftLeg.current) leftLeg.current.rotation.x = 0.2 - kickPhase * 0.1;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.4 - kickPhase * 1.1;
      if (leftArm.current) {
        leftArm.current.rotation.x = -1.0 + jab * 0.55;
        leftArm.current.rotation.z = 0.35;
        leftArm.current.rotation.y = 0.25 + jab * 0.2;
      }
      if (rightArm.current) {
        rightArm.current.rotation.x = -1.15 + cross * 0.65;
        rightArm.current.rotation.z = -0.3;
        rightArm.current.rotation.y = -0.2 - cross * 0.25;
      }
      if (torso.current) {
        torso.current.rotation.x = 0.18 + kickPhase * 0.08;
        torso.current.rotation.y = jab * 0.15 + cross * 0.12;
      }
      if (head.current) {
        head.current.rotation.y = (jab + cross) * 0.08;
        head.current.rotation.x = 0.1;
      }
      return;
    }

    // Live webcam head pose wins over idle look-at when Face Studio is tracking
    if (liveFace && head.current) {
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, liveFace.headYaw, 0.2);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, liveFace.headPitch, 0.2);
      head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z, liveFace.headRoll, 0.15);
    }

    const moving = moveState === "walk" || moveState === "run";
    const pace = moveState === "run" ? 10.5 : moveState === "walk" ? 6.5 : 1.4;
    const swing = moveState === "run" ? 0.72 : moveState === "walk" ? 0.48 : 0.08;
    const bob = moveState === "run" ? 0.04 : moveState === "walk" ? 0.022 : 0.01;

    // Weight shift + breath when standing still
    const weight = !moving ? Math.sin(t * 0.55) * 0.018 : 0;
    root.current.position.y = Math.sin(t * pace) * bob + (!moving ? Math.sin(t * 1.55) * 0.008 : 0);
    root.current.rotation.y =
      (moving ? 0 : Math.sin(t * 0.38) * 0.03) + postureLean + weight * 0.4;
    root.current.rotation.z =
      postureLean * 0.28 + (moving ? Math.sin(t * pace) * 0.03 : Math.sin(t * 0.55) * 0.012);

    let legA = Math.sin(t * pace) * swing;
    let legB = Math.sin(t * pace + Math.PI) * swing;
    let armA = Math.sin(t * pace + Math.PI) * swing * 0.75;
    let armB = Math.sin(t * pace) * swing * 0.75;
    let armAz = 0;
    let armBz = 0;
    let armAy = 0;
    let armBy = 0;

    if (!moving) {
      // Living idle: breath, weight shift, micro gestures (readable on NPCs)
      const breath = Math.sin(t * 1.35);
      const shift = Math.sin(t * 0.42 + phase.current);
      const fidget = Math.sin(t * 0.95 + 1.7);
      // Arms hang with occasional soft raise / settle
      armA = -0.14 + breath * 0.04 + fidget * 0.06;
      armB = -0.14 + breath * 0.035 + Math.sin(t * 0.8 + 2.1) * 0.07;
      armAz = -0.22 + shift * 0.05;
      armBz = 0.22 - shift * 0.05;
      armAy = fidget * 0.08;
      armBy = -fidget * 0.06;
      // Legs: soft knee ease, weight on alternating side
      legA = 0.04 + shift * 0.06;
      legB = -0.02 - shift * 0.05;
      // Stronger vertical breath + lean so idle is visible from distance
      root.current.position.y = 0.012 + breath * 0.014 + Math.abs(shift) * 0.006;
      root.current.rotation.z = postureLean * 0.28 + shift * 0.035;
      root.current.rotation.y = postureLean + shift * 0.04;
    } else {
      // Walk/run: keep a little outward arm carry so limbs don't clip torso
      armAz = -0.12;
      armBz = 0.12;
    }

    // Discussion / talk / wave overlay
    if (social === "talk" || social === "discuss") {
      // One arm gesturing, other more open; head nods handled on head group
      const gest = Math.sin(t * 2.4) * 0.35;
      const gest2 = Math.sin(t * 1.8 + 0.8) * 0.22;
      armA = -0.35 + gest * 0.55; // raise + sweep
      armAz = -0.25 + gest2 * 0.2;
      armAy = gest * 0.25;
      armB = -0.15 + Math.sin(t * 1.5) * 0.12;
      armBz = 0.12;
      if (social === "discuss") {
        // Both hands more active, slightly open stance
        armB = -0.25 + gest2 * 0.45;
        armBz = 0.18 + gest * 0.1;
        armBy = -gest * 0.2;
        legA = 0.08 + Math.sin(t * 0.9) * 0.04;
        legB = -0.05 + Math.sin(t * 0.9 + 1) * 0.03;
      }
    } else if (social === "wave") {
      armB = -1.55 + Math.sin(t * 5.5) * 0.35;
      armBz = 0.15;
      armBy = Math.sin(t * 5.5) * 0.4;
      armA = -0.1 + Math.sin(t * 0.8) * 0.05;
    }

    if (leftLeg.current) leftLeg.current.rotation.x = legA;
    if (rightLeg.current) rightLeg.current.rotation.x = legB;
    if (leftArm.current) {
      leftArm.current.rotation.x = armA;
      leftArm.current.rotation.z = armAz;
      leftArm.current.rotation.y = armAy;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = armB;
      rightArm.current.rotation.z = armBz;
      rightArm.current.rotation.y = armBy;
    }
    if (torso.current) {
      torso.current.rotation.y = moving
        ? Math.sin(t * pace) * 0.06
        : social === "discuss" || social === "talk"
          ? Math.sin(t * 1.2) * 0.05
          : Math.sin(t * 0.55) * 0.045;
      torso.current.rotation.x =
        moveState === "run"
          ? 0.12
          : social === "discuss" || social === "talk"
            ? 0.04 + Math.sin(t * 2.1) * 0.025
            : 0.02 + Math.sin(t * 1.35) * 0.028;
    }

    // ——— Head: idle scan, talk nods, look-at player ———
    if (head.current) {
      let targetYaw = 0;
      let targetPitch = 0;

      if (lookAt) {
        const wp = new THREE.Vector3();
        root.current.getWorldPosition(wp);
        const dx = lookAt[0] - wp.x;
        const dy = lookAt[1] - (wp.y + 1.55);
        const dz = lookAt[2] - wp.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.15 && dist < 14) {
          // Character faces local +Z after parent rotation; convert world dir → local yaw
          const parentYaw = root.current.parent
            ? new THREE.Euler().setFromQuaternion(
                root.current.parent.getWorldQuaternion(new THREE.Quaternion()),
                "YXZ",
              ).y
            : root.current.rotation.y;
          const worldYaw = Math.atan2(dx, dz);
          let rel = worldYaw - parentYaw;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          targetYaw = THREE.MathUtils.clamp(rel, -0.85, 0.85);
          targetPitch = THREE.MathUtils.clamp(-Math.atan2(dy, dist) * 0.55, -0.35, 0.25);
        }
      }

      // Idle / talk micro motion on top of look-at (stronger so NPCs feel alive)
      let idleYaw = Math.sin(t * 0.38) * 0.14 + Math.sin(t * 0.15) * 0.07;
      let idlePitch = Math.sin(t * 0.5) * 0.06 + Math.sin(t * 0.9) * 0.02;
      if (social === "talk" || social === "discuss") {
        // Nod while speaking + slight side turns
        idlePitch = Math.sin(t * 3.2) * 0.09 + Math.sin(t * 1.1) * 0.03;
        idleYaw = Math.sin(t * 1.35) * 0.12 + Math.sin(t * 0.6) * 0.05;
      } else if (social === "wave") {
        idleYaw = Math.sin(t * 0.9) * 0.1;
        idlePitch = 0.05;
      }

      const blend = lookAt ? 0.72 : 0;
      const desiredYaw = targetYaw * blend + idleYaw * (1 - blend * 0.55);
      const desiredPitch = targetPitch * blend + idlePitch * (1 - blend * 0.4);

      lookSmooth.current.yaw += (desiredYaw - lookSmooth.current.yaw) * 0.08;
      lookSmooth.current.pitch += (desiredPitch - lookSmooth.current.pitch) * 0.08;
      head.current.rotation.y = lookSmooth.current.yaw;
      head.current.rotation.x = lookSmooth.current.pitch;
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
    () => (
      <MaxHair
        style={appearance.hair}
        color={appearance.hairColor}
        seed={appearance.detailSeed}
      />
    ),
    [appearance.hair, appearance.hairColor, appearance.detailSeed],
  );

  // Seeded face asymmetry (subtle, readable up close)
  const faceAsym = useMemo(() => {
    const seed = appearance.detailSeed;
    return {
      eyeY: ((seed % 7) - 3) * 0.0025,
      jawX: ((seed % 5) - 2) * 0.003,
      browL: appearance.browStrength + (seed % 2) * 0.06,
      browR: appearance.browStrength - (seed % 3) * 0.04,
      mouthY: ((seed % 3) - 1) * 0.002,
    };
  }, [appearance.detailSeed, appearance.browStrength]);

  return (
    <group
      ref={root}
      scale={scale * heightMul}
      position={[((appearance.detailSeed % 7) - 3) * 0.002, 0, 0]}
    >
      {/* ——— LOWER BODY ——— */}
      {isSkirt || isWrap || isFringeKilt ? (
        <group>
          {/* Hip wrap / kilt — game-character silhouette */}
          <mesh position={[0, 0.72, 0]} castShadow>
            <sphereGeometry args={[0.22 * hip, 20, 16]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0, 0.48, 0]} castShadow>
            <cylinderGeometry args={[0.16 * hip, 0.36 * hip, 0.55, 18]} />
            <ClothMat color={bottomC} soft />
          </mesh>
          {/* Front drape panel */}
          <mesh position={[0.06, 0.38, 0.14]} rotation={[0.15, 0.2, 0.08]} castShadow>
            <boxGeometry args={[0.22 * hip, 0.55, 0.04]} />
            <ClothMat color={bottomC} soft />
          </mesh>
          <mesh position={[-0.05, 0.32, 0.12]} rotation={[0.1, -0.15, -0.05]} castShadow>
            <boxGeometry args={[0.18 * hip, 0.48, 0.03]} />
            <ClothMat color={bottomC} soft />
          </mesh>
          {/* Tie cord */}
          <mesh position={[0.12, 0.78, 0.16]} castShadow>
            <torusGeometry args={[0.04, 0.012, 6, 12]} />
            <meshStandardMaterial color="#5c4030" roughness={0.85} />
          </mesh>
          {/* Blue cloth underlayer (concept art) */}
          {isFringeKilt && (
            <mesh position={[0, 0.42, 0.05]} castShadow>
              <cylinderGeometry args={[0.14 * hip, 0.28 * hip, 0.35, 14]} />
              <meshStandardMaterial color="#3b6ea5" roughness={0.75} />
            </mesh>
          )}
          {isFringeKilt &&
            Array.from({ length: 16 }).map((_, i) => {
              const a = -0.55 + (i / 15) * 1.1;
              return (
                <mesh key={`fr-${i}`} position={[a * 0.3 * hip, 0.22, 0.14 + Math.abs(a) * 0.05]} castShadow>
                  <boxGeometry args={[0.022, 0.42 + (i % 4) * 0.05, 0.018]} />
                  <ClothMat color={bottomC} />
                </mesh>
              );
            })}
          {/* Bare lower legs under wrap + optional fur greaves */}
          <group ref={leftLeg} position={[-0.12 * hip, 0.55, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.095 * hip, 0.35, 10, 16]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            {/* Quad bulge */}
            <mesh position={[0.02, -0.18, 0.04]} castShadow scale={[1.05, 0.9, 1.1]}>
              <sphereGeometry args={[0.07 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            {/* Calf */}
            <mesh position={[0, -0.42, -0.01]} castShadow scale={[1.05, 1.15, 1.1]}>
              <sphereGeometry args={[0.065 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[0, -0.55, 0.02]} castShadow>
              <sphereGeometry args={[0.055 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            {/* Foot */}
            <group position={[0, -0.62, 0.06]}>
              <mesh castShadow rotation={[0.15, 0, 0]}>
                <boxGeometry args={[0.08 * hip, 0.04, 0.16]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, -0.01, 0.1]} castShadow>
                <sphereGeometry args={[0.035 * hip, 10, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
            </group>
            {isFurGreaves && (
              <group>
                <mesh position={[0, -0.45, 0.02]} castShadow>
                  <cylinderGeometry args={[0.085, 0.075, 0.28, 12]} />
                  <meshStandardMaterial color="#5c3317" roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.58, 0.02]} castShadow>
                  <torusGeometry args={[0.07, 0.03, 8, 14]} />
                  <meshStandardMaterial color="#f5f0e6" roughness={0.95} />
                </mesh>
                <mesh position={[0, -0.32, 0.05]} castShadow>
                  <boxGeometry args={[0.09, 0.1, 0.04]} />
                  <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
                </mesh>
              </group>
            )}
          </group>
          <group ref={rightLeg} position={[0.12 * hip, 0.55, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.095 * hip, 0.35, 10, 16]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[-0.02, -0.18, 0.04]} castShadow scale={[1.05, 0.9, 1.1]}>
              <sphereGeometry args={[0.07 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[0, -0.42, -0.01]} castShadow scale={[1.05, 1.15, 1.1]}>
              <sphereGeometry args={[0.065 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[0, -0.55, 0.02]} castShadow>
              <sphereGeometry args={[0.055 * hip, 12, 10]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <group position={[0, -0.62, 0.06]}>
              <mesh castShadow rotation={[0.15, 0, 0]}>
                <boxGeometry args={[0.08 * hip, 0.04, 0.16]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, -0.01, 0.1]} castShadow>
                <sphereGeometry args={[0.035 * hip, 10, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
            </group>
            {isFurGreaves && (
              <group>
                <mesh position={[0, -0.45, 0.02]} castShadow>
                  <cylinderGeometry args={[0.085, 0.075, 0.28, 12]} />
                  <meshStandardMaterial color="#5c3317" roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.58, 0.02]} castShadow>
                  <torusGeometry args={[0.07, 0.03, 8, 14]} />
                  <meshStandardMaterial color="#f5f0e6" roughness={0.95} />
                </mesh>
                <mesh position={[0, -0.32, 0.05]} castShadow>
                  <boxGeometry args={[0.09, 0.1, 0.04]} />
                  <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.3} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      ) : (
        <group>
          {/* Pelvis */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <sphereGeometry args={[0.26 * hip, 32, 26]} />
            <ClothMat color={bottomC} denim={isDenimBottom} />
          </mesh>
          {/* belt band */}
          <mesh position={[0, 0.88, 0]} castShadow>
            <torusGeometry args={[0.24 * hip, 0.035, 10, 28]} />
            <meshStandardMaterial color="#1c1917" roughness={0.55} metalness={0.15} />
          </mesh>
          <mesh position={[0.02, 0.88, 0.22]}>
            <boxGeometry args={[0.06, 0.045, 0.03]} />
            <meshStandardMaterial color="#a8a29e" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* front fly seam */}
          <mesh position={[0, 0.65, 0.22]}>
            <boxGeometry args={[0.012, 0.28, 0.01]} />
            <meshStandardMaterial color="#000000" transparent opacity={0.18} />
          </mesh>
          <group ref={leftLeg} position={[-0.14 * hip, 0.76, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.12 * hip, 0.28, 12, 24]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.1 * hip, -0.26, 0]} rotation={[0, 0, 0.04]}>
              <boxGeometry args={[0.01, 0.42, 0.01]} />
              <meshStandardMaterial color="#000000" transparent opacity={0.12} />
            </mesh>
            <mesh position={[-0.05, -0.08, 0.09]} castShadow>
              <boxGeometry args={[0.09, 0.07, 0.018]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0, -0.4, 0.015]} castShadow>
              <sphereGeometry args={[0.095 * hip, 16, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.01, -0.58, 0.025]} castShadow>
              <capsuleGeometry args={[0.088 * hip, 0.22, 12, 22]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.01, -0.72, 0.035]}>
              <torusGeometry args={[0.075 * hip, 0.012, 8, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.01, -0.7, 0.035]} castShadow>
              <sphereGeometry args={[0.065 * hip, 14, 12]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
          </group>
          <group ref={rightLeg} position={[0.14 * hip, 0.76, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.12 * hip, 0.28, 12, 24]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0.1 * hip, -0.26, 0]} rotation={[0, 0, -0.04]}>
              <boxGeometry args={[0.01, 0.42, 0.01]} />
              <meshStandardMaterial color="#000000" transparent opacity={0.12} />
            </mesh>
            <mesh position={[0.05, -0.08, 0.09]} castShadow>
              <boxGeometry args={[0.09, 0.07, 0.018]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[0, -0.4, 0.015]} castShadow>
              <sphereGeometry args={[0.095 * hip, 16, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.01, -0.58, 0.025]} castShadow>
              <capsuleGeometry args={[0.088 * hip, 0.22, 12, 22]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.01, -0.72, 0.035]}>
              <torusGeometry args={[0.075 * hip, 0.012, 8, 14]} />
              <ClothMat color={bottomC} denim={isDenimBottom} />
            </mesh>
            <mesh position={[-0.01, -0.7, 0.04]} castShadow>
              <sphereGeometry args={[0.072 * hip, 16, 14]} />
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
      {/* Core body — skin when bare/beaded/armor base */}
      <mesh position={[0, 1.05, 0]} castShadow scale={[waistMul, 1, waistMul * 0.95]}>
        <capsuleGeometry args={[0.26 * waist, 0.42, 14, 28]} />
        {isBareTorso || isLeatherArmor ? (
          <SkinMat color={appearance.skin} />
        ) : (
          <ClothMat color={topC} soft={isSoftTop} />
        )}
      </mesh>
      <mesh position={[0, 1.22, 0.06]} castShadow scale={[chestMul, 1.05, chestMul]}>
        <sphereGeometry args={[0.24 * chest, 28, 24]} />
        {isBareTorso || isLeatherArmor ? (
          <SkinMat color={appearance.skin} />
        ) : (
          <ClothMat color={topC} soft={isSoftTop} />
        )}
      </mesh>
      {/* Muscle definition — bare warrior (pecs, abs, obliques, traps) */}
      {isBareTorso && (
        <group>
          {/* Pectorals — split L/R with lower shelf */}
          <mesh position={[-0.11 * chest, 1.24, 0.15]} castShadow scale={[1.15, 0.9, 0.75]}>
            <sphereGeometry args={[0.12 * chest, 16, 14]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.11 * chest, 1.24, 0.15]} castShadow scale={[1.15, 0.9, 0.75]}>
            <sphereGeometry args={[0.12 * chest, 16, 14]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[-0.09 * chest, 1.14, 0.16]} castShadow scale={[0.95, 0.55, 0.55]}>
            <sphereGeometry args={[0.09 * chest, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.09 * chest, 1.14, 0.16]} castShadow scale={[0.95, 0.55, 0.55]}>
            <sphereGeometry args={[0.09 * chest, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {/* Sternum valley */}
          <mesh position={[0, 1.2, 0.12]} scale={[0.35, 1.1, 0.4]}>
            <capsuleGeometry args={[0.02, 0.14, 4, 8]} />
            <meshStandardMaterial color={appearance.skin} transparent opacity={0.35} />
          </mesh>
          {/* Six-pack — 3 rows × 2 */}
          {[1.04, 0.96, 0.88].map((y, row) =>
            [-1, 1].map((side) => (
              <mesh
                key={`abs-${row}-${side}`}
                position={[side * 0.045 * waist, y, 0.175]}
                castShadow
                scale={[0.85, 0.55, 0.55]}
              >
                <sphereGeometry args={[0.055 * waist, 12, 10]} />
                <SkinMat color={appearance.skin} />
              </mesh>
            )),
          )}
          {/* Obliques */}
          <mesh position={[-0.14 * waist, 0.95, 0.08]} rotation={[0, 0, 0.35]} castShadow scale={[0.55, 1.2, 0.6]}>
            <sphereGeometry args={[0.08 * waist, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.14 * waist, 0.95, 0.08]} rotation={[0, 0, -0.35]} castShadow scale={[0.55, 1.2, 0.6]}>
            <sphereGeometry args={[0.08 * waist, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {/* Serratus hints under pecs */}
          {[-1, 1].map((side) => (
            <mesh
              key={`ser-${side}`}
              position={[side * 0.16 * chest, 1.08, 0.12]}
              rotation={[0.2, side * 0.3, side * 0.4]}
              castShadow
              scale={[0.4, 0.9, 0.35]}
            >
              <capsuleGeometry args={[0.025, 0.1, 4, 8]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          ))}
          {/* Upper traps into neck */}
          <mesh position={[-0.08, 1.38, -0.02]} castShadow scale={[0.7, 0.5, 0.55]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.08, 1.38, -0.02]} castShadow scale={[0.7, 0.5, 0.55]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {/* Navel */}
          <mesh position={[0, 0.86, 0.19]}>
            <sphereGeometry args={[0.014, 8, 6]} />
            <meshStandardMaterial color="#3d2314" transparent opacity={0.3} />
          </mesh>
        </group>
      )}
      {/* Shoulders / deltoids */}
      <mesh position={[-0.22 * shoulder * shoulderMul, 1.33, 0]} castShadow>
        <sphereGeometry args={[0.14 * shoulder * shoulderMul, 22, 18]} />
        {isBareTorso ? (
          <SkinMat color={appearance.skin} />
        ) : (
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        )}
      </mesh>
      <mesh position={[0.22 * shoulder * shoulderMul, 1.33, 0]} castShadow>
        <sphereGeometry args={[0.14 * shoulder * shoulderMul, 22, 18]} />
        {isBareTorso ? (
          <SkinMat color={appearance.skin} />
        ) : (
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        )}
      </mesh>
      {!isBareTorso && !isLeatherArmor && (
        <mesh position={[0, 1.34, 0]}>
          <boxGeometry args={[0.58 * shoulder, 0.1, 0.26]} />
          <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />
        </mesh>
      )}
      {/* Beaded chest layers */}
      {isBeadedTop && (
        <group>
          {/* Layered bead chokers — red / blue / gold (Mask Bearer reference) */}
          {[
            { y: 1.32, r: 0.11, c: "#1d4ed8", tube: 0.02 },
            { y: 1.26, r: 0.13, c: "#dc2626", tube: 0.018 },
            { y: 1.2, r: 0.15, c: "#f8f5f0", tube: 0.016 },
            { y: 1.14, r: 0.17, c: "#e8b923", tube: 0.02 },
            { y: 1.08, r: 0.19, c: "#dc2626", tube: 0.015 },
            { y: 1.02, r: 0.21, c: "#c9a227", tube: 0.018 },
          ].map((b, i) => (
            <mesh key={`bead-${i}`} position={[0, b.y, 0.14]} castShadow>
              <torusGeometry args={[b.r, b.tube, 8, 24]} />
              <meshStandardMaterial color={b.c} roughness={0.35} metalness={0.3} />
            </mesh>
          ))}
          {/* hanging heart / gold pendant drops */}
          {[-0.08, 0, 0.08].map((x, i) => (
            <mesh key={`pend-${i}`} position={[x, 0.96, 0.22]} castShadow>
              <sphereGeometry args={[0.025, 10, 8]} />
              <meshStandardMaterial color="#e8b923" metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          {/* red leather strap across chest */}
          <mesh position={[0, 1.05, 0.12]} rotation={[0.4, 0, 0.3]} castShadow>
            <boxGeometry args={[0.08, 0.35, 0.02]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* Mask Bearer waist harness — belts + pouch (concept art) */}
      {isMaskBearer && (
        <group>
          <mesh position={[0, 0.82, 0]} castShadow>
            <torusGeometry args={[0.22 * hip, 0.03, 8, 24]} />
            <meshStandardMaterial color="#5c3317" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.76, 0]} castShadow>
            <torusGeometry args={[0.23 * hip, 0.022, 8, 24]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
          </mesh>
          {/* front pouch */}
          <mesh position={[0.12, 0.78, 0.2]} castShadow>
            <boxGeometry args={[0.1, 0.12, 0.06]} />
            <meshStandardMaterial color="#6b4423" roughness={0.8} />
          </mesh>
          <mesh position={[-0.1, 0.8, 0.18]} castShadow>
            <boxGeometry args={[0.08, 0.1, 0.05]} />
            <meshStandardMaterial color="#4a3728" roughness={0.8} />
          </mesh>
          {/* gold belt buckle */}
          <mesh position={[0, 0.82, 0.24]} castShadow>
            <boxGeometry args={[0.06, 0.05, 0.02]} />
            <meshStandardMaterial color="#c9a227" metalness={0.75} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Leather armor chest plate */}
      
      {/* Mask Bearer: white fur + gold face pauldrons, arm plates, knee faces */}
      {isGoldPauldron && (
        <group>
          {/* white fur mantle — layered clumps */}
          {[-0.28, -0.22, 0.22, 0.28].map((x, i) => (
            <mesh
              key={`fur-${i}`}
              position={[x, 1.38 + (i % 2) * 0.04, -0.02 + Math.abs(x) * 0.05]}
              rotation={[0.1, 0, x > 0 ? -0.35 : 0.35]}
              castShadow
            >
              <sphereGeometry args={[0.1 + (i % 2) * 0.02, 12, 10]} />
              <meshStandardMaterial color="#f5f0e6" roughness={0.95} />
            </mesh>
          ))}
          {[-0.32, 0.32].map((x, i) => (
            <mesh key={`fur2-${i}`} position={[x * 0.9, 1.3, 0.05]} castShadow>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshStandardMaterial color="#e7e5e4" roughness={0.92} />
            </mesh>
          ))}
          {/* gold shoulder face plates */}
          <mesh position={[-0.32, 1.36, 0.08]} rotation={[0.2, 0.4, 0.2]} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.06]} />
            <meshStandardMaterial color="#c9a227" metalness={0.75} roughness={0.28} />
          </mesh>
          <mesh position={[0.32, 1.36, 0.08]} rotation={[0.2, -0.4, -0.2]} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.06]} />
            <meshStandardMaterial color="#c9a227" metalness={0.75} roughness={0.28} />
          </mesh>
          {/* embossed face on plates — eyes + mouth */}
          {[-0.32, 0.32].map((x, i) => (
            <group key={`faceplate-${i}`} position={[x, 1.36, 0.12]}>
              <mesh>
                <sphereGeometry args={[0.038, 10, 8]} />
                <meshStandardMaterial color="#a67c00" metalness={0.6} roughness={0.35} />
              </mesh>
              <mesh position={[-0.012, 0.008, 0.02]}>
                <sphereGeometry args={[0.008, 6, 6]} />
                <meshStandardMaterial color="#3d2914" />
              </mesh>
              <mesh position={[0.012, 0.008, 0.02]}>
                <sphereGeometry args={[0.008, 6, 6]} />
                <meshStandardMaterial color="#3d2914" />
              </mesh>
              <mesh position={[0, -0.012, 0.02]}>
                <boxGeometry args={[0.02, 0.006, 0.008]} />
                <meshStandardMaterial color="#3d2914" />
              </mesh>
            </group>
          ))}
          {/* upper arm gold bands */}
          <mesh position={[-0.42, 1.15, 0]} rotation={[0, 0, 0.2]} castShadow>
            <torusGeometry args={[0.07, 0.025, 8, 16]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.42, 1.15, 0]} rotation={[0, 0, -0.2]} castShadow>
            <torusGeometry args={[0.07, 0.025, 8, 16]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* elbow face guards (concept art) */}
          <mesh position={[-0.48, 0.95, 0.05]} rotation={[0.2, 0.3, 0.4]} castShadow>
            <boxGeometry args={[0.08, 0.09, 0.04]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.48, 0.95, 0.05]} rotation={[0.2, -0.3, -0.4]} castShadow>
            <boxGeometry args={[0.08, 0.09, 0.04]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.48, 0.95, 0.08]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshStandardMaterial color="#a67c00" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.48, 0.95, 0.08]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshStandardMaterial color="#a67c00" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* knee face guards */}
          <mesh position={[-0.12, 0.55, 0.1]} castShadow>
            <boxGeometry args={[0.1, 0.12, 0.05]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.12, 0.55, 0.1]} castShadow>
            <boxGeometry args={[0.1, 0.12, 0.05]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.12, 0.55, 0.14]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#a67c00" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.55, 0.14]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#a67c00" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* red knee wraps */}
          <mesh position={[-0.12, 0.48, 0.06]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.08]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.75} />
          </mesh>
          <mesh position={[0.12, 0.48, 0.06]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.08]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.75} />
          </mesh>
          {/* hanging leather tassels under pauldrons */}
          {[-0.3, -0.25, 0.25, 0.3].map((x, i) => (
            <mesh key={`tassel-${i}`} position={[x, 1.22, 0.08]} castShadow>
              <boxGeometry args={[0.015, 0.12 + (i % 2) * 0.04, 0.012]} />
              <meshStandardMaterial color="#6b4423" roughness={0.85} />
            </mesh>
          ))}
        </group>
      )}


      {/* Extra ritual details — cowries, hip tassels, secondary straps */}
      {isMaskBearer && (
        <group>
          {/* cowrie shells on collar */}
          {[-0.1, -0.05, 0, 0.05, 0.1].map((x, i) => (
            <mesh key={`cow-${i}`} position={[x, 1.22, 0.2]} rotation={[0.5, 0, i * 0.2]} castShadow>
              <sphereGeometry args={[0.018, 8, 6]} />
              <meshStandardMaterial color="#f8f5f0" roughness={0.45} />
            </mesh>
          ))}
          {/* diagonal secondary strap */}
          <mesh position={[0.05, 1.05, 0.1]} rotation={[0.5, 0, -0.55]} castShadow>
            <boxGeometry args={[0.05, 0.4, 0.015]} />
            <meshStandardMaterial color="#5c3317" roughness={0.75} />
          </mesh>
          {/* hip fringe leather strips */}
          {Array.from({ length: 8 }).map((_, i) => {
            const x = -0.18 + (i / 7) * 0.36;
            return (
              <mesh key={`hipfr-${i}`} position={[x, 0.68, 0.18]} castShadow>
                <boxGeometry args={[0.02, 0.14 + (i % 3) * 0.03, 0.015]} />
                <meshStandardMaterial color="#6b4423" roughness={0.85} />
              </mesh>
            );
          })}
          {/* small gold charms on belt */}
          {[-0.12, 0, 0.12].map((x, i) => (
            <mesh key={`charm-${i}`} position={[x, 0.74, 0.22]} castShadow>
              <sphereGeometry args={[0.015, 8, 6]} />
              <meshStandardMaterial color="#e8b923" metalness={0.75} roughness={0.25} />
            </mesh>
          ))}
        </group>
      )}

      {/* Ancestor mask shield — large face disc (always visible on Mask Bearer) */}
      {isMaskBearer && (
        <group position={[-0.38, 0.92, 0.28]} rotation={[0.25, 0.55, -0.2]}>
          {/* disc body */}
          <mesh castShadow>
            <circleGeometry args={[0.3, 28]} />
            <meshStandardMaterial color="#8b6914" metalness={0.5} roughness={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, -0.02]} castShadow>
            <circleGeometry args={[0.3, 28]} />
            <meshStandardMaterial color="#5c4a1a" metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* brow ridge */}
          <mesh position={[0, 0.1, 0.025]} castShadow>
            <boxGeometry args={[0.22, 0.04, 0.03]} />
            <meshStandardMaterial color="#6b4423" roughness={0.5} />
          </mesh>
          {/* face nose */}
          <mesh position={[0, 0.02, 0.04]} castShadow>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color="#6b4423" roughness={0.55} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.08, 0.08, 0.04]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#1a1008" />
          </mesh>
          <mesh position={[0.08, 0.08, 0.04]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#1a1008" />
          </mesh>
          {/* mouth */}
          <mesh position={[0, -0.08, 0.035]}>
            <boxGeometry args={[0.12, 0.035, 0.025]} />
            <meshStandardMaterial color="#3d2914" />
          </mesh>
          {/* scarification lines */}
          {[-0.12, -0.06, 0.06, 0.12].map((x, i) => (
            <mesh key={`scar-${i}`} position={[x, -0.02, 0.03]} rotation={[0, 0, 0.4 * (i % 2 ? 1 : -1)]}>
              <boxGeometry args={[0.04, 0.008, 0.01]} />
              <meshStandardMaterial color="#4a3728" />
            </mesh>
          ))}
          {/* gold rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.022, 8, 32]} />
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* grip handle on back */}
          <mesh position={[0, -0.05, -0.06]} rotation={[0.2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.02, 0.12, 6, 10]} />
            <meshStandardMaterial color="#5c3317" roughness={0.8} />
          </mesh>
        </group>
      )}

{isLeatherArmor && (
        <group>
          <mesh position={[0, 1.18, 0.08]} castShadow>
            <boxGeometry args={[0.48 * shoulder, 0.42, 0.22]} />
            <meshStandardMaterial color="#8b1a1a" roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.18, 0.2]} castShadow>
            <boxGeometry args={[0.36 * shoulder, 0.28, 0.04]} />
            <meshStandardMaterial color="#6b1515" roughness={0.55} metalness={0.1} />
          </mesh>
          {/* brass studs */}
          {[-0.12, 0, 0.12].map((x, i) =>
            [1.28, 1.18, 1.08].map((y, j) => (
              <mesh key={`st-${i}-${j}`} position={[x * shoulder, y, 0.24]}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial color="#c9a227" metalness={0.85} roughness={0.25} />
              </mesh>
            )),
          )}
        </group>
      )}
      {/* Crew neck only on cloth tops */}
      {!isBareTorso && !isLeatherArmor && (
        <mesh position={[0, 1.38, 0.1]}>
          <torusGeometry args={[0.095, 0.03, 10, 24]} />
          <ClothMat color={topC} soft />
        </mesh>
      )}
      {/* collarbone hints */}
      <mesh position={[-0.1 * shoulder, 1.36, 0.12]} rotation={[0.2, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
        {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={topC} soft={isSoftTop} />}
      </mesh>
      <mesh position={[0.1 * shoulder, 1.36, 0.12]} rotation={[0.2, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.025, 0.1, 6, 12]} />
        {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={topC} soft={isSoftTop} />}
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
      {/* Tee hem — cloth tops only */}
      {!isBareTorso && !isLeatherArmor && (
        <>
          <mesh position={[0, 0.82, 0.05]}>
            <cylinderGeometry args={[0.28 * waist, 0.29 * waist, 0.04, 20]} />
            <ClothMat color={topC} soft={isSoftTop} />
          </mesh>
          <mesh position={[0, 0.8, 0.05]}>
            <torusGeometry args={[0.285 * waist, 0.012, 8, 24]} />
            <ClothMat color={topC} soft />
          </mesh>
        </>
      )}
      {/* side body soft folds */}
      <mesh position={[-0.22 * waist, 1.05, 0.05]} castShadow scale={[0.55, 1.1, 0.7]}>
        <sphereGeometry args={[0.12, 16, 14]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      <mesh position={[0.22 * waist, 1.05, 0.05]} castShadow scale={[0.55, 1.1, 0.7]}>
        <sphereGeometry args={[0.12, 16, 14]} />
        <ClothMat color={topC} soft={isSoftTop} />
      </mesh>
      {/* shirt buttons */}
      {[1.28, 1.16, 1.04, 0.92].map((y, i) => (
        <mesh key={`btn-${i}`} position={[0, y, 0.24 * chest]} castShadow>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial color="#e7e5e4" metalness={0.15} roughness={0.4} />
        </mesh>
      ))}
      {/* placket line */}
      <mesh position={[0, 1.1, 0.235]}>
        <boxGeometry args={[0.02, 0.45, 0.008]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.12} />
      </mesh>
      {/* back volume */}
      <mesh position={[0, 1.12, -0.12]} castShadow scale={[0.95, 1.05, 0.75]}>
        <sphereGeometry args={[0.22 * shoulder, 20, 16]} />
        <ClothMat color={topC} soft={isSoftTop} />
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

      {/* ——— ARMS — pivot at shoulder so swing is natural ——— */}
      <group ref={leftArm} position={[-0.34 * shoulder * shoulderMul, 1.34, 0]}>
        {/* upper arm hangs from shoulder joint */}
        <mesh
          position={[-0.04, -0.2, 0]}
          rotation={[0.12, 0, -0.35]}
          scale={[isBareTorso ? 1.12 : sleeveW, 1, isBareTorso ? 1.12 : sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.09, 0.32, 12, 24]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        {/* Bicep bulge */}
        {isBareTorso && (
          <mesh position={[-0.06, -0.22, 0.06]} rotation={[0.2, 0, -0.3]} castShadow scale={[1.15, 0.9, 1.1]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        {/* Tricep */}
        {isBareTorso && (
          <mesh position={[-0.05, -0.24, -0.05]} rotation={[0.15, 0, -0.25]} castShadow scale={[0.9, 1.0, 0.85]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        <mesh position={[-0.1, -0.4, 0.02]} castShadow>
          <sphereGeometry args={[0.085 * (isBareTorso ? 1.1 : sleeveW), 14, 12]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        <mesh
          position={[-0.14, -0.58, 0.05]}
          rotation={[0.3, 0, -0.25]}
          scale={[isBareTorso ? 1.08 : sleeveW, 1, isBareTorso ? 1.08 : sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.072, 0.24, 12, 22]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        {/* Forearm flexor */}
        {isBareTorso && (
          <mesh position={[-0.13, -0.55, 0.08]} rotation={[0.35, 0, -0.25]} castShadow scale={[0.85, 1.1, 0.7]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        <mesh position={[-0.16, -0.72, 0.08]} rotation={[0.3, 0, -0.25]}>
          <torusGeometry args={[0.072, 0.012, 8, 14]} />
          {isBareTorso ? (
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          ) : (
            <ClothMat color={outerC ?? topC} soft />
          )}
        </mesh>
        {/* Left hand — palm, knuckles, fingers, thumb */}
        <group position={[-0.18, -0.8, 0.11]} rotation={[0.2, 0.1, -0.35]}>
          <mesh castShadow>
            <sphereGeometry args={[0.055, 14, 12]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0, -0.01, 0.04]} castShadow>
            <boxGeometry args={[0.09, 0.04, 0.1]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {/* knuckles */}
          {[-0.032, -0.01, 0.012, 0.034].map((x, i) => (
            <mesh key={`kn-${i}`} position={[x, 0.005, 0.08]} castShadow>
              <sphereGeometry args={[0.014, 8, 6]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          ))}
          {[-0.032, -0.01, 0.012, 0.034].map((x, i) => (
            <group key={i} position={[x, -0.01, 0.1]} rotation={[0.35 + i * 0.04, 0, (i - 1.5) * 0.05]}>
              <mesh position={[0, 0, 0.03]} castShadow>
                <capsuleGeometry args={[0.012, 0.032, 6, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, 0, 0.055]} castShadow>
                <sphereGeometry args={[0.013, 8, 6]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, 0, 0.08]} castShadow>
                <capsuleGeometry args={[0.011, 0.022 - i * 0.002, 6, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
            </group>
          ))}
          {/* thumb */}
          <group position={[-0.055, 0.0, 0.03]} rotation={[0.4, 0.2, 1.0]}>
            <mesh position={[0, 0, 0.03]} castShadow>
              <capsuleGeometry args={[0.015, 0.04, 6, 8]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[0, 0, 0.06]} castShadow>
              <sphereGeometry args={[0.014, 8, 6]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          </group>
        </group>
      </group>
      <group ref={rightArm} position={[0.34 * shoulder * shoulderMul, 1.34, 0]}>
        <mesh
          position={[0.04, -0.2, 0]}
          rotation={[0.12, 0, 0.35]}
          scale={[isBareTorso ? 1.12 : sleeveW, 1, isBareTorso ? 1.12 : sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.09, 0.32, 12, 24]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        {isBareTorso && (
          <mesh position={[0.06, -0.22, 0.06]} rotation={[0.2, 0, 0.3]} castShadow scale={[1.15, 0.9, 1.1]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        {isBareTorso && (
          <mesh position={[0.05, -0.24, -0.05]} rotation={[0.15, 0, 0.25]} castShadow scale={[0.9, 1.0, 0.85]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        <mesh position={[0.1, -0.4, 0.02]} castShadow>
          <sphereGeometry args={[0.085 * (isBareTorso ? 1.1 : sleeveW), 14, 12]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        <mesh
          position={[0.14, -0.58, 0.05]}
          rotation={[0.3, 0, 0.25]}
          scale={[isBareTorso ? 1.08 : sleeveW, 1, isBareTorso ? 1.08 : sleeveW]}
          castShadow
        >
          <capsuleGeometry args={[0.072, 0.24, 12, 22]} />
          {isBareTorso ? <SkinMat color={appearance.skin} /> : <ClothMat color={outerC ?? topC} soft={!outerC} fur={isFur} />}
        </mesh>
        {isBareTorso && (
          <mesh position={[0.13, -0.55, 0.08]} rotation={[0.35, 0, 0.25]} castShadow scale={[0.85, 1.1, 0.7]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
        )}
        <mesh position={[0.16, -0.72, 0.08]} rotation={[0.3, 0, 0.25]}>
          <torusGeometry args={[0.072, 0.012, 8, 14]} />
          {isBareTorso ? (
            <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
          ) : (
            <ClothMat color={outerC ?? topC} soft />
          )}
        </mesh>
        <group position={[0.18, -0.8, 0.11]} rotation={[0.2, -0.1, 0.35]}>
          <mesh castShadow>
            <sphereGeometry args={[0.055, 14, 12]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0, -0.01, 0.04]} castShadow>
            <boxGeometry args={[0.09, 0.04, 0.1]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          {[-0.032, -0.01, 0.012, 0.034].map((x, i) => (
            <mesh key={`rkn-${i}`} position={[x, 0.005, 0.08]} castShadow>
              <sphereGeometry args={[0.014, 8, 6]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          ))}
          {[-0.032, -0.01, 0.012, 0.034].map((x, i) => (
            <group key={i} position={[x, -0.01, 0.1]} rotation={[0.35 + i * 0.04, 0, (i - 1.5) * 0.05]}>
              <mesh position={[0, 0, 0.03]} castShadow>
                <capsuleGeometry args={[0.012, 0.032, 6, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, 0, 0.055]} castShadow>
                <sphereGeometry args={[0.013, 8, 6]} />
                <SkinMat color={appearance.skin} />
              </mesh>
              <mesh position={[0, 0, 0.08]} castShadow>
                <capsuleGeometry args={[0.011, 0.022 - i * 0.002, 6, 8]} />
                <SkinMat color={appearance.skin} />
              </mesh>
            </group>
          ))}
          <group position={[0.055, 0.0, 0.03]} rotation={[0.4, -0.2, -1.0]}>
            <mesh position={[0, 0, 0.03]} castShadow>
              <capsuleGeometry args={[0.015, 0.04, 6, 8]} />
              <SkinMat color={appearance.skin} />
            </mesh>
            <mesh position={[0, 0, 0.06]} castShadow>
              <sphereGeometry args={[0.014, 8, 6]} />
              <SkinMat color={appearance.skin} />
            </mesh>
          </group>
          {/* Combat weapons parented to right hand */}
          {showWeapons && (
            <group position={[0.05, -0.02, 0.12]}>
              <CombatProps
                kind={propForActivity(activity).right}
                side="right"
                active={(activity ?? "none").startsWith("combat_")}
              />
            </group>
          )}
        </group>
      </group>

      {/* Left-hand shield when guarding */}
      {showWeapons && propForActivity(activity).left === "shield" && (
        <group position={[-0.34 * shoulder, 1.2, 0.15]}>
          <CombatProps kind="shield" side="left" active />
        </group>
      )}

      {/* ——— NECK + HEAD (pivots at neck for look-at / talk) ——— */}
      <group ref={head} position={[0, 1.44, 0]}>
      <group position={[0, -1.44, 0]}>
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
      {/* Brow ridge / forehead mass */}
      <mesh position={[0, 1.72, 0.12]} castShadow scale={[1.15, 0.45, 0.7]}>
        <sphereGeometry args={[0.14, 18, 14]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      {/* Temple volume */}
      <mesh position={[-0.2, 1.62, 0.02]} castShadow scale={[0.6, 0.9, 0.7]}>
        <sphereGeometry args={[0.1, 14, 12]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh position={[0.2, 1.62, 0.02]} castShadow scale={[0.6, 0.9, 0.7]}>
        <sphereGeometry args={[0.1, 14, 12]} />
        <SkinMat color={appearance.skin} />
      </mesh>

      {/* Eyes — sclera + iris + pupil + catchlight */}
      <mesh position={[-0.08, 1.64 + faceAsym.eyeY, 0.21]}>
        <sphereGeometry args={[eyeR, 20, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>
      <mesh position={[0.08, 1.64 - faceAsym.eyeY, 0.21]}>
        <sphereGeometry args={[eyeR, 20, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>
      {/* outer iris */}
      <mesh position={[-0.08, 1.64 + faceAsym.eyeY, 0.248]}>
        <sphereGeometry args={[eyeR * 0.62, 16, 16]} />
        <meshStandardMaterial
          color={appearance.eyeColor || "#2c1810"}
          roughness={0.22}
          emissive={isMaskBearer ? appearance.eyeColor || "#c45c26" : "#000000"}
          emissiveIntensity={isMaskBearer ? 0.15 : 0}
        />
      </mesh>
      <mesh position={[0.08, 1.64 - faceAsym.eyeY, 0.248]}>
        <sphereGeometry args={[eyeR * 0.62, 16, 16]} />
        <meshStandardMaterial
          color={appearance.eyeColor || "#2c1810"}
          roughness={0.22}
          emissive={isMaskBearer ? appearance.eyeColor || "#c45c26" : "#000000"}
          emissiveIntensity={isMaskBearer ? 0.15 : 0}
        />
      </mesh>
      {/* inner iris ring (darker) */}
      <mesh position={[-0.08, 1.64 + faceAsym.eyeY, 0.258]}>
        <sphereGeometry args={[eyeR * 0.38, 12, 12]} />
        <meshStandardMaterial color="#3d1810" roughness={0.35} />
      </mesh>
      <mesh position={[0.08, 1.64 - faceAsym.eyeY, 0.258]}>
        <sphereGeometry args={[eyeR * 0.38, 12, 12]} />
        <meshStandardMaterial color="#3d1810" roughness={0.35} />
      </mesh>
      {/* pupil */}
      <mesh position={[-0.08, 1.64 + faceAsym.eyeY, 0.272]}>
        <sphereGeometry args={[eyeR * 0.26, 12, 12]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.15} />
      </mesh>
      <mesh position={[0.08, 1.64 - faceAsym.eyeY, 0.272]}>
        <sphereGeometry args={[eyeR * 0.26, 12, 12]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.15} />
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
        <boxGeometry args={[0.11, 0.014 + faceAsym.browL * 0.022 + (isMaskBearer ? 0.01 : 0), 0.022]} />
        <meshStandardMaterial color={appearance.hairColor} roughness={0.9} />
      </mesh>
      <mesh position={[0.08, 1.71, 0.2]} rotation={[0, 0, -0.14]}>
        <boxGeometry args={[0.11, 0.014 + faceAsym.browR * 0.022 + (isMaskBearer ? 0.01 : 0), 0.022]} />
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
      {/* under-eye soft shadow volume */}
      <mesh position={[-0.08, 1.615, 0.21]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#5c3317" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0.08, 1.615, 0.21]} scale={[1, 0.45, 0.7]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#5c3317" transparent opacity={0.12} />
      </mesh>
      {/* philtrum / upper lip notch */}
      <mesh position={[0, 1.53, 0.23]} scale={[0.5, 0.8, 0.6]}>
        <sphereGeometry args={[0.02, 10, 8]} />
        <SkinMat color={appearance.skin} />
      </mesh>

      {/* Upper lids — rotation.x driven by blink proxy (0 open → ~1.1 closed) */}
      <mesh
        ref={lidLRef}
        position={[-0.08, 1.64 + faceAsym.eyeY + eyeR * 0.55, 0.24]}
        rotation={[0.15, 0, 0]}
        castShadow
      >
        <boxGeometry args={[eyeR * 1.7, eyeR * 0.55, 0.04]} />
        <SkinMat color={appearance.skin} />
      </mesh>
      <mesh
        ref={lidRRef}
        position={[0.08, 1.64 - faceAsym.eyeY + eyeR * 0.55, 0.24]}
        rotation={[0.15, 0, 0]}
        castShadow
      >
        <boxGeometry args={[eyeR * 1.7, eyeR * 0.55, 0.04]} />
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
      {/* Lips — rounded volume (jaw group for talk / ARKit jawOpen proxy) */}
      <group ref={jawRef} position={[faceAsym.jawX, 1.505, 0.22]}>
      <mesh
        position={[0, faceAsym.mouthY, 0.015]}
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
      </group>
      {appearance.gapTooth && (
        <mesh position={[0, 1.505, 0.24]}>
          <boxGeometry args={[0.015, 0.02, 0.01]} />
          <meshStandardMaterial color="#fafaf9" />
        </mesh>
      )}
      {/* Ears — rounded default, pointed elf tips for Mask Bearer */}
      {isMaskBearer ? (
        <group>
          {/* left pointed ear */}
          <mesh position={[-0.26, 1.62, -0.02]} rotation={[0.15, 0.35, 0.55]} castShadow scale={[0.45, 1.35, 0.55]}>
            <sphereGeometry args={[0.08, 14, 12]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[-0.3, 1.72, -0.04]} rotation={[0.2, 0.4, 0.7]} castShadow scale={[0.25, 0.7, 0.3]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[-0.27, 1.62, 0.01]} scale={[0.25, 0.6, 0.35]} rotation={[0, 0.3, 0.4]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#5c3317" transparent opacity={0.35} />
          </mesh>
          {/* right pointed ear */}
          <mesh position={[0.26, 1.62, -0.02]} rotation={[0.15, -0.35, -0.55]} castShadow scale={[0.45, 1.35, 0.55]}>
            <sphereGeometry args={[0.08, 14, 12]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.3, 1.72, -0.04]} rotation={[0.2, -0.4, -0.7]} castShadow scale={[0.25, 0.7, 0.3]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.27, 1.62, 0.01]} scale={[0.25, 0.6, 0.35]} rotation={[0, -0.3, -0.4]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#5c3317" transparent opacity={0.35} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[-0.25, 1.6, -0.01]} castShadow scale={[0.55, 1.05, 0.85]} rotation={[0, 0.2, 0.15]}>
            <sphereGeometry args={[0.072, 18, 16]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[-0.255, 1.6, 0.01]} scale={[0.35, 0.7, 0.5]} rotation={[0, 0.3, 0.1]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color="#5c3317" transparent opacity={0.35} />
          </mesh>
          <mesh position={[0.25, 1.6, -0.01]} castShadow scale={[0.55, 1.05, 0.85]} rotation={[0, -0.2, -0.15]}>
            <sphereGeometry args={[0.072, 18, 16]} />
            <SkinMat color={appearance.skin} />
          </mesh>
          <mesh position={[0.255, 1.6, 0.01]} scale={[0.35, 0.7, 0.5]} rotation={[0, -0.3, -0.1]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color="#5c3317" transparent opacity={0.35} />
          </mesh>
        </group>
      )}

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

      {/* ——— War paint / ritual marks (concept head sheet) ——— */}
      {appearance.faceMark === "paint-vertical" && (
        <group>
          <mesh position={[0, 1.62, 0.24]}>
            <boxGeometry args={[0.035, 0.28, 0.01]} />
            <meshStandardMaterial color="#0e4d6b" transparent opacity={0.85} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.48, 0.25]}>
            <boxGeometry args={[0.028, 0.08, 0.01]} />
            <meshStandardMaterial color="#0e4d6b" transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      )}
      {appearance.faceMark === "paint-cheek-bars" && (
        <group>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.14, 1.55, 0.22]} rotation={[0, 0, side * 0.15]}>
                <boxGeometry args={[0.08, 0.022, 0.01]} />
                <meshStandardMaterial color="#0e4d6b" transparent opacity={0.9} depthWrite={false} />
              </mesh>
              <mesh position={[side * 0.14, 1.52, 0.22]} rotation={[0, 0, side * 0.15]}>
                <boxGeometry args={[0.07, 0.018, 0.01]} />
                <meshStandardMaterial color="#0e4d6b" transparent opacity={0.85} depthWrite={false} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {appearance.faceMark === "paint-eye-band" && (
        <group>
          <mesh position={[0, 1.64, 0.23]}>
            <boxGeometry args={[0.36, 0.04, 0.012]} />
            <meshStandardMaterial color="#0a3a52" transparent opacity={0.88} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.5, 0.24]}>
            <boxGeometry args={[0.06, 0.12, 0.01]} />
            <meshStandardMaterial color="#0a3a52" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </group>
      )}
      {appearance.faceMark === "paint-full-mask" && (
        <group>
          <mesh position={[0, 1.6, 0.22]}>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshStandardMaterial color="#0e4d6b" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.62, 0.26]}>
            <boxGeometry args={[0.04, 0.32, 0.012]} />
            <meshStandardMaterial color="#082a3a" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </group>
      )}
      {      {appearance.faceMark === "paint-ritual-dots" && (
        <group>
          {/* White ceremonial dots — forehead, under eyes, cheeks (concept art) */}
          {[[-0.06, 1.72, 0.28], [0.06, 1.72, 0.28], [0, 1.74, 0.29],
            [-0.1, 1.62, 0.3], [0.1, 1.62, 0.3],
            [-0.12, 1.55, 0.28], [0.12, 1.55, 0.28],
            [-0.08, 1.5, 0.29], [0.08, 1.5, 0.29],
            [0, 1.58, 0.31]].map(([x, y, z], i) => (
            <mesh key={`dot-${i}`} position={[x, y, z]}>
              <sphereGeometry args={[0.012 + (i % 3) * 0.003, 8, 6]} />
              <meshStandardMaterial color="#f8f5f0" roughness={0.55} />
            </mesh>
          ))}
          {/* thin white lines under eyes */}
          <mesh position={[-0.09, 1.58, 0.3]} rotation={[0.2, 0, 0.15]}>
            <boxGeometry args={[0.06, 0.008, 0.01]} />
            <meshStandardMaterial color="#f8f5f0" roughness={0.5} />
          </mesh>
          <mesh position={[0.09, 1.58, 0.3]} rotation={[0.2, 0, -0.15]}>
            <boxGeometry args={[0.06, 0.008, 0.01]} />
            <meshStandardMaterial color="#f8f5f0" roughness={0.5} />
          </mesh>
        </group>
      )}

appearance.faceMark === "scar-cheek" && (
        <mesh position={[0.13, 1.54, 0.22]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.01, 0.1, 0.008]} />
          <meshStandardMaterial color="#4a2c1a" transparent opacity={0.75} />
        </mesh>
      )}
      {appearance.faceMark === "scar-eye" && (
        <mesh position={[-0.1, 1.66, 0.22]} rotation={[0, 0, -0.55]}>
          <boxGeometry args={[0.009, 0.09, 0.008]} />
          <meshStandardMaterial color="#3d2418" transparent opacity={0.8} />
        </mesh>
      )}

      {appearance.leftEarPiercing && (
        isMaskBearer ? (
          <mesh position={[-0.28, 1.52, 0.04]} rotation={[0, 0.3, 0]}>
            <circleGeometry args={[0.045, 16]} />
            <meshStandardMaterial color="#f8f5f0" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh position={[-0.26, 1.52, 0.02]}>
            <sphereGeometry args={[0.017, 10, 10]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.15} />
          </mesh>
        )
      )}
      {appearance.rightEarPiercing && (
        isMaskBearer ? (
          <mesh position={[0.28, 1.52, 0.04]} rotation={[0, -0.3, 0]}>
            <circleGeometry args={[0.045, 16]} />
            <meshStandardMaterial color="#f8f5f0" roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh position={[0.26, 1.52, 0.02]}>
            <sphereGeometry args={[0.017, 10, 10]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.15} />
          </mesh>
        )
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
          {isWarriorHelm ? (
            <group>
              <mesh castShadow>
                <sphereGeometry args={[0.28, 16, 12]} />
                <meshStandardMaterial color={hatC} roughness={0.55} metalness={0.15} />
              </mesh>
              <mesh position={[0, 0.12, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, 0.12, 10]} />
                <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
              </mesh>
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26]}>
                    <sphereGeometry args={[0.02, 6, 6]} />
                    <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.25} />
                  </mesh>
                );
              })}
            </group>
          ) : isBeadCrown ? (
            <group>
              <mesh castShadow>
                <coneGeometry args={[0.22, 0.55, 12]} />
                <meshStandardMaterial color={hatC} roughness={0.45} />
              </mesh>
              {[0.1, 0.22, 0.34].map((y, i) => (
                <mesh key={i} position={[0, y - 0.15, 0]}>
                  <torusGeometry args={[0.18 - i * 0.02, 0.02, 6, 14]} />
                  <meshStandardMaterial color={i % 2 ? "#fbbf24" : "#dc2626"} metalness={0.3} roughness={0.4} />
                </mesh>
              ))}
            </group>
          ) : isFeatherBand ? (
            <group>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[0.22, 0.025, 8, 20]} />
                <meshStandardMaterial color="#e7e5e4" roughness={0.7} />
              </mesh>
              <mesh position={[0.18, 0.25, -0.05]} rotation={[0.3, 0.4, 0.5]} castShadow>
                <boxGeometry args={[0.04, 0.35, 0.01]} />
                <meshStandardMaterial color="#d6d3d1" roughness={0.8} />
              </mesh>
              <mesh position={[0.18, 0.35, -0.05]} rotation={[0.3, 0.4, 0.5]}>
                <boxGeometry args={[0.08, 0.12, 0.008]} />
                <meshStandardMaterial color="#a8a29e" roughness={0.85} />
              </mesh>
            </group>
          ) : isRedBand ? (
            <group>
              {/* thin red ritual band across brow */}
              <mesh position={[0, 0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[0.2, 0.018, 8, 20]} />
                <meshStandardMaterial color="#b91c1c" roughness={0.55} />
              </mesh>
            </group>
          ) : (
            <group>
              <mesh castShadow>
                <cylinderGeometry args={[0.29, 0.31, 0.26, 20]} />
                <ClothMat color={hatC} soft />
              </mesh>
              {equipped.hat === "hat-wide" && (
                <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.31, 0.55, 32]} />
                  <meshStandardMaterial color={hatC} side={THREE.DoubleSide} roughness={0.85} />
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
        </group>
      )}

      {/* Accessories */}
      {acc?.id === "acc-glasses" && (
        <group position={[0, 1.64, 0.25]}>
          {/* round light frames — Mask Bearer goggles */}
          <mesh position={[-0.085, 0, 0]}>
            <torusGeometry args={[0.055, 0.01, 8, 24]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.65} roughness={0.18} />
          </mesh>
          <mesh position={[0.085, 0, 0]}>
            <torusGeometry args={[0.055, 0.01, 8, 24]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.65} roughness={0.18} />
          </mesh>
          {/* lens tint */}
          <mesh position={[-0.085, 0, 0.005]}>
            <circleGeometry args={[0.048, 20]} />
            <meshStandardMaterial color="#94a3b8" transparent opacity={0.25} metalness={0.3} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.085, 0, 0.005]}>
            <circleGeometry args={[0.048, 20]} />
            <meshStandardMaterial color="#94a3b8" transparent opacity={0.25} metalness={0.3} roughness={0.1} side={THREE.DoubleSide} />
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
      </group>
      </group>
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

function MaxHair({ style, color, seed = 17 }: { style: CharacterAppearance["hair"]; color: string; seed?: number }) {
  const hairMat = (
    <meshPhysicalMaterial
      color={color}
      roughness={0.92}
      sheen={0.55}
      sheenRoughness={0.85}
      sheenColor={color}
    />
  );
  switch (style) {
    case "afro":
      return (
        <group>
          <mesh position={[Math.sin(seed * 0.4) * 0.02, 1.78, 0]} castShadow scale={[1.04, 1, 0.96]}>
            <sphereGeometry args={[0.4, 28, 22]} />
            {hairMat}
          </mesh>
          {Array.from({ length: 28 }).map((_, i) => {
            const a = (i / 28) * Math.PI * 2;
            const elev = ((i * 5) % 7) * 0.04;
            const r = 0.28 + (i % 3) * 0.04;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * r, 1.7 + elev, Math.sin(a) * r * 0.95]}
                castShadow
              >
                <sphereGeometry args={[0.09 + (i % 4) * 0.012, 12, 10]} />
                {hairMat}
              </mesh>
            );
          })}
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[0.33, 24, 18]} />
            {hairMat}
          </mesh>
          <mesh position={[0, 1.42, 0]} castShadow scale={[1, 1.05, 1]}>
            <sphereGeometry args={[0.34, 22, 16]} />
            {hairMat}
          </mesh>
          <mesh position={[0, 1.28, -0.05]} castShadow>
            <capsuleGeometry args={[0.2, 0.15, 8, 16]} />
            {hairMat}
          </mesh>
        </group>
      );
    case "braids":
      return (
        <group>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[0.29, 22, 18]} />
            {hairMat}
          </mesh>
          {/* scalp cornrow ridges */}
          {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
            <mesh key={`row-${i}`} position={[x, 1.78, 0]} rotation={[0.2, 0, 0]} castShadow>
              <capsuleGeometry args={[0.025, 0.22, 6, 10]} />
              {hairMat}
            </mesh>
          ))}
          {[-0.18, -0.1, -0.02, 0.06, 0.14, 0.2].map((x, i) => {
            const lenMul = 0.88 + ((Math.sin(seed * 0.2 + i * 1.3) * 0.5 + 0.5) * 0.28);
            const xOff = Math.sin(seed * 0.4) * 0.02;
            return (
            <group key={i} position={[x + xOff, 1.55, -0.08]}>
              <mesh position={[0, 0.35 * lenMul, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.028, (0.65 + (i % 3) * 0.08) * lenMul, 12]} />
                {hairMat}
              </mesh>
              {/* braid segments */}
              {[0.15, 0.3, 0.45].map((y, j) => (
                <mesh key={j} position={[0, y, 0]} castShadow>
                  <sphereGeometry args={[0.038, 10, 8]} />
                  {hairMat}
                </mesh>
              ))}
              <mesh position={[0, 0.05, 0]}>
                <torusGeometry args={[0.04, 0.01, 6, 12]} />
                <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.18} />
              </mesh>
            </group>
            );
          })}
        </group>
      );
    case "locs": {
      const sideBias = Math.sin(seed * 0.5) * 0.035;
      const n = 14;
      return (
        <group>
          <mesh position={[sideBias * 0.5, 1.68, 0]} castShadow>
            <sphereGeometry args={[0.26, 20, 16]} />
            {hairMat}
          </mesh>
          {Array.from({ length: n }).map((_, i) => {
            const a = (i / n) * Math.PI * 2;
            const r = 0.12 + (i % 3) * 0.02 + (i % 2) * 0.008;
            const hJitter = 0.85 + ((Math.sin(seed * 0.13 + i * 1.7) * 0.5 + 0.5) * 0.35);
            const h = (0.14 + (i % 4) * 0.04) * hJitter;
            // more height on one hemisphere
            const favor = Math.cos(a - seed * 0.3) > 0 ? 1.12 : 0.92;
            const y = 1.78 + h * 0.35 * favor;
            return (
              <mesh
                key={`loc-${i}`}
                position={[Math.cos(a) * r + sideBias, y, Math.sin(a) * r * 0.85]}
                rotation={[0.15 + (i % 3) * 0.04, a, 0.1]}
                castShadow
              >
                <capsuleGeometry args={[0.028 + (i % 3) * 0.003, h * favor, 4, 8]} />
                {hairMat}
              </mesh>
            );
          })}
          {[0, 3, 7, 11].map((i) => {
            const a = (i / 14) * Math.PI * 2;
            return (
              <mesh key={`tip-${i}`} position={[Math.cos(a) * 0.14 + sideBias, 1.95, Math.sin(a) * 0.12]}>
                <sphereGeometry args={[0.025, 8, 6]} />
                <meshStandardMaterial color="#6b3a1f" roughness={0.85} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "bun":
      return (
        <group>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[0.28, 22, 18]} />
            {hairMat}
          </mesh>
          <mesh position={[0, 1.98, -0.06]} castShadow>
            <sphereGeometry args={[0.18, 20, 16]} />
            {hairMat}
          </mesh>
          <mesh position={[0, 1.92, -0.06]}>
            <torusGeometry args={[0.12, 0.025, 8, 16]} />
            {hairMat}
          </mesh>
        </group>
      );
    case "long":
      return (
        <group>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[0.3, 22, 18]} />
            {hairMat}
          </mesh>
          {[-0.12, 0, 0.12].map((x, i) => (
            <mesh key={i} position={[x, 1.15, -0.1]} castShadow>
              <capsuleGeometry args={[0.1, 0.55, 8, 14]} />
              {hairMat}
            </mesh>
          ))}
          <mesh position={[0, 1.35, -0.14]} castShadow>
            <boxGeometry args={[0.48, 0.5, 0.18]} />
            {hairMat}
          </mesh>
        </group>
      );
    case "bald":
      return null;
    default:
      // short
      return (
        <group>
          <mesh position={[0, 1.76, 0]} castShadow scale={[1, 0.7, 1]}>
            <sphereGeometry args={[0.28, 24, 16]} />
            {hairMat}
          </mesh>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * 0.22, 1.72, Math.sin(a) * 0.2]}
                castShadow
              >
                <sphereGeometry args={[0.06, 10, 8]} />
                {hairMat}
              </mesh>
            );
          })}
        </group>
      );
  }
}

export default StylizedCharacter;
