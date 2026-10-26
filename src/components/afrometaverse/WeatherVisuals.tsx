import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { currentRenderTier, type RenderTier } from "@/lib/renderTier";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import {
  WEATHER_TARGETS,
  VISUAL_WEATHER_IDS,
  VISUAL_WEATHER_LABELS,
  advanceWindClock,
  createGustClock,
  emitWindGust,
  stepGustClock,
  type VisualWeatherId,
  type WeatherParams,
} from "@/lib/weatherSystem";
import { useVisualWeatherStore, seasonalVisualWeather } from "@/stores/visualWeatherStore";

/**
 * Weather visuals. Every layer reads the eased blend from useVisualWeatherStore inside
 * useFrame (getState, no React re-render). Geometry and materials are shared, particle
 * counts are capped per render tier, and no vector or matrix is allocated per frame.
 */

// Per-tier particle caps (mobile friendly). low = phones on weak data, high = desktop.
const CAPS: Record<RenderTier, { rain: number; dust: number; wind: number; clouds: number }> = {
  low: { rain: 220, dust: 70, wind: 50, clouds: 5 },
  mid: { rain: 380, dust: 110, wind: 80, clouds: 7 },
  high: { rain: 600, dust: 160, wind: 120, clouds: 9 },
};

// Shared scratch objects (reused every frame).
const tmpColor = new THREE.Color();
const greyColor = new THREE.Color("#5c6670");
const stormColor = new THREE.Color("#2b323a");
const hazeColor = new THREE.Color(SCENE_PALETTE.dust);
const warmColor = new THREE.Color("#e8a85c");
const wetGround = new THREE.Color("#3a2e22");
const whiteColor = new THREE.Color("#ffffff");

// Shared textures, built once per page.
let cloudTex: THREE.CanvasTexture | null = null;
let hazeTex: THREE.CanvasTexture | null = null;
let shadowTex: THREE.CanvasTexture | null = null;
let sparkleTex: THREE.CanvasTexture | null = null;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = false) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/** Soft puffy cloud: overlapping radial blobs with a lit top and darker base. */
function getCloudTexture(): THREE.CanvasTexture {
  if (!cloudTex) {
    cloudTex = canvasTexture(256, (ctx, s) => {
      const blobs: [number, number, number][] = [
        [0.5, 0.52, 0.3], [0.32, 0.6, 0.22], [0.68, 0.6, 0.24], [0.45, 0.42, 0.2], [0.62, 0.45, 0.18], [0.28, 0.5, 0.15],
      ];
      for (const [x, y, r] of blobs) {
        const g = ctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.6, "rgba(255,255,255,0.6)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
      // Darker base so the cloud reads as volume, not a flat sticker.
      const base = ctx.createLinearGradient(0, s * 0.45, 0, s * 0.8);
      base.addColorStop(0, "rgba(120,120,130,0)");
      base.addColorStop(1, "rgba(120,120,130,0.35)");
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
    });
  }
  return cloudTex;
}

/** Horizon haze bank: vertical gradient, fully transparent at the top. */
function getHazeTexture(): THREE.CanvasTexture {
  if (!hazeTex) {
    hazeTex = canvasTexture(4, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.55, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  return hazeTex;
}

/** Cloud shadow: soft noisy dark blobs on a tile, scrolled across the ground. */
function getShadowTexture(): THREE.CanvasTexture {
  if (!shadowTex) {
    shadowTex = canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 14; i++) {
        const x = ((i * 137) % 256);
        const y = ((i * 71) % 256);
        const r = 30 + ((i * 29) % 40);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(0,0,0,0.9)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
    }, true);
  }
  return shadowTex;
}

/** Puddle sparkle: sparse bright specks on a tile (additive). */
function getSparkleTexture(): THREE.CanvasTexture {
  if (!sparkleTex) {
    sparkleTex = canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) {
        const x = (i * 53) % s;
        const y = (i * 97) % s;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 6, y - 6, 12, 12);
      }
    }, true);
  }
  return sparkleTex;
}

/** Deterministic pseudo-random so cloud layouts are stable between renders. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Clouds: three layers at different heights and speeds, each a cluster of
// billboards. Layer tint darkens with the blend (grey in rain, near black in storm).
// Shadows: a ground plane with scrolling cloud-shadow texture.
// ---------------------------------------------------------------------------

export function WeatherClouds() {
  const tier = currentRenderTier();
  const count = CAPS[tier].clouds;
  const groups = useRef<THREE.Group[]>([]);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const cloudTexture = useMemo(() => getCloudTexture(), []);
  const shadowTexture = useMemo(() => getShadowTexture(), []);

  const layers = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const height = 26 + (i % 3) * 7;
        return {
          height,
          speed: 0.35 + (i % 3) * 0.22,
          z: -40 + rnd(i + 1) * 80,
          x: -60 + rnd(i + 7) * 120,
          scale: 12 + (i % 4) * 4,
        };
      }),
    [count],
  );

  useFrame((_, dt) => {
    const b = useVisualWeatherStore.getState().blend;
    const wind = b.wind;
    // Clouds drift with the wind. Speed rises a little in gusty states.
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i]!;
      const g = groups.current[i];
      if (!g) continue;
      L.x += dt * L.speed * (0.6 + wind);
      if (L.x > 70) L.x = -70;
      g.position.set(L.x, L.height, L.z);
      const visible = b.cloud > 0.08 ? 1 : 0;
      g.visible = visible > 0;
    }
    // Colour follows darkness: white in clear, slate in rain, near black in storm.
    tmpColor.copy(greyColor).lerp(stormColor, Math.min(1, b.storm)).lerp(whiteColor, 1 - b.darkness);
    for (let i = 0; i < mats.current.length; i++) {
      const m = mats.current[i];
      if (!m) continue;
      m.color.copy(tmpColor);
      // Opacity controlled by cover, so clear skies keep a few wisps.
      m.opacity = Math.min(0.92, 0.25 + b.cloud * 0.7) * (i % 2 === 0 ? 1 : 0.8);
    }
    // Cloud shadows scroll on the ground at the wind's pace, strength from cover.
    if (shadowRef.current && shadowMat.current) {
      shadowMat.current.opacity = Math.min(0.42, b.cloud * 0.42);
      shadowTexture.offset.x += dt * (0.02 + wind * 0.05);
      shadowTexture.offset.y += dt * (0.01 + wind * 0.02);
      shadowRef.current.visible = b.cloud > 0.1;
    }
  });

  return (
    <group>
      {layers.map((L, i) => (
        <group
          key={i}
          ref={(el) => {
            if (el) groups.current[i] = el;
          }}
          position={[L.x, L.height, L.z]}
        >
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[k * L.scale * 0.45 - L.scale * 0.45, rnd(i * 3 + k) * 2, rnd(i * 5 + k) * 3]} scale={[L.scale, L.scale * 0.45, 1]}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                ref={(m) => {
                  if (m) mats.current[i * 3 + k] = m;
                }}
                map={cloudTexture}
                transparent
                depthWrite={false}
                fog={false}
                opacity={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshBasicMaterial
          ref={shadowMat}
          map={shadowTexture}
          transparent
          depthWrite={false}
          opacity={0}
          color="#000000"
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Haze bank: a ring of warm translucent planes around the village at the horizon.
// Opacity is the blend's haze. Draw distance is reduced in DayNightSky.
// ---------------------------------------------------------------------------

export function WeatherHazeBank() {
  const matRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const tex = useMemo(() => getHazeTexture(), []);
  const ring = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);

  useFrame(() => {
    const b = useVisualWeatherStore.getState().blend;
    tmpColor.copy(hazeColor).lerp(warmColor, b.fogWarm * 0.6).lerp(greyColor, b.darkness * 0.5);
    for (const m of matRefs.current) {
      if (!m) continue;
      m.color.copy(tmpColor);
      m.opacity = b.haze * 0.85;
    }
  });

  return (
    <group>
      {ring.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 46, 4, Math.sin(a) * 46]} rotation={[0, -a + Math.PI / 2, 0]} scale={[60, 14, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={(m) => {
              if (m) matRefs.current[i] = m;
            }}
            map={tex}
            transparent
            depthWrite={false}
            opacity={0}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rain streaks + splash rings + puddle sparkle + wet ground sheen.
// ---------------------------------------------------------------------------

const RAIN_SPAN = { x: 44, y: 22, z: 40 };
const SPLASH_COUNT = 40;

export function WeatherRain() {
  const tier = currentRenderTier();
  const count = CAPS[tier].rain;
  const rainRef = useRef<THREE.InstancedMesh>(null);
  const splashRef = useRef<THREE.InstancedMesh>(null);
  const rainMat = useRef<THREE.MeshBasicMaterial>(null);
  const splashMat = useRef<THREE.MeshBasicMaterial>(null);
  const sheenRef = useRef<THREE.Mesh>(null);
  const sheenMat = useRef<THREE.MeshStandardMaterial>(null);
  const sparkleRef = useRef<THREE.Mesh>(null);
  const sparkleMat = useRef<THREE.MeshBasicMaterial>(null);
  const sparkleTexture = useMemo(() => getSparkleTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Shared geometry and particle state, created once per mount.
  const rainGeom = useMemo(() => new THREE.BoxGeometry(0.02, 0.6, 0.02), []);
  const splashGeom = useMemo(() => new THREE.RingGeometry(0.05, 0.12, 8), []);
  const particles = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (rnd(i + 11) - 0.5) * RAIN_SPAN.x;
      p[i * 3 + 1] = rnd(i + 23) * RAIN_SPAN.y;
      p[i * 3 + 2] = (rnd(i + 37) - 0.5) * RAIN_SPAN.z;
    }
    return p;
  }, [count]);
  const splashes = useMemo(() => {
    const s = new Float32Array(SPLASH_COUNT * 3);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      s[i * 3] = (rnd(i + 51) - 0.5) * 30;
      s[i * 3 + 1] = 0.03;
      s[i * 3 + 2] = (rnd(i + 61) - 0.5) * 26;
    }
    return s;
  }, []);

  useEffect(
    () => () => {
      rainGeom.dispose();
      splashGeom.dispose();
    },
    [rainGeom, splashGeom],
  );

  useFrame((state, dt) => {
    const b = useVisualWeatherStore.getState().blend;
    const t = state.clock.elapsedTime;
    const wind = b.wind;
    const rainOn = b.rain > 0.02;
    const drop = Math.min(0.1, dt);

    if (rainRef.current) {
      rainRef.current.visible = rainOn;
      if (rainOn) {
        const active = Math.floor(count * Math.min(1, b.rain));
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          // Fall speed and slant come from the wind blend.
          particles[j + 1]! -= drop * (18 + b.storm * 6);
          particles[j]! += drop * wind * 5;
          if (particles[j + 1]! < 0) {
            particles[j + 1]! += RAIN_SPAN.y;
            particles[j]! = (rnd(i + t * 7) - 0.5) * RAIN_SPAN.x;
          }
          if (i < active) {
            dummy.position.set(particles[j]!, particles[j + 1]! + 1, particles[j + 2]!);
            dummy.rotation.set(0, 0, -wind * 0.25);
            dummy.scale.set(1, 1, 1);
          } else {
            dummy.position.set(0, -100, 0);
            dummy.scale.set(0, 0, 0);
          }
          dummy.updateMatrix();
          rainRef.current.setMatrixAt(i, dummy.matrix);
        }
        rainRef.current.instanceMatrix.needsUpdate = true;
      }
      if (rainMat.current) rainMat.current.opacity = 0.28 * b.rain;
    }

    if (splashRef.current) {
      splashRef.current.visible = b.rain > 0.4;
      if (splashRef.current.visible) {
        for (let i = 0; i < SPLASH_COUNT; i++) {
          // Rings expand and fade on a fixed cycle, staggered per ring.
          const phase = (t * 1.6 + i * 0.37) % 1;
          const s = 0.4 + phase * 1.6;
          dummy.position.set(splashes[i * 3]!, 0.03, splashes[i * 3 + 2]!);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          splashRef.current.setMatrixAt(i, dummy.matrix);
        }
        splashRef.current.instanceMatrix.needsUpdate = true;
        if (splashMat.current) splashMat.current.opacity = 0.5 * (1 - ((t * 1.6) % 1)) * b.rain;
      }
    }

    // Wet ground: darker tint and lower roughness (puddles catch light), dried out when the rain stops.
    if (sheenRef.current && sheenMat.current) {
      sheenRef.current.visible = b.wet > 0.02;
      sheenMat.current.opacity = Math.min(0.55, b.wet * 0.5);
      sheenMat.current.color.copy(wetGround);
      sheenMat.current.roughness = 1 - b.wet * 0.8;
    }
    if (sparkleRef.current && sparkleMat.current) {
      sparkleRef.current.visible = b.wet > 0.25;
      sparkleMat.current.opacity = 0.35 + 0.25 * Math.sin(t * 3.1);
      sparkleTexture.offset.x = t * 0.01;
    }
  });

  return (
    <group>
      <instancedMesh ref={rainRef} args={[rainGeom, undefined, count]} frustumCulled={false} visible={false}>
        <meshBasicMaterial ref={rainMat} color="#c9dcec" transparent opacity={0} depthWrite={false} fog={false} />
      </instancedMesh>
      <instancedMesh ref={splashRef} args={[splashGeom, undefined, SPLASH_COUNT]} frustumCulled={false} visible={false}>
        <meshBasicMaterial ref={splashMat} color="#e6f3ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* Wet darkening over the ground: low roughness shows the sheen. */}
      <mesh ref={sheenRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} visible={false}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial ref={sheenMat} color={wetGround} transparent opacity={0} depthWrite={false} roughness={1} metalness={0} />
      </mesh>
      {/* Puddle sparkle: additive specks on the wet ground. */}
      <mesh ref={sparkleRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} visible={false}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial ref={sparkleMat} map={sparkleTexture} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Harmattan dust motes and storm wind streaks. Both are instanced and wind-driven.
// ---------------------------------------------------------------------------

export function WeatherDust() {
  const tier = currentRenderTier();
  const count = CAPS[tier].dust;
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geom = useMemo(() => new THREE.SphereGeometry(1, 4, 4), []);
  useEffect(() => () => geom.dispose(), [geom]);
  const p = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (rnd(i + 101) - 0.5) * 60;
      a[i * 3 + 1] = rnd(i + 113) * 9 + 0.3;
      a[i * 3 + 2] = (rnd(i + 127) - 0.5) * 60;
    }
    return a;
  }, [count]);

  useFrame((state, dt) => {
    const b = useVisualWeatherStore.getState().blend;
    if (!ref.current || !mat.current) return;
    const on = b.dust > 0.05 || b.wind > 0.3;
    ref.current.visible = on;
    if (!on) return;
    mat.current.color.copy(hazeColor).lerp(warmColor, b.fogWarm * 0.4);
    mat.current.opacity = Math.min(0.5, b.dust * 0.45 + b.wind * 0.1);
    const t = state.clock.elapsedTime;
    const drift = dt * (0.8 + b.wind * 4);
    const active = Math.floor(count * Math.min(1, 0.3 + b.dust));
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      p[j]! += drift * (0.4 + (i % 5) * 0.1);
      p[j + 1]! += Math.sin(t * 0.7 + i) * dt * 0.05;
      if (p[j]! > 30) p[j]! -= 60;
      if (i < active) {
        dummy.position.set(p[j]!, p[j + 1]!, p[j + 2]!);
        dummy.scale.setScalar(0.05 + (i % 3) * 0.02);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geom, undefined, count]} frustumCulled={false} visible={false}>
      <meshBasicMaterial ref={mat} color={SCENE_PALETTE.dust} transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

export function WeatherWindStreaks() {
  const tier = currentRenderTier();
  const count = CAPS[tier].wind;
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geom = useMemo(() => new THREE.BoxGeometry(0.5, 0.02, 0.02), []);
  useEffect(() => () => geom.dispose(), [geom]);
  const p = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (rnd(i + 201) - 0.5) * 60;
      a[i * 3 + 1] = rnd(i + 213) * 8 + 0.5;
      a[i * 3 + 2] = (rnd(i + 227) - 0.5) * 60;
    }
    return a;
  }, [count]);

  useFrame((_, dt) => {
    const b = useVisualWeatherStore.getState().blend;
    if (!ref.current || !mat.current) return;
    const on = b.storm > 0.05;
    ref.current.visible = on;
    if (!on) return;
    mat.current.opacity = Math.min(0.55, b.storm * 0.5);
    const speed = dt * (10 + b.wind * 14);
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      p[j]! += speed;
      if (p[j]! > 30) p[j]! -= 60;
      dummy.position.set(p[j]!, p[j + 1]!, p[j + 2]!);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geom, undefined, count]} frustumCulled={false} visible={false}>
      <meshBasicMaterial ref={mat} color="#e7dcc2" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Driver: advances the state machine from the seasonal weather, raises wind gusts
// during storms, and fires lightning. It owns no geometry; it only writes the store.
// ---------------------------------------------------------------------------

export function WeatherDriver() {
  const gust = useMemo(() => createGustClock(), []);
  const flash = useRef(0);
  const flashTimer = useRef(4 + Math.random() * 4);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    advanceWindClock(step);
    const store = useVisualWeatherStore.getState();
    const seasonal = seasonalVisualWeather();
    const current = store.tick(step, seasonal);
    const b = store.blend;

    const g = stepGustClock(gust, b.storm, step, Math.random);
    if (g > 0) {
      emitWindGust(g);
    }

    // Lightning: storm only. A brief flash lifts the sky and the sun intensity via the blend.
    if (current === "storm" || (store.target === "storm" && b.storm > 0.5)) {
      flashTimer.current -= step;
      if (flashTimer.current <= 0) {
        flash.current = 1;
        flashTimer.current = 4 + Math.random() * 7;
      }
    }
    flash.current *= Math.pow(0.04, step);
    useVisualWeatherStore.setState({ flash: flash.current });
  });

  return null;
}

/** Labels for the dev strip. */
export const WEATHER_DEBUG_ORDER: VisualWeatherId[] = VISUAL_WEATHER_IDS.slice();
export { VISUAL_WEATHER_LABELS, WEATHER_TARGETS };
export type { WeatherParams };

/** Everything weather, mounted once inside the scene Canvas. */
export function WeatherScene() {
  return (
    <group>
      <WeatherDriver />
      <WeatherClouds />
      <WeatherHazeBank />
      <WeatherRain />
      <WeatherDust />
      <WeatherWindStreaks />
    </group>
  );
}
