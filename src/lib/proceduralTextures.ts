/**
 * Procedural PBR-style textures for the village (mud plaster, thatch, dust ground).
 * Built once on a canvas and shared by every mesh, so there are no extra downloads on mobile data.
 * Each map is a near-white albedo variation (so the material colour tints it) plus a normal map
 * generated from the same height field. Only runs in the browser.
 */
import * as THREE from "three";

type Kind = "mud" | "thatch" | "dust";
const cache = new Map<Kind, { map: THREE.CanvasTexture; normal: THREE.CanvasTexture }>();

/** Deterministic value noise so the look is stable between reloads. */
function hash(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Tileable value noise (wraps at size) with `octaves` layers. */
function fbm(x: number, y: number, size: number, cell: number, seed: number, octaves: number): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let c = cell;
  for (let o = 0; o < octaves; o++) {
    const gx = (x / size) * c;
    const gy = (y / size) * c;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const wrap = (v: number) => ((v % c) + c) % c;
    const a = hash(wrap(x0), wrap(y0), seed + o);
    const b = hash(wrap(x0 + 1), wrap(y0), seed + o);
    const d = hash(wrap(x0), wrap(y0 + 1), seed + o);
    const e = hash(wrap(x0 + 1), wrap(y0 + 1), seed + o);
    const v = a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
    sum += v * amp;
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
}

function heightField(kind: Kind, size: number): Float32Array {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v: number;
      if (kind === "mud") {
        // lime-washed plaster: broad mottling, fine grit, and a few cracks
        const broad = fbm(x, y, size, 4, 1, 3);
        const grit = fbm(x, y, size, 64, 9, 2);
        const crack = Math.abs(fbm(x, y, size, 8, 21, 2) - 0.5);
        v = broad * 0.6 + grit * 0.3 - (crack < 0.012 ? 0.25 : 0);
      } else if (kind === "thatch") {
        // stacked straw: long streaks along one axis with dark gaps
        const streak = fbm(x, y, size, 3, 5, 2);
        const stalk = Math.abs(Math.sin((y / size) * Math.PI * 2 * 26 + streak * 6));
        v = stalk * 0.7 + streak * 0.3;
      } else {
        // dust ground: fine speckle plus soft patches
        const patch = fbm(x, y, size, 3, 33, 3);
        const speck = fbm(x, y, size, 96, 41, 1);
        v = patch * 0.7 + speck * 0.3;
      }
      h[y * size + x] = v;
    }
  }
  return h;
}

function buildTextures(kind: Kind, size: number) {
  const h = heightField(kind, size);
  const albedo = document.createElement("canvas");
  albedo.width = albedo.height = size;
  const actx = albedo.getContext("2d");
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  const nctx = normalCanvas.getContext("2d");
  if (!actx || !nctx) return null;

  const aData = actx.createImageData(size, size);
  const nData = nctx.createImageData(size, size);
  const strength = kind === "thatch" ? 3.5 : kind === "mud" ? 2.2 : 1.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // albedo: near-white with a gentle luminance variation; the material colour tints it
      const lum = 0.86 + h[i]! * 0.2;
      const p = i * 4;
      aData.data[p] = Math.min(255, lum * 255);
      aData.data[p + 1] = Math.min(255, lum * 255 * 0.98);
      aData.data[p + 2] = Math.min(255, lum * 255 * 0.94);
      aData.data[p + 3] = 255;

      const l = h[y * size + ((x - 1 + size) % size)]!;
      const r = h[y * size + ((x + 1) % size)]!;
      const u = h[((y - 1 + size) % size) * size + x]!;
      const d = h[((y + 1) % size) * size + x]!;
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

/** Returns a shared, tileable albedo + normal pair for the given surface type. */
export function getProceduralPBR(kind: Kind, size = 512): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  const built = buildTextures(kind, size);
  if (!built) return null;
  cache.set(kind, built);
  return built;
}
