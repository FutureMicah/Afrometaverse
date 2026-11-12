/**
 * Mixamo animation retargeting helpers for AfroMetaverse.
 *
 * Mixamo bones use the prefix `mixamorig:` (e.g. mixamorig:Hips).
 * When loading clips from one GLB onto another Mixamo-compatible skeleton,
 * bone names usually match 1:1 — no retarget needed.
 *
 * When skeletons differ (custom / Quaternius / KayKit), use the bone map
 * below or build one from a name-similarity pass.
 */

import * as THREE from "three";

/** Canonical Mixamo humanoid bone names (without mixamorig: prefix variants). */
export const MIXAMO_BONES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
] as const;

export type MixamoBone = (typeof MIXAMO_BONES)[number];

/** Strip common prefixes so "mixamorig:Hips" and "Hips" compare equal. */
export function normalizeBoneName(name: string): string {
  return name
    .replace(/^mixamorig[:_]?/i, "")
    .replace(/^mixamo[:_]?/i, "")
    .replace(/^Armature\|/i, "")
    .replace(/^Bone\.?/i, "")
    .trim();
}

/**
 * Build a map: sourceClipTrackBone → targetSkeletonBoneName
 * Returns only bones that exist on the target.
 */
export function buildBoneMap(
  sourceBoneNames: string[],
  targetBoneNames: string[],
): Map<string, string> {
  const targetByNorm = new Map<string, string>();
  for (const t of targetBoneNames) {
    targetByNorm.set(normalizeBoneName(t).toLowerCase(), t);
  }
  const map = new Map<string, string>();
  for (const s of sourceBoneNames) {
    const hit = targetByNorm.get(normalizeBoneName(s).toLowerCase());
    if (hit) map.set(s, hit);
  }
  return map;
}

/**
 * Retarget an AnimationClip so track names match the target skeleton.
 * Only Quaternion / Vector keyframe tracks on bones are rewritten.
 * Safe no-op when bone names already match.
 */
export function retargetClip(
  clip: THREE.AnimationClip,
  boneMap: Map<string, string>,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    // Tracks look like "mixamorig:Hips.quaternion" or "Hips.position"
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) {
      tracks.push(track);
      continue;
    }
    const bonePath = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    // Handle nested paths "Armature/mixamorig:Hips.quaternion"
    const parts = bonePath.split(/[/|]/);
    const leaf = parts[parts.length - 1] ?? bonePath;
    const mapped = boneMap.get(leaf) ?? boneMap.get(bonePath);
    if (!mapped) {
      // Keep unmapped tracks only if they look non-bone (morph targets etc.)
      if (prop === "morphTargetInfluences") tracks.push(track);
      continue;
    }
    const newName = `${mapped}.${prop}`;
    const clone = track.clone();
    clone.name = newName;
    tracks.push(clone);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

/**
 * Collect bone names from a skinned scene root.
 */
export function collectBoneNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) names.push(o.name);
  });
  return names;
}

/**
 * Collect bone names referenced by animation tracks.
 */
export function collectTrackBoneNames(clips: THREE.AnimationClip[]): string[] {
  const set = new Set<string>();
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      if (dot < 0) continue;
      const path = track.name.slice(0, dot);
      const leaf = path.split(/[/|]/).pop() ?? path;
      set.add(leaf);
    }
  }
  return [...set];
}

/**
 * Full pipeline: retarget all clips from a source GLTF onto a target root skeleton.
 */
export function retargetClipsToSkeleton(
  clips: THREE.AnimationClip[],
  targetRoot: THREE.Object3D,
): THREE.AnimationClip[] {
  const targetBones = collectBoneNames(targetRoot);
  const sourceBones = collectTrackBoneNames(clips);
  const map = buildBoneMap(sourceBones, targetBones);
  return clips.map((c) => retargetClip(c, map));
}

/** Ragdoll body segments aligned to Mixamo hierarchy (for constraint setup). */
export type RagdollSegmentId =
  | "hips"
  | "spine"
  | "head"
  | "leftUpperArm"
  | "leftLowerArm"
  | "rightUpperArm"
  | "rightLowerArm"
  | "leftUpperLeg"
  | "leftLowerLeg"
  | "rightUpperLeg"
  | "rightLowerLeg";

export const RAGDOLL_BONE_MAP: Record<RagdollSegmentId, string[]> = {
  hips: ["Hips"],
  spine: ["Spine", "Spine1", "Spine2"],
  head: ["Neck", "Head"],
  leftUpperArm: ["LeftShoulder", "LeftArm"],
  leftLowerArm: ["LeftForeArm", "LeftHand"],
  rightUpperArm: ["RightShoulder", "RightArm"],
  rightLowerArm: ["RightForeArm", "RightHand"],
  leftUpperLeg: ["LeftUpLeg"],
  leftLowerLeg: ["LeftLeg", "LeftFoot"],
  rightUpperLeg: ["RightUpLeg"],
  rightLowerLeg: ["RightLeg", "RightFoot"],
};

/** Parent segment for joint constraints (child → parent). */
export const RAGDOLL_HIERARCHY: { child: RagdollSegmentId; parent: RagdollSegmentId }[] = [
  { child: "spine", parent: "hips" },
  { child: "head", parent: "spine" },
  { child: "leftUpperArm", parent: "spine" },
  { child: "leftLowerArm", parent: "leftUpperArm" },
  { child: "rightUpperArm", parent: "spine" },
  { child: "rightLowerArm", parent: "rightUpperArm" },
  { child: "leftUpperLeg", parent: "hips" },
  { child: "leftLowerLeg", parent: "leftUpperLeg" },
  { child: "rightUpperLeg", parent: "hips" },
  { child: "rightLowerLeg", parent: "rightUpperLeg" },
];
