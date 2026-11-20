/**
 * Webcam → MediaPipe Face Landmarker → faceTrackStore proxy.
 * Loads tasks-vision from CDN so no package install is required.
 * Studio / character-creator only — do not run in the open village.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFaceTrackStore, type FaceProxyLive } from "@/stores/faceTrackStore";
import { remapWeight, type ArkitShape } from "@/lib/arkitFaceMap";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type FaceLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
    facialTransformationMatrixes?: { data: Float32Array | number[] }[];
  };
  close?: () => void;
};

function shapesToProxy(
  categories: { categoryName: string; score: number }[],
): Partial<FaceProxyLive> {
  const w: Partial<Record<ArkitShape, number>> = {};
  for (const c of categories) {
    w[c.categoryName as ArkitShape] = c.score;
  }
  const blinkL = remapWeight(w.eyeBlinkLeft ?? 0);
  const blinkR = remapWeight(w.eyeBlinkRight ?? 0);
  const jawOpen = remapWeight(w.jawOpen ?? 0);
  const browUp = remapWeight(w.browInnerUp ?? 0);
  const smile =
    (remapWeight(w.mouthSmileLeft ?? 0) + remapWeight(w.mouthSmileRight ?? 0)) * 0.5;
  return { blinkL, blinkR, jawOpen, browUp, smile };
}

/** Extract rough yaw/pitch/roll from 4x4 column-major matrix */
function matrixToHead(data: Float32Array | number[]): Pick<FaceProxyLive, "headYaw" | "headPitch" | "headRoll"> {
  const m = data.length >= 16 ? data : null;
  if (!m) return { headYaw: 0, headPitch: 0, headRoll: 0 };
  // Column-major: forward is -Z in MediaPipe camera space — approximate euler
  const r00 = m[0] ?? 0, r01 = m[4] ?? 0, r02 = m[8] ?? 0;
  const r10 = m[1] ?? 0, r11 = m[5] ?? 0, r12 = m[9] ?? 0;
  const r20 = m[2] ?? 0, r21 = m[6] ?? 0, r22 = m[10] ?? 0;
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r12)));
  const yaw = Math.atan2(r02, r22);
  const roll = Math.atan2(r10, r11);
  return {
    headYaw: yaw * 0.55,
    headPitch: pitch * 0.55,
    headRoll: roll * 0.35,
  };
}

export function useFaceTracker(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastTs = useRef(0);

  const setTracking = useFaceTrackStore((s) => s.setTracking);
  const setError = useFaceTrackStore((s) => s.setError);
  const setProxy = useFaceTrackStore((s) => s.setProxy);
  const resetProxy = useFaceTrackStore((s) => s.resetProxy);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      landmarkerRef.current?.close?.();
    } catch {
      /* ignore */
    }
    landmarkerRef.current = null;
    setTracking(false);
    resetProxy();
  }, [resetProxy, setTracking]);

  const start = useCallback(async () => {
    setError(null);
    try {
      // Dynamic ESM import from CDN
      const visionModuleUrl = new URL(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm",
      );
      const vision = await import(/* @vite-ignore */ visionModuleUrl.href);
      const { FaceLandmarker, FilesetResolver } = vision as {
        FaceLandmarker: {
          createFromOptions: (
            fileset: unknown,
            opts: Record<string, unknown>,
          ) => Promise<FaceLandmarkerInstance>;
        };
        FilesetResolver: {
          forVisionTasks: (root: string) => Promise<unknown>;
        };
      };

      const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      landmarkerRef.current = landmarker;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      let video = videoRef.current;
      if (!video) {
        video = document.createElement("video");
        video.playsInline = true;
        video.muted = true;
        video.style.display = "none";
        document.body.appendChild(video);
        videoRef.current = video;
      }
      video.srcObject = stream;
      await video.play();

      setTracking(true);

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const v = videoRef.current;
        const lm = landmarkerRef.current;
        if (!v || !lm || v.readyState < 2) return;
        const now = performance.now();
        if (now - lastTs.current < 33) return; // ~30 fps detect
        lastTs.current = now;
        try {
          const res = lm.detectForVideo(v, now);
          const cats = res.faceBlendshapes?.[0]?.categories;
          if (cats?.length) {
            const proxy = shapesToProxy(cats);
            const mat = res.facialTransformationMatrixes?.[0]?.data;
            const head = mat ? matrixToHead(mat) : {};
            setProxy({ ...proxy, ...head });
          }
        } catch {
          /* frame skip */
        }
      };
      loop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Face tracking failed";
      setError(msg);
      setTracking(false);
      stop();
    }
  }, [setError, setProxy, setTracking, stop]);

  useEffect(() => {
    if (active) void start();
    else stop();
    return () => stop();
  }, [active, start, stop]);

  return { videoRef, stop, start };
}
