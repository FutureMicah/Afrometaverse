/**
 * Render tier from device hints (era-progression-spec.md 10.1, 10.3).
 * Low, mid and high set render radius 2, 3 and 4 chunks.
 */

export type RenderTier = "low" | "mid" | "high";

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number | undefined;
  mobile?: boolean | undefined;
}

export function detectRenderTier(h: DeviceHints): RenderTier {
  const cores = h.hardwareConcurrency ?? 4;
  const mem = h.deviceMemory ?? 4;
  if (h.mobile) {
    if (mem >= 8 && cores >= 8) return "high";
    if (mem >= 6 && cores >= 6) return "mid";
    return "low";
  }
  if (cores >= 4 && mem >= 4) return "high";
  return "mid";
}

export function readDeviceHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent ?? "");
  const out: DeviceHints = { hardwareConcurrency: nav.hardwareConcurrency, mobile };
  if (nav.deviceMemory !== undefined) out.deviceMemory = nav.deviceMemory;
  return out;
}

export function currentRenderTier(): RenderTier {
  return detectRenderTier(readDeviceHints());
}
