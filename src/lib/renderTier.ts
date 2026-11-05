/**
 * Render tier detection — defaults LOW because PC and phone both froze on mid/high.
 * Players can raise quality via localStorage: localStorage.setItem("am-quality","mid"|"high")
 */

export type RenderTier = "low" | "mid" | "high";

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number | undefined;
  mobile?: boolean | undefined;
}

export function detectRenderTier(h: DeviceHints): RenderTier {
  // Safe default for everyone — outer world / dense fauna only on explicit high
  const cores = h.hardwareConcurrency ?? 2;
  const mem = h.deviceMemory;
  const mobile = !!h.mobile;

  if (mobile) return "low";

  // Desktop: still start low unless clearly strong AND memory is known
  if (mem != null && mem >= 8 && cores >= 8) return "mid";
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
