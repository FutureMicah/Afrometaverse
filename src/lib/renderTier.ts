/**
 * Render tier from device hints.
 * Conservative defaults: missing deviceMemory must NOT imply a powerful GPU.
 */

export type RenderTier = "low" | "mid" | "high";

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number | undefined;
  mobile?: boolean | undefined;
}

export function detectRenderTier(h: DeviceHints): RenderTier {
  const cores = h.hardwareConcurrency ?? 4;
  const mem = h.deviceMemory; // may be undefined (Chrome often hides this)
  const mobile = !!h.mobile;

  // Mobile: stay low unless clearly strong
  if (mobile) {
    if (mem != null && mem >= 8 && cores >= 8) return "mid";
    return "low";
  }

  // Desktop / tablet: only "high" when memory is known and healthy
  if (mem != null && mem >= 8 && cores >= 8) return "high";
  if (mem != null && mem >= 4 && cores >= 4) return "mid";
  // Unknown memory (common): prefer mid for desktop, never auto-high
  if (!mobile && cores >= 6) return "mid";
  return "low";
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
