/**
 * Always-on immersion strip: game clock, weather vibe, KOWRY, online citizens.
 * compact = one line only (fullscreen play — does not cover the village).
 */

import { useMemo } from "react";
import { useWeatherStore } from "@/stores/weatherStore";
import { useKowryStore } from "@/stores/kowryStore";
import { formatGameClock, worldModifiers } from "@/lib/timeEffects";

type Props = {
  onlineCount?: number;
  districtName?: string | null;
  /** Fullscreen play: single slim row, no flavor text */
  compact?: boolean;
};

const FLAVOR = [
  "A keke horn cuts through the lane.",
  "Someone bargains hard over dried fish.",
  "Zinc roof ticks as the sun shifts.",
  "Generator coughs once, then settles.",
  "Children chase a tyre past the compound.",
  "Radio gospel mixes with highlife far off.",
  "Palm oil scent rides the breeze.",
  "A ferry whistle answers from the creek.",
];

export function ImmersionBar({ onlineCount = 0, districtName, compact = false }: Props) {
  const hour = useWeatherStore((s) => s.state.hour);
  const timeOfDay = useWeatherStore((s) => s.state.timeOfDay);
  const weatherId = useWeatherStore((s) => s.state.weatherId);
  const temp = useWeatherStore((s) => s.state.temperature);
  const config = useWeatherStore((s) => s.config);
  const kowry = useKowryStore((s) => s.balance);
  const influence = useKowryStore((s) => s.influenceScore);

  const mods = useMemo(
    () => worldModifiers(timeOfDay, weatherId, hour),
    [timeOfDay, weatherId, hour],
  );

  const flavor = FLAVOR[Math.floor(hour * 3) % FLAVOR.length];

  return (
    <div className={`am-immersion-bar ${compact ? "am-immersion-compact" : ""}`} aria-label="City conditions">
      <div className="am-immersion-row">
        <span className="am-immersion-clock" title="In-game clock">
          {formatGameClock(hour)}
          <small>{timeOfDay}</small>
        </span>
        <span className="am-immersion-weather" title={config.description}>
          {config.icon} {Math.round(temp)}°
        </span>
        <span className="am-immersion-kowry" title="KOWRY shells — heritage play currency">
          🐚 {kowry}
          {!compact && influence > 0 && <small>· infl {influence}</small>}
        </span>
        <span className="am-immersion-online" title="Citizens with recent presence">
          ◎ {Math.max(onlineCount, 0)} live
        </span>
        {districtName && <span className="am-immersion-dist">{districtName}</span>}
      </div>
      {!compact && (
        <div className="am-immersion-vibe">
          <span>{mods.vibe}</span>
          <span className="am-immersion-flavor">{flavor}</span>
        </div>
      )}
    </div>
  );
}

export default ImmersionBar;
