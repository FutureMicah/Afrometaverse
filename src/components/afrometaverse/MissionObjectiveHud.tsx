/**
 * Compact mission objective strip + compass toward the current step.
 * Used in full-screen play and as a floating strip over the city canvas.
 */

import { useMemo } from "react";
import { useRoamStore, DISTRICT_WORLD } from "@/stores/roamStore";

function currentObjective(mission: NonNullable<ReturnType<typeof useRoamStore.getState>["activeMission"]>) {
  const step = mission.steps.find((s) => !s.done);
  if (!step) return { done: true as const, label: "Return to complete", districtId: null as string | null, sub: null as string | null };
  const sub = step.subSteps?.find((s) => !s.done) ?? null;
  return {
    done: false as const,
    label: sub?.label ?? step.label,
    districtId: step.districtId,
    sub: sub?.label ?? null,
    stepLabel: step.label,
    progress: {
      done: mission.steps.filter((s) => s.done).length,
      total: mission.steps.length,
    },
  };
}

function bearingDeg(fromX: number, fromZ: number, toX: number, toZ: number, facing: number) {
  const worldAngle = Math.atan2(toX - fromX, toZ - fromZ);
  // facing is yaw where 0 looks -Z in our controller... faceYaw uses atan2(vx, vz)
  let delta = worldAngle - facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return (delta * 180) / Math.PI;
}

type Props = {
  compact?: boolean;
  onAdvance?: () => void;
  onCancel?: () => void;
  nearDistrictId?: string | null;
};

export function MissionObjectiveHud({ compact, onAdvance, onCancel, nearDistrictId }: Props) {
  const activeMission = useRoamStore((s) => s.activeMission);
  const position = useRoamStore((s) => s.position);
  const facing = useRoamStore((s) => s.facing);

  const obj = useMemo(() => (activeMission ? currentObjective(activeMission) : null), [activeMission]);
  if (!activeMission || !obj) return null;

  const world = obj.districtId ? DISTRICT_WORLD[obj.districtId] : null;
  const dist = world
    ? Math.hypot(position[0] - world.x, position[2] - world.z)
    : null;
  const onSite =
    !!obj.districtId && (nearDistrictId === obj.districtId || (dist !== null && dist < 3.2));
  const bear =
    world && !obj.done ? bearingDeg(position[0], position[2], world.x, world.z, facing) : 0;

  return (
    <div className={`am-obj-hud ${compact ? "am-obj-hud-compact" : ""}`} aria-live="polite">
      <div className="am-obj-top">
        <span className={`am-kind am-kind-${activeMission.kind}`}>{activeMission.kind}</span>
        <strong className="am-obj-title">{activeMission.title}</strong>
        {!obj.done && obj.progress && (
          <span className="am-obj-progress">
            {obj.progress.done}/{obj.progress.total}
          </span>
        )}
      </div>
      <div className="am-obj-row">
        {!obj.done && world && (
          <div className="am-obj-compass" aria-hidden title="Direction to objective">
            <div className="am-obj-compass-dial" style={{ transform: `rotate(${bear}deg)` }}>
              ▲
            </div>
          </div>
        )}
        <div className="am-obj-body">
          <div className="am-obj-label">{obj.done ? "All objectives done" : obj.label}</div>
          <div className="am-obj-meta">
            {world && !obj.done && (
              <>
                {world.name}
                {dist !== null && ` · ${dist.toFixed(0)}m`}
                {onSite ? " · on site" : " · go here"}
              </>
            )}
            {obj.done && "Tap complete to collect reward"}
          </div>
        </div>
        {(onAdvance || onCancel) && (
          <div className="am-obj-actions">
            {onAdvance && (
              <button type="button" className="am-btn am-btn-primary am-btn-sm" onClick={onAdvance}>
                {obj.done ? "Complete" : onSite ? "Do objective" : "Advance"}
              </button>
            )}
            {onCancel && (
              <button type="button" className="am-btn am-btn-ghost am-btn-sm" onClick={onCancel}>
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MissionObjectiveHud;
