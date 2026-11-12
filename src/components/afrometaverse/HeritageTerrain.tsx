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

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { sampleHeight, sampleBiome as worldSampleBiome } from "@/lib/worldGen";

export type BiomeId = "SAVANNAH" | "PLATEAU" | "MOUNTAIN" | "COASTAL";

const TERRAIN_SIZE = 200;
const SEGMENTS = 128;

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

  // Deep rainforest canopy zone — SE (dark green via strong G, suppressed R/B)
  {
    const g = ctx.createRadialGradient(size * 0.78, size * 0.78, 8, size * 0.78, size * 0.78, size * 0.38);
    g.addColorStop(0, "rgba(20, 160, 40, 0.95)");
    g.addColorStop(0.5, "rgba(15, 120, 35, 0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(size * 0.5, size * 0.5, size * 0.5, size * 0.5);

    // darker understory core
    const g2 = ctx.createRadialGradient(size * 0.82, size * 0.82, 4, size * 0.82, size * 0.82, size * 0.2);
    g2.addColorStop(0, "rgba(10, 90, 30, 0.85)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(size * 0.55, size * 0.55, size * 0.45, size * 0.45);
  }

  // River valley cut — multiply darker band NW→SE
  {
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(40, 55, 50, 0.55)";
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(size * 0.15, size * 0.2);
    ctx.quadraticCurveTo(size * 0.4, size * 0.55, size * 0.85, size * 0.75);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
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

  // Height is pre-baked into the geometry via sampleHeight() so the
  // outer ring of this 200 m plane matches the streamed 12 km world.
  void main() {
    vUv = uv;
    vHeight = position.z; // already displaced in JS
    vec3 pos = position;
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

    // Base biome colours — richer, more natural African landscape
    vec3 redEarth = vec3(0.55, 0.28, 0.14);   // Deep laterite
    vec3 grass    = vec3(0.28, 0.42, 0.16);   // Plateau grass
    vec3 rock     = vec3(0.32, 0.29, 0.26);   // Weathered stone
    vec3 sand     = vec3(0.72, 0.62, 0.42);   // Coastal sand

    float r = splat.r;
    float g = splat.g;
    float b = splat.b;
    float sum = r + g + b;
    float sandW = max(0.0, 1.0 - sum);

    if (sum > 1.0) {
      r /= sum; g /= sum; b /= sum;
      sandW = 0.0;
    }

    vec3 color = redEarth * r + grass * g + rock * b + sand * sandW;

    // Height-driven rock exposure + dry grass on slopes
    color = mix(color, rock, smoothstep(0.8, 1.8, vHeight) * 0.55);
    color = mix(color, vec3(0.42, 0.48, 0.22), smoothstep(-0.1, 0.35, vHeight) * (1.0 - smoothstep(0.6, 1.2, vHeight)) * g * 0.35);

    // Multi-frequency micro variation (avoids flat plastic look)
    float n2 = texture2D(uNoise, vUv * 3.7).r;
    color *= 0.84 + noise * 0.22 + n2 * 0.08;

    // Soft ambient occlusion in depressions
    color *= 0.92 + smoothstep(-0.4, 0.3, vHeight) * 0.1;

    // Climate: wet darkens & slightly greens; dust desaturates toward beige
    color = mix(color, color * vec3(0.68, 0.72, 0.58), uWetness * 0.5);
    color = mix(color, vec3(0.78, 0.70, 0.55), uDust * 0.32);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Biome at a world position — delegates to the shared large-world sampler. */
export function sampleBiome(worldX: number, worldZ: number): BiomeId {
  return worldSampleBiome(worldX, worldZ);
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

  // Bake the shared world height field so the outer ring of this 200 m
  // plane joins seamlessly with streamed WorldChunks.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS);
    const pos = geo.attributes.position;
    if (!pos) return geo;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i); // local −100 … +100
      const ly = pos.getY(i);
      const h = sampleHeight(lx, ly);
      pos.setZ(i, h);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

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
      if (u["uWetness"]) u["uWetness"].value = wetness;
      if (u["uDust"]) u["uDust"].value = dust;
    }
  });

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      receiveShadow
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

/** Fan of tapered grass blades for outer biome scatter */
function makeBiomeTuftGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.05;
    const h = 0.45 + (i % 3) * 0.08;
    const lean = 0.07 + (i % 4) * 0.03;
    const tipX = Math.cos(a) * lean;
    const tipZ = Math.sin(a) * lean;
    const hw = 0.08 + (i % 2) * 0.03;
    const bx = Math.cos(a + Math.PI / 2) * hw;
    const bz = Math.sin(a + Math.PI / 2) * hw;
    positions.push(-bx, 0, -bz, bx, 0, bz, tipX, h, tipZ);
    colors.push(0.25, 0.38, 0.12, 0.3, 0.42, 0.14, 0.5, 0.58, 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Biome-aware grass — real blade tufts (not cones), wind + color by biome.
 */
export function BiomeFlora({ count = 220 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const placements = useMemo(() => {
    const out: { x: number; z: number; s: number; biome: BiomeId; phase: number }[] = [];
    let i = 0;
    let attempts = 0;
    while (i < count && attempts < count * 10) {
      attempts++;
      const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.92;
      const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.92;
      if (Math.hypot(x, z) < 6.5) continue;
      out.push({
        x,
        z,
        s: 0.55 + Math.random() * 1.0,
        biome: sampleBiome(x, z),
        phase: Math.random() * Math.PI * 2,
      });
      i++;
    }
    return out;
  }, [count]);

  const tuftGeo = useMemo(() => makeBiomeTuftGeo(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]!;
      const y = sampleHeight(p.x, p.z);
      const spatial = p.x * 0.18 + p.z * 0.12;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.3);
      const bend = Math.sin(t * 2.0 + spatial + p.phase) * 0.35 * gust
        + Math.sin(t * 3.2 + p.phase) * 0.12;
      dummy.position.set(p.x, y, p.z);
      dummy.rotation.set(Math.cos(0.65) * bend, p.phase, Math.sin(0.65) * bend);
      dummy.scale.setScalar(p.s * (1 + Math.abs(bend) * 0.04));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (p.biome === "PLATEAU" || p.biome === "SAVANNAH") {
        color.setRGB(0.38 + p.phase * 0.01, 0.5, 0.15);
      } else if (p.biome === "COASTAL") {
        color.setRGB(0.48, 0.55, 0.2);
      } else if (p.biome === "MOUNTAIN") {
        color.setRGB(0.32, 0.38, 0.18);
      } else {
        color.setRGB(0.26, 0.46, 0.16);
      }
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[tuftGeo, undefined, Math.max(1, placements.length)]} frustumCulled={false}>
      <meshStandardMaterial
        color="#4a6a30"
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.93}
      />
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
    sea: { color: "#1a4a6e", opacity: 0.94, speed: 0.9, amp: 0.04 },
    river: { color: "#1e5c52", opacity: 0.92, speed: 1.6, amp: 0.028 },
    pond: { color: "#2d4a38", opacity: 0.9, speed: 0.55, amp: 0.014 },
  }[type];

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y =
        position[1] + 0.03 + Math.sin(clock.getElapsedTime() * config.speed) * config.amp;
    }
  });

  // Rivers render as elongated ovals so they read as flowing channels
  const sx = type === "river" ? 2.4 : 1;
  const sz = type === "river" ? 0.55 : 1;

  return (
    <group position={position}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, type === "river" ? 0.6 : 0]} scale={[sx, 1, sz]} receiveShadow>
        <circleGeometry args={[radius, 28]} />
        <meshStandardMaterial
          color={config.color}
          transparent
          opacity={config.opacity}
          roughness={0.18}
          metalness={0.22}
          envMapIntensity={0.6}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, type === "river" ? 0.6 : 0]}
        position={[0, 0.015, 0]}
        scale={[sx, 1, sz]}
      >
        <ringGeometry args={[radius * 0.97, radius * 1.18, 28]} />
        <meshStandardMaterial color={SCENE_PALETTE.earth} roughness={1} />
      </mesh>
    </group>
  );
}
