/**
 * Day 6 — Heritage Architecture & Tribal Compounds
 * Modular mud walls, thatched roofs, compound layouts, village hearths.
 * Climate-reactive materials (wet darken / Harmattan dust).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";

/** Adobe / bature mud — darkens when wet, dusty in Harmattan */
export function MudWallMaterial({
  climateIntensity = 0,
  baseColor = SCENE_PALETTE.wallOchre,
}: {
  climateIntensity?: number; // 0 dry … 1 saturated rain
  baseColor?: string;
}) {
  const props = useMemo(() => {
    const wet = climateIntensity > 0.45;
    return {
      color: wet ? SCENE_PALETTE.wetMud : baseColor,
      roughness: 1.0 - climateIntensity * 0.55,
      metalness: climateIntensity * 0.12,
    };
  }, [climateIntensity, baseColor]);

  return <meshStandardMaterial {...props} />;
}

/** Multi-layer conical / gable thatch — deep eaves, ridge, fringe, wind rustle */
export function ThatchedRoof({
  type = "conical",
  radius = 1.1,
  height = 0.9,
  windIntensity = 0.3,
  isRainy = false,
}: {
  type?: "conical" | "gable";
  radius?: number;
  height?: number;
  windIntensity?: number;
  isRainy?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const thatch = SCENE_PALETTE.thatch;
  const thatchDark = SCENE_PALETTE.thatchDark;
  const thatchGold = SCENE_PALETTE.thatchGold ?? "#b08a4e";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 1.8) * 0.01 * windIntensity;
    ref.current.rotation.x = Math.cos(t * 1.4) * 0.006 * windIntensity;
  });

  if (type === "gable") {
    const span = radius * 1.7;
    const depth = radius * 1.15;
    return (
      <group ref={ref}>
        {/* Two pitched planes with thickness */}
        <mesh castShadow position={[0, height * 0.28, depth * 0.22]} rotation={[0.48, 0, 0]}>
          <boxGeometry args={[span, 0.22, depth * 0.72]} />
          <meshStandardMaterial color={thatch} roughness={0.96} />
        </mesh>
        <mesh castShadow position={[0, height * 0.28, -depth * 0.22]} rotation={[-0.48, 0, 0]}>
          <boxGeometry args={[span, 0.22, depth * 0.72]} />
          <meshStandardMaterial color={thatchDark} roughness={0.97} />
        </mesh>
        {/* ridge beam */}
        <mesh castShadow position={[0, height * 0.52, 0]}>
          <boxGeometry args={[span * 1.02, 0.1, 0.14]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
        </mesh>
        {/* thatch ridge cap */}
        <mesh position={[0, height * 0.58, 0]}>
          <boxGeometry args={[span * 0.98, 0.12, 0.28]} />
          <meshStandardMaterial color={thatchGold} roughness={0.95} />
        </mesh>
        {/* eave fringe strips */}
        {[-1, 1].map((side) =>
          Array.from({ length: 7 }, (_, i) => {
            const x = ((i / 6) - 0.5) * span * 0.9;
            return (
              <mesh
                key={`${side}-${i}`}
                position={[x, height * 0.12, side * depth * 0.48]}
                rotation={[side * 0.35, 0, 0]}
              >
                <boxGeometry args={[span * 0.12, 0.06, 0.18]} />
                <meshStandardMaterial color={i % 2 ? thatchDark : thatch} roughness={1} />
              </mesh>
            );
          }),
        )}
        {isRainy &&
          Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[(i - 2) * 0.25, 0.02, 0]}>
              <sphereGeometry args={[0.025, 4, 4]} />
              <meshBasicMaterial color={SCENE_PALETTE.waterLight} transparent opacity={0.4} />
            </mesh>
          ))}
      </group>
    );
  }

  // ——— Conical rondavel thatch ———
  return (
    <group ref={ref}>
      {/* under-layer (darker, slightly smaller) */}
      <mesh castShadow position={[0, height * 0.32, 0]}>
        <coneGeometry args={[radius * 0.92, height * 0.95, 16]} />
        <meshStandardMaterial color={thatchDark} roughness={1} flatShading />
      </mesh>
      {/* main thatch body */}
      <mesh castShadow position={[0, height * 0.36, 0]}>
        <coneGeometry args={[radius, height, 18]} />
        <meshStandardMaterial color={thatch} roughness={0.96} flatShading />
      </mesh>
      {/* weathered mid band */}
      <mesh position={[0, height * 0.55, 0]}>
        <coneGeometry args={[radius * 0.62, height * 0.42, 14]} />
        <meshStandardMaterial color={thatchGold} roughness={0.98} transparent opacity={0.85} />
      </mesh>
      {/* apex tip / smoke-hole collar */}
      <mesh castShadow position={[0, height * 0.88, 0]}>
        <coneGeometry args={[radius * 0.22, height * 0.28, 10]} />
        <meshStandardMaterial color={thatchDark} roughness={1} />
      </mesh>
      {/* wooden ridge pole stub */}
      <mesh position={[0, height * 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, height * 0.18, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.85} />
      </mesh>
      {/* dense layered eave fringe — thick thatch skirt from references */}
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        const rr = radius * (0.94 + (i % 3) * 0.015);
        const layer = i % 3;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * rr, height * (0.02 + layer * 0.03), Math.sin(a) * rr]}
            rotation={[0.65 + layer * 0.08, -a, (i % 5) * 0.05]}
            castShadow
          >
            <boxGeometry args={[0.16 + (i % 4) * 0.02, 0.05, 0.32 + layer * 0.08 + (i % 3) * 0.04]} />
            <meshStandardMaterial
              color={layer === 0 ? thatchDark : layer === 1 ? thatch : thatchGold}
              roughness={1}
            />
          </mesh>
        );
      })}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + 0.12;
        const rr = radius * 0.88;
        return (
          <mesh
            key={`in-${i}`}
            position={[Math.cos(a) * rr, height * 0.08, Math.sin(a) * rr]}
            rotation={[0.45, -a, 0]}
          >
            <boxGeometry args={[0.18, 0.05, 0.22]} />
            <meshStandardMaterial color={thatch} roughness={0.98} />
          </mesh>
        );
      })}
      {isRainy &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          return (
            <mesh
              key={`drip-${i}`}
              position={[Math.cos(a) * radius * 0.75, height * 0.1, Math.sin(a) * radius * 0.75]}
            >
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshBasicMaterial color={SCENE_PALETTE.waterLight} transparent opacity={0.4} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Single modular mud hut (Day 6 building block) */

/**
 * Bhunga / rondavel matched to traditional construction references:
 * raised stone plinth (60–80 cm), thick mud walls, white lime band,
 * recessed timber door, veranda posts under deep thatch eaves,
 * layered conical thatch with fringe, radial rafters.
 */
export function BhungaHut({
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  wallColor = SCENE_PALETTE.wallOchre,
  climateIntensity = 0,
  windIntensity = 0.3,
  showSteps = true,
  band = true,
  veranda = true,
}: {
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
  wallColor?: string;
  climateIntensity?: number;
  windIntensity?: number;
  showSteps?: boolean;
  band?: boolean;
  /** Posts supporting the thatch overhang (classic finished house) */
  veranda?: boolean;
}) {
  // Human-scale: wall radius ~2.1 m, plinth ~0.7 m, deep eave overhang
  const r = 2.1 * scale;
  const plinthH = 0.68 * scale; // 60–80 cm stone foundation
  const wallH = 2.05 * scale;
  const doorW = 0.9 * scale;
  const doorH = 1.72 * scale;
  const wallTopY = plinthH + wallH;
  const postR = r * 1.28; // veranda post ring under eaves
  const thatchR = r * 1.55; // deep overhang covering veranda
  const postCount = 12;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* packed earth apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <circleGeometry args={[thatchR * 1.08, 28]} />
        <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
      </mesh>
      {/* worn path to door */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, r * 1.15]} receiveShadow>
        <planeGeometry args={[1.2 * scale, r * 0.85]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>

      {/* ——— Stone foundation / raised plinth ——— */}
      <mesh castShadow receiveShadow position={[0, plinthH / 2, 0]}>
        <cylinderGeometry args={[r * 1.1, r * 1.16, plinthH, 24]} />
        <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={1} flatShading />
      </mesh>
      {/* irregular rubble facing */}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + 0.05;
        const rr = r * (1.08 + (i % 4) * 0.015);
        const y = plinthH * (0.15 + (i % 5) * 0.14);
        return (
          <mesh
            key={`st-${i}`}
            position={[Math.cos(a) * rr, y, Math.sin(a) * rr]}
            rotation={[0, a, (i % 3) * 0.2]}
            castShadow
          >
            <boxGeometry
              args={[
                0.32 * scale + (i % 3) * 0.08,
                0.16 * scale + (i % 2) * 0.08,
                0.2 * scale + (i % 4) * 0.04,
              ]}
            />
            <meshStandardMaterial
              color={i % 3 === 0 ? SCENE_PALETTE.wallPale : SCENE_PALETTE.stone}
              roughness={1}
              flatShading
            />
          </mesh>
        );
      })}
      {/* pale lip on top of plinth */}
      <mesh position={[0, plinthH + 0.04 * scale, 0]}>
        <cylinderGeometry args={[r * 1.03, r * 1.06, 0.09 * scale, 24]} />
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={0.94} />
      </mesh>

      {/* ——— Thick mud walls (tapered) ——— */}
      <mesh castShadow receiveShadow position={[0, plinthH + wallH / 2, 0]}>
        <cylinderGeometry args={[r * 0.97, r * 1.02, wallH, 24]} />
        <MudWallMaterial climateIntensity={climateIntensity} baseColor={wallColor} />
      </mesh>
      {/* outer skin hint for wall thickness */}
      <mesh position={[0, plinthH + wallH * 0.5, 0]}>
        <cylinderGeometry args={[r * 1.015, r * 1.03, wallH * 0.92, 22]} />
        <meshStandardMaterial color={wallColor} roughness={0.99} transparent opacity={0.28} />
      </mesh>

      {/* broad white lime band (reference finished house) */}
      {band && (
        <>
          <mesh position={[0, plinthH + wallH * 0.42, 0]}>
            <cylinderGeometry args={[r * 1.025, r * 1.025, 0.38 * scale, 24]} />
            <meshStandardMaterial color="#e8dcc8" roughness={0.9} />
          </mesh>
          <mesh position={[0, plinthH + wallH * 0.42 - 0.2 * scale, 0]}>
            <cylinderGeometry args={[r * 1.028, r * 1.028, 0.035 * scale, 24]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
          </mesh>
          <mesh position={[0, plinthH + wallH * 0.42 + 0.2 * scale, 0]}>
            <cylinderGeometry args={[r * 1.028, r * 1.028, 0.03 * scale, 24]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
          </mesh>
        </>
      )}

      {/* ——— Doorway on +Z ——— */}
      <mesh position={[0, plinthH + doorH / 2 + 0.02, r * 0.88]}>
        <boxGeometry args={[doorW * 1.08, doorH * 1.04, 0.4 * scale]} />
        <meshStandardMaterial color="#1a120c" roughness={1} />
      </mesh>
      {/* timber leaves */}
      <mesh position={[-doorW * 0.22, plinthH + doorH / 2 + 0.02, r * 0.97]} castShadow>
        <boxGeometry args={[doorW * 0.46, doorH * 0.95, 0.055 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={0.88} />
      </mesh>
      <mesh position={[doorW * 0.22, plinthH + doorH / 2 + 0.02, r * 0.97]} castShadow>
        <boxGeometry args={[doorW * 0.46, doorH * 0.95, 0.055 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={0.9} />
      </mesh>
      {[0.28, 0.55, 0.82].map((t, i) => (
        <mesh key={`bt-${i}`} position={[0, plinthH + doorH * t, r * 1.0]} castShadow>
          <boxGeometry args={[doorW * 0.94, 0.045 * scale, 0.035 * scale]} />
          <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[-doorW * 0.54, plinthH + doorH / 2, r * 0.94]} castShadow>
        <boxGeometry args={[0.09 * scale, doorH * 1.06, 0.16 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
      </mesh>
      <mesh position={[doorW * 0.54, plinthH + doorH / 2, r * 0.94]} castShadow>
        <boxGeometry args={[0.09 * scale, doorH * 1.06, 0.16 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, plinthH + doorH + 0.09 * scale, r * 0.93]} castShadow>
        <boxGeometry args={[doorW * 1.4, 0.14 * scale, 0.2 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.88} />
      </mesh>
      {/* threshold */}
      <mesh position={[0, plinthH * 0.4, r * 1.05]} castShadow receiveShadow>
        <boxGeometry args={[doorW * 1.35, plinthH * 0.5, 0.35 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={1} flatShading />
      </mesh>

      {/* round windows (reference poster) */}
      {[Math.PI * 0.55, -Math.PI * 0.55].map((a, i) => (
        <group key={`win-${i}`} rotation={[0, a, 0]}>
          <mesh position={[0, plinthH + wallH * 0.62, r * 0.99]}>
            <cylinderGeometry args={[0.18 * scale, 0.18 * scale, 0.14 * scale, 12]} />
            <meshStandardMaterial color="#1a120c" roughness={1} />
          </mesh>
          <mesh position={[0, plinthH + wallH * 0.62, r * 1.02]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2 * scale, 0.025 * scale, 6, 14]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* stone steps */}
      {showSteps && (
        <group position={[0, 0, r * 1.18]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              position={[0, 0.07 * scale + i * 0.14 * scale, 0.1 * scale + i * 0.2 * scale]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[1.35 * scale - i * 0.12, 0.12 * scale, 0.36 * scale]} />
              <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      )}

      {/* veranda floor ring (packed earth / plaster between wall and posts) */}
      {veranda && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, plinthH + 0.02 * scale, 0]} receiveShadow>
          <ringGeometry args={[r * 1.02, postR * 1.02, 28]} />
          <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={0.95} />
        </mesh>
      )}

      {/* ——— Veranda posts under thatch eaves (key reference feature) ——— */}
      {veranda &&
        Array.from({ length: postCount }, (_, i) => {
          const a = (i / postCount) * Math.PI * 2 + Math.PI / postCount;
          // leave gap at door
          const doorGap = Math.abs(Math.atan2(Math.sin(a), Math.cos(a) - 0) - 0);
          const nearDoor = Math.abs(((a + Math.PI * 2) % (Math.PI * 2)) - 0) < 0.35
            || Math.abs(((a + Math.PI * 2) % (Math.PI * 2)) - Math.PI * 2) < 0.35
            || a < 0.4 || a > Math.PI * 2 - 0.4;
          // posts sit on +Z door at angle ~0 in local; skip two posts in front of door
          const ang = (i / postCount) * Math.PI * 2;
          const front = Math.cos(ang) > 0.75; // +Z is door; our cylinder: door on +Z means ang near 0 if cos/sin of Z
          // door is +Z: position (0,0,r) → angle from +X is PI/2. Use atan2(x,z): door at atan2(0,r)=0.
          // so skip when ang near 0
          const skip = Math.abs(Math.sin(ang)) < 0.35 && Math.cos(ang) > 0.7;
          if (skip) return null;
          void doorGap;
          void nearDoor;
          void front;
          return (
            <group key={`post-${i}`}>
              <mesh
                position={[Math.sin(ang) * postR, plinthH + wallH * 0.48, Math.cos(ang) * postR]}
                castShadow
              >
                <cylinderGeometry args={[0.07 * scale, 0.085 * scale, wallH * 0.95, 7]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.88} />
              </mesh>
              {/* post top pad under eave */}
              <mesh
                position={[Math.sin(ang) * postR, wallTopY + 0.04 * scale, Math.cos(ang) * postR]}
                castShadow
              >
                <cylinderGeometry args={[0.1 * scale, 0.08 * scale, 0.08 * scale, 6]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
              </mesh>
            </group>
          );
        })}

      {/* timber wall-plate ring */}
      <mesh position={[0, wallTopY + 0.03 * scale, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.99, 0.055 * scale, 6, 28]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
      </mesh>

      {/* ——— Conical thatch with deep eaves ——— */}
      <group position={[0, wallTopY + 0.05 * scale, 0]}>
        <ThatchedRoof
          type="conical"
          radius={thatchR}
          height={2.55 * scale}
          windIntensity={windIntensity}
          isRainy={climateIntensity > 0.5}
        />
        {/* radial rafters from wall-plate out to eave */}
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const midR = (r + thatchR) * 0.52;
          return (
            <mesh
              key={`rf-${i}`}
              position={[Math.sin(a) * midR, 0.35 * scale, Math.cos(a) * midR]}
              rotation={[0.5, a, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.035 * scale, 0.028 * scale, (thatchR - r * 0.85) * 1.1, 5]} />
              <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.92} />
            </mesh>
          );
        })}
        {/* inner radial sticks toward apex */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + 0.12;
          return (
            <mesh
              key={`in-${i}`}
              position={[Math.sin(a) * r * 0.55, 0.7 * scale, Math.cos(a) * r * 0.55]}
              rotation={[0.95, a, 0]}
            >
              <cylinderGeometry args={[0.022 * scale, 0.016 * scale, 0.95 * scale, 4]} />
              <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
            </mesh>
          );
        })}
        {/* clay smoke vent (pre-colonial) */}
        <mesh position={[0.15 * scale, 2.35 * scale, -0.1 * scale]} castShadow>
          <cylinderGeometry args={[0.06 * scale, 0.08 * scale, 0.45 * scale, 8]} />
          <meshStandardMaterial color={SCENE_PALETTE.clay} roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}


/** Rectangular or round mud dwelling with plinth, timber door, window, layered thatch. */
export function MudHut({
  position = [0, 0, 0],
  rotation = 0,
  style = "round",
  wallColor = SCENE_PALETTE.wallOchre,
  scale = 1,
  climateIntensity = 0,
  windIntensity = 0.3,
}: {
  position?: [number, number, number];
  rotation?: number;
  style?: "round" | "rect";
  wallColor?: string;
  scale?: number;
  climateIntensity?: number;
  windIntensity?: number;
}) {
  const w = 2.6 * scale;
  const d = w * 0.92;
  const h = 2.15 * scale;
  const isRound = style === "round";
  const doorW = 0.88 * scale;
  const doorH = 1.75 * scale;
  const doorZ = isRound ? w * 0.5 : d * 0.5;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* packed earth apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        {isRound ? (
          <circleGeometry args={[w * 0.78, 16]} />
        ) : (
          <planeGeometry args={[w * 1.35, d * 1.35]} />
        )}
        <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
      </mesh>

      {/* low stone / rubble footing */}
      <mesh castShadow receiveShadow position={[0, 0.12 * scale, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.54, w * 0.56, 0.24 * scale, 14]} />
        ) : (
          <boxGeometry args={[w * 1.06, 0.24 * scale, d * 1.06]} />
        )}
        <meshStandardMaterial color={SCENE_PALETTE.stone} roughness={1} flatShading />
      </mesh>

      {/* mud walls */}
      <mesh castShadow receiveShadow position={[0, 0.24 * scale + h / 2, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.5, w * 0.52, h, 16]} />
        ) : (
          <boxGeometry args={[w, h, d]} />
        )}
        <MudWallMaterial climateIntensity={climateIntensity} baseColor={wallColor} />
      </mesh>

      {/* lime wash band near base */}
      <mesh position={[0, 0.38 * scale, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.525, w * 0.525, 0.2 * scale, 16]} />
        ) : (
          <boxGeometry args={[w * 1.02, 0.2 * scale, d * 1.02]} />
        )}
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={0.94} />
      </mesh>

      {/* door void + timber leaves */}
      <mesh position={[0, 0.24 * scale + doorH / 2, doorZ * 0.92]}>
        <boxGeometry args={[doorW * 1.08, doorH * 1.02, 0.28 * scale]} />
        <meshStandardMaterial color="#1a120c" roughness={1} />
      </mesh>
      <mesh position={[-doorW * 0.22, 0.24 * scale + doorH / 2, doorZ * 0.98]} castShadow>
        <boxGeometry args={[doorW * 0.46, doorH * 0.95, 0.05 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={0.88} />
      </mesh>
      <mesh position={[doorW * 0.22, 0.24 * scale + doorH / 2, doorZ * 0.98]} castShadow>
        <boxGeometry args={[doorW * 0.46, doorH * 0.95, 0.05 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={0.9} />
      </mesh>
      {/* lintel + jambs */}
      <mesh position={[0, 0.24 * scale + doorH + 0.06 * scale, doorZ * 0.96]} castShadow>
        <boxGeometry args={[doorW * 1.25, 0.1 * scale, 0.14 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.88} />
      </mesh>
      <mesh position={[-doorW * 0.52, 0.24 * scale + doorH / 2, doorZ * 0.95]} castShadow>
        <boxGeometry args={[0.07 * scale, doorH, 0.12 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
      </mesh>
      <mesh position={[doorW * 0.52, 0.24 * scale + doorH / 2, doorZ * 0.95]} castShadow>
        <boxGeometry args={[0.07 * scale, doorH, 0.12 * scale]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
      </mesh>

      {/* side window */}
      {!isRound && (
        <group position={[w * 0.5 + 0.01, 0.24 * scale + h * 0.55, 0]}>
          <mesh>
            <boxGeometry args={[0.08 * scale, 0.32 * scale, 0.38 * scale]} />
            <meshStandardMaterial color="#1a120c" roughness={1} />
          </mesh>
          <mesh position={[0.02, 0.18 * scale, 0]}>
            <boxGeometry args={[0.05 * scale, 0.05 * scale, 0.44 * scale]} />
            <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.9} />
          </mesh>
        </group>
      )}
      {isRound && (
        <mesh position={[0, 0.24 * scale + h * 0.7, -w * 0.5]} castShadow>
          <boxGeometry args={[0.32 * scale, 0.26 * scale, 0.1 * scale]} />
          <meshStandardMaterial color="#1a120c" roughness={1} />
        </mesh>
      )}

      {/* roof */}
      <group position={[0, 0.24 * scale + h + 0.04 * scale, 0]}>
        <ThatchedRoof
          type={isRound ? "conical" : "gable"}
          radius={isRound ? w * 0.78 : w * 0.72}
          height={isRound ? 1.85 * scale : 1.45 * scale}
          windIntensity={windIntensity}
          isRainy={climateIntensity > 0.5}
        />
        {isRound &&
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * w * 0.52, 0.2 * scale, Math.sin(a) * w * 0.52]}
                rotation={[0.55, -a, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.03 * scale, 0.025 * scale, 0.85 * scale, 4]} />
                <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={0.92} />
              </mesh>
            );
          })}
      </group>
    </group>
  );
}

/** Low compound fence — circular adobe ring */
export function CompoundWall({
  x,
  z,
  radius = 5.2,
  segments = 14,
  climateIntensity = 0,
}: {
  x: number;
  z: number;
  radius?: number;
  segments?: number;
  climateIntensity?: number;
}) {
  const posts = useMemo(() => {
    return Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return {
        x: Math.cos(a) * radius,
        z: Math.sin(a) * radius,
        rot: -a,
      };
    });
  }, [radius, segments]);

  return (
    <group position={[x, 0, z]}>
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.7, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={[0.9, 1.4, 0.18]} />
          <MudWallMaterial climateIntensity={climateIntensity} baseColor={SCENE_PALETTE.wallWarm} />
        </mesh>
      ))}
    </group>
  );
}

/** Yoruba-style courtyard compound (Day 6) */
export function YorubaCompound({
  position = [0, 0, 0],
  climateIntensity = 0,
  windIntensity = 0.3,
}: {
  position?: [number, number, number];
  climateIntensity?: number;
  windIntensity?: number;
}) {
  return (
    <group position={position}>
      <MudHut
        position={[-3.2, 0, -2.0]}
        style="rect"
        wallColor={SCENE_PALETTE.wallSand}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <MudHut
        position={[3.0, 0, -1.6]}
        rotation={0.4}
        style="round"
        wallColor={SCENE_PALETTE.clayWall}
        scale={0.92}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <MudHut
        position={[0.4, 0, 3.0]}
        rotation={-0.3}
        style="rect"
        wallColor={SCENE_PALETTE.wallTan}
        scale={0.95}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <CompoundWall x={0} z={0} radius={6.4} segments={16} climateIntensity={climateIntensity} />
      {/* central courtyard hearth pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.15]} receiveShadow>
        <circleGeometry args={[1.4, 16]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>
    </group>
  );
}

/** Igbo-style linear compound */
export function IgboCompound({
  position = [0, 0, 0],
  climateIntensity = 0,
  windIntensity = 0.3,
}: {
  position?: [number, number, number];
  climateIntensity?: number;
  windIntensity?: number;
}) {
  return (
    <group position={position}>
      {([-4.6, 0, 4.6] as const).map((ox, i) => (
        <MudHut
          key={i}
          position={[ox, 0, i % 2 === 0 ? -1.2 : 1.4]}
          rotation={i * 0.15}
          style={i === 1 ? "round" : "rect"}
          wallColor={[SCENE_PALETTE.wallOchre, SCENE_PALETTE.clayWall, SCENE_PALETTE.wallTan][i] ?? SCENE_PALETTE.wallOchre}
          scale={0.9 + i * 0.04}
          climateIntensity={climateIntensity}
          windIntensity={windIntensity}
        />
      ))}
      {/* simple rectangular enclosure markers */}
      {[
        [-7.2, -3.2, 0.35, 1.1],
        [7.2, -3.2, 0.35, 1.1],
        [0, -3.4, 14.5, 0.28],
        [0, 3.6, 14.5, 0.28],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x as number, 0.65, z as number]} castShadow>
          <boxGeometry args={[w as number, 1.3, d as number]} />
          <MudWallMaterial climateIntensity={climateIntensity} baseColor={SCENE_PALETTE.mudWallDusk} />
        </mesh>
      ))}
    </group>
  );
}

/** Cooking / village hearth with flicker + smoke billboard */
export function VillageHearth({ position = [0, 0, 0] as [number, number, number] }) {
  const light = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (light.current) {
      light.current.intensity = 1.6 + Math.sin(t * 14) * 0.45 + Math.sin(t * 23) * 0.2;
      light.current.position.x = position[0] + Math.sin(t * 9) * 0.04;
      light.current.position.z = position[2] + Math.cos(t * 11) * 0.03;
    }
    if (flame.current) {
      flame.current.scale.y = 0.85 + Math.sin(t * 12) * 0.2;
      flame.current.position.y = 0.35 + Math.sin(t * 10) * 0.03;
    }
  });

  return (
    <group position={position}>
      {/* stone ring */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.35, 0.08, Math.sin(a) * 0.35]} castShadow>
            <boxGeometry args={[0.14, 0.12, 0.1]} />
            <meshStandardMaterial color={SCENE_PALETTE.greyBrown} roughness={1} />
          </mesh>
        );
      })}
      {/* logs */}
      <mesh position={[0, 0.1, 0]} rotation={[0, 0.4, 0.1]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.55, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.mudDeepBrown} roughness={1} />
      </mesh>
      <mesh position={[0.05, 0.12, 0.05]} rotation={[0.2, -0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.45, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.timberDark} roughness={1} />
      </mesh>
      {/* flame billboard */}
      <mesh ref={flame} position={[0, 0.35, 0]}>
        <planeGeometry args={[0.35, 0.55]} />
        <meshBasicMaterial color={SCENE_PALETTE.fireOrange} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <planeGeometry args={[0.22, 0.35]} />
        <meshBasicMaterial color={SCENE_PALETTE.goldSun} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <pointLight
        ref={light}
        position={[position[0], 0.6, position[2]]}
        color={SCENE_PALETTE.amberFlame}
        distance={7}
        decay={2}
        castShadow
      />
      {/* simple rising smoke puffs */}
      <SmokePuffs />
    </group>
  );
}

function SmokePuffs() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((c, i) => {
      const y = ((t * 0.35 + i * 0.4) % 2.2) + 0.5;
      c.position.y = y;
      c.position.x = Math.sin(t * 0.8 + i) * 0.12;
      const s = 0.15 + (y / 2.5) * 0.35;
      c.scale.setScalar(s);
      const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.35 * (1 - y / 2.5));
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshBasicMaterial color={SCENE_PALETTE.stoneGrey} transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}
