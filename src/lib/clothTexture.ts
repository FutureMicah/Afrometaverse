import * as THREE from "three";
import type { ClothPattern } from "@/lib/characterWardrobe";

/**
 * Procedural woven-cloth and skin materials. Textures are painted on a 128px canvas at runtime
 * (no downloads). Materials are cached by key so ~28 NPCs share a handful of GPU textures.
 * Patterns use a deterministic LCG so every client sees the same weave.
 */

const SIZE = 128;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function paintCloth(pattern: ClothPattern, base: string, accent: string, seed: number): THREE.CanvasTexture | null {
  const pair = canvas();
  if (!pair) return null;
  const [c, ctx] = pair;
  const rnd = lcg(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const threads = pattern === "gold" ? 6 : 8;
  // warp / weft weave lines
  for (let i = 0; i < SIZE; i += SIZE / threads) {
    ctx.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.05})`;
    ctx.fillRect(i, 0, 2, SIZE);
    ctx.fillRect(0, i, SIZE, 2);
  }

  switch (pattern) {
    case "indigo-check":
    case "kente": {
      const cell = pattern === "kente" ? 16 : 22;
      for (let y = 0; y < SIZE; y += cell) {
        for (let x = 0; x < SIZE; x += cell) {
          const pick = rnd();
          ctx.fillStyle = pick < 0.5 ? accent : base;
          ctx.globalAlpha = pattern === "kente" ? 0.9 : 0.55;
          ctx.fillRect(x, y, cell, cell);
        }
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "aso-oke":
    case "embroidered": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      for (let y = 8; y < SIZE; y += 18) {
        ctx.beginPath();
        for (let x = 0; x <= SIZE; x += 8) {
          ctx.lineTo(x, y + Math.sin((x + y) * 0.2) * 2);
        }
        ctx.stroke();
      }
      break;
    }
    case "leopard": {
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = `rgba(30,18,8,${0.35 + rnd() * 0.3})`;
        const x = rnd() * SIZE;
        const y = rnd() * SIZE;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + rnd() * 3, 3 + rnd() * 2, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "hide": {
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
        ctx.fillRect(rnd() * SIZE, rnd() * SIZE, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      break;
    }
    case "quilted": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      for (let i = 0; i < SIZE; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, SIZE);
        ctx.stroke();
      }
      break;
    }
    case "raffia": {
      for (let i = 0; i < 120; i++) {
        ctx.strokeStyle = `rgba(200,160,90,${0.3 + rnd() * 0.4})`;
        ctx.lineWidth = 1 + rnd();
        const x = rnd() * SIZE;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + rnd() * 6 - 3, SIZE);
        ctx.stroke();
      }
      break;
    }
    case "gold":
    case "beaded": {
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = pattern === "gold" ? accent : `rgba(239,106,75,${0.5 + rnd() * 0.4})`;
        ctx.beginPath();
        ctx.arc(rnd() * SIZE, rnd() * SIZE, 2 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
  return finish(c);
}

function paintSkin(base: string, seed: number): THREE.CanvasTexture | null {
  const pair = canvas();
  if (!pair) return null;
  const [c, ctx] = pair;
  const rnd = lcg(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // soft mottling so skin doesn't read as flat plastic
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? "0,0,0" : "255,255,255"},${0.02 + rnd() * 0.035})`;
    ctx.beginPath();
    ctx.arc(rnd() * SIZE, rnd() * SIZE, 2 + rnd() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}

const matCache = new Map<string, THREE.MeshPhysicalMaterial>();
const texCache = new Map<string, THREE.CanvasTexture | null>();

function cachedTex(key: string, make: () => THREE.CanvasTexture | null) {
  if (texCache.has(key)) return texCache.get(key) ?? null;
  const t = make();
  texCache.set(key, t);
  return t;
}

/** Woven cloth PBR material. Same pattern+colour+accent always returns the same instance. */
export function clothMaterial(opts: { pattern: ClothPattern; color: string; accent?: string }): THREE.MeshPhysicalMaterial {
  const accent = opts.accent ?? "#ffffff";
  const key = `cloth|${opts.pattern}|${opts.color}|${accent}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const seed = hash(key);
  const map = cachedTex(key + "|map", () => paintCloth(opts.pattern, opts.color, accent, seed));
  const mat = new THREE.MeshPhysicalMaterial({
    color: map ? "#ffffff" : opts.color,
    map: map ?? null,
    roughness: 0.82,
    sheen: 0.6,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(opts.color),
    side: THREE.DoubleSide,
  });
  matCache.set(key, mat);
  return mat;
}

/** Skin material with subsurface-ish sheen. Optional face photo overrides the base map. */
export function skinMaterial(color: string, faceMap?: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  const key = `skin|${color}|${faceMap ? "face" : "plain"}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const map = faceMap ?? cachedTex(`skin|${color}|map`, () => paintSkin(color, hash(color)));
  const mat = new THREE.MeshPhysicalMaterial({
    color: map ? "#ffffff" : color,
    map: map ?? null,
    roughness: 0.6,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(color).multiplyScalar(1.4),
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  });
  matCache.set(key, mat);
  return mat;
}

/** Stable 32-bit string hash so the same key always produces the same seed. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Test hook: clear caches (used by unit tests). */
export function __resetClothCaches() {
  matCache.clear();
  texCache.clear();
}
