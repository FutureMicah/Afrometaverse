import { createFileRoute } from "@tanstack/react-router";
import { CombatArena } from "@/components/afrometaverse/combat/CombatArena";
import "@/components/afrometaverse/combat/combat.css";

// Dev-only route. Hidden in production builds: the component renders nothing unless import.meta.env.DEV.
export const Route = createFileRoute("/dev/combat")({
  head: () => ({ meta: [{ title: "Combat arena (dev) · Afrometaverse" }] }),
  component: DevCombatPage,
});

function DevCombatPage() {
  if (!import.meta.env.DEV) return null;
  return <CombatArena />;
}
