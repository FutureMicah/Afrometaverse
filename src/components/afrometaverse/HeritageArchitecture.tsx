/**
 * Day 6 — Heritage Architecture & Tribal Compounds
 * Hand-built mud walls with real thickness and irregular edges, layered thatch roofs with
 * scalloped eaves, lintelled doorways, clay pots, firewood and low compound walls with gates.
 * Climate-reactive materials (wet darken / Harmattan dust). Textures are procedural (no downloads).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { getProceduralPBR } from "@/lib/proceduralTextures";

/** World scale: characters are ~1.8 units tall. Huts stand about 2.6x that scale so a person
 * reads small against them, and compound walls reach about waist to shoulder height. */
export const BUILDING_SCALE = 2.6;
export const WALL_SCALE = 2.2;
/** Low compound wall height (ground to coping). */
const COMPOUND_WALL_H = 1.5;

/** Deterministic 0..1 value from a seed and a key, so every player sees the same village. */
function rnd(seed: number, k: number): number {
  const s = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

type V2 = [number, number];

/** Mud plaster material. Built once per call, shared textures from the procedural cache. */
function makeMudMaterial(climate: number, baseColor: string, side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
  const wet = climate > 0.45;
  const pbr = getProceduralPBR("mud", 512);
  const m = new THREE.MeshStandardMaterial({
    color: wet ? SCENE_PALETTE.wetMud : baseColor,
    roughness: 1.0 - climate * 0.55,
    metalness: climate * 0.12,
    side,
    envMapIntensity: 0.6,
  });
  if (pbr) {
    m.map = pbr.map;
    m.normalMap = pbr.normal;
    m.normalScale = new THREE.Vector2(0.7, 0.7);
  }
  return m;
}

/** Adobe / bature mud — darkens when wet, dusty in Harmattan */
export function MudWallMaterial({
  climateIntensity = 0,
  baseColor = SCENE_PALETTE.wallOchre,
  side = THREE.FrontSide,
}: {
  climateIntensity?: number; // 0 dry … 1 saturated rain
  baseColor?: string;
  side?: THREE.Side;
}) {
  const mat = useMemo(() => makeMudMaterial(climateIntensity, baseColor, side), [climateIntensity, baseColor, side]);
  return <primitive object={mat} attach="material" />;
}

/** Wall ring with real thickness (closed lathe profile) and a hand-built, wobbly outline. */
function roundWallGeometry(R: number, t: number, H: number, seed: number): THREE.BufferGeometry {
  const Ri = R - t;
  const pts = [
    new THREE.Vector2(Ri, 0),
    new THREE.Vector2(R, 0),
    new THREE.Vector2(R * 1.01, H * 0.5),
    new THREE.Vector2(R * 1.015, H * 0.95),
    new THREE.Vector2(R * 0.99, H),
    new THREE.Vector2(Ri, H),
    new THREE.Vector2(Ri, 0),
  ];
  const g = new THREE.LatheGeometry(pts, 24);
  const pos = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const th = Math.atan2(z, x);
    const f = 1 + 0.035 * Math.sin(3 * th + seed) + 0.02 * Math.sin(7 * th + seed * 1.7) + 0.015 * Math.sin(y * 9 + seed);
    x *= f;
    z *= f;
    if (y > H * 0.95) y += 0.07 * Math.sin(5 * th + seed * 0.6); // uneven top course under the thatch
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Rectangular mud wall: an extruded rounded outline with a real inner hole (thickness). */
function rectWallGeometry(hw: number, hd: number, t: number, H: number, seed: number): THREE.BufferGeometry {
  const corners: V2[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const outer: V2[] = [];
  for (let e = 0; e < 4; e++) {
    const a = corners[e]!;
    const b = corners[(e + 1) % 4]!;
    for (let s = 0; s < 4; s++) {
      const u = s / 4;
      const jx = 0.04 * hw * Math.sin(e * 2.7 + s * 1.9 + seed);
      const jy = 0.04 * hd * Math.cos(e * 1.3 + s * 2.3 + seed);
      outer.push([a[0] + (b[0] - a[0]) * u + jx, a[1] + (b[1] - a[1]) * u + jy]);
    }
  }
  const sx = (hw - t) / hw;
  const sz = (hd - t) / hd;
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  const hole = new THREE.Path(outer.map(([x, y]) => new THREE.Vector2(x * sx, y * sz)));
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // extrude upward from y=0
  g.computeVertexNormals();
  return g;
}

/** Open conical shell between two radii, with a scalloped (hand-tied) lower eave. */
function coneShellGeometry(r0: number, y0: number, r1: number, y1: number, scallop: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], 28);
  const pos = g.attributes["position"] as THREE.BufferAttribute;
  const yLo = Math.min(y0, y1);
  const yHi = Math.max(y0, y1);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const th = Math.atan2(z, x);
    const eave = (yHi - y) / Math.max(1e-4, yHi - yLo); // 1 at the eave, 0 at the top
    const f = 1 + scallop * Math.sin(12 * th + seed) * eave;
    pos.setXYZ(i, x * f, y, z * f);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Four-sided sloped shell from a bottom rectangle to a top rectangle (hipped roof layer). */
function frustumGeometry(b: V2, t: V2, y0: number, y1: number): THREE.BufferGeometry {
  const B: V2[] = [
    [-b[0], -b[1]],
    [b[0], -b[1]],
    [b[0], b[1]],
    [-b[0], b[1]],
  ];
  const T: V2[] = [
    [-t[0], -t[1]],
    [t[0], -t[1]],
    [t[0], t[1]],
    [-t[0], t[1]],
  ];
  const v: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    v.push(B[i]![0], y0, B[i]![1], B[j]![0], y0, B[j]![1], T[j]![0], y1, T[j]![1]);
    v.push(B[i]![0], y0, B[i]![1], T[j]![0], y1, T[j]![1], T[i]![0], y1, T[i]![1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Layered thatch roof: three stacked courses, scalloped eaves, a rounded ridge cap. */
export function ThatchedRoof({
  type = "conical",
  radius = 1.1,
  height = 0.9,
  windIntensity = 0.3,
  isRainy = false,
  seed = 1,
}: {
  type?: "conical" | "gable";
  radius?: number;
  height?: number;
  windIntensity?: number;
  isRainy?: boolean;
  seed?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const thatch = SCENE_PALETTE.thatch;
  const thatchDark = SCENE_PALETTE.thatchDark;
  const thatchGold = SCENE_PALETTE.thatchGold;
  const S = BUILDING_SCALE;

  const strawMap = useMemo(() => getProceduralPBR("thatch", 256), []);
  const strawMats = useMemo(() => {
    const mk = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.98, side: THREE.DoubleSide });
      if (strawMap) {
        m.map = strawMap.map;
        m.normalMap = strawMap.normal;
        m.normalScale = new THREE.Vector2(0.9, 0.9);
      }
      return m;
    };
    return { dark: mk(thatchDark), base: mk(thatch), gold: mk(thatchGold) };
  }, [strawMap, thatch, thatchDark, thatchGold]);

  const layers = useMemo(() => {
    if (type === "conical") {
      const H = height;
      const R = radius;
      return {
        l0: coneShellGeometry(R * 1.12, 0, R * 0.8, H * 0.42, 0.06, seed),
        l1: coneShellGeometry(R * 0.8, H * 0.36, R * 0.45, H * 0.78, 0.035, seed + 3),
        l2: coneShellGeometry(R * 0.5, H * 0.72, R * 0.12, H * 1.0, 0.0, seed + 5),
      };
    }
    const H = height;
    const hw = radius * 0.8;
    const hd = radius * 0.55;
    return {
      l0: frustumGeometry([hw * 1.12, hd * 1.12], [hw * 0.8, hd * 0.8], 0, H * 0.42),
      l1: frustumGeometry([hw * 0.8, hd * 0.8], [hw * 0.42, hd * 0.42], H * 0.36, H * 0.8),
      l2: frustumGeometry([hw * 0.42, hd * 0.42], [hw * 0.12, hd * 0.12], H * 0.74, H),
    };
  }, [type, radius, height, seed]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 2.2) * 0.012 * windIntensity;
    ref.current.position.y = Math.cos(t * 3.1) * 0.004 * windIntensity;
  });

  return (
    <group ref={ref}>
      <mesh castShadow geometry={layers.l0} material={strawMats.dark} />
      <mesh castShadow geometry={layers.l1} material={strawMats.base} />
      <mesh castShadow geometry={layers.l2} material={strawMats.gold} />
      {/* course lines where one layer of thatch is tied over the next */}
      <mesh position={[0, height * 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * (type === "conical" ? 0.8 : 0.8), 0.035 * S * 0.4, 4, 28]} />
        <meshStandardMaterial color={thatchDark} roughness={1} />
      </mesh>
      {/* ridge cap: a rounded bundle over the apex */}
      {type === "conical" ? (
        <mesh position={[0, height * 0.98, 0]} castShadow>
          <sphereGeometry args={[radius * 0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={thatchDark} roughness={1} />
        </mesh>
      ) : (
        <mesh position={[0, height * 1.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.07 * S, radius * 1.3, 4, 8]} />
          <meshStandardMaterial color={thatchDark} roughness={1} />
        </mesh>
      )}
      {isRainy &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * radius * 0.7, -0.05, Math.sin(a) * radius * 0.7]}>
              <sphereGeometry args={[0.03, 4, 4]} />
              <meshBasicMaterial color={SCENE_PALETTE.waterLight} transparent opacity={0.45} />
            </mesh>
          );
        })}
    </group>
  );
}

/** Clay water pot / storage jar. Each pot is slightly uneven so a row of them does not look stamped. */
export function ClayPot({ position = [0, 0, 0] as [number, number, number], scale = 1, seed = 1 }: { position?: [number, number, number]; scale?: number; seed?: number }) {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.1, 0.0),
      new THREE.Vector2(0.155, 0.08),
      new THREE.Vector2(0.165, 0.2),
      new THREE.Vector2(0.11, 0.3),
      new THREE.Vector2(0.12, 0.36),
      new THREE.Vector2(0.145, 0.4),
      new THREE.Vector2(0.125, 0.43),
      new THREE.Vector2(0.1, 0.41),
    ];
    return new THREE.LatheGeometry(pts, 14);
  }, []);
  const color = rnd(seed, 1) > 0.5 ? SCENE_PALETTE.clay : SCENE_PALETTE.clayWall;
  const k = scale * (0.9 + rnd(seed, 2) * 0.2);
  return (
    <mesh geometry={geo} position={position} scale={[k * (1 + (rnd(seed, 3) - 0.5) * 0.12), k, k * (1 + (rnd(seed, 4) - 0.5) * 0.12)]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Stacked firewood beside a wall: rows of split logs with uneven ends. */
export function Firewood({ position = [0, 0, 0] as [number, number, number], rotation = 0, seed = 1 }: { position?: [number, number, number]; rotation?: number; seed?: number }) {
  const logs = useMemo(() => {
    const out: Array<{ x: number; y: number; len: number; rad: number; tilt: number }> = [];
    const rows = 3;
    const cols = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - (r === rows - 1 ? 1 : 0); c++) {
        out.push({
          x: (c - 1.5) * 0.11 + (r % 2) * 0.05,
          y: 0.08 + r * 0.095,
          len: 0.9 + rnd(seed, r * 10 + c) * 0.15,
          rad: 0.045 + rnd(seed, r * 10 + c + 50) * 0.012,
          tilt: (rnd(seed, r * 10 + c + 90) - 0.5) * 0.05,
        });
      }
    }
    return out;
  }, [seed]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {logs.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, 0]} rotation={[0, 0, Math.PI / 2 + l.tilt]} castShadow>
          <cylinderGeometry args={[l.rad, l.rad * 1.05, l.len, 6]} />
          <meshStandardMaterial color={i % 3 === 0 ? SCENE_PALETTE.darkWood : SCENE_PALETTE.timberDark} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Single modular mud hut. Round (cylindrical) or rectangular, with `seed` setting its proportions and wobble. */
export function MudHut({
  position = [0, 0, 0],
  rotation = 0,
  style = "round",
  wallColor = SCENE_PALETTE.wallOchre,
  scale = 1,
  climateIntensity = 0,
  windIntensity = 0.3,
  seed = 1,
}: {
  position?: [number, number, number];
  rotation?: number;
  style?: "round" | "rect";
  wallColor?: string;
  scale?: number;
  climateIntensity?: number;
  windIntensity?: number;
  seed?: number;
}) {
  const S = scale * BUILDING_SCALE;
  const w = 1.2 * S;
  const h = S * (0.94 + rnd(seed, 1) * 0.12); // wall height varies per hut
  const isRound = style === "round";
  const R = w * 0.52; // outer radius (round)
  const t = 0.12 * S; // real wall thickness
  const hw = w * 0.5; // half width (rect)
  const hd = w * 0.45; // half depth (rect)
  const doorW = 0.3 * S;
  const doorH = h * 0.56;
  const doorZ = isRound ? R + 0.02 : hd + 0.02;

  const wallGeo = useMemo(
    () => (isRound ? roundWallGeometry(R, t, h, seed * 7.3) : rectWallGeometry(hw, hd, t, h, seed * 7.3)),
    [isRound, R, t, h, hw, hd, seed],
  );
  const wallMat = useMemo(() => makeMudMaterial(climateIntensity, wallColor, THREE.DoubleSide), [climateIntensity, wallColor]);
  const plinthMat = useMemo(() => makeMudMaterial(climateIntensity, SCENE_PALETTE.wallPale, THREE.FrontSide), [climateIntensity]);
  const timber = SCENE_PALETTE.doorWood;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* packed earth around the footing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[(isRound ? R : hw) * 1.25, 16]} />
        <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
      </mesh>

      {/* low plinth course: slightly wider, paler, reads as a repaired base */}
      <mesh position={[0, 0.07 * S * 0.5, 0]} receiveShadow>
        {isRound ? <cylinderGeometry args={[R * 1.05, R * 1.07, 0.14 * S * 0.5, 16]} /> : <boxGeometry args={[w * 1.06, 0.14 * S * 0.5, w * 0.98]} />}
        <primitive object={plinthMat} attach="material" />
      </mesh>

      {/* wall: real thickness, irregular outline */}
      <mesh castShadow receiveShadow geometry={wallGeo} material={wallMat} />

      {/* door opening: dark recess, timber frame, lintel over the top */}
      <mesh position={[0, doorH / 2, doorZ - 0.005]} castShadow>
        <boxGeometry args={[doorW, doorH, 0.04]} />
        <meshStandardMaterial color={timber} roughness={1} />
      </mesh>
      <mesh position={[0, doorH / 2, doorZ + 0.01]}>
        <boxGeometry args={[doorW * 0.78, doorH * 0.92, 0.03]} />
        <meshStandardMaterial color={SCENE_PALETTE.asphalt} roughness={1} />
      </mesh>
      {/* lintel: a timber beam across the top of the opening, slightly proud of the wall */}
      <mesh position={[0, doorH + 0.07 * S * 0.4, doorZ + 0.02]} castShadow>
        <boxGeometry args={[doorW * 1.35, 0.1 * S * 0.5, t * 1.6]} />
        <meshStandardMaterial color={SCENE_PALETTE.timberDark} roughness={1} />
      </mesh>
      {/* jamb posts */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * doorW * 0.56, doorH * 0.5, doorZ + 0.02]} castShadow>
          <boxGeometry args={[0.07 * S * 0.5, doorH, t * 1.2]} />
          <meshStandardMaterial color={SCENE_PALETTE.doorWood} roughness={1} />
        </mesh>
      ))}

      {/* side window: small dark opening with a sill */}
      <mesh position={[isRound ? R + 0.01 : hw + 0.01, h * 0.64, isRound ? -R * 0.25 : 0]} rotation={[0, isRound ? -Math.PI / 2 : Math.PI / 2, 0]}>
        <boxGeometry args={[0.2 * S, 0.22 * S, 0.04]} />
        <meshStandardMaterial color={timber} roughness={1} />
      </mesh>
      <mesh position={[isRound ? R + 0.03 : hw + 0.03, h * 0.6, isRound ? -R * 0.25 : 0]} rotation={[0, isRound ? -Math.PI / 2 : Math.PI / 2, 0]}>
        <boxGeometry args={[0.04 * S, 0.035 * S, 0.12 * S]} />
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={1} />
      </mesh>

      {/* veranda: a low earth step in front of the door */}
      <mesh position={[0, 0.05 * S * 0.5, doorZ + 0.32 * S * 0.5]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.7, 0.1 * S * 0.5, w * 0.3]} />
        <meshStandardMaterial color={SCENE_PALETTE.wallPale} roughness={1} />
      </mesh>

      {/* layered thatch roof, sitting on the wall top */}
      <group position={[0, h - 0.02, 0]}>
        <ThatchedRoof
          type={isRound ? "conical" : "gable"}
          radius={isRound ? w * 0.6 : w * 0.8}
          height={0.85 * S * (0.96 + rnd(seed, 2) * 0.08)}
          windIntensity={windIntensity}
          isRainy={climateIntensity > 0.5}
          seed={seed}
        />
      </group>
    </group>
  );
}

/** A straight run of low mud wall from a to b. A gap is left in the run where gap=[t0,t1] (0..1 along the run). */
function WallRun({
  a,
  b,
  seed,
  climateIntensity = 0,
  gap,
}: {
  a: V2;
  b: V2;
  seed: number;
  climateIntensity?: number;
  gap?: [number, number];
}) {
  const mat = useMemo(() => makeMudMaterial(climateIntensity, SCENE_PALETTE.wallWarm, THREE.DoubleSide), [climateIntensity]);
  const segs = useMemo(() => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(L / 0.9));
    const out: Array<{ cx: number; cz: number; len: number; ang: number; hgt: number; tilt: number }> = [];
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const um = (u0 + u1) / 2;
      if (gap && um > gap[0] && um < gap[1]) continue;
      const cx = a[0] + dx * um;
      const cz = a[1] + dz * um;
      out.push({
        cx,
        cz,
        len: (L / n) * 1.02,
        ang: -Math.atan2(dz, dx),
        hgt: COMPOUND_WALL_H * (0.86 + rnd(seed, i) * 0.22),
        tilt: (rnd(seed, i + 40) - 0.5) * 0.06,
      });
    }
    return out;
  }, [a, b, seed, gap]);

  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.cx, s.hgt / 2, s.cz]} rotation={[0, s.ang, s.tilt]} castShadow receiveShadow>
          <boxGeometry args={[s.len, s.hgt, 0.3]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Low compound wall, a closed ring of runs with a gap at the entry angle. */
export function CompoundWall({
  x,
  z,
  radius = 2.2,
  segments = 12,
  climateIntensity = 0,
  gate,
  seed = 1,
}: {
  x: number;
  z: number;
  radius?: number;
  segments?: number;
  climateIntensity?: number;
  gate?: number;
  seed?: number;
}) {
  const runs = useMemo(() => {
    const pts: V2[] = Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      const r = radius * (1 + (rnd(seed, i) - 0.5) * 0.04); // slightly hand-set radius
      return [Math.cos(a) * r, Math.sin(a) * r] as V2;
    });
    const gapHalf = Math.PI / segments;
    return pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length]!;
      const mid = ((i + 0.5) / segments) * Math.PI * 2;
      const isGate = gate !== undefined && Math.abs(Math.atan2(Math.sin(mid - gate), Math.cos(mid - gate))) < gapHalf;
      return { a: p, b: q, isGate };
    });
  }, [radius, segments, gate, seed]);

  return (
    <group position={[x, 0, z]}>
      {runs.map((r, i) => (r.isGate ? null : <WallRun key={i} a={r.a} b={r.b} seed={seed * 13 + i} climateIntensity={climateIntensity} />))}
    </group>
  );
}

/** Yoruba-style courtyard compound: a walled yard with a gate, three huts of different size and turn, pots and firewood. */
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
        position={[-1.4, 0, -1.2]}
        rotation={0.12}
        style="rect"
        wallColor={SCENE_PALETTE.wallSand}
        scale={1.02}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
        seed={11}
      />
      <MudHut
        position={[1.9, 0, -2.1]}
        rotation={0.55}
        style="round"
        wallColor={SCENE_PALETTE.clayWall}
        scale={0.88}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
        seed={12}
      />
      <MudHut
        position={[0.5, 0, 1.6]}
        rotation={-0.35}
        style="rect"
        wallColor={SCENE_PALETTE.wallTan}
        scale={0.96}
        climateIntensity={climateIntensity}
        windIntensity={windIntensity}
        seed={13}
      />
      <CompoundWall x={0} z={0} radius={4.8} segments={18} climateIntensity={climateIntensity} gate={Math.PI / 2} seed={41} />
      {/* outside the yard wall: a stack of firewood and clay pots by the gate */}
      <Firewood position={[-3.4, 0, -3.6]} rotation={0.6} seed={5} />
      <ClayPot position={[2.6, 0, 1.4]} scale={1.0} seed={21} />
      <ClayPot position={[2.9, 0, 1.9]} scale={0.8} seed={22} />
      <ClayPot position={[-2.6, 0, 2.6]} scale={0.9} seed={23} />
      {/* central courtyard hearth pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.15]} receiveShadow>
        <circleGeometry args={[0.7, 16]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>
    </group>
  );
}

/** Igbo-style linear compound: a long rectangular yard with three huts in a row, gap in the front wall for the entry. */
export function IgboCompound({
  position = [0, 0, 0],
  climateIntensity = 0,
  windIntensity = 0.3,
}: {
  position?: [number, number, number];
  climateIntensity?: number;
  windIntensity?: number;
}) {
  const xs = [-2.1, 0.0, 2.2] as const;
  return (
    <group position={position}>
      {xs.map((ox, i) => (
        <MudHut
          key={i}
          position={[ox, 0, i === 1 ? -0.6 : i === 0 ? 0.1 : -0.1]}
          rotation={[0.05, -0.12, 0.2][i] ?? 0}
          style={i === 1 ? "round" : "rect"}
          wallColor={[SCENE_PALETTE.wallOchre, SCENE_PALETTE.clayWall, SCENE_PALETTE.wallTan][i] ?? SCENE_PALETTE.wallOchre}
          scale={[0.86, 0.92, 0.84][i] ?? 0.9}
          climateIntensity={climateIntensity}
          windIntensity={windIntensity}
          seed={31 + i}
        />
      ))}
      {/* enclosure: back, left, right runs full; front run has a gap for the entry */}
      <WallRun a={[-4.3, -2.6]} b={[4.3, -2.6]} seed={61} climateIntensity={climateIntensity} />
      <WallRun a={[-4.3, -2.6]} b={[-4.3, 2.6]} seed={62} climateIntensity={climateIntensity} />
      <WallRun a={[4.3, -2.6]} b={[4.3, 2.6]} seed={63} climateIntensity={climateIntensity} />
      <WallRun a={[-4.3, 2.6]} b={[4.3, 2.6]} seed={64} climateIntensity={climateIntensity} gap={[0.36, 0.64]} />
      <Firewood position={[3.2, 0, 2.0]} rotation={-0.4} seed={9} />
      <ClayPot position={[-3.0, 0, 1.6]} scale={1.1} seed={71} />
      <ClayPot position={[-3.5, 0, 1.2]} scale={0.85} seed={72} />
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
