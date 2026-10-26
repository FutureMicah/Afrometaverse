/**
 * Day 6 — Heritage Architecture & Tribal Compounds
 * Modular mud walls, thatched roofs, compound layouts, village hearths.
 * Climate-reactive materials (wet darken / Harmattan dust).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { getProceduralPBR } from "@/lib/proceduralTextures";

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

  // plaster albedo + normal (procedural, shared). Gives walls grain instead of flat paint.
  const pbr = useMemo(() => getProceduralPBR("mud", 512), []);
  return (
    <meshStandardMaterial
      {...props}
      map={pbr?.map ?? null}
      normalMap={pbr?.normal ?? null}
      normalScale={new THREE.Vector2(0.6, 0.6)}
      envMapIntensity={0.6}
    />
  );
}

/** Conical or gable thatch that subtly rustles with wind */
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

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 2.2) * 0.012 * windIntensity;
    ref.current.position.y = Math.cos(t * 3.1) * 0.004 * windIntensity;
  });

  return (
    <group ref={ref}>
      {type === "conical" ? (
        <>
          <mesh castShadow position={[0, height * 0.35, 0]}>
            <coneGeometry args={[radius, height, 10]} />
            <meshStandardMaterial color={thatch} roughness={0.98} map={getProceduralPBR("thatch", 256)?.map ?? null} normalMap={getProceduralPBR("thatch", 256)?.normal ?? null} normalScale={new THREE.Vector2(0.8, 0.8)} />
          </mesh>
          <mesh position={[0, height * 0.55, 0]}>
            <coneGeometry args={[radius * 0.35, height * 0.35, 8]} />
            <meshStandardMaterial color={thatchDark} roughness={1} />
          </mesh>
        </>
      ) : (
        <>
          <mesh castShadow position={[0, height * 0.25, 0]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[radius * 1.6, 0.12, radius * 1.1]} />
            <meshStandardMaterial color={thatch} roughness={0.98} />
          </mesh>
          <mesh castShadow position={[0, height * 0.25, 0]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[radius * 1.6, 0.12, radius * 1.1]} />
            <meshStandardMaterial color={thatchDark} roughness={0.98} />
          </mesh>
        </>
      )}
      {isRainy &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * radius * 0.7, -0.05, Math.sin(a) * radius * 0.7]}
            >
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshBasicMaterial color={SCENE_PALETTE.waterLight} transparent opacity={0.45} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Single modular mud hut (Day 6 building block) */
/** World scale: characters are ~1.8 units tall. Huts stand about 2.6x that scale so a person
 * reads small against them, and compound walls reach shoulder height. */
export const BUILDING_SCALE = 2.6;
export const WALL_SCALE = 2.2;

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
  const w = 1.2 * scale * BUILDING_SCALE;
  const h = 1.0 * scale * BUILDING_SCALE;
  const isRound = style === "round";

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[w * 0.75, 12]} />
        <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.5, w * 0.52, h, 12]} />
        ) : (
          <boxGeometry args={[w, h, w * 0.9]} />
        )}
        <MudWallMaterial climateIntensity={climateIntensity} baseColor={wallColor} />
      </mesh>

      <mesh position={[0, 0.1 * scale * BUILDING_SCALE, 0]}>
        {isRound ? (
          <cylinderGeometry args={[w * 0.54, w * 0.54, 0.16 * scale, 12]} />
        ) : (
          <boxGeometry args={[w * 1.04, 0.16 * scale, w * 0.94]} />
        )}
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={1} />
      </mesh>

      <mesh position={[0, h * 0.35, isRound ? w * 0.5 : w * 0.46]} castShadow>
        <boxGeometry args={[0.3 * scale * BUILDING_SCALE, h * 0.55, 0.04]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} />
      </mesh>
      {/* window opening: dark recess with a frame, reads at distance */}
      <mesh position={[isRound ? w * 0.42 : w * 0.5 + 0.01, h * 0.62, isRound ? -w * 0.2 : 0]} rotation={[0, isRound ? -Math.PI / 2 : Math.PI / 2, 0]}>
        <boxGeometry args={[0.22 * scale * BUILDING_SCALE, 0.24 * scale * BUILDING_SCALE, 0.04]} />
        <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} />
      </mesh>
      <mesh position={[isRound ? w * 0.44 : w * 0.5 + 0.02, h * 0.62, isRound ? -w * 0.2 : 0]} rotation={[0, isRound ? -Math.PI / 2 : Math.PI / 2, 0]}>
        <boxGeometry args={[0.16 * scale * BUILDING_SCALE, 0.18 * scale * BUILDING_SCALE, 0.02]} />
        <meshStandardMaterial color={SCENE_PALETTE.asphalt} roughness={1} />
      </mesh>

      {/* veranda: a raised porch with posts in front of the door */}
      <mesh position={[0, 0.06 * scale * BUILDING_SCALE, isRound ? w * 0.62 : w * 0.6]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, 0.08 * scale * BUILDING_SCALE, w * 0.36]} />
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={1} />
      </mesh>
      {[-0.4, 0.4].map((sx) => (
        <mesh key={sx} position={[sx * w * 0.44, h * 0.35, isRound ? w * 0.78 : w * 0.76]} castShadow>
          <cylinderGeometry args={[0.05 * scale * BUILDING_SCALE, 0.055 * scale * BUILDING_SCALE, h * 0.7, 6]} />
          <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} />
        </mesh>
      ))}

      <group position={[0, h + 0.05, 0]}>
        <ThatchedRoof
          type={isRound ? "conical" : "gable"}
          radius={w * 0.78}
          height={0.85 * scale * BUILDING_SCALE}
          windIntensity={windIntensity}
          isRainy={climateIntensity > 0.5}
        />
        {/* ridge pole along the roof apex, so rectangular roofs read as built */}
        {!isRound && (
          <mesh position={[0, 0.84 * scale * BUILDING_SCALE, 0]} castShadow>
            <boxGeometry args={[w * 1.1, 0.06 * scale * BUILDING_SCALE, 0.06 * scale * BUILDING_SCALE]} />
            <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Low compound fence — circular adobe ring */
export function CompoundWall({
  x,
  z,
  radius = 2.2,
  segments = 12,
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
        <mesh key={i} position={[p.x, 0.35 * WALL_SCALE, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={[0.55 * WALL_SCALE, 0.7 * WALL_SCALE, 0.12 * WALL_SCALE]} />
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
        position={[-1.4, 0, -0.8]}
        style="rect"
        wallColor={SCENE_PALETTE.wallSand}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <MudHut
        position={[1.3, 0, -0.6]}
        rotation={0.4}
        style="round"
        wallColor={SCENE_PALETTE.clayWall}
        scale={0.9}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <MudHut
        position={[0.2, 0, 1.2]}
        rotation={-0.3}
        style="rect"
        wallColor={SCENE_PALETTE.wallTan}
        scale={0.95}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
      />
      <CompoundWall x={0} z={0} radius={2.6} segments={14} climateIntensity={climateIntensity} />
      {/* central courtyard hearth pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.15]} receiveShadow>
        <circleGeometry args={[0.7, 16]} />
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
      {([-2.0, 0, 2.0] as const).map((ox, i) => (
        <MudHut
          key={i}
          position={[ox, 0, i % 2 === 0 ? -0.5 : 0.6]}
          rotation={i * 0.15}
          style={i === 1 ? "round" : "rect"}
          wallColor={[SCENE_PALETTE.wallOchre, SCENE_PALETTE.clayWall, SCENE_PALETTE.wallTan][i] ?? SCENE_PALETTE.wallOchre}
          scale={0.85 + i * 0.05}
          climateIntensity={climateIntensity}
          windIntensity={windIntensity}
        />
      ))}
      {/* simple rectangular enclosure markers */}
      {[
        [-3.2, -1.4, 0.2, 0.55],
        [3.2, -1.4, 0.2, 0.55],
        [0, -1.5, 6.4, 0.12],
        [0, 1.6, 6.4, 0.12],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x as number, 0.28, z as number]} castShadow>
          <boxGeometry args={[w as number, 0.55, d as number]} />
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
