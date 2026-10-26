import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { CharacterAppearance } from "@/stores/characterStore";
import type { WardrobeTier } from "@/lib/characterWardrobe";
import { StylizedCharacter } from "./StylizedCharacter";

/**
 * Female fighter as a rigged GLB (Mixamo-named skeleton, idle/walk/run clips).
 * Only the female warrior tier uses it. Every other tier keeps StylizedCharacter.
 * The stylised figure is shown while the GLB downloads and if the load fails, so the scene is never blank.
 */

export const FIGHTER_GLB_URL = "/models/characters/female-fighter.glb";
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
    const clone = loaded.scene.clone(true);
    const mixer = new THREE.AnimationMixer(clone);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of loaded.clips) actions[c.name] = mixer.clipAction(c, clone);
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
    getFighter()
      .then((l) => {
        if (alive) setLoaded(l);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed || !loaded) {
    return <StylizedCharacter appearance={appearance} tier={tier} scale={scale} animate={animate} detail={detail ?? false} moveState={moveState} />;
  }
  return <FighterModel loaded={loaded} moveState={moveState} animate={animate} scale={scale} />;
}
