/**
 * NPC dialogue from player action + scene + reputation via Lovable AI Gateway.
 * POST { action, scene, reputation, heat?, wanted?, displayName? }
 * → { reply, speaker, mood, reputationHint }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function sanitize(s: string, max = 400): string {
  return s.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in to speak with the city." }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.slice(7));
    if (authErr || !claims?.claims?.sub) {
      return json({ error: "Sign in to speak with the city." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const action = typeof body.action === "string" ? sanitize(body.action, 320) : "";
    if (!action || action.length < 2) {
      return json({ error: "Describe what you want to do or say." }, 400);
    }

    const scene =
      body.scene && typeof body.scene === "object" && body.scene !== null
        ? (body.scene as Record<string, unknown>)
        : {};

    const reputation = Math.max(0, Math.min(99, Number(body.reputation) || 0));
    const heat = Math.max(0, Math.min(100, Number(body.heat) || 0));
    const wanted = Math.max(0, Math.min(5, Number(body.wanted) || 0));
    const displayName =
      typeof body.displayName === "string" ? sanitize(body.displayName, 40) : "Citizen";

    const district = typeof scene.district === "string" ? sanitize(scene.district, 60) : "the village";
    const place = typeof scene.place === "string" ? sanitize(scene.place, 80) : district;
    const timeOfDay = typeof scene.timeOfDay === "string" ? sanitize(scene.timeOfDay, 24) : "day";
    const weather = typeof scene.weather === "string" ? sanitize(scene.weather, 40) : "clear";
    const interior = typeof scene.interior === "string" ? sanitize(scene.interior, 60) : "";
    const recentLog = Array.isArray(scene.recentLog)
      ? scene.recentLog
          .filter((x): x is string => typeof x === "string")
          .slice(0, 4)
          .map((x) => sanitize(x, 80))
      : [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI is not configured on the server (LOVABLE_API_KEY)." }, 500);
    }

    const system = `You are the living voice of NPCs in AfroMetaverse — a pre-colonial-inspired West African village / city sim (Port Harcourt flavoured, no modern neon/guns in speech).
Write short in-character dialogue only. Rules:
- Respond as ONE nearby NPC reacting to the player's action.
- Tone must fit reputation (${reputation}/99), heat (${heat}), wanted (${wanted}).
  * High reputation (60+): respect, soft deference, open trade talk.
  * Mid (25–59): ordinary neighbourly talk, cautious curiosity.
  * Low (<25): suspicion, shorter answers, possible refusal.
  * High heat/wanted: fear, warnings, people keep distance.
- Setting: ${place}${interior ? ` (inside ${interior})` : ""}, ${timeOfDay}, weather ${weather}.
- Pre-colonial / traditional social texture: elders, market gossip, compounds, kowry, paths, sacred grove — no smartphones, cars, or modern slang.
- Keep reply under 60 words. No markdown, no stage directions in asterisks.
- Return STRICT JSON only:
{"speaker":"Name or role","mood":"warm|wary|proud|fearful|amused|stern","reply":"dialogue text","reputationHint":"optional one-line social consequence"}`;

    const user = `Player name: ${displayName}
Reputation: ${reputation}/99 · Heat: ${heat} · Wanted: ${wanted}
Location: ${place}${interior ? ` / ${interior}` : ""} · ${timeOfDay} · ${weather}
Recent events: ${recentLog.length ? recentLog.join(" | ") : "quiet morning"}
Player action: ${action}

Respond with JSON only.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
      }),
    });

    if (!ai.ok) {
      const text = await ai.text();
      console.error("npc-dialogue gateway", ai.status, text);
      if (ai.status === 429) return json({ error: "Too many requests — try again shortly." }, 429);
      if (ai.status === 402) return json({ error: "AI credits are used up. Add credits in workspace settings." }, 402);
      if (ai.status === 403) return json({ error: "AI access is blocked for this workspace." }, 403);
      return json({ error: "The city is quiet right now. Try again." }, 502);
    }

    const data = await ai.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
    let parsed: {
      speaker?: string;
      mood?: string;
      reply?: string;
      reputationHint?: string;
    } = {};
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      }
    } catch {
      parsed = { reply: raw.slice(0, 280), speaker: "Villager", mood: "wary" };
    }

    const reply = sanitize(String(parsed.reply ?? raw), 400);
    if (!reply) return json({ error: "No reply came back. Try a clearer action." }, 422);

    return json({
      speaker: sanitize(String(parsed.speaker ?? "Villager"), 40),
      mood: sanitize(String(parsed.mood ?? "wary"), 20),
      reply,
      reputationHint: parsed.reputationHint
        ? sanitize(String(parsed.reputationHint), 120)
        : undefined,
    });
  } catch (err) {
    console.error("npc-dialogue error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
