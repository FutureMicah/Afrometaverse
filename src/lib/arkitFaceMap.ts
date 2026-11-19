/**
 * ARKit-style blendshape mapping for AfroMetaverse.
 * Ready for a morph-target hero face GLB; also lists channels
 * used by the procedural face proxy (jaw / blink groups).
 */

/** Standard ARKit face shape names (subset + full list). */
export const ARKIT_SHAPES = [
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "eyeWideLeft",
  "eyeWideRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "noseSneerLeft",
  "noseSneerRight",
  "jawForward",
  "jawLeft",
  "jawRight",
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthLeft",
  "mouthRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "tongueOut",
] as const;

export type ArkitShape = (typeof ARKIT_SHAPES)[number];

/** Priority channels for stylized / low-shape faces */
export const ARKIT_PRIORITY: ArkitShape[] = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "jawOpen",
  "mouthSmileLeft",
  "mouthSmileRight",
  "browInnerUp",
  "browDownLeft",
  "browDownRight",
  "eyeWideLeft",
  "eyeWideRight",
  "mouthFrownLeft",
  "mouthFrownRight",
];

/**
 * Map ARKit channel → morph target name on our hero mesh.
 * Adjust values when the face GLB ships.
 */
export const ARKIT_TO_MORPH: Partial<Record<ArkitShape, string>> = {
  eyeBlinkLeft: "blink_L",
  eyeBlinkRight: "blink_R",
  jawOpen: "jawOpen",
  mouthSmileLeft: "smile_L",
  mouthSmileRight: "smile_R",
  mouthFrownLeft: "frown_L",
  mouthFrownRight: "frown_R",
  browInnerUp: "browUp",
  browDownLeft: "browDown_L",
  browDownRight: "browDown_R",
  eyeWideLeft: "wide_L",
  eyeWideRight: "wide_R",
  mouthPucker: "pucker",
  cheekPuff: "cheekPuff",
  tongueOut: "tongueOut",
};

export type ArkitWeights = Partial<Record<ArkitShape, number>>;

/** Smoothstep 0..1 */
export function remapWeight(raw: number, soft = 0.05, hard = 0.9): number {
  const x = Math.min(1, Math.max(0, (raw - soft) / (hard - soft || 1e-5)));
  return x * x * (3 - 2 * x);
}

/**
 * Apply ARKit-style weights onto a Three.js morph mesh.
 * no-op if morph targets missing.
 */
export function applyArkitWeights(
  mesh: { morphTargetDictionary?: Record<string, number> | undefined; morphTargetInfluences?: number[] | undefined },
  shapes: ArkitWeights,
  map: Partial<Record<ArkitShape, string>> = ARKIT_TO_MORPH,
): void {
  const dict = mesh.morphTargetDictionary;
  const inf = mesh.morphTargetInfluences;
  if (!dict || !inf) return;

  for (const [arkit, morph] of Object.entries(map) as [ArkitShape, string][]) {
    const idx = dict[morph];
    if (idx == null) continue;
    const raw = shapes[arkit] ?? 0;
    inf[idx] = remapWeight(raw);
  }

  // Simple antagonist: jawOpen vs mouthClose
  const jawIdx = dict["jawOpen"];
  if (jawIdx != null && shapes.mouthClose != null) {
    inf[jawIdx] = Math.max(0, (inf[jawIdx] ?? 0) - remapWeight(shapes.mouthClose));
  }
}

/**
 * Collapse ARKit channels into a tiny procedural proxy
 * (for StylizedCharacter jaw / lid groups — no morph mesh required).
 */
export function arkitToProxy(shapes: ArkitWeights): {
  blinkL: number;
  blinkR: number;
  jawOpen: number;
  browUp: number;
  smile: number;
} {
  return {
    blinkL: remapWeight(shapes.eyeBlinkLeft ?? 0),
    blinkR: remapWeight(shapes.eyeBlinkRight ?? 0),
    jawOpen: remapWeight(shapes.jawOpen ?? 0),
    browUp: remapWeight(shapes.browInnerUp ?? 0),
    smile:
      (remapWeight(shapes.mouthSmileLeft ?? 0) + remapWeight(shapes.mouthSmileRight ?? 0)) * 0.5,
  };
}

/** Seeded idle proxy — asymmetric blink phase for procedural faces */
export function idleFaceProxy(t: number, seed: number): {
  blinkL: number;
  blinkR: number;
  jawOpen: number;
  browUp: number;
} {
  const blinkCycle = 4.2 + (seed % 5) * 0.35;
  const phase = t + seed * 0.17;
  // blink pulse ~every blinkCycle seconds, duration ~0.12s
  const blinkT = ((phase % blinkCycle) / blinkCycle) * blinkCycle;
  const pulse = blinkT < 0.14 ? Math.sin((blinkT / 0.14) * Math.PI) : 0;
  const lag = 0.04 + (seed % 3) * 0.02;
  const blinkT2 = (((phase + lag) % blinkCycle) / blinkCycle) * blinkCycle;
  const pulseR = blinkT2 < 0.14 ? Math.sin((blinkT2 / 0.14) * Math.PI) : 0;
  return {
    blinkL: pulse,
    blinkR: pulseR,
    jawOpen: 0,
    browUp: Math.sin(t * 0.3 + seed) * 0.08,
  };
}
