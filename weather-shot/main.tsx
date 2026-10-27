import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { DayNightSky } from "../src/components/afrometaverse/DayNightSky";
import { WeatherScene } from "../src/components/afrometaverse/WeatherVisuals";
import { HeritageTerrain } from "../src/components/afrometaverse/HeritageTerrain";
import { ChunkVillageProps } from "../src/components/afrometaverse/VillageProps";
import { jumpVisualWeather, useVisualWeatherStore } from "../src/stores/visualWeatherStore";
import type { VisualWeatherId } from "../src/lib/weatherSystem";

const q = new URLSearchParams(location.search);
const id = (q.get("w") ?? "clear") as VisualWeatherId;
jumpVisualWeather(id);
useVisualWeatherStore.getState().setOverride(id);
(window as any).__weatherReady = false;

createRoot(document.getElementById("root")!).render(
  <div className="box">
    <Canvas
      camera={{ position: [0, 6, 18], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ width: 900, height: 600 }}
      onCreated={() => setTimeout(() => ((window as any).__weatherReady = true), 2500)}
    >
      <DayNightSky />
      <HeritageTerrain wetness={0} dust={0} />
      <ChunkVillageProps chunk={{ cx: 0, cz: 0 }} />
      <WeatherScene />
    </Canvas>
  </div>
);
