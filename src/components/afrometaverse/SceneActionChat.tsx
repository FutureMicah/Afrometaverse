/**
 * In-world action → AI NPC dialogue (Lovable AI Gateway via npc-dialogue function).
 * Uses current district, heat/wanted, and citizen reputation for context.
 */
import { useCallback, useMemo, useState } from "react";
import { MessageCircle, Send, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRoamStore, DISTRICT_WORLD } from "@/stores/roamStore";
import { useInteriorStore } from "@/stores/interiorStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { INTERIOR_LIST } from "@/data/interiors";

const FUNCTION_NAME = "npc-dialogue";

type DialogueResult = {
  speaker: string;
  mood: string;
  reply: string;
  reputationHint?: string;
};

type Props = {
  reputation: number;
  displayName: string;
  isAuthenticated: boolean;
  onNeedAuth?: () => void;
  onToast?: (msg: string) => void;
};

function nearestDistrictLabel(x: number, z: number): string {
  let best = "Village paths";
  let bestD = Infinity;
  for (const d of Object.values(DISTRICT_WORLD)) {
    const dx = d.x - x;
    const dz = d.z - z;
    const dist = dx * dx + dz * dz;
    if (dist < bestD) {
      bestD = dist;
      best = d.name ?? d.id;
    }
  }
  return best;
}

function timeOfDayLabel(hour?: number): string {
  const h = hour ?? new Date().getHours();
  if (h < 5) return "deep night";
  if (h < 8) return "dawn";
  if (h < 12) return "morning";
  if (h < 16) return "afternoon";
  if (h < 19) return "evening";
  return "night";
}

export function SceneActionChat({
  reputation,
  displayName,
  isAuthenticated,
  onNeedAuth,
  onToast,
}: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { action: string; result: DialogueResult }[]
  >([]);

  const position = useRoamStore((s) => s.position);
  const nearDistrictId = useRoamStore((s) => s.nearDistrictId);
  const heatPoints = useRoamStore((s) => s.heatPoints);
  const wantedLevel = useRoamStore((s) => s.wantedLevel);
  const missionLog = useRoamStore((s) => s.missionLog);
  const pushLog = useRoamStore((s) => s.pushLog);
  const interiorId = useInteriorStore((s) => s.insideId);
  const rain = useWeatherStore((s) => s.rainIntensity);
  const dust = useWeatherStore((s) => s.dustIntensity);

  const place = useMemo(() => {
    if (nearDistrictId && DISTRICT_WORLD[nearDistrictId]) {
      return DISTRICT_WORLD[nearDistrictId]?.name ?? nearDistrictId;
    }
    return nearestDistrictLabel(position[0], position[2]);
  }, [nearDistrictId, position]);

  const interiorName = useMemo(() => {
    if (!interiorId) return "";
    const row = INTERIOR_LIST.find((i) => i.id === interiorId);
    return row?.name ?? interiorId;
  }, [interiorId]);

  const weatherLabel =
    rain > 0.4 ? "rain" : dust > 0.45 ? "dusty harmattan air" : "clear skies";

  const submit = useCallback(async () => {
    const text = action.trim();
    if (!text) return;
    if (!isAuthenticated) {
      onNeedAuth?.();
      onToast?.("Sign in to speak with the city.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(FUNCTION_NAME, {
        body: {
          action: text,
          reputation,
          heat: heatPoints,
          wanted: wantedLevel,
          displayName,
          scene: {
            district: nearDistrictId ?? "village",
            place,
            interior: interiorName || undefined,
            timeOfDay: timeOfDayLabel(),
            weather: weatherLabel,
            recentLog: missionLog.slice(-4),
          },
        },
      });

      if (fnErr) {
        throw new Error(fnErr.message || "Could not reach the city voice.");
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }

      const result: DialogueResult = {
        speaker: String(data?.speaker ?? "Villager"),
        mood: String(data?.mood ?? "wary"),
        reply: String(data?.reply ?? ""),
        reputationHint: data?.reputationHint ? String(data.reputationHint) : undefined,
      };
      if (!result.reply) throw new Error("No reply came back.");

      setHistory((h) => [{ action: text, result }, ...h].slice(0, 8));
      setAction("");
      pushLog(`${result.speaker}: ${result.reply}`);
      if (result.reputationHint) onToast?.(result.reputationHint);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      onToast?.(msg);
    } finally {
      setLoading(false);
    }
  }, [
    action,
    isAuthenticated,
    onNeedAuth,
    onToast,
    reputation,
    heatPoints,
    wantedLevel,
    displayName,
    nearDistrictId,
    place,
    interiorName,
    weatherLabel,
    missionLog,
    pushLog,
  ]);

  return (
    <div className="am-scene-chat">
      {!open ? (
        <button
          type="button"
          className="am-scene-chat-fab"
          onClick={() => setOpen(true)}
          title="Describe an action — NPCs respond"
        >
          <MessageCircle size={18} />
          <span>Speak</span>
        </button>
      ) : (
        <div className="am-scene-chat-panel" role="dialog" aria-label="Scene action dialogue">
          <header className="am-scene-chat-head">
            <div>
              <strong>City voice</strong>
              <small>
                {place}
                {interiorName ? ` · ${interiorName}` : ""} · Rep {reputation}
                {wantedLevel > 0 ? ` · Wanted ${wantedLevel}` : ""}
              </small>
            </div>
            <button type="button" className="am-scene-chat-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </header>

          <p className="am-scene-chat-hint">
            Describe what you do or say. Nearby people answer from the scene and your reputation.
          </p>

          <div className="am-scene-chat-input-row">
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void submit();
              }}
              placeholder='e.g. "Greet the market women and ask about yam prices"'
              maxLength={320}
              disabled={loading}
            />
            <button type="button" onClick={() => void submit()} disabled={loading || !action.trim()}>
              {loading ? <Loader2 size={16} className="am-spin" /> : <Send size={16} />}
            </button>
          </div>

          {error && <p className="am-scene-chat-error">{error}</p>}

          <ul className="am-scene-chat-history">
            {history.map((h, i) => (
              <li key={i}>
                <div className="am-scene-chat-you">You: {h.action}</div>
                <div className="am-scene-chat-npc">
                  <span className="am-scene-chat-speaker">
                    {h.result.speaker}
                    <em>{h.result.mood}</em>
                  </span>
                  <p>{h.result.reply}</p>
                  {h.result.reputationHint && (
                    <small className="am-scene-chat-hint-line">{h.result.reputationHint}</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SceneActionChat;
