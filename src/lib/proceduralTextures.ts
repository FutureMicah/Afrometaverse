/**
 * Procedural PBR-style textures for the village: hand-daubed mud plaster, layered palm-frond thatch and
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

export type SurfaceKind = "mud" | "thatch" | "dust" | "mat" | "basket" | "cloth" | "wood" | "clay" | "gourd";

/**
 * Resolution per surface. Mud and thatch are 2K for close walls and roofs; the ground is 1K to keep GPU memory small on phones.
 * Interior props (woven mats, baskets, cloth, wood, fired clay, calabash) are 512: they are small on screen and mobile GPUs are tight.
 */
const SIZE: Record<SurfaceKind, number> = {
  mud: 2048,
  thatch: 2048,
  dust: 1024,
  mat: 512,
  basket: 512,
  cloth: 512,
  wood: 512,
  clay: 512,
  gourd: 512,
};

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
  /** optional direct albedo per channel (0..1, shading included); used by the palm thatch */
  rgb?: [Float32Array, Float32Array, Float32Array];
}

/**
 * Mud plaster: hand-troweled patches, rain-streaked erosion, bare eroded patches with ragged edges,
 * hairline cracks that only run in some zones (not everywhere), and cell-based repair daubs with a
 * slightly different, warmer tone and a darker seam. Warped lattice lookups stop the cracks from
 * reading as one repeating grid.
 */
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
  const crackWarp = new Noise(4, 4, 61, 2);
  const crackZone = new Noise(4, 4, 73, 2);
  const deepN = new Noise(8, 8, 37, 3);
  const erodeN = new Noise(8, 8, 67, 3);
  const DAUB = 6; // repair cells per texture tile
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
      // hairline cracks: warped so they wander, and only in zones where the plaster is weak
      const wu = (crackWarp.sample(u, v) - 0.5) * 0.14;
      const wv = (crackWarp.sample(u + 0.41, v + 0.23) - 0.5) * 0.14;
      const c = crackN.sample(u + wu, v + wv);
      const zone = smooth(0.48, 0.66, crackZone.sample(u, v));
      const crack = (1 - smooth(0.0, 0.02, Math.abs(c - 0.5))) * zone;
      // deep fissures: rarer, wider, deeper, and also zoned
      const dn = deepN.sample(u, v);
      const deep = (1 - smooth(0.0, 0.011, Math.abs(dn - 0.5))) * smooth(0.55, 0.72, crackZone.sample(u + 0.5, v + 0.5));
      // eroded bare patches: ragged, irregular blobs where the fine plaster has worn back to the core
      const er = erodeN.sample(u, v) + (g - 0.5) * 0.14;
      const erode = smooth(0.6, 0.66, er);
      // repair daubs: one rectangular cell in some grid cells, with a ragged outline
      const cu = u * DAUB;
      const cv = v * DAUB;
      const gx = Math.floor(cu);
      const gy = Math.floor(cv);
      const has = hash(gx, gy, 91) > 0.6 ? 1 : 0;
      const ax = Math.abs(cu - gx - 0.5) / 0.36;
      const ay = Math.abs(cv - gy - 0.5) / 0.28;
      const dd = Math.max(ax, ay) + (g - 0.5) * 0.25;
      const daub = has ? 1 - smooth(0.9, 1.0, dd) : 0;
      const seam = has ? smooth(0.72, 0.86, dd) * (1 - smooth(0.9, 1.0, dd)) : 0;

      h[i] = b * 0.5 + p * 0.22 + g * 0.2 - streak * 0.2 - crack * 0.45 - deep * 0.8 - erode * 0.3 + daub * 0.25 - seam * 0.12;
      lum[i] =
        0.9 + (b - 0.5) * 0.12 + (p - 0.5) * 0.07 + (g - 0.5) * 0.09 - streak * 0.1 - crack * 0.5 - deep * 0.6 - erode * 0.3 + daub * 0.22 - seam * 0.2;
      tint[i] = daub * 1.0 - streak * 0.3 - erode * 0.55 - crack * 0.25;
    }
  }
  return { h, lum, tint };
}

/**
 * Palm-frond thatch. Long fronds lie in overlapping courses: each course row holds FRONDS fronds side by
 * side (offset every other row), and every frond runs DOWN the slope for 1.5 to 2 m, so it overlaps
 * several courses below it like real palm thatch. Each frond length varies per frond, and some fronds
 * are missing from a course, so the layer edges stagger instead of forming a uniform tile.
 * Each frond tapers to a point, has a raised central rib, and combed leaflets slanting toward the tip.
 * Colour runs from fresh yellow-green near the root to golden and then brown toward the tip, with
 * damp dark tips. Texture u runs across the roof and v runs down the slope (see villageProps frondRoofUV).
 */
function thatchFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const rgb: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const ROWS = 6; // one tile is 1.8 m of slope, so one row is 0.30 m
  const FRONDS = 22;
  const LEN = 5; // longest frond: 5 rows, about 1.5 m
  const wearN = new Noise(4, 4, 71, 2);
  const fineN = new Noise(64, 64, 79, 2);
  // sRGB anchors: yellow-green fresh frond, golden dried frond, brown sun-bleached frond, dark damp tip
  const GREEN = [168, 176, 74];
  const GOLD = [206, 156, 64];
  const BROWN = [128, 90, 42];
  const TIP = [70, 56, 26];
  const GAP = [54, 42, 20];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const vr = v * ROWS;
    const r0 = Math.floor(vr);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const uf = u * FRONDS;
      const i = y * size + x;
      let bestR = -1e9;
      let bestT = 0;
      let bestLen = LEN;
      let bestA = 0;
      let bestFrond = 0;
      // candidate fronds: every course that can reach down over this pixel (fronds are up to LEN rows long)
      for (let dr = 0; dr <= LEN + 1; dr++) {
        const R = r0 - dr;
        const t = vr - R; // distance down the frond from its root, in rows
        if (t < 0) continue;
        const rowOff = ((R % 2) + 2) % 2 * 0.5;
        const rowMod = ((R % ROWS) + ROWS) % ROWS;
        // the frond column nearest to this pixel in this row
        const cFloor = Math.floor(uf - rowOff);
        for (let dc = -1; dc <= 1; dc++) {
          const C = cFloor + dc;
          const cMod = ((C % FRONDS) + FRONDS) % FRONDS;
          // some fronds are missing from a course (broken layer edge): skip them
          if (hash(cMod, rowMod, 157) > 0.93) continue;
          // each frond has its own length, from 70 to 100 percent of LEN, so the tips stagger
          const lenF = LEN * (0.7 + 0.3 * hash(cMod, rowMod, 151));
          if (t > lenF) continue;
          const sway = (hash(cMod, rowMod, 131) - 0.5) * 0.35 * (t / lenF);
          const centre = C + 0.5 + rowOff + sway;
          // halfwidth tapers from the root to a point at the tip
          const taper = Math.max(0, 1 - Math.pow(t / lenF, 1.4));
          const hw = 0.46 * (0.35 + 0.65 * taper);
          const a = (uf - centre) / hw;
          if (Math.abs(a) > 1) continue;
          // later rows lie on top of earlier rows (shingle overlap), so the largest R wins
          if (R > bestR) {
            bestR = R;
            bestT = t;
            bestLen = lenF;
            bestA = a;
            bestFrond = cMod + rowMod * FRONDS;
          }
        }
      }

      if (bestR < -1e8) {
        // gap between fronds: deep shadow with a little debris
        const gN = fineN.sample(u, v);
        h[i] = -0.3 + gN * 0.04;
        lum[i] = 1;
        tint[i] = 0;
        const sh = 0.4 + gN * 0.08;
        rgb[0][i] = (GAP[0]! / 255) * sh;
        rgb[1][i] = (GAP[1]! / 255) * sh;
        rgb[2][i] = (GAP[2]! / 255) * sh;
        continue;
      }

      const a = bestA;
      const absA = Math.abs(a);
      const tn = bestT / bestLen; // 0 at the root, 1 at the tip
      const fh = hash(bestFrond % FRONDS, Math.floor(bestFrond / FRONDS), 101);
      const fh2 = hash(bestFrond % FRONDS, Math.floor(bestFrond / FRONDS), 103);
      const rib = 1 - smooth(0.0, 0.09, absA);
      // combed leaflets: slanted fine ridges angled from the rib toward the outer edge and down-slope
      const comb = Math.abs(Math.sin((bestT * 15 - absA * 3.2 + fh * 6.28) * Math.PI * 0.5));
      const leaf = Math.pow(comb, 4);
      const dome = 1 - absA * absA;
      const under = smooth(0.62, 1.0, tn); // the tip end is the damp, dark underside at the eave
      const wear = wearN.sample(u, v);
      const sp = fineN.sample(u, v);

      // height: raised rib, leaflet relief, cupped blade, tip curls down
      const hF = 0.42 + 0.34 * rib + 0.12 * leaf * dome - 0.14 * under + (sp - 0.5) * 0.04 + 0.05 * dome;
      // colour: fresh yellow-green at the root, golden in the middle, browned by weather
      const gold = smooth(0.2, 0.7, tn * 0.8 + (fh - 0.5) * 0.4 + (wear - 0.5) * 0.4);
      let cr = GREEN[0]! + (GOLD[0]! - GREEN[0]!) * gold;
      let cg = GREEN[1]! + (GOLD[1]! - GREEN[1]!) * gold;
      let cb = GREEN[2]! + (GOLD[2]! - GREEN[2]!) * gold;
      const brown = smooth(0.6, 1.0, wear * 0.5 + fh * 0.6) * 0.45;
      cr += (BROWN[0]! - cr) * brown;
      cg += (BROWN[1]! - cg) * brown;
      cb += (BROWN[2]! - cb) * brown;
      cr += (TIP[0]! - cr) * under * 0.7;
      cg += (TIP[1]! - cg) * under * 0.7;
      cb += (TIP[2]! - cb) * under * 0.7;
      // rib catches light, leaflet grooves go darker, each frond gets its own slight shade
      const shade = (0.9 + 0.2 * rib - 0.16 * leaf * (1 - rib) + (fh2 - 0.5) * 0.1) * (1 - 0.45 * under) * (0.95 + 0.07 * sp);

      h[i] = hF;
      lum[i] = 1;
      tint[i] = 0;
      rgb[0][i] = Math.min(1, (cr / 255) * shade);
      rgb[1][i] = Math.min(1, (cg / 255) * shade);
      rgb[2][i] = Math.min(1, (cb / 255) * shade);
    }
  }
  return { h, lum, tint, rgb };
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

      // fine crack net + speckle: high-frequency albedo and normal detail, tileable (fixed lattice)
      const crx = u * 64;
      const cry = v * 64;
      const cfx = crx - Math.floor(crx);
      const cfy = cry - Math.floor(cry);
      const crack = (hash(Math.floor(crx), Math.floor(cry), 11) > 0.55) ? 1 - smooth(0.0, 0.03, Math.min(cfx, 1 - cfx, cfy, 1 - cfy)) : 0;

      h[i] = pt * 0.5 + sp * 0.22 + peb * 0.55 - trail * 0.3 + (sp > 0.6 ? -0.08 : 0) - crack * 0.06 + hash(Math.floor(u * 512), Math.floor(v * 512), 13) * 0.05;
      // trample darkening follows the trails and pebbles stay lighter; cracks dark the albedo
      lum[i] = 0.9 + (pt - 0.5) * 0.14 + (sp - 0.5) * 0.09 + trail * 0.02 + peb * 0.12 - leaf * 0.3 - crack * 0.1 - trail * 0.14;
      tint[i] = trail * 0.25 - leaf * 0.2;

    }
  }
  return { h, lum, tint };
}

type RGB = [number, number, number];

/**
 * Over/under weave (mats, baskets, cloth). Horizontal strands lie on top in even cells, vertical strands
 * in odd cells. Each strand is rounded (bright crown, dark crossing edges), gets its own tone and an
 * optional dyed stripe every few strands, and a little grit and wear on top.
 */
function weaveFields(size: number, nU: number, nV: number, colA: RGB, colB: RGB, dye: { every: number; col: RGB } | null, seed: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const rgb: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const grit = new Noise(128, 128, seed + 5, 1);
  const wear = new Noise(4, 4, seed + 9, 2);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const cu = u * nU;
      const cv = v * nV;
      const ix = Math.floor(cu);
      const iy = Math.floor(cv);
      const fu = cu - ix;
      const fv = cv - iy;
      const horiz = (ix + iy) % 2 === 0;
      const sIdx = horiz ? iy : ix;
      const prof = horiz ? Math.sin(Math.PI * fv) : Math.sin(Math.PI * fu);
      const tone = hash(sIdx, horiz ? 3 : 5, seed);
      let base = tone > 0.5 ? colA : colB;
      if (dye && sIdx % dye.every === 0) base = dye.col;
      const g = grit.sample(u, v);
      const wr = wear.sample(u, v);
      const shade = (0.5 + 0.5 * prof) * (0.9 + 0.2 * tone) * (0.9 + 0.2 * g) * (0.9 + 0.12 * wr);
      rgb[0][i] = Math.min(1, (base[0] / 255) * shade);
      rgb[1][i] = Math.min(1, (base[1] / 255) * shade);
      rgb[2][i] = Math.min(1, (base[2] / 255) * shade);
      h[i] = prof * 0.6 + (g - 0.5) * 0.12;
      lum[i] = 1;
      tint[i] = 0;
    }
  }
  return { h, lum, tint, rgb };
}

/** Hewn wood: long grain along the face, wavy ring lines, fibre streaks and the odd dark knot. */
function woodFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const rgb: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const warp = new Noise(2, 8, 111, 2);
  const fibre = new Noise(4, 128, 113, 2);
  const knot = new Noise(4, 4, 117, 2);
  const DARK: RGB = [92, 58, 32];
  const LIGHT: RGB = [166, 118, 70];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const w = warp.sample(u, v) * 5;
      const ring = 0.5 + 0.5 * Math.sin((v * 26 + w) * Math.PI * 2);
      const f = fibre.sample(u, v);
      const k = smooth(0.6, 0.7, knot.sample(u, v));
      const t = Math.min(1, Math.max(0, ring * 0.65 + f * 0.35 - 0.1));
      const dim = 1 - k * 0.35;
      rgb[0][i] = ((DARK[0] + (LIGHT[0] - DARK[0]) * t) / 255) * dim;
      rgb[1][i] = ((DARK[1] + (LIGHT[1] - DARK[1]) * t) / 255) * dim;
      rgb[2][i] = ((DARK[2] + (LIGHT[2] - DARK[2]) * t) / 255) * dim;
      h[i] = f * 0.25 + ring * 0.1;
      lum[i] = 1;
      tint[i] = 0;
    }
  }
  return { h, lum, tint, rgb };
}

/** Hand-thrown, fired clay: fire clouds (darker, smoky blotches), pale grit, dark specks and throwing rings. */
function clayFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const rgb: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const cloud = new Noise(8, 8, 131, 3);
  const grit = new Noise(256, 256, 137, 1);
  const rings = new Noise(2, 32, 139, 1);
  const BASE: RGB = [178, 98, 54];
  const BURN: RGB = [116, 54, 28];
  const PALE: RGB = [212, 152, 102];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const burn = smooth(0.45, 0.7, cloud.sample(u, v)) * 0.8;
      const gr = grit.sample(u, v);
      const pale = gr < 0.2 ? 0.25 : 0;
      const speck = gr > 0.8 ? 1 : 0;
      const th = rings.sample(u, v);
      const r = BASE[0] + (BURN[0] - BASE[0]) * burn + (PALE[0] - BASE[0]) * pale;
      const g = BASE[1] + (BURN[1] - BASE[1]) * burn + (PALE[1] - BASE[1]) * pale;
      const b = BASE[2] + (BURN[2] - BASE[2]) * burn + (PALE[2] - BASE[2]) * pale;
      const shade = (0.9 + 0.14 * th) * (1 - 0.35 * speck);
      rgb[0][i] = Math.min(1, (r / 255) * shade);
      rgb[1][i] = Math.min(1, (g / 255) * shade);
      rgb[2][i] = Math.min(1, (b / 255) * shade);
      h[i] = gr * 0.35 + th * 0.2 - speck * 0.2;
      lum[i] = 1;
      tint[i] = 0;
    }
  }
  return { h, lum, tint, rgb };
}

/** Calabash / dried gourd: buff skin with rough mottled spots, fine pitting and a faint waxy sheen. */
function gourdFields(size: number): Fields {
  const N = size * size;
  const h = new Float32Array(N);
  const lum = new Float32Array(N);
  const tint = new Float32Array(N);
  const rgb: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const blot = new Noise(4, 4, 151, 3);
  const fine = new Noise(256, 256, 153, 1);
  const sheen = new Noise(4, 4, 157, 2);
  const BUFF: RGB = [190, 156, 100];
  const SPOT: RGB = [120, 86, 46];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const t = smooth(0.52, 0.66, blot.sample(u, v)) * 0.8;
      const fn = fine.sample(u, v);
      const sh = sheen.sample(u, v);
      const shade = (0.88 + 0.22 * sh) * (0.85 + 0.3 * fn);
      rgb[0][i] = Math.min(1, ((BUFF[0] + (SPOT[0] - BUFF[0]) * t) / 255) * shade);
      rgb[1][i] = Math.min(1, ((BUFF[1] + (SPOT[1] - BUFF[1]) * t) / 255) * shade);
      rgb[2][i] = Math.min(1, ((BUFF[2] + (SPOT[2] - BUFF[2]) * t) / 255) * shade);
      h[i] = fn * 0.5 - t * 0.2;
      lum[i] = 1;
      tint[i] = 0;
    }
  }
  return { h, lum, tint, rgb };
}

const FIELDS: Record<SurfaceKind, (size: number) => Fields> = {
  mud: mudFields,
  thatch: thatchFields,
  dust: dustFields,
  mat: (s) => weaveFields(s, 24, 24, [196, 160, 98], [168, 132, 76], { every: 6, col: [124, 70, 40] }, 171),
  basket: (s) => weaveFields(s, 16, 16, [190, 138, 72], [160, 110, 54], { every: 4, col: [92, 54, 30] }, 181),
  cloth: (s) => weaveFields(s, 96, 96, [44, 64, 116], [30, 44, 86], { every: 16, col: [200, 160, 84] }, 163),
  wood: woodFields,
  clay: clayFields,
  gourd: gourdFields,
};

/** Normal-map slope strength per surface. */
const STRENGTH: Record<SurfaceKind, number> = {
  thatch: 3.6,
  mud: 3.0,
  dust: 3.2,
  mat: 2.2,
  basket: 2.6,
  cloth: 1.2,
  wood: 1.4,
  clay: 2.4,
  gourd: 2.2,
};

function buildTextures(kind: SurfaceKind, size: number) {
  const f = FIELDS[kind](size);
  const { h, lum, tint } = f;
  const rgbF = f.rgb;
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
  // palm fronds carry deeper relief so each spine and leaflet groove catches the light
  const strength = STRENGTH[kind];
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yc = y * size;
    for (let x = 0; x < size; x++) {
      const i = yc + x;
      const p = i * 4;
      const L = lum[i]!;
      const tn = tint[i]!;
      if (rgbF) {
        aData.data[p] = Math.min(255, Math.max(0, rgbF[0][i]! * 255));
        aData.data[p + 1] = Math.min(255, Math.max(0, rgbF[1][i]! * 255));
        aData.data[p + 2] = Math.min(255, Math.max(0, rgbF[2][i]! * 255));
      } else {
        // slight warm/cool tint keeps the material colour from going grey on the sun-bleached areas
        aData.data[p] = Math.min(255, Math.max(0, (L + 0.03 * tn) * 255));
        aData.data[p + 1] = Math.min(255, Math.max(0, L * 255 * 0.98));
        aData.data[p + 2] = Math.min(255, Math.max(0, (L - 0.04 * tn) * 255 * 0.94));
      }
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
