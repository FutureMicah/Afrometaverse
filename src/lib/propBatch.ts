import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Static prop batching for the village (mobile draw-call budget).
 *
 * Every small prop (a sphere of a bush, a fence post, a roof slab) used to be its own mesh, so a
 * single hut cost about 10 draw calls and a bush about 3. PropBatch bakes each part's world
 * transform and colour into one geometry per material class, so a whole chunk of props draws
 * in one call per material class instead of one call per part.
 *
 * Per-part colour goes into a vertex colour attribute. Materials that differ in roughness,
 * metalness or shadow flags cannot share one draw call, so they are kept in separate buckets.
 */

export interface PropMaterialSpec {
  roughness: number;
  metalness: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface MergedPropMesh {
  geometry: THREE.BufferGeometry;
  material: PropMaterialSpec;
}

const DEFAULT_SPEC: PropMaterialSpec = {
  roughness: 1,
  metalness: 0,
  castShadow: false,
  receiveShadow: false,
};

const KEEP_ATTRIBUTES = ["position", "normal", "uv"] as const;

/** Normalise a part so every part shares the same attribute layout (merge requires it). */
function normaliseForMerge(source: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const geo = source.index ? source.toNonIndexed() : source;
  for (const name of Object.keys(geo.attributes)) {
    if (!(KEEP_ATTRIBUTES as readonly string[]).includes(name)) geo.deleteAttribute(name);
  }
  const count = geo.getAttribute("position").count;
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  if (!geo.getAttribute("uv")) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export class PropBatch {
  private buckets = new Map<string, { spec: PropMaterialSpec; parts: THREE.BufferGeometry[] }>();
  private partTotal = 0;

  /** Number of parts added so far (before merging). */
  get parts(): number {
    return this.partTotal;
  }

  /**
   * Add one part. The geometry is consumed (it is disposed on build). `matrix` is the part's
   * full transform into the scene.
   */
  add(geometry: THREE.BufferGeometry, color: string, matrix: THREE.Matrix4, spec: Partial<PropMaterialSpec> = {}): void {
    const full: PropMaterialSpec = { ...DEFAULT_SPEC, ...spec };
    const key = `${full.roughness}|${full.metalness}|${full.castShadow ? 1 : 0}|${full.receiveShadow ? 1 : 0}`;
    const geo = normaliseForMerge(geometry, new THREE.Color(color));
    geo.applyMatrix4(matrix);
    if (geo !== geometry) geometry.dispose();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { spec: full, parts: [] };
      this.buckets.set(key, bucket);
    }
    bucket.parts.push(geo);
    this.partTotal++;
  }

  /** Merge every bucket into one geometry each. Source parts are disposed; the batch is reset. */
  build(): MergedPropMesh[] {
    const out: MergedPropMesh[] = [];
    for (const { spec, parts } of this.buckets.values()) {
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      out.push({ geometry: merged, material: spec });
    }
    this.buckets.clear();
    this.partTotal = 0;
    return out;
  }
}

/** Places local-space parts under a base transform (like a parent group would). */
export class Placer {
  constructor(
    private readonly batch: PropBatch,
    private readonly base: THREE.Matrix4 = new THREE.Matrix4(),
  ) {}

  part(
    geometry: THREE.BufferGeometry,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    spec: Partial<PropMaterialSpec> = {},
  ): void {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    this.batch.add(geometry, color, new THREE.Matrix4().multiplyMatrices(this.base, local), spec);
  }
}

/** Base transform for an object placed at (x, 0, z) with yaw and uniform-ish scale. */
export function groupMatrix(
  position: [number, number, number],
  rotationY = 0,
  scale: [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)),
    new THREE.Vector3(...scale),
  );
}
