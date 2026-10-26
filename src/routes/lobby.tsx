import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCharacterStore } from "@/stores/characterStore";
import { useKowryStore } from "@/stores/kowryStore";
import { LobbyScene } from "@/components/afrometaverse/lobby/LobbyScene";
import "@/components/afrometaverse/lobby/lobby.css";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [{ title: "Lobby · Afrometaverse" }, { name: "description", content: "Your fighter, your modes, your kowry. Night in the village." }],
  }),
  component: LobbyPage,
});

type ModeId = "hunt" | "missions" | "arena" | "spirit";

const MODES: { id: ModeId; name: string; blurb: string; tag: string }[] = [
  { id: "hunt", name: "Hunt", blurb: "Track wildlife and spirits through the bush at dusk.", tag: "Open land" },
  { id: "missions", name: "Missions", blurb: "One-time story chapters. Earn kowry and standing.", tag: "Story" },
  { id: "arena", name: "Arena", blurb: "Duel other warriors in the compound ring.", tag: "PvP" },
  { id: "spirit", name: "Spirit Realm", blurb: "Cross the veil. Horror is optional, toggle it anytime.", tag: "Veil" },
];

export function LobbyPage() {
  const displayName = useCharacterStore((s) => s.appearance.displayName) || "Citizen";
  const tier = useCharacterStore((s) => s.wardrobeTier) || "commoner";
  const kowry = useKowryStore((s) => s.balance);
  // reputation is not in a shared store yet; use the game's default (24) so the level matches the city HUD
  const reputation = 24;
  const level = Math.min(99, 1 + Math.floor(reputation / 10));
  const [mode, setMode] = useState<ModeId>("hunt");
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="am-lobby">
      <div className="am-lobby-scene" aria-hidden="true">
        <LobbyScene shot="full" />
      </div>
      <div className="am-lobby-vignette" aria-hidden="true" />

      <aside className="am-lobby-left" aria-label="Player">
        <div className="am-lobby-badge">
          <span className="am-lobby-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
          <div className="am-lobby-badge-text">
            <strong>{displayName}</strong>
            <small>Lv {String(level).padStart(2, "0")} · {tier} tier</small>
          </div>
        </div>
        <div className="am-lobby-chip" role="status">
          <span className="am-lobby-chip-label">Kowry</span>
          <strong>{kowry.toLocaleString()}</strong>
        </div>
        <div className="am-lobby-stack">
          <button type="button" className="am-btn am-btn-secondary am-lobby-pill" onClick={() => setNote("Events open once live ops are wired.")}>
            Events
          </button>
          <button type="button" className="am-btn am-btn-secondary am-lobby-pill" onClick={() => setNote("Store opens with the economy ledger.")}>
            Store
          </button>
        </div>
        {note ? <p className="am-lobby-note" role="status">{note}</p> : null}
      </aside>

      <section className="am-lobby-right" aria-label="Modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`am-lobby-mode ${mode === m.id ? "am-lobby-mode-active" : ""}`}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            <span className="am-lobby-mode-tag">{m.tag}</span>
            <strong>{m.name}</strong>
            <small>{m.blurb}</small>
          </button>
        ))}
      </section>

      <button type="button" className="am-btn am-btn-primary am-lobby-loadout" onClick={() => setNote("Loadout editor opens from the character creator.")}>
        Loadout
      </button>
    </div>
  );
}
