/**
 * High-polish content for a single 128 m world chunk.
 *
 * Uses real HeritageArchitecture (BhungaHut, MudHut), layered trees,
 * grazing animals, birds, and weather-reactive ground — not primitive blobs.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { ChunkCoord } from "@/lib/chunkStreaming";
import {
  WORLD_CHUNK_SIZE,
  worldChunkOrigin,
  worldChunkCentre,
} from "@/lib/worldConfig";
import {
  sampleHeight,
  sampleRegion,
  sampleGroundColor,
  sampleContentDensity,
  isVillageCore,
} from "@/lib/worldGen";
import { SCENE_PALETTE } from "@/lib/scenePalette";
import { BhungaHut, MudHut, VillageHearth } from "@/components/afrometaverse/HeritageArchitecture";
import {
  Creature,
  Chicken,
  Duck,
  Heron,
  FlyingBird,
  type CreatureKind,
} from "@/components/afrometaverse/Creatures";
import { ChunkOrganicDetail } from "@/components/afrometaverse/EnvironmentalLife";
import { AnatomyVillager } from "@/components/afrometaverse/characters/AnatomyBody";
import { useWeatherStore } from "@/stores/weatherStore";

const SEGMENTS = 20; // ~6.4 m resolution per chunk

function seeded(i: number, salt = 1): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface WorldChunkProps {
  chunk: ChunkCoord;
  densityScale?: number;
}

export function WorldChunk({ chunk, densityScale = 1 }: WorldChunkProps) {
  const origin = worldChunkOrigin(chunk.cx, chunk.cz);
  const centre = worldChunkCentre(chunk.cx, chunk.cz);

  // Village core is owned by HeritageTerrain + village props.
  if (isVillageCore(centre.x, centre.z, 105)) {
    return null;
  }

  const region = sampleRegion(centre.x, centre.z);
  const density = sampleContentDensity(centre.x, centre.z) * densityScale;
  const rainIntensity = useWeatherStore((s) => s.rainIntensity);
  const dustIntensity = useWeatherStore((s) => s.dustIntensity);
  const climate = Math.max(rainIntensity, dustIntensity * 0.5);
  const wind = 0.25 + dustIntensity * 0.5 + rainIntensity * 0.2;

  // ---- Ground tile with matching heights ----
  const groundGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      WORLD_CHUNK_SIZE,
      WORLD_CHUNK_SIZE,
      SEGMENTS,
      SEGMENTS,
    );
    const pos = geo.attributes.position;
    if (!pos) return geo;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const wx = origin.x + WORLD_CHUNK_SIZE * 0.5 + lx;
      const wz = origin.z + WORLD_CHUNK_SIZE * 0.5 + ly;
      pos.setZ(i, sampleHeight(wx, wz));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [chunk.cx, chunk.cz, origin.x, origin.z]);

  const groundColor = useMemo(() => {
    const [r, g, b] = sampleGroundColor(centre.x, centre.z);
    const wet = 1 - rainIntensity * 0.25;
    const dust = dustIntensity * 0.15;
    return new THREE.Color(
      r * wet + dust * 0.15,
      g * wet + dust * 0.12,
      b * wet + dust * 0.08,
    );
  }, [centre.x, centre.z, rainIntensity, dustIntensity]);

  // ---- Settlement layout (compounds, not random single huts) ----
  const settlement = useMemo(() => {
    if (region !== "OUTER_SETTLEMENT" && region !== "PLATEAU" && region !== "SAVANNAH") {
      if (seeded(chunk.cx * 17 + chunk.cz, 40) <= 0.92) {
        return null;
      }
    }
    const chance = region === "OUTER_SETTLEMENT" ? 0.85 : 0.12;
    if (seeded(chunk.cx * 13 + chunk.cz * 7, 41) > chance) return null;

    const hutCount =
      region === "OUTER_SETTLEMENT"
        ? 3 + Math.floor(seeded(chunk.cx + chunk.cz, 42) * 4)
        : 2 + Math.floor(seeded(chunk.cx + chunk.cz, 42) * 2);

    const cx = centre.x + (seeded(chunk.cx, 43) - 0.5) * 30;
    const cz = centre.z + (seeded(chunk.cz, 44) - 0.5) * 30;
    const huts: {
      x: number;
      y: number;
      z: number;
      rot: number;
      scale: number;
      kind: "bhunga" | "mud";
    }[] = [];

    for (let i = 0; i < hutCount; i++) {
      const angle = (i / hutCount) * Math.PI * 2 + seeded(i, 45) * 0.4;
      const dist = 4 + seeded(i, 46) * 5 + (hutCount > 4 ? 2 : 0);
      const hx = cx + Math.cos(angle) * dist;
      const hz = cz + Math.sin(angle) * dist;
      huts.push({
        x: hx,
        y: sampleHeight(hx, hz),
        z: hz,
        rot: angle + Math.PI + (seeded(i, 47) - 0.5) * 0.5,
        scale: 0.85 + seeded(i, 48) * 0.35,
        kind: seeded(i, 49) > 0.4 ? "bhunga" : "mud",
      });
    }

    // People near the hearth / yard (detailed anatomy bodies)
    const peopleCount = 1 + Math.floor(seeded(chunk.cx + chunk.cz, 55) * 3);
    const skinTones = ["#5c3317", "#6b4423", "#8d5524", "#a0673f", "#c68642"];
    const people: {
      x: number;
      y: number;
      z: number;
      rot: number;
      gender: "male" | "female";
      skin: string;
      height: number;
    }[] = [];
    for (let i = 0; i < peopleCount; i++) {
      const a = seeded(i, 56) * Math.PI * 2;
      const d = 1.5 + seeded(i, 57) * 3.5;
      const px = cx + Math.cos(a) * d;
      const pz = cz + Math.sin(a) * d;
      people.push({
        x: px,
        y: sampleHeight(px, pz),
        z: pz,
        rot: a + Math.PI + (seeded(i, 58) - 0.5),
        gender: seeded(i, 59) > 0.5 ? "female" : "male",
        skin: skinTones[Math.floor(seeded(i, 60) * skinTones.length)]!,
        height: 1.55 + seeded(i, 61) * 0.25,
      });
    }

    return {
      huts,
      hearth: {
        x: cx,
        y: sampleHeight(cx, cz),
        z: cz,
      },
      yard: { x: cx, y: sampleHeight(cx, cz) + 0.02, z: cz, r: 6 + hutCount * 0.8 },
      people,
    };
  }, [region, centre.x, centre.z, chunk.cx, chunk.cz]);

  // ---- Layered trees ----
  const trees = useMemo(() => {
    const base = region === "RAINFOREST" ? 22 : region === "SAVANNAH" ? 6 : 12;
    const count = Math.floor((base + density * 20) * densityScale);
    const out: {
      x: number;
      y: number;
      z: number;
      trunkH: number;
      canopyR: number;
      lean: number;
      rot: number;
      variant: number;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const lx = (seeded(i, 1) - 0.5) * WORLD_CHUNK_SIZE * 0.9;
      const lz = (seeded(i, 2) - 0.5) * WORLD_CHUNK_SIZE * 0.9;
      const wx = centre.x + lx;
      const wz = centre.z + lz;
      if (
        settlement &&
        Math.hypot(wx - settlement.yard.x, wz - settlement.yard.z) < settlement.yard.r + 2
      ) {
        continue;
      }
      out.push({
        x: wx,
        y: sampleHeight(wx, wz),
        z: wz,
        trunkH: region === "RAINFOREST" ? 5 + seeded(i, 3) * 4 : 3.2 + seeded(i, 3) * 2.8,
        canopyR: region === "RAINFOREST" ? 1.6 + seeded(i, 4) * 1.4 : 1.1 + seeded(i, 4) * 0.9,
        lean: (seeded(i, 5) - 0.5) * 0.18,
        rot: seeded(i, 6) * Math.PI * 2,
        variant: Math.floor(seeded(i, 7) * 3),
      });
    }
    return out;
  }, [centre.x, centre.z, density, densityScale, region, settlement]);

  // ---- Creatures (region-aware) — meshes live in Creatures.tsx ----
  const animals = useMemo(() => {
    const count = Math.floor(2 + density * 7 * densityScale);
    const kinds: CreatureKind[] =
      region === "SAVANNAH"
        ? ["goat", "goat", "sheep", "cow", "dog", "antelope", "antelope"]
        : region === "HILLS"
          ? ["goat", "goat", "sheep", "antelope"]
          : region === "RAINFOREST"
            ? ["pig", "pig", "cat"]
            : region === "RIVERINE" || region === "COASTAL"
              ? ["goat", "pig", "dog", "cat"]
              : ["goat", "sheep", "dog", "cow", "pig", "cat"];
    const out: {
      x: number;
      y: number;
      z: number;
      phase: number;
      scale: number;
      kind: CreatureKind;
    }[] = [];
    for (let i = 0; i < count; i++) {
      const lx = (seeded(i, 60) - 0.5) * WORLD_CHUNK_SIZE * 0.7;
      const lz = (seeded(i, 61) - 0.5) * WORLD_CHUNK_SIZE * 0.7;
      const wx = centre.x + lx;
      const wz = centre.z + lz;
      const kind = kinds[Math.floor(seeded(i, 64) * kinds.length)]!;
      const scaleMap: Record<CreatureKind, number> = {
        cow: 1.15 + seeded(i, 63) * 0.25,
        antelope: 0.95 + seeded(i, 63) * 0.2,
        pig: 0.65 + seeded(i, 63) * 0.2,
        dog: 0.55 + seeded(i, 63) * 0.2,
        cat: 0.4 + seeded(i, 63) * 0.15,
        goat: 0.75 + seeded(i, 63) * 0.3,
        sheep: 0.8 + seeded(i, 63) * 0.25,
      };
      out.push({
        x: wx,
        y: sampleHeight(wx, wz),
        z: wz,
        phase: seeded(i, 62) * Math.PI * 2,
        scale: scaleMap[kind],
        kind,
      });
    }
    return out;
  }, [centre.x, centre.z, density, densityScale, region]);

  // ---- Chickens, ducks near water/settlements + herons + flying birds ----
  const birds = useMemo(() => {
    const out: {
      x: number;
      y: number;
      z: number;
      phase: number;
      kind: "chicken" | "duck" | "heron" | "flyer";
    }[] = [];
    if (settlement) {
      const count = 5 + Math.floor(seeded(chunk.cx + chunk.cz, 70) * 6);
      for (let i = 0; i < count; i++) {
        const a = seeded(i, 71) * Math.PI * 2;
        const d = 2 + seeded(i, 72) * 6;
        const wx = settlement.yard.x + Math.cos(a) * d;
        const wz = settlement.yard.z + Math.sin(a) * d;
        out.push({
          x: wx,
          y: sampleHeight(wx, wz),
          z: wz,
          phase: seeded(i, 73) * Math.PI * 2,
          kind: seeded(i, 74) > 0.75 ? "duck" : "chicken",
        });
      }
    }
    // Ducks / herons in riverine & coastal
    if (region === "RIVERINE" || region === "COASTAL") {
      const wCount = 3 + Math.floor(seeded(chunk.cx + chunk.cz, 76) * 4);
      for (let i = 0; i < wCount; i++) {
        const wx = centre.x + (seeded(i, 77) - 0.5) * 50;
        const wz = centre.z + (seeded(i, 78) - 0.5) * 50;
        out.push({
          x: wx,
          y: sampleHeight(wx, wz),
          z: wz,
          phase: seeded(i, 79) * Math.PI * 2,
          kind: seeded(i, 80) > 0.45 ? "heron" : "duck",
        });
      }
    }
    // Flying birds overhead
    if (region !== "RAINFOREST") {
      const flyCount = 2 + Math.floor(seeded(chunk.cx * 3 + chunk.cz, 81) * 3);
      for (let i = 0; i < flyCount; i++) {
        out.push({
          x: centre.x + (seeded(i, 82) - 0.5) * 40,
          y: 8 + seeded(i, 83) * 10,
          z: centre.z + (seeded(i, 84) - 0.5) * 40,
          phase: seeded(i, 85) * Math.PI * 2,
          kind: "flyer",
        });
      }
    }
    return out;
  }, [settlement, chunk.cx, chunk.cz, centre.x, centre.z, region]);

  // ---- Bushes ----
  const bushes = useMemo(() => {
    const count = Math.floor(8 + density * 18 * densityScale);
    const out: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    for (let i = 0; i < count; i++) {
      const lx = (seeded(i, 10) - 0.5) * WORLD_CHUNK_SIZE * 0.88;
      const lz = (seeded(i, 11) - 0.5) * WORLD_CHUNK_SIZE * 0.88;
      const wx = centre.x + lx;
      const wz = centre.z + lz;
      out.push({
        x: wx,
        y: sampleHeight(wx, wz),
        z: wz,
        s: 0.5 + seeded(i, 12) * 0.7,
        rot: seeded(i, 13) * Math.PI * 2,
      });
    }
    return out;
  }, [centre.x, centre.z, density, densityScale]);

  return (
    <group>
      <mesh
        geometry={groundGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centre.x, 0, centre.z]}
        receiveShadow
      >
        <meshStandardMaterial color={groundColor} roughness={0.92} metalness={0.02} />
      </mesh>

      {settlement && (
        <group>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[settlement.yard.x, settlement.yard.y, settlement.yard.z]}
            receiveShadow
          >
            <circleGeometry args={[settlement.yard.r, 24]} />
            <meshStandardMaterial color={SCENE_PALETTE.dirtLight} roughness={1} />
          </mesh>
          {settlement.huts.map((h, i) =>
            h.kind === "bhunga" ? (
              <BhungaHut
                key={i}
                position={[h.x, h.y, h.z]}
                rotation={h.rot}
                scale={h.scale}
                climateIntensity={climate}
                windIntensity={wind}
              />
            ) : (
              <MudHut
                key={i}
                position={[h.x, h.y, h.z]}
                rotation={h.rot}
                scale={h.scale}
                climateIntensity={climate}
                windIntensity={wind}
              />
            ),
          )}
          <VillageHearth position={[settlement.hearth.x, settlement.hearth.y, settlement.hearth.z]} />
          {settlement.people.map((p, i) => (
            <AnatomyVillager
              key={`p${i}`}
              gender={p.gender}
              position={[p.x, p.y, p.z]}
              rotationY={p.rot}
              skinColor={p.skin}
              height={p.height}
            />
          ))}
        </group>
      )}

      {trees.map((t, i) => (
        <Tree
          key={i}
          x={t.x}
          y={t.y}
          z={t.z}
          trunkH={t.trunkH}
          canopyR={t.canopyR}
          lean={t.lean}
          rot={t.rot}
          variant={t.variant}
          rainforest={region === "RAINFOREST"}
        />
      ))}

      {bushes.map((b, i) => (
        <group key={`b${i}`} position={[b.x, b.y, b.z]} rotation={[0, b.rot, 0]}>
          <mesh position={[0, 0.35 * b.s, 0]} castShadow>
            <sphereGeometry args={[0.5 * b.s, 6, 5]} />
            <meshStandardMaterial color="#2a5a28" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.25 * b.s, 0.28 * b.s, 0.15 * b.s]} castShadow>
            <sphereGeometry args={[0.32 * b.s, 5, 4]} />
            <meshStandardMaterial color="#1e4a22" roughness={1} flatShading />
          </mesh>
        </group>
      ))}

      {animals.map((a, i) => (
        <Creature key={`a${i}`} {...a} />
      ))}

      {birds.map((b, i) => {
        if (b.kind === "chicken") {
          return <Chicken key={`br${i}`} x={b.x} y={b.y} z={b.z} phase={b.phase} />;
        }
        if (b.kind === "duck") {
          return <Duck key={`du${i}`} x={b.x} y={b.y} z={b.z} phase={b.phase} />;
        }
        if (b.kind === "heron") {
          return <Heron key={`he${i}`} x={b.x} y={b.y} z={b.z} phase={b.phase} />;
        }
        return <FlyingBird key={`fl${i}`} x={b.x} y={b.y} z={b.z} phase={b.phase} />;
      })}

      {/* Mushrooms, shells, paw prints, butterflies, beetles, feathers */}
      <ChunkOrganicDetail cx={centre.x} cz={centre.z} densityScale={densityScale} />
    </group>
  );
}

function Tree({
  x,
  y,
  z,
  trunkH,
  canopyR,
  lean,
  rot,
  variant,
  rainforest,
}: {
  x: number;
  y: number;
  z: number;
  trunkH: number;
  canopyR: number;
  lean: number;
  rot: number;
  variant: number;
  rainforest: boolean;
}) {
  const canopy = rainforest
    ? "#0c3420"
    : variant === 0
      ? "#1a5c32"
      : variant === 1
        ? "#246b38"
        : "#2d7a40";
  const canopyDark = rainforest ? "#082818" : "#143d24";

  return (
    <group position={[x, y, z]} rotation={[lean, rot, 0]}>
      <mesh position={[0, trunkH * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, trunkH * 0.8, 6]} />
        <meshStandardMaterial color={SCENE_PALETTE.woodDark} roughness={1} />
      </mesh>
      <mesh position={[0, trunkH * 0.85, 0]} castShadow>
        <sphereGeometry args={[canopyR, 7, 6]} />
        <meshStandardMaterial color={canopy} roughness={1} flatShading />
      </mesh>
      <mesh position={[canopyR * 0.35, trunkH * 0.95, canopyR * 0.2]} castShadow>
        <sphereGeometry args={[canopyR * 0.65, 6, 5]} />
        <meshStandardMaterial color={canopyDark} roughness={1} flatShading />
      </mesh>
      {rainforest && (
        <mesh position={[-canopyR * 0.25, trunkH * 0.78, -canopyR * 0.15]} castShadow>
          <sphereGeometry args={[canopyR * 0.5, 5, 4]} />
          <meshStandardMaterial color={canopyDark} roughness={1} flatShading />
        </mesh>
      )}
    </group>
  );
}
