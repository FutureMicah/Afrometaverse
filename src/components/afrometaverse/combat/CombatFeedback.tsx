import { useEffect, useState } from "react";
import { useCombatStore, type CombatFeedEvent } from "@/stores/combatStore";
import "./combat.css";

const LIFE_MS = 900;

/** Floating damage numbers and hit labels. Uses am-* classes only; no hex in this file. */
export function CombatFeedback() {
  const feed = useCombatStore((s) => s.feed);
  const [visible, setVisible] = useState<CombatFeedEvent[]>([]);

  useEffect(() => {
    setVisible(feed.slice(-12));
    const t = window.setTimeout(() => setVisible([]), LIFE_MS);
    return () => window.clearTimeout(t);
  }, [feed]);

  return (
    <div className="am-combat-feed" aria-live="polite">
      {visible.map((ev) => (
        <span
          key={ev.id}
          className={[
            "am-combat-float",
            ev.critical ? "am-combat-float-crit" : "",
            ev.kind === "playerHit" || ev.kind === "playerDown" ? "am-combat-float-hurt" : "",
            ev.kind === "parried" || ev.kind === "perfectParry" ? "am-combat-float-parry" : "",
            ev.kind === "blocked" || ev.kind === "missedParry" ? "am-combat-float-block" : "",
          ].join(" ")}
          style={{ left: `${50 + ev.x * 4}%`, top: `${50 - ev.z * 4}%` }}
        >
          {labelFor(ev)}
        </span>
      ))}
    </div>
  );
}

function labelFor(ev: CombatFeedEvent): string {
  switch (ev.kind) {
    case "damage":
    case "kill":
      return ev.critical ? `${ev.amount} crit` : `${ev.amount}`;
    case "stagger":
      return "staggered";
    case "parried":
      return "parry";
    case "perfectParry":
      return "perfect parry";
    case "blocked":
      return `blocked ${ev.amount}`;
    case "missedParry":
      return "missed parry";
    case "dodged":
      return "dodge";
    case "playerHit":
      return `-${ev.amount}`;
    case "playerDown":
      return "down";
    case "noStamina":
      return "no breath";
    case "winded":
      return "winded";
    case "miss":
      return "miss";
    default:
      return ev.kind;
  }
}
