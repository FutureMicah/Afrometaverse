import * as THREE from "three";

/** Cheap 2D value noise in 0..1 (lattice hash, smooth interpolation). */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (i: number, j: number) => {
    const n = Math.sin((i * 127.1 + j * 311.7 + seed * 74.7)) * 43758.5453;
    return n - Math.floor(n);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * A flat ground plane with gentle height relief (laid flat, facing +y, rotate the mesh to lie on the ground).
 * Heights run from 0 up to `amp` metres, so the plane never sinks below its base. The relief is what
 * the lights catch on the dust: low ridges and shallow hollows instead of a dead flat sheet.
 */
export function undulatedGround(width: number, depth: number, segments: number, amp: number, seed = 3): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, depth, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = 0.65 * valueNoise(x * 0.3, z * 0.3, seed) + 0.35 * valueNoise(x * 0.8, z * 0.8, seed + 5);
    pos.setY(i, amp * n);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
