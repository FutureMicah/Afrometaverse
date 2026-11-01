/**
 * First-person view limbs: swinging hands always in the lower corners of the eye view,
 * and legs that appear when the player looks down (real eye perspective).
 * Driven from the active camera each frame; no React state.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRoamStore } from "@/stores/roamStore";
import { useCameraSettingsStore } from "@/stores/cameraSettingsStore";
import { useCharacterStore } from "@/stores/characterStore";

const _q = new THREE.Quaternion();
const _pos = new THREE.Vector3();

export function FirstPersonLimbs({
  activeRef,
  pitchRef,
}: {
  /** Live first-person flag from PlayerController */
  activeRef: React.MutableRefObject<boolean>;
  /** Shared pitch ref from PlayerController (radians, + look up) */
  pitchRef: React.MutableRefObject<number>;
}) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const legsGroup = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const phase = useRef(0);

  const skinHex = useCharacterStore((s) => s.appearance.skin) || "#c68642";

  useFrame((_, dt) => {
    if (!root.current) return;
    const show = useCameraSettingsStore.getState().showFpsBody;
    const legAmt = useCameraSettingsStore.getState().fpsLegVisibility;
    const active = activeRef.current;
    if (!active || !show) {
      root.current.visible = false;
      return;
    }
    root.current.visible = true;

    // Sit in camera space: slightly forward of the lens
    camera.getWorldPosition(_pos);
    camera.getWorldQuaternion(_q);
    root.current.position.copy(_pos);
    root.current.quaternion.copy(_q);

    const moveState = useRoamStore.getState().moveState;
    const moving = moveState === "walk" || moveState === "run";
    const run = moveState === "run";
    const speed = run ? 11 : moving ? 7.2 : 0;
    if (moving) phase.current += dt * speed;
    else phase.current = THREE.MathUtils.lerp(phase.current, 0, 1 - Math.pow(0.002, dt));

    const swing = Math.sin(phase.current) * (run ? 0.55 : 0.38);
    const bob = Math.abs(Math.sin(phase.current * 2)) * (run ? 0.03 : 0.015);

    if (leftArm.current) {
      leftArm.current.rotation.x = swing * 0.85 + bob;
      leftArm.current.rotation.z = 0.18;
      leftArm.current.position.y = -0.22 - bob;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = -swing * 0.85 + bob;
      rightArm.current.rotation.z = -0.18;
      rightArm.current.position.y = -0.22 - bob;
    }

    // Legs: visible when looking down (negative pitch)
    const pitch = pitchRef.current;
    const lookDown = THREE.MathUtils.clamp((-pitch - 0.12) / 0.85, 0, 1) * legAmt;
    if (legsGroup.current) {
      legsGroup.current.visible = lookDown > 0.04;
      legsGroup.current.position.y = -0.55 - (1 - lookDown) * 0.35;
      legsGroup.current.scale.setScalar(0.85 + lookDown * 0.15);
    }
    if (leftLeg.current) {
      leftLeg.current.rotation.x = -swing * 0.7;
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = swing * 0.7;
    }
  });

  const skinMat = () => (
    <meshStandardMaterial color={skinHex} roughness={0.72} metalness={0.05} />
  );

  return (
    <group ref={root} visible={false}>
      <group ref={leftArm} position={[-0.28, -0.22, -0.42]}>
        <mesh position={[0, -0.16, 0]} rotation={[0.35, 0, 0.12]}>
          <capsuleGeometry args={[0.035, 0.22, 4, 8]} />
          {skinMat()}
        </mesh>
        <mesh position={[0, -0.32, 0.02]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.08, 0.1]} />
          {skinMat()}
        </mesh>
      </group>
      <group ref={rightArm} position={[0.28, -0.22, -0.42]}>
        <mesh position={[0, -0.16, 0]} rotation={[0.35, 0, -0.12]}>
          <capsuleGeometry args={[0.035, 0.22, 4, 8]} />
          {skinMat()}
        </mesh>
        <mesh position={[0, -0.32, 0.02]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.08, 0.1]} />
          {skinMat()}
        </mesh>
      </group>
      <group ref={legsGroup} position={[0, -0.55, -0.25]} visible={false}>
        <group ref={leftLeg} position={[-0.09, 0, 0]}>
          <mesh position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
            {skinMat()}
          </mesh>
          <mesh position={[0, -0.4, 0.03]}>
            <boxGeometry args={[0.08, 0.06, 0.14]} />
            {skinMat()}
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.09, 0, 0]}>
          <mesh position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
            {skinMat()}
          </mesh>
          <mesh position={[0, -0.4, 0.03]}>
            <boxGeometry args={[0.08, 0.06, 0.14]} />
            {skinMat()}
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default FirstPersonLimbs;
