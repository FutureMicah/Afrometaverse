import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterAppearance } from "@/stores/characterStore";
import type { WardrobeTier } from "@/lib/characterWardrobe";
import { StylizedCharacter } from "./StylizedCharacter";

/**
 * Female fighter as a rigged GLB (Mixamo-named skeleton, idle/walk/run clips).
 * Only the female warrior tier uses it. Every other tier keeps StylizedCharacter.
 * The stylised figure is shown while the GLB downloads and if the load fails, so the scene is never blank.
 */

// Harper CC0 base (Innerscene), repainted to the fighter spec and draco-compressed; ~1.7m, Idle_Standing clip.
export const FIGHTER_GLB_URL = "/models/characters/fighter-harper.glb";
const DRACO_PATH = "/draco/";

export function usesFighterGLB(appearance: CharacterAppearance, tier: WardrobeTier): boolean {
  return appearance.gender === "female" && tier === "warrior";
}

type MoveState = "idle" | "walk" | "run" | "ride";

type Props = {
  appearance: CharacterAppearance;
  tier: WardrobeTier;
  scale?: number;
  animate?: boolean;
  detail?: boolean | undefined;
  moveState?: MoveState;
};

type Loaded = { scene: THREE.Group; clips: THREE.AnimationClip[] };

// Procedural woven-cloth normal map (aso oke / adire weave), built once and shared.
// The GLB ships with base colour only, so without this the cloth reads as flat plastic.
let weaveNormal: THREE.CanvasTexture | null = null;
function getWeaveNormal(): THREE.CanvasTexture {
  if (weaveNormal) return weaveNormal;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return (weaveNormal = new THREE.CanvasTexture(c));
  const img = ctx.createImageData(size, size);
  // height field: crossing warp/weft threads with a slight fray noise
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const thread = Math.abs(Math.sin(x * Math.PI * 2 * 16 / size)) * 0.6 + Math.abs(Math.sin(y * Math.PI * 2 * 16 / size)) * 0.6;
      const over = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0 ? 1 : 0.7;
      h[y * size + x] = thread * over + (Math.random() - 0.5) * 0.12;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)]!;
      const r = h[y * size + ((x + 1) % size)]!;
      const u = h[((y - 1 + size) % size) * size + x]!;
      const d = h[((y + 1) % size) * size + x]!;
      const nx = (l - r) * 2.2;
      const ny = (u - d) * 2.2;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  weaveNormal = tex;
  return tex;
}

/**
 * Raise the GLB's materials to a PBR cloth/leather/skin look:
 * shadows on, environment reflections on, cloth weave normal map, sensible roughness.
 */
function dressFighterMaterials(root: THREE.Object3D) {
  const normal = getWeaveNormal();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Skinned primitives are culled against their rest-pose bounds, which hides hair and
    // other parts once they bend with the animation. Keep every skinned part drawn.
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || !("roughness" in m)) continue;
      m.envMapIntensity = 0.8;
      // sharper texture sampling at close range: the GLB ships small (256-512px) maps,
      // so max anisotropy keeps braids and wrap patterns from going to mush when the camera is near
      for (const tex of [m.map, m.normalMap, m.roughnessMap]) {
        if (tex) tex.anisotropy = 8;
      }
      const n = (m.name || "").toLowerCase();
      if (n.includes("skirt") || n.includes("wrap") || n.includes("cloth") || n.includes("adire")) {
        // woven cloth: matte, with a soft sheen at grazing angles
        m.roughness = Math.max(m.roughness ?? 0.8, 0.85);
        m.metalness = 0;
        if (!m.normalMap) {
          m.normalMap = normal;
          m.normalScale = new THREE.Vector2(0.35, 0.35);
        }
      } else if (n.includes("belt") || n.includes("leather")) {
        m.roughness = 0.5;
        m.metalness = 0;
        if (!m.normalMap) {
          m.normalMap = normal;
          m.normalScale = new THREE.Vector2(0.2, 0.2);
        }
      }
      m.needsUpdate = true;
    }
  });
}

// one shared download for every instance; reset on failure so the next mount retries
let loadPromise: Promise<Loaded> | null = null;
function getFighter(): Promise<Loaded> {
  if (!loadPromise) {
    loadPromise = new Promise<Loaded>((resolve, reject) => {
      const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader().setDRACOLoader(draco);
      loader.load(
        FIGHTER_GLB_URL,
        (gltf) => resolve({ scene: gltf.scene, clips: gltf.animations }),
        undefined,
        reject,
      );
    }).catch((e) => {
      loadPromise = null;
      throw e;
    });
  }
  return loadPromise;
}

function FighterModel({ loaded, moveState, animate, scale }: { loaded: Loaded; moveState: MoveState; animate: boolean; scale: number }) {
  const holder = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});

  // each character gets its own skinned clone and mixer; geometry and materials stay shared
  useEffect(() => {
    // Plain Object3D.clone() makes SkinnedMesh copies that still point at the SOURCE skeleton,
    // so every clone skins against bones that never move (the collapsed blob). SkeletonUtils.clone
    // rebuilds the bone hierarchy and rebinds each skinned mesh to its own copy.
    const clone = SkeletonUtils.clone(loaded.scene) as THREE.Group;
    dressFighterMaterials(clone);
    const mixer = new THREE.AnimationMixer(clone);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of loaded.clips) actions[c.name] = mixer.clipAction(c, clone);
    // Put the rest pose on the bones straight away (idle frame 0) so the figure never shows bind/T-pose.
    actions["idle"]?.play();
    mixer.update(0);
    mixerRef.current = mixer;
    actionsRef.current = actions;
    holder.current?.add(clone);
    return () => {
      mixer.stopAllAction();
      holder.current?.remove(clone);
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [loaded]);

  useEffect(() => {
    if (!animate) return;
    const key = moveState === "run" ? "run" : moveState === "walk" ? "walk" : "idle";
    const next = actionsRef.current[key] ?? actionsRef.current["idle"];
    if (!next) return;
    for (const [k, a] of Object.entries(actionsRef.current)) if (a !== next && k !== key) a.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
  }, [moveState, animate, loaded]);

  useFrame((_, dt) => mixerRef.current?.update(dt));

  return <group ref={holder} scale={scale} />;
}

export function FighterGLB({ appearance, tier, scale = 1, animate = true, detail, moveState = "idle" }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // one silent retry before giving up, so a flaky mobile connection doesn't drop to the mannequin
    const attempt = (n: number) =>
      getFighter()
        .then((l) => {
          if (alive) setLoaded(l);
        })
        .catch(() => {
          if (!alive) return;
          if (n < 1) attempt(n + 1);
          else setFailed(true);
        });
    attempt(0);
    return () => {
      alive = false;
    };
  }, []);

  // while the GLB is still downloading show nothing (the scene loads in place); the mannequin only
  // appears if the model genuinely fails twice.
  if (!loaded && !failed) return null;
  if (failed || !loaded) {
    return <StylizedCharacter appearance={appearance} tier={tier} scale={scale} animate={animate} detail={detail ?? false} moveState={moveState} />;
  }
  return <FighterModel loaded={loaded} moveState={moveState} animate={animate} scale={scale} />;
}
