/**
 * Character-creator Face Studio — optional webcam → MediaPipe → live face proxy.
 * Does not run inside the village simulation.
 */

import { useFaceTrackStore } from "@/stores/faceTrackStore";
import { useFaceTracker } from "@/hooks/useFaceTracker";

export function FaceStudio() {
  const enabled = useFaceTrackStore((s) => s.enabled);
  const tracking = useFaceTrackStore((s) => s.tracking);
  const error = useFaceTrackStore((s) => s.error);
  const proxy = useFaceTrackStore((s) => s.proxy);
  const setEnabled = useFaceTrackStore((s) => s.setEnabled);

  useFaceTracker(enabled);

  return (
    <div
      className="am-face-studio"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(20,16,28,0.85)",
        border: "1px solid rgba(251,191,36,0.25)",
        fontSize: 13,
        color: "#f5e6d3",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <strong style={{ color: "#fbbf24" }}>Face Studio</strong>
          <div style={{ opacity: 0.75, fontSize: 11, marginTop: 2 }}>
            Webcam → live blink / jaw on your character (on-device)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            background: enabled ? "#b91c1c" : "#c9a227",
            color: enabled ? "#fff" : "#1a1025",
          }}
        >
          {enabled ? "Stop" : "Track face"}
        </button>
      </div>

      {enabled && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.9 }}>
          {error && <div style={{ color: "#f87171" }}>{error}</div>}
          {!error && !tracking && <div>Starting camera + model…</div>}
          {tracking && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <span>Blink L {(proxy.blinkL * 100).toFixed(0)}%</span>
              <span>Blink R {(proxy.blinkR * 100).toFixed(0)}%</span>
              <span>Jaw {(proxy.jawOpen * 100).toFixed(0)}%</span>
              <span>Smile {(proxy.smile * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FaceStudio;
