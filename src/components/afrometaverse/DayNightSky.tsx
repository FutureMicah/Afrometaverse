import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWeatherStore } from "@/stores/weatherStore";
import { atmosphereAt, MOON_COLOR } from "@/lib/atmosphere";
import { currentRenderTier, type RenderTier } from "@/lib/renderTier";
import { fogEndMeters } from "@/lib/chunkStreaming";
import { seasonForDay, type SeasonId } from "@/lib/seasons";
import { SCENE_PALETTE } from "@/lib/scenePalette";

/**
 * Day/night sky, sun, moon, stars, fog and light (era-progression-spec.md 10.4, 12.2.2).
 * Reads the in-game hour and season from weatherStore each frame and applies atmosphereAt().
 * The sun and moon are in the same scene; the moon is kept at a low ambient level so night is dark but navigable.
 */

const STAR_COUNT = 400;

interface DayNightSkyProps {
  tier?: RenderTier;
  /** Dust intensity 0 to 1 from the weather state, thickens harmattan fog. */
  dust?: number;
  /** Starts the in-game clock. Pass false to freeze the clock (tests, pause). */
  clockRunning?: boolean;
}

export function DayNightSky({ tier, dust = 0, clockRunning = true }: DayNightSkyProps) {
  const resolvedTier = tier ?? currentRenderTier();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const starsRef = useRef<THREE.Points>(null);
  const fogRef = useRef<THREE.Fog>(null);

  const starGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.1);
      const r = 90;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.abs(Math.cos(phi)) + 4;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => () => starGeom.dispose(), [starGeom]);

  // Advance the in-game clock from real time, frame by frame.
  useFrame((_, dt) => {
    if (!clockRunning) return;
    useWeatherStore.getState().tickClock(Math.min(dt, 0.25));
  });

  useFrame(() => {
    const { state } = useWeatherStore.getState();
    const season: SeasonId = seasonForDay(state.day);
    const atm = atmosphereAt(state.hour, season, fogEndMeters(resolvedTier), dust);

    const sun = sunRef.current;
    if (sun) {
      sun.position.set(atm.sunPosition[0], atm.sunPosition[1], atm.sunPosition[2]);
      sun.intensity = atm.sunIntensity;
      sun.color.set(atm.sunColor);
    }
    const moon = moonRef.current;
    if (moon) {
      moon.position.set(atm.moonPosition[0], atm.moonPosition[1], atm.moonPosition[2]);
      moon.intensity = atm.moonVisible ? 0.18 : 0;
      moon.color.set(MOON_COLOR);
    }
    if (ambientRef.current) ambientRef.current.intensity = atm.ambientIntensity;
    if (hemiRef.current) {
      hemiRef.current.intensity = atm.hemiIntensity;
      hemiRef.current.color.set(atm.hemiSky);
    }
    const fog = fogRef.current;
    if (fog) {
      fog.color.set(atm.fog);
      fog.near = atm.fogNear;
      fog.far = atm.fogFar;
    }
    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = atm.starOpacity;
    }
  });

  return (
    <>
      <color attach="background" args={[SCENE_PALETTE.skyHaze]} />
      <fog ref={fogRef} attach="fog" args={[SCENE_PALETTE.fogSand, 16, fogEndMeters(resolvedTier)]} />
      <ambientLight ref={ambientRef} intensity={0.62} />
      <hemisphereLight ref={hemiRef} args={[SCENE_PALETTE.skyPale, SCENE_PALETTE.groundBrown, 0.5]} />
      <directionalLight
        ref={sunRef}
        position={[12, 20, 8]}
        intensity={1.45}
        color={SCENE_PALETTE.sunWarm}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight ref={moonRef} position={[-12, -20, -8]} intensity={0} color={MOON_COLOR} />
      <points ref={starsRef} geometry={starGeom}>
        <pointsMaterial color={SCENE_PALETTE.pureWhite} size={0.6} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>
    </>
  );
}
