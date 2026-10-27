/**
 * Multi-Biome Heritage Terrain (Day 2)
 * Single-draw-call splat-style terrain for Nigerian ecological zones.
 * No external textures required — procedural CanvasTexture + shader blend.
 *
 * Channels (concept):
 *   R = Red Earth / Savannah (North)
 *   G = Lush Grass / Plateau (Central)
 *   B = Dark Rock / Mountains & Valleys
 *   remainder = Sand / Coastal
 */

import { useVisualWeatherStore } from "@/stores/visualWeatherStore";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";

export type BiomeId = "SAVANNAH" | "PLATEAU" | "MOUNTAIN" | "COASTAL";

const TERRAIN_SIZE = 120;
const SEGMENTS = 96;

/** World extents used for UV ↔ world mapping (centred on village) */
const HALF = TERRAIN_SIZE / 2;

/**
 * Procedural splat map: paints Nigerian-inspired zones around the village.
 * Centre stays relatively flat grass/laterite so existing huts/roads sit cleanly.
 */
function createSplatMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base: mixed plateau / grass (green channel)
  ctx.fillStyle = "rgb(40, 180, 40)";
  ctx.fillRect(0, 0, size, size);

  const toPx = (wx: number, wz: number) => {
    // world x,z → canvas (0..size); +z is "south" on canvas y
    const u = (wx + HALF) / TERRAIN_SIZE;
    const v = (wz + HALF) / TERRAIN_SIZE;
    return [u * size, v * size] as const;
  };

  // Northern savannah / red earth (red channel) — top of map
  {
    const g = ctx.createRadialGradient(size * 0.5, size * 0.12, 10, size * 0.5, size * 0.18, size * 0.42);
    g.addColorStop(0, "rgba(220, 30, 20, 0.95)");
    g.addColorStop(0.55, "rgba(180, 40, 20, 0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size * 0.55);
  }

  // Coastal / sand near creek (SW) and some SE — alpha-ish via low RGB + we'll treat residual as sand
  {
    const g = ctx.createRadialGradient(size * 0.22, size * 0.72, 8, size * 0.28, size * 0.68, size * 0.35);
    g.addColorStop(0, "rgba(20, 20, 20, 0.05)"); // push residual toward sand by lowering other channels
    g.addColorStop(1, "rgba(0,0,0,0)");
    // Actually paint a low-saturation "sand hole": darken R/G/B so residual dominates
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(30, 40, 35, 0.85)";
    ctx.beginPath();
    ctx.ellipse(size * 0.28, size * 0.72, size * 0.22, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Mountain / rock ridges at far edges (blue channel)
  {
    const g = ctx.createRadialGradient(size * 0.88, size * 0.2, 5, size * 0.85, size * 0.25, size * 0.3);
    g.addColorStop(0, "rgba(30, 40, 210, 0.9)");
    g.addColorStop(0.6, "rgba(40, 50, 180, 0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(size * 0.55, 0, size * 0.45, size * 0.55);

    const g2 = ctx.createRadialGradient(size * 0.1, size * 0.15, 5, size * 0.15, size * 0.2, size * 0.28);
    g2.addColorStop(0, "rgba(25, 35, 200, 0.85)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, size * 0.4, size * 0.45);
  }

  // Soften village core so roads/huts stay readable (boost green, reduce extremes)
  {
    const [cx, cy] = toPx(0, 0);
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.22);
    g.addColorStop(0, "rgba(50, 200, 60, 0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Simple noise-like detail texture for surface variation */
function createDetailNoise(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 180 + Math.floor(Math.random() * 75);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.needsUpdate = true;
  return tex;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vHeight;

  // Cheap height field from UV so edges rise into hills / plateaus
  float heightAt(vec2 uv) {
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    // Keep centre flat for village
    float edge = smoothstep(0.22, 0.95, r);
    float hills = sin(p.x * 6.0) * cos(p.y * 5.0) * 0.55
                + sin(p.x * 11.0 + 1.3) * sin(p.y * 9.0) * 0.25;
    // Extra ridge on NE (mountains)
    float ridge = exp(-pow((p.x - 0.7) * 2.2, 2.0) - pow((p.y + 0.55) * 2.0, 2.0)) * 2.2;
    return edge * (hills * 1.4 + ridge);
  }

  void main() {
    vUv = uv;
    float h = heightAt(uv);
    vHeight = h;
    vec3 pos = position;
    pos.z += h; // plane is XY before rotation; after rot -PI/2, Z becomes world Y
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uSplat;
  uniform sampler2D uNoise;
  uniform float uWetness; // 0 dry … 1 rainy
  uniform float uDust;    // harmattan dust tint
  varying vec2 vUv;
  varying float vHeight;

  void main() {
    vec4 splat = texture2D(uSplat, vUv);
    float noise = texture2D(uNoise, vUv).r;

    // Base biome colours (laterite / grass / rock / sand)
    vec3 redEarth = vec3(0.62, 0.32, 0.16);   // Savannah laterite
    vec3 grass    = vec3(0.35, 0.48, 0.18);   // Plateau / central
    vec3 rock     = vec3(0.28, 0.26, 0.24);   // Mountain
    vec3 sand     = vec3(0.78, 0.68, 0.48);   // Coastal

    float r = splat.r;
    float g = splat.g;
    float b = splat.b;
    float sum = r + g + b;
    float sandW = max(0.0, 1.0 - sum);

    // Renormalise when sum > 1
    if (sum > 1.0) {
      r /= sum; g /= sum; b /= sum;
      sandW = 0.0;
    }

    vec3 color = redEarth * r + grass * g + rock * b + sand * sandW;

    // Height-driven rock exposure
    color = mix(color, rock, smoothstep(0.8, 1.8, vHeight) * 0.55);

    // Micro variation
    color *= 0.88 + noise * 0.24;

    // Climate: wet darkens & slightly greens; dust desaturates toward beige
    color = mix(color, color * vec3(0.72, 0.68, 0.62), uWetness * 0.55);
    color = mix(color, vec3(0.82, 0.74, 0.58), uDust * 0.35);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function sampleBiome(worldX: number, worldZ: number): BiomeId {
  // Approximate the same zones as the splat painter (no GPU readback)
  const nx = worldX / HALF;
  const nz = worldZ / HALF;
  const r = Math.hypot(nx, nz);

  // Mountains at far NE / NW edges
  if (r > 0.55 && (nx > 0.45 || (nx < -0.5 && nz < -0.2))) return "MOUNTAIN";
  // Coastal near creek (SW of village)
  if (nx < -0.15 && nz > 0.25 && r < 0.75) return "COASTAL";
  // Northern savannah
  if (nz < -0.35) return "SAVANNAH";
  return "PLATEAU";
}

type HeritageTerrainProps = {
  wetness?: number; // 0–1 from rain
  dust?: number; // 0–1 from harmattan
};

export function HeritageTerrain({ wetness = 0, dust = 0 }: HeritageTerrainProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { splat, noise } = useMemo(
    () => ({
      splat: createSplatMap(256),
      noise: createDetailNoise(128),
    }),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uSplat: { value: splat },
      uNoise: { value: noise },
      uWetness: { value: wetness },
      uDust: { value: dust },
      uTime: { value: 0 },
    }),
    [splat, noise, wetness, dust],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      const u = matRef.current.uniforms;
      if (u["uTime"]) u["uTime"].value = clock.getElapsedTime();
      const wb = useVisualWeatherStore.getState().blend;
      // Prop wetness/dust still apply; the weather blend adds on top, so rain darkens and dust bleaches.
      if (u["uWetness"]) u["uWetness"].value = Math.max(wetness, wb.wet);
      if (u["uDust"]) u["uDust"].value = Math.max(dust, wb.dust);
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      receiveShadow
    >
      <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/** Lightweight biome-aware grass / scrub scatter for outer rings */
export function BiomeFlora({ count = 180 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const placements = useMemo(() => {
    const out: { x: number; z: number; s: number; biome: BiomeId }[] = [];
    let i = 0;
    let attempts = 0;
    while (i < count && attempts < count * 8) {
      attempts++;
      const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.92;
      const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.92;
      // Keep clear of dense village core
      if (Math.hypot(x, z) < 12) continue;
      const biome = sampleBiome(x, z);
      out.push({
        x,
        z,
        s: 0.55 + Math.random() * 0.9,
        biome,
      });
      i++;
    }
    return out;
  }, [count]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    placements.forEach((p, i) => {
      // Approximate height from same formula (simplified)
      const nx = p.x / HALF;
      const nz = p.z / HALF;
      const r = Math.hypot(nx, nz);
      const edge = Math.max(0, Math.min(1, (r - 0.22) / 0.73));
      const hills =
        Math.sin(nx * 6) * Math.cos(nz * 5) * 0.55 +
        Math.sin(nx * 11 + 1.3) * Math.sin(nz * 9) * 0.25;
      const y = edge * (hills * 1.4) - 0.02;
      dummy.position.set(p.x, y, p.z);
      dummy.scale.set(p.s * 0.35, p.s, p.s * 0.35);
      dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, placements.length]} castShadow>
      <coneGeometry args={[0.35, 1.4, 5]} />
      <meshStandardMaterial color={SCENE_PALETTE.grassEdge} roughness={1} />
    </instancedMesh>
  );
}

/** Simple living water body used for creek / future rivers */
export function LivingWater({
  type = "pond",
  position,
  radius = 3.8,
}: {
  type?: "sea" | "river" | "pond";
  position: [number, number, number];
  radius?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const config = {
    sea: { color: SCENE_PALETTE.seaBlue, opacity: 0.92, speed: 0.9, amp: 0.04 },
    river: { color: SCENE_PALETTE.riverTeal, opacity: 0.9, speed: 1.6, amp: 0.025 },
    pond: { color: SCENE_PALETTE.pondGreen, opacity: 0.88, speed: 0.55, amp: 0.012 },
  }[type];

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + 0.03 + Math.sin(clock.getElapsedTime() * config.speed) * config.amp;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 28]} />
        <meshStandardMaterial
          color={config.color}
          transparent
          opacity={config.opacity}
          roughness={0.32}
          metalness={0.08}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[radius * 0.97, radius * 1.15, 28]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>
    </group>
  );
}
