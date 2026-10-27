import * as THREE from "three";

/**
 * GPU side of the vegetation sway. The same math as windSwayAt() in weatherSystem.ts, run per
 * vertex so merged tree and bush meshes (one draw call per bucket) bend with the wind.
 * Bend grows with height above the ground, so canopy tops move most and trunks stay put.
 *
 * One shared uniform object feeds every swaying material. WindSwayClock writes it once per frame.
 */
export const swayUniforms: Record<"uTime" | "uWind" | "uGust" | "uGustAt", { value: number }> = {
  uTime: { value: 0 },
  uWind: { value: 0 },
  uGust: { value: 0 },
  uGustAt: { value: -1e9 },
};

const RIPPLE_SPEED = 9;
const RIPPLE_DECAY = 1.4;

/** Per-frame write from the wind clock + blend. Cheap: scalar writes only. */
export function setSwayState(time: number, wind: number, gustStrength: number, gustAt: number): void {
  swayUniforms["uTime"].value = time;
  swayUniforms["uWind"].value = wind;
  swayUniforms["uGust"].value = gustStrength;
  swayUniforms["uGustAt"].value = gustAt;
}

const cache = new WeakMap<THREE.MeshStandardMaterial, boolean>();

/** Patch a standard material so its vertices sway. Idempotent per material. */
export function applySway(m: THREE.MeshStandardMaterial): void {
  if (cache.has(m)) return;
  cache.set(m, true);
  m.onBeforeCompile = (shader) => {
    shader.uniforms["uTime"] = swayUniforms.uTime;
    shader.uniforms["uWind"] = swayUniforms.uWind;
    shader.uniforms["uGust"] = swayUniforms.uGust;
    shader.uniforms["uGustAt"] = swayUniforms.uGustAt;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime; uniform float uWind; uniform float uGust; uniform float uGustAt;
vec2 swayAt(vec2 p, float wind, float time) {
  float phase = p.x * 0.37 + p.y * 0.23;
  float base = sin(time * (0.8 + wind * 1.6) + phase) * (0.02 + wind * 0.12);
  float dist = length(p);
  float age = time - (uGustAt + dist / ${RIPPLE_SPEED.toFixed(1)});
  float gust = age >= 0.0 ? uGust * exp(-age * ${RIPPLE_DECAY.toFixed(1)}) * sin(age * 6.0) : 0.0;
  return vec2(base + gust * 0.25);
}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float swayH = max(transformed.y, 0.0);
float bend = smoothstep(0.3, 2.6, swayH);
vec2 swayA = swayAt(vec2(transformed.x, transformed.z), uWind, uTime);
transformed.x += sin(swayA.x) * swayH * bend * 0.9;
transformed.z += sin(swayA.x * 0.6 + 0.7) * swayH * bend * 0.35;`,
      );
  };
  m.customProgramCacheKey = () => "village-sway-v1";
}
