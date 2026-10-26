import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterAppearance, EquippedLoadout } from "@/stores/characterStore";
import {
  wardrobeFor,
  type GarmentSpec,
  type WardrobeTier,
} from "@/lib/characterWardrobe";
import { clothMaterial, skinMaterial } from "@/lib/clothTexture";

/**
 * Procedural character rig, phase 1 of the art rebuild.
 *
 * Proportions are in metres for a 1.8u figure (feet at y=0, crown near y=1.78). The head is a
 * sculpted sphere (brow, cheekbones, jaw, eye sockets) with nose, lips, ears and eyes as separate
 * shaped meshes. Hands have palm and finger segments. The rig is a joint hierarchy (hips, knees,
 * shoulders, elbows, neck) so the walk cycle bends the knee instead of swinging a block.
 *
 * Clothing is built from the wardrobe tier (characterWardrobe.ts) as cloth layers that sit just
 * outside the body, with woven PBR materials from clothTexture.ts. The `equipped` prop is kept for
 * call-site compatibility and is not drawn; wardrobe is driven by `tier`.
 */

type Props = {
  appearance: CharacterAppearance;
  /** Legacy catalog loadout. Accepted for compatibility, not drawn (wardrobe comes from `tier`). */
  equipped?: EquippedLoadout;
  tier?: WardrobeTier;
  scale?: number;
  animate?: boolean;
  detail?: boolean;
  /** idle | walk | run | ride: drives the limb cycles */
  moveState?: "idle" | "walk" | "run" | "ride";
};

// ---- shared geometry (built once) -------------------------------------------------------------

const HEAD_R = 0.115;

/** Sculpted head: a sphere pushed into a face profile. Unit radius; scaled by HEAD_R at use. */
const headGeoCache = new Map<"male" | "female", THREE.BufferGeometry>();
function headGeometry(gender: "male" | "female"): THREE.BufferGeometry {
  const hit = headGeoCache.get(gender);
  if (hit) return hit;
  const g = new THREE.SphereGeometry(1, 48, 36);
  const p = g.getAttribute("position");
  const male = gender === "male";
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    // taller skull
    y *= 1.12;
    // jaw taper below the cheekbones, chin narrows; men keep a squarer jaw
    if (y < -0.15) {
      const k = Math.min(1, (-0.15 - y) / 0.75);
      x *= 1 - k * (male ? 0.2 : 0.3);
      z *= 1 - k * 0.12;
    }
    // cheekbones: a soft widening at mid-face, stronger for women
    const cheek = Math.exp(-(((y + 0.02) / 0.3) ** 2));
    x *= 1 + cheek * (male ? 0.05 : 0.09);
    // brow ridge and eye sockets on the front
    if (z > 0) {
      const brow = Math.exp(-(((y - 0.2) / 0.11) ** 2));
      z += brow * 0.05 * z;
      const socket = Math.exp(-(((y - 0.02) / 0.12) ** 2)) * Math.exp(-((x / 0.7) ** 2));
      z -= socket * 0.03 * z;
    }
    // flatter forehead, rounder back of skull
    if (y > 0.45) z *= 0.94;
    if (z < 0) z *= 1.03;
    v.set(x, y, z);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  headGeoCache.set(gender, g);
  return g;
}

const beadGeo = new THREE.SphereGeometry(0.0085, 10, 8);
const fingerGeo = new THREE.CapsuleGeometry(0.0075, 0.035, 4, 8);
const eyeWhiteGeo = new THREE.SphereGeometry(1, 16, 12);
const irisGeo = new THREE.SphereGeometry(1, 14, 10);
const lidGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

function lipColor(skin: string) {
  return "#" + new THREE.Color(skin).multiplyScalar(0.72).getHexString();
}

/** Ring of N beads at radius r around the vertical axis, each at height y. */
function beadRing(count: number, r: number, y: number, bead: THREE.BufferGeometry, mat: THREE.Material, key: string) {
  return (
    <group key={key}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} geometry={bead} material={mat} position={[Math.sin(a) * r, y, Math.cos(a) * r]} castShadow />
        );
      })}
    </group>
  );
}

// ---- body parts -------------------------------------------------------------------------------

function Torso({ isFemale, shape, skin }: { isFemale: boolean; shape: CharacterAppearance["bodyShape"]; skin: string }) {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.001, 0.86),
      new THREE.Vector2(0.12, 0.88),
      new THREE.Vector2(0.155, 0.95),
      new THREE.Vector2(0.14, 1.03),
      new THREE.Vector2(0.125, 1.1),
      new THREE.Vector2(0.14, 1.18),
      new THREE.Vector2(0.158, 1.26),
      new THREE.Vector2(0.155, 1.34),
      new THREE.Vector2(0.125, 1.42),
      new THREE.Vector2(0.07, 1.47),
      new THREE.Vector2(0.05, 1.5),
    ];
    return new THREE.LatheGeometry(pts, 40);
  }, []);
  const sx = (isFemale ? 1.05 : 1.2) * (shape === "broad" ? 1.12 : shape === "slim" ? 0.88 : 1);
  const sz = isFemale ? 0.92 : 0.98;
  const hipW = isFemale ? (shape === "curvy" ? 1.32 : 1.15) : 1.02;
  return (
    <group>
      <mesh geometry={geo} material={skinMaterial(skin)} scale={[sx, 1, sz]} castShadow />
      {/* hips widen the pelvis */}
      <mesh position={[0, 0.93, 0]} scale={[0.17 * hipW, 0.08, 0.13 * hipW]} material={skinMaterial(skin)} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {/* chest volume: women get a subtle bust, men a pec plate */}
      <mesh position={[0, 1.24, 0.09]} scale={[isFemale ? 0.13 : 0.14, isFemale ? 0.09 : 0.07, isFemale ? 0.085 : 0.05]} material={skinMaterial(skin)} castShadow>
        <sphereGeometry args={[1, 22, 16]} />
      </mesh>
      {isFemale && (
        <>
          <mesh position={[-0.06, 1.23, 0.1]} scale={[0.06, 0.06, 0.06]} material={skinMaterial(skin)}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh position={[0.06, 1.23, 0.1]} scale={[0.06, 0.06, 0.06]} material={skinMaterial(skin)}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Limb({ r, len, skin, sway = 0 }: { r: number; len: number; skin: string; sway?: number }) {
  // capsule is centred on its origin; the group pivot sits at the top joint
  return (
    <mesh position={[0, -len / 2, 0]} rotation={[0, 0, sway]} castShadow material={skinMaterial(skin)}>
      <capsuleGeometry args={[r, Math.max(0.01, len - 2 * r), 8, 16]} />
    </mesh>
  );
}

function Hand({ skin, side }: { skin: string; side: 1 | -1 }) {
  const mat = skinMaterial(skin);
  return (
    <group position={[0, -0.09, 0]}>
      <mesh material={mat} scale={[0.034, 0.05, 0.02]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      {[-0.02, -0.007, 0.007, 0.02].map((x, i) => (
        <mesh key={i} geometry={fingerGeo} material={mat} position={[x, -0.055 - (i === 1 || i === 2 ? 0.004 : 0), 0]} castShadow />
      ))}
      <mesh geometry={fingerGeo} material={mat} position={[0.03 * side, -0.02, 0.01]} rotation={[0, 0, -0.5 * side]} castShadow />
    </group>
  );
}

function Foot({ skin }: { skin: string }) {
  return (
    <mesh position={[0, 0.02, 0.05]} material={skinMaterial(skin)} scale={[0.05, 0.035, 0.12]} castShadow>
      <sphereGeometry args={[1, 18, 12]} />
    </mesh>
  );
}

// ---- face -------------------------------------------------------------------------------------

function Face({ appearance }: { appearance: CharacterAppearance }) {
  const skin = appearance.skin;
  const isFemale = appearance.gender === "female";
  const head = headGeometry(appearance.gender);
  const skinM = skinMaterial(skin);
  const lipM = new THREE.MeshStandardMaterial({ color: lipColor(skin), roughness: 0.5 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: "#efe9dc", roughness: 0.25 });
  const iris = new THREE.MeshStandardMaterial({ color: appearance.eyeColor, roughness: 0.25 });
  const browM = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });

  // the eye line is at head centre, so eyes sit at y ~ 0.005 relative to the head
  const eyeX = 0.042;
  const eyeY = 0.01;
  const eyeZ = 0.094;
  const hooded = appearance.eyeShape === "hooded";
  const wide = appearance.eyeShape === "wide" || appearance.eyeShape === "round";
  const eyeSize = wide ? 0.0155 : hooded ? 0.012 : 0.0138;
  const noseW = appearance.noseShape === "wide" ? 0.036 : appearance.noseShape === "narrow" ? 0.022 : 0.029;
  const noseH = appearance.noseShape === "strong" ? 0.064 : 0.052;
  const noseZ = appearance.noseShape === "strong" ? 0.12 : 0.112;
  const lipW = appearance.lipShape === "full" ? 0.03 : appearance.lipShape === "thin" ? 0.022 : 0.026;
  const lipH = appearance.lipShape === "full" ? 0.0115 : appearance.lipShape === "thin" ? 0.0075 : 0.0095;
  const mouthY = -0.085 * 1.0;

  return (
    <group>
      {/* skull and face mass */}
      <mesh geometry={head} material={skinM} scale={[HEAD_R, HEAD_R, HEAD_R]} castShadow />
      {/* nose: bridge plus a broader base for West African noses */}
      <mesh position={[0, -0.012, noseZ - 0.008]} scale={[noseW * 0.6, noseH * 0.45, 0.028]} material={skinM} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh position={[0, -0.042, noseZ + 0.002]} scale={[noseW, 0.024, 0.024]} material={skinM} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh position={[-noseW * 0.5, -0.048, noseZ - 0.012]} scale={[0.012, 0.011, 0.014]} material={skinM}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh position={[noseW * 0.5, -0.048, noseZ - 0.012]} scale={[0.012, 0.011, 0.014]} material={skinM}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      {/* lips: fuller upper and lower lip */}
      <mesh position={[0, mouthY + 0.012, 0.104]} scale={[lipW * 0.9, lipH * 0.7, 0.012]} material={lipM} castShadow>
        <sphereGeometry args={[1, 18, 12]} />
      </mesh>
      <mesh position={[0, mouthY - 0.004, 0.104]} scale={[lipW, lipH, 0.014]} material={lipM} castShadow>
        <sphereGeometry args={[1, 18, 12]} />
      </mesh>
      {/* eyes: white, iris, lid */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * eyeX, eyeY, eyeZ]}>
          <mesh geometry={eyeWhiteGeo} material={eyeWhite} scale={[eyeSize * 1.35, eyeSize * 0.8, eyeSize * 0.45]} />
          <mesh geometry={irisGeo} material={iris} position={[0, 0, eyeSize * 0.22]} scale={[eyeSize * 0.52, eyeSize * 0.52, eyeSize * 0.4]} />
          <mesh geometry={lidGeo} material={skinM} position={[0, eyeSize * 0.12, 0.002]} rotation={[0.0, 0, 0]} scale={[eyeSize * 1.5, eyeSize * (hooded ? 0.92 : 0.7), eyeSize * 0.6]} />
          {/* brow */}
          <mesh position={[0, eyeSize * 1.9, 0.004]} scale={[eyeSize * 1.5, 0.0055 * appearance.browStrength + 0.002, 0.005]} material={browM}>
            <sphereGeometry args={[1, 14, 8]} />
          </mesh>
        </group>
      ))}
      {/* ears */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * HEAD_R * 0.98, -0.005, -0.005]}>
          <mesh scale={[0.014, 0.03, 0.02]} material={skinM} castShadow>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        </group>
      ))}
      {/* cheek marks and chin dimple as per appearance */}
      {appearance.faceMark === "cheek-mole" && (
        <mesh position={[0.075, -0.035, 0.1]} scale={[0.004, 0.004, 0.003]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#2a1a0f" />
        </mesh>
      )}
      {/* camwood hint is handled by the warrior garments, not the base face */}
      {isFemale ? null : <mesh position={[0, -0.085, 0.112]} scale={[0.008, 0.005, 0.005]} material={skinM} />}
    </group>
  );
}

// ---- hair -------------------------------------------------------------------------------------

function Hair({ style, color }: { style: CharacterAppearance["hair"]; color: string }) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color(color) }),
    [color],
  );
  const headY = 1.66;
  if (style === "bald") return null;
  if (style === "afro") {
    // clustered curls: a dome of spheres around the crown
    return (
      <group position={[0, headY + 0.02, -0.01]}>
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const ring = i % 3;
          const rr = 0.13 + ring * 0.03;
          const y = 0.05 + (ring * 0.035);
          return (
            <mesh key={i} material={mat} position={[Math.sin(a) * rr, y, Math.cos(a) * rr * 0.95]} castShadow>
              <sphereGeometry args={[0.045 + ring * 0.006, 10, 8]} />
            </mesh>
          );
        })}
        <mesh material={mat} position={[0, 0.1, 0]} scale={[0.14, 0.09, 0.14]} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
      </group>
    );
  }
  if (style === "braids" || style === "bun" || style === "long" || style === "bob" || style === "short") {
    const cap = (
      <mesh position={[0, headY + 0.045, -0.01]} material={mat} scale={[HEAD_R * 1.06, HEAD_R * 0.8, HEAD_R * 1.06]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
    );
    if (style === "short") return cap;
    if (style === "bun") {
      return (
        <group>
          {cap}
          <mesh position={[0, headY + 0.11, -0.085]} material={mat} scale={[0.05, 0.05, 0.05]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        </group>
      );
    }
    if (style === "bob") {
      return (
        <group>
          {cap}
          <mesh position={[0, headY - 0.03, -0.05]} material={mat} scale={[0.14, 0.12, 0.12]} castShadow>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
        </group>
      );
    }
    if (style === "long") {
      return (
        <group>
          {cap}
          <mesh position={[0, headY - 0.22, -0.07]} material={mat} scale={[0.13, 0.22, 0.09]} castShadow>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
        </group>
      );
    }
    // braids: cornrow ridges on the scalp plus hanging braid ropes
    const ropes = [-0.1, -0.05, 0, 0.05, 0.1];
    return (
      <group>
        {cap}
        {ropes.map((x, i) => (
          <mesh key={i} position={[x, headY - 0.06, -0.085]} material={mat} rotation={[0.1, 0, 0]} castShadow>
            <capsuleGeometry args={[0.012, 0.16, 6, 10]} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

// ---- garments ---------------------------------------------------------------------------------

/** Garments are cloth layers sitting just outside the body surface (radius * 1.08). */
function Garment({ g, kind }: { g: GarmentSpec; kind: GarmentSpec["kind"] }) {
  void kind;
  const mat = clothMaterial({ pattern: g.pattern, color: g.color, ...(g.accent ? { accent: g.accent } : {}) });
  const len = g.length === "ankle" ? 0.84 : g.length === "knee" ? 0.5 : 0.36;

  switch (g.kind) {
    case "tunic":
    case "wrap-top": {
      const shortSleeve = g.sleeves === "short";
      return (
        <group>
          <mesh material={mat} position={[0, 1.18, 0]} castShadow scale={[1.18, 1, 0.98]}>
            <cylinderGeometry args={[0.17, 0.14, 0.42, 28, 1, true]} />
          </mesh>
          {/* sleeves */}
          {g.sleeves !== "none" && (
            <>
              {[-1, 1].map((s) => (
                <mesh key={s} material={mat} position={[s * 0.25, 1.33, 0]} rotation={[0, 0, s * 0.35]} castShadow>
                  <capsuleGeometry args={[0.06, shortSleeve ? 0.06 : 0.22, 6, 12]} />
                </mesh>
              ))}
            </>
          )}
        </group>
      );
    }
    case "wrapper":
    case "loincloth": {
      const top = g.kind === "loincloth" ? 0.9 : 0.92;
      const bottom = top - len;
      const h = top - bottom;
      return (
        <group>
          <mesh position={[0, (top + bottom) / 2, 0]} castShadow material={mat}>
            <cylinderGeometry args={[0.178, 0.205, h, 36, 1, true]} />
          </mesh>
          {/* pleats */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.195, (top + bottom) / 2, Math.cos(a) * 0.195]} rotation={[0, a, 0]} material={mat}>
                <boxGeometry args={[0.012, h * 0.94, 0.02]} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "shoulder-cloth": {
      return (
        <mesh position={[0.03, 1.27, 0.11]} rotation={[0.3, 0.2, -0.65]} material={mat} castShadow>
          <boxGeometry args={[0.44, 0.09, 0.02]} />
        </mesh>
      );
    }
    case "armor-pads": {
      return (
        <group>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mat} position={[s * 0.22, 1.36, 0]} scale={[0.1, 0.07, 0.11]} castShadow>
              <sphereGeometry args={[1, 18, 12]} />
            </mesh>
          ))}
          <mesh material={mat} position={[0, 1.25, 0.1]} scale={[0.15, 0.13, 0.05]} castShadow>
            <sphereGeometry args={[1, 18, 12]} />
          </mesh>
        </group>
      );
    }
    case "hide-cape": {
      return (
        <mesh position={[0, 1.04, -0.09]} material={mat} castShadow>
          <boxGeometry args={[0.36, 0.56, 0.02]} />
        </mesh>
      );
    }
    case "raffia-skirt": {
      return (
        <group>
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.19, 0.74, Math.cos(a) * 0.19]} material={mat} castShadow>
                <cylinderGeometry args={[0.009, 0.007, 0.22, 4]} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "shield": {
      return (
        <mesh position={[-0.27, 1.02, 0.08]} rotation={[0, 0.4, 0]} material={mat} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.025, 28]} />
        </mesh>
      );
    }
    case "feather-crest": {
      return (
        <group position={[0, 1.8, -0.02]}>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[(i - 4) * 0.02, 0.02, -0.04 - Math.abs(i - 4) * 0.005]} rotation={[-0.2, 0, (i - 4) * 0.08]} material={mat} castShadow>
              <coneGeometry args={[0.012, 0.13, 6]} />
            </mesh>
          ))}
        </group>
      );
    }
    case "dagger": {
      return (
        <mesh position={[0.2, 0.9, 0.12]} rotation={[0.2, 0, -0.5]} material={mat} castShadow>
          <boxGeometry args={[0.012, 0.22, 0.02]} />
        </mesh>
      );
    }
    case "camwood-paint": {
      const m = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.9 });
      return (
        <group>
          {[-1, 1].map((s) =>
            [0, 1, 2].map((i) => (
              <mesh key={`${s}-${i}`} position={[s * 0.085, -0.025 + i * 0.022, 0.102]} rotation={[0, s * 0.5, 0]} material={m}>
                <boxGeometry args={[0.006, 0.012, 0.003]} />
              </mesh>
            )),
          )}
        </group>
      );
    }
    case "waist-beads": {
      const beads = g.strands ?? 1;
      const m = mat;
      return (
        <group>
          {Array.from({ length: beads }, (_, s) =>
            beadRing(30, 0.155 + s * 0.012, 0.96 - s * 0.01, beadGeo, m, `w${s}`),
          )}
        </group>
      );
    }
    case "neck-beads": {
      const strands = g.strands ?? 1;
      return (
        <group>
          {Array.from({ length: strands }, (_, s) =>
            beadRing(28, 0.075 + s * 0.012, 1.5 - s * 0.012, beadGeo, mat, `n${s}`),
          )}
        </group>
      );
    }
    case "braid-beads": {
      return (
        <group>
          {[-0.09, -0.04, 0.01, 0.06].map((x, i) => (
            <mesh key={i} geometry={beadGeo} material={mat} position={[x, 1.76, -0.085]} castShadow />
          ))}
        </group>
      );
    }
    case "cap": {
      // fila: a beaded skull cap with a band of beads
      return (
        <group>
          <mesh position={[0, 1.7, -0.01]} material={mat} scale={[HEAD_R * 1.14, HEAD_R * 0.6, HEAD_R * 1.14]} castShadow>
            <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {beadRing(26, HEAD_R * 1.18, 1.695, beadGeo, mat, "cap")}
        </group>
      );
    }
    case "medallion": {
      return (
        <mesh position={[0, 1.31, 0.165]} rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.012, 24]} />
        </mesh>
      );
    }
    case "armband": {
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.25, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat} castShadow>
              <torusGeometry args={[0.052, 0.009, 8, 20]} />
            </mesh>
          ))}
        </>
      );
    }
    default:
      return null;
  }
}

// ---- rig --------------------------------------------------------------------------------------

export function StylizedCharacter({
  appearance,
  tier = "commoner",
  scale = 1,
  animate = true,
  moveState = "idle",
}: Props) {
  const root = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const isFemale = appearance.gender === "female";
  const [faceMap, setFaceMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!appearance.facePhoto) {
      setFaceMap(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let alive = true;
    loader.load(appearance.facePhoto, (tex) => {
      if (!alive) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      setFaceMap(tex);
    });
    return () => {
      alive = false;
    };
  }, [appearance.facePhoto]);

  const heightMul = appearance.height === "short" ? 0.9 : appearance.height === "tall" ? 1.08 : 1;
  const wardrobe = useMemo(() => wardrobeFor(tier, isFemale ? "female" : "male"), [tier, isFemale]);
  const postureLean = appearance.posture === "confident" ? 0.05 : appearance.posture === "shy" ? -0.06 : appearance.posture === "upright" ? 0.02 : 0;

  useFrame(({ clock }) => {
    if (!animate || !root.current) return;
    const t = clock.getElapsedTime();

    if (moveState === "ride") {
      root.current.position.y = Math.sin(t * 8) * 0.01;
      if (leftLeg.current) leftLeg.current.rotation.x = -1.2;
      if (rightLeg.current) rightLeg.current.rotation.x = -1.2;
      if (leftArm.current) leftArm.current.rotation.x = -0.5;
      if (rightArm.current) rightArm.current.rotation.x = -0.5;
      if (torso.current) torso.current.rotation.x = 0.12;
      return;
    }

    const moving = moveState === "walk" || moveState === "run";
    const pace = moveState === "run" ? 10 : moveState === "walk" ? 6.5 : 1.4;
    const swing = moveState === "run" ? 0.75 : moveState === "walk" ? 0.42 : 0.04;
    const bob = moveState === "run" ? 0.03 : moveState === "walk" ? 0.018 : 0.008;

    root.current.position.y = Math.abs(Math.sin(t * pace)) * bob;
    root.current.rotation.y = moving ? 0 : Math.sin(t * 0.38) * 0.03;
    root.current.rotation.z = postureLean * 0.25;

    const legA = Math.sin(t * pace) * swing;
    const legB = Math.sin(t * pace + Math.PI) * swing;
    if (leftLeg.current) leftLeg.current.rotation.x = legA;
    if (rightLeg.current) rightLeg.current.rotation.x = legB;
    if (leftArm.current) leftArm.current.rotation.x = Math.sin(t * pace + Math.PI) * swing * 0.7;
    if (rightArm.current) rightArm.current.rotation.x = Math.sin(t * pace) * swing * 0.7;
    if (torso.current) {
      torso.current.rotation.y = moving ? Math.sin(t * pace) * 0.05 : 0;
      torso.current.rotation.x = moveState === "run" ? 0.1 : postureLean;
    }
    if (head.current) head.current.rotation.x = moveState === "run" ? 0.08 : 0;
  });

  const skin = appearance.skin;
  const skinM = skinMaterial(skin, faceMap);
  const hipPivotY = 0.9;
  const shoulderY = 1.4;
  const shoulderX = 0.2;
  const hipX = 0.09;

  // slim/curvy shape tweaks on the limbs
  const limbScale = appearance.bodyShape === "slim" ? 0.9 : appearance.bodyShape === "broad" ? 1.12 : 1;

  return (
    <group ref={root} scale={scale * heightMul} position={[((appearance.detailSeed % 7) - 3) * 0.002, 0, 0]}>
      <Torso isFemale={isFemale} shape={appearance.bodyShape} skin={skin} />
      {/* legs: pivot at hip joint, knee bend from a shin child */}
      {[
        { ref: leftLeg, x: -hipX },
        { ref: rightLeg, x: hipX },
      ].map((leg, i) => (
        <group key={i} ref={leg.ref} position={[leg.x, hipPivotY, 0]}>
          <Limb r={0.068 * limbScale} len={0.44} skin={skin} />
          <group position={[0, -0.44, 0]}>
            <Limb r={0.05 * limbScale} len={0.4} skin={skin} />
            <group position={[0, -0.4, 0]}>
              <Foot skin={skin} />
            </group>
          </group>
        </group>
      ))}
      {/* garments on the lower body */}
      {wardrobe.garments.map((g, i) => (
        <Garment key={`${g.kind}-${i}`} g={g} kind={g.kind} />
      ))}
      {/* arms: shoulder pivot, elbow, hand */}
      {[
        { ref: leftArm, x: -shoulderX, s: -1 as const },
        { ref: rightArm, x: shoulderX, s: 1 as const },
      ].map((arm, i) => (
        <group key={i} ref={arm.ref} position={[arm.x, shoulderY, 0]}>
          <mesh material={skinM} castShadow>
            <sphereGeometry args={[0.048 * limbScale, 14, 12]} />
          </mesh>
          <Limb r={0.04 * limbScale} len={0.3} skin={skin} />
          <group position={[0, -0.3, 0]}>
            <Limb r={0.034 * limbScale} len={0.26} skin={skin} />
            <group position={[0, -0.26, 0]}>
              <Hand skin={skin} side={arm.s} />
            </group>
          </group>
        </group>
      ))}
      {/* neck and head */}
      <mesh position={[0, 1.5, 0]} material={skinM} castShadow>
        <cylinderGeometry args={[0.052, 0.058, 0.1, 18]} />
      </mesh>
      <group ref={head} position={[0, 1.6, 0]}>
        <Face appearance={appearance} />
        <Hair style={appearance.hair} color={appearance.hairColor} />
      </group>
      {/* earrings: coral studs per the appearance flags */}
      {appearance.leftEarPiercing && (
        <mesh position={[-HEAD_R * 1.01, 1.6, 0]} material={new THREE.MeshStandardMaterial({ color: "#ef6a4b", roughness: 0.3 })}>
          <torusGeometry args={[0.012, 0.003, 6, 12]} />
        </mesh>
      )}
      {appearance.rightEarPiercing && (
        <mesh position={[HEAD_R * 1.01, 1.6, 0]} material={new THREE.MeshStandardMaterial({ color: "#ef6a4b", roughness: 0.3 })}>
          <torusGeometry args={[0.012, 0.003, 6, 12]} />
        </mesh>
      )}
    </group>
  );
}

export default StylizedCharacter;
