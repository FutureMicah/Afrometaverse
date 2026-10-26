/**
 * Procedural PBR-style textures for the village: hand-daubed mud plaster, layered thatch and
 * trampled dust ground.
 *
 * Each surface is built once on a canvas and shared by every mesh, so there are no extra
 * downloads on mobile data. Each kind yields a near-white albedo (the material / vertex colour
 * tints it) plus a normal map derived from the same height field, so light catches cracks, straw
 * courses and pebbles.
 *
 * Noise uses precomputed lattice tables with power-of-two cell counts, so every octave is a few
 * array reads instead of trig calls. Textures are tileable. Only runs in the browser.
 */
import * as THREE from "three";

export type SurfaceKind = "mud" | "thatch" | "dust";

/** Resolution per surface. Mud and thatch are 2K for close walls and roofs; the ground is 1K to keep GPU memory small on phones. */
const SIZE: Record<SurfaceKind, number> = { mud: 2048, thatch: 2048, dust: 1024 };

const cache = new Map<SurfaceKind, { map: THREE.CanvasTexture; normal: THREE.CanvasTexture }>();

/** Deterministic hash so the look is stable between reloads. */
function hash(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Lattice {
  w: number;
  h: number;
  v: Float32Array;
}

function lattice(w: number, h: number, seed: number): Lattice {
  const v = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) v[j * w + i] = hash(i, j, seed);
  return { w, h, v };
}

/**
 * Tileable fractal value noise over u,v in [0,1). cx/cy are the lattice cell counts along each axis
 * (powers of two). Unequal counts give stretched features, for example long vertical streaks or
 * thin straw strands.
 */
class Noise {
  private levels: Array<{ L: Lattice; kx: number; ky: number }> = [];
  private norm = 0;

  constructor(cx: number, cy: number, seed: number, octaves: number) {
    let amp = 0.5;
    let kx = cx;
    let ky = cy;
    for (let o = 0; o < octaves; o++) {
      this.levels.push({ L: lattice(kx, ky, seed + o * 13), kx, ky });
      this.norm += amp;
      amp *= 0.5;
      kx *= 2;
      ky *= 2;
    }
  }

  sample(u: number, v: number): number {
    let amp = 0.5;
    let sum = 0;
    for (const { L, kx, ky } of this.levels) {
      const gx = u * kx;
      const gy = v * ky;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const xa = x0 & (kx - 1);
      const xb = (x0 + 1) & (kx - 1);
      const ya = (y0 & (ky - 1)) * kx;
      const yb = ((y0 + 1) & (ky - 1)) * kx;
      const a = L.v[ya + xa]!;
      const b = L.v[ya + xb]!;
      const d = L.v[yb + xa]!;
      const e = L.v[yb + xb]!;
      sum += (a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy) * amp;
      amp *= 0.5;
    }
    return sum / this.norm;
  }
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

interface Fields {
  /** height, roughly 0..1 (normal map derives from this) */
  h: Float32Array;
  /** albedo luminance, roughly 0.5..1.05 */
  lum: Float32Array;
  /** per-pixel warm/cool tint shift in -1..1 (repairs and sun-bleached patches) */
  tint: Float32Array;
}

/** Mud plaster: hand-troweled patches, rain-streaked erosion, deep hairline and map cracks, repair patches, grit. */
function mudFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const broad = new Noise(8, 8, 1, 3);
  const patch = new Noise(4, 4, 17, 2);
  const grit = new Noise(256, 256, 9, 1);
  const streakN = new Noise(32, 2, 29, 2);
  const crackN = new Noise(16, 16, 21, 2);
  const deepN = new Noise(8, 8, 37, 3);
  const repairN = new Noise(4, 4, 53, 2);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const b = broad.sample(u, v);
      const p = patch.sample(u, v);
      const g = grit.sample(u, v);
      // rain streaks run down the wall: long along v, thin along u, warped by a slow noise
      const sn = streakN.sample(u, v);
      const streak = Math.pow(Math.abs(Math.sin(u * Math.PI * 2 * 24 + sn * 6)), 10) * (0.35 + 0.65 * sn);
      // hairline cracks: thin bands where a noise field crosses its midline
      const c = crackN.sample(u, v);
      const crack = 1 - smooth(0.0, 0.022, Math.abs(c - 0.5));
      // deep fissures: rarer, wider, deeper
      const dn = deepN.sample(u, v);
      const deep = 1 - smooth(0.0, 0.012, Math.abs(dn - 0.5));
      // repair daubs: fresh patches of plaster on the wall
      const r = repairN.sample(u, v);
      const repair = smooth(0.6, 0.7, r);

      h[i] = b * 0.5 + p * 0.22 + g * 0.2 - streak * 0.2 - crack * 0.25 - deep * 0.6 + repair * 0.1;
      lum[i] = 0.9 + (b - 0.5) * 0.12 + (p - 0.5) * 0.07 + (g - 0.5) * 0.09 - streak * 0.1 - crack * 0.28 - deep * 0.35 - repair * 0.07;
      tint[i] = repair * 0.6 - streak * 0.3;
    }
  }
  return { h, lum, tint };
}

/**
 * Thatch: stalks laid in courses. Long thin strands run down the slope (along v), each course is a
 * tied layer whose lower edge casts a dark tuck line, and worn patches darken the matting.
 */
function thatchFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const strandN = new Noise(128, 4, 5, 2);
  const wobble = new Noise(2, 8, 61, 2);
  const wearN = new Noise(4, 4, 71, 2);
  const flecks = new Noise(256, 256, 83, 1);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const s = strandN.sample(u, v);
      // individual stalks: fine sine ripple along u so strands catch light, with random lean
      const stalk = Math.abs(Math.sin(u * Math.PI * 2 * 128 + s * 4));
      // courses: 9 layers per tile; the tile wraps because 9 is an integer
      const t = 9 * v + (wobble.sample(u, v) - 0.5) * 0.5;
      const c = t - Math.floor(t);
      const layer = smooth(0.0, 0.35, c) * 0.4;
      const tuck = 1 - smooth(0.82, 1.0, c);
      const wear = wearN.sample(u, v);
      const fleck = flecks.sample(u, v);

      h[i] = s * 0.45 + stalk * 0.3 + layer * tuck * 0.5 + (1 - tuck) * -0.35 + fleck * 0.1;
      lum[i] = 0.92 + (s - 0.5) * 0.2 + (stalk - 0.5) * 0.14 - (1 - tuck) * 0.3 - smooth(0.6, 0.7, wear) * 0.16 + (fleck - 0.5) * 0.08;
      tint[i] = smooth(0.6, 0.7, wear) * -0.3 + (s - 0.5) * 0.2;
    }
  }
  return { h, lum, tint };
}

/** Trampled dust: compacted paths with foot pits, scattered pebbles, dead leaves, and soft patches. */
function dustFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const patch = new Noise(4, 4, 33, 3);
  const speck = new Noise(256, 256, 41, 1);
  const warp = new Noise(2, 2, 47, 2);
  const CELL = 48;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const pt = patch.sample(u, v);
      const sp = speck.sample(u, v);
      const w = warp.sample(u, v) * 2.4;
      // two winding trails crossing the tile; their centre lines wobble with a tileable warp
      const trailA = Math.abs(Math.sin(u * Math.PI * 2 + w));
      const trailB = Math.abs(Math.sin(v * Math.PI * 2 + w * 0.7 + 1.3));
      const trail = 1 - smooth(0.08, 0.2, Math.min(trailA, trailB));

      // pebbles: one per cell with probability, in a round blob
      const cu = u * CELL;
      const cv = v * CELL;
      const gx = Math.floor(cu);
      const gy = Math.floor(cv);
      const fx = cu - gx - 0.5;
      const fy = cv - gy - 0.5;
      const d = Math.hypot(fx, fy);
      const peb = hash(gx, gy, 3) > 0.72 ? 1 - smooth(0.12, 0.22, d) : 0;
      // dead leaves / straw bits: small dark flecks on a sparser grid
      const lx = Math.floor(u * 96);
      const ly = Math.floor(v * 96);
      const lfx = u * 96 - lx - 0.5;
      const lfy = v * 96 - ly - 0.5;
      const leaf = hash(lx, ly, 7) > 0.8 ? 1 - smooth(0.08, 0.16, Math.hypot(lfx, lfy)) : 0;

      h[i] = pt * 0.5 + sp * 0.22 + peb * 0.55 - trail * 0.3 + (sp > 0.6 ? -0.08 : 0);
      lum[i] = 0.9 + (pt - 0.5) * 0.14 + (sp - 0.5) * 0.09 + trail * 0.08 + peb * 0.12 - leaf * 0.3;
      tint[i] = trail * 0.25 - leaf * 0.2;
    }
  }
  return { h, lum, tint };
}

function buildTextures(kind: SurfaceKind, size: number) {
  const f = kind === "mud" ? mudFields(size) : kind === "thatch" ? thatchFields(size) : dustFields(size);
  const { h, lum, tint } = f;
  const albedo = document.createElement("canvas");
  albedo.width = albedo.height = size;
  const actx = albedo.getContext("2d");
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  const nctx = normalCanvas.getContext("2d");
  if (!actx || !nctx) return null;

  const aData = actx.createImageData(size, size);
  const nData = nctx.createImageData(size, size);
  // slope strength: thatch and mud carry deep relief, ground stays gentle
  const strength = kind === "thatch" ? 3.2 : kind === "mud" ? 3.0 : 1.6;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yc = y * size;
    for (let x = 0; x < size; x++) {
      const i = yc + x;
      const p = i * 4;
      const L = lum[i]!;
      const tn = tint[i]!;
      // slight warm/cool tint keeps the material colour from going grey on the sun-bleached areas
      aData.data[p] = Math.min(255, Math.max(0, (L + 0.03 * tn) * 255));
      aData.data[p + 1] = Math.min(255, Math.max(0, L * 255 * 0.98));
      aData.data[p + 2] = Math.min(255, Math.max(0, (L - 0.04 * tn) * 255 * 0.94));
      aData.data[p + 3] = 255;

      const l = h[yc + ((x - 1 + size) % size)]!;
      const r = h[yc + ((x + 1) % size)]!;
      const u = h[ym + x]!;
      const d = h[yp + x]!;
      const nx = (l - r) * strength;
      const ny = (u - d) * strength;
      const len = Math.hypot(nx, ny, 1);
      nData.data[p] = ((nx / len) * 0.5 + 0.5) * 255;
      nData.data[p + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      nData.data[p + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nData.data[p + 3] = 255;
    }
  }
  actx.putImageData(aData, 0, 0);
  nctx.putImageData(nData, 0, 0);

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.CanvasTexture(normalCanvas);
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, normal };
}

/**
 * Returns a shared, tileable albedo + normal pair for the surface. Built once per kind; the size
 * is fixed per kind (see SIZE), so every caller gets the same texture and GPU memory is paid once.
 */
export function getProceduralPBR(kind: SurfaceKind, _size?: number): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  const built = buildTextures(kind, SIZE[kind]);
  if (!built) return null;
  cache.set(kind, built);
  return built;
}
