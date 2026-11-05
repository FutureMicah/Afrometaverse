/**
 * Full-screen play HUD: context prompts (door / vehicle / safehouse) + first-run coach.
 * Keyboard vs touch copy adapts automatically.
 */

import { useEffect, useState } from "react";
import { useRoamStore } from "@/stores/roamStore";
import { useInteriorStore } from "@/stores/interiorStore";
import { INTERIORS } from "@/data/interiors";
import { SAFEHOUSES, DISTRICT_WORLD } from "@/stores/roamStore";

const COACH_KEY = "am-play-coach-v1";

type Props = {
  isTouch: boolean;
  fullscreen: boolean;
};

export function PlaySessionHud({ isTouch, fullscreen }: Props) {
  const mountedVehicleId = useRoamStore((s) => s.mountedVehicleId);
  const nearVehicleId = useRoamStore((s) => s.nearVehicleId);
  const nearDistrictId = useRoamStore((s) => s.nearDistrictId);
  const inSafehouseId = useRoamStore((s) => s.inSafehouseId);
  const nearDoorId = useInteriorStore((s) => s.nearDoorId);
  const insideId = useInteriorStore((s) => s.insideId);

  const [coach, setCoach] = useState<"hidden" | "step1" | "step2" | "done">("hidden");

  useEffect(() => {
    if (!fullscreen) return;
    try {
      if (localStorage.getItem(COACH_KEY) === "1") {
        setCoach("done");
        return;
      }
    } catch {
      /* ignore */
    }
    setCoach("step1");
  }, [fullscreen]);

  const dismissCoach = (final = false) => {
    if (coach === "step1" && !final) {
      setCoach("step2");
      return;
    }
    setCoach("done");
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!fullscreen || insideId) return null;

  // Context prompt priority
  let prompt: string | null = null;
  if (mountedVehicleId) {
    prompt = isTouch ? "EXIT — leave this ride" : "F — exit vehicle";
  } else if (nearDoorId) {
    const name = INTERIORS[nearDoorId]?.name ?? "building";
    prompt = isTouch ? `DOOR — enter ${name}` : `F — enter ${name}`;
  } else if (nearVehicleId) {
    prompt = isTouch ? "RIDE — hop on (glow marker)" : "F — enter vehicle";
  } else if (inSafehouseId) {
    const name = SAFEHOUSES.find((s) => s.id === inSafehouseId)?.name ?? "Safehouse";
    prompt = `Safe · ${name} — heat cooling`;
  } else if (nearDistrictId) {
    prompt = DISTRICT_WORLD[nearDistrictId]?.name ?? null;
  }

  return (
    <div className="am-play-hud" aria-live="polite">
      {coach === "step1" && (
        <div className="am-play-coach">
          <strong>{isTouch ? "Move & look" : "Free roam"}</strong>
          <p>
            {isTouch
              ? "Left side: drag to walk. Right side: drag to look. RUN · JUMP · CROUCH on the right."
              : "WASD move · mouse look (click canvas) · Shift run · Space jump · C crouch · V eyes/shoulder."}
          </p>
          <button type="button" className="am-btn am-btn-primary am-btn-sm" onClick={() => dismissCoach()}>
            Next
          </button>
        </div>
      )}
      {coach === "step2" && (
        <div className="am-play-coach">
          <strong>{isTouch ? "Interact & view" : "Interact"}</strong>
          <p>
            {isTouch
              ? "RIDE / DOOR / EXIT appears when you are close. VIEW switches first-person eyes and shoulder cam."
              : "F enter vehicle or building when the prompt shows. V = first-person eyes (hands swing, look down for legs). Esc exits full screen."}
          </p>
          <button type="button" className="am-btn am-btn-primary am-btn-sm" onClick={() => dismissCoach(true)}>
            Got it — play
          </button>
        </div>
      )}

      {prompt && coach === "done" && (
        <div className={`am-play-prompt ${nearDoorId || nearVehicleId || mountedVehicleId ? "am-play-prompt-hot" : ""}`}>
          {prompt}
        </div>
      )}

      {/* Permanent mini-hint removed — was covering the view. Coach shows once; Shrink is top-right. */}
    </div>
  );
}

export default PlaySessionHud;
