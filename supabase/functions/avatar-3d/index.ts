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

const LIKENESS = `Preserve the EXACT likeness of this specific person: skin tone,
ethnicity, face shape, eye colour, eyebrows, nose, lips, hair colour and style,
facial hair, glasses, headwear, piercings and visible accessories. Do NOT change
race, gender, age, body type or distinctive features. It must clearly be THIS
person, not a generic character.`;

const STYLES: Record<string, string> = {
  pixar:
    "a high-end Pixar / Disney animated-film 3D character: glossy render, soft subsurface skin, slightly enlarged expressive eyes, cinematic studio rim lighting",
  memoji:
    "an Apple Memoji-style 3D avatar: smooth rounded shapes, slightly larger head, clean matte-gloss materials, bright soft lighting",
  clay: "a hand-made claymation 3D character (Aardman style): visible soft clay texture, subtle fingerprints, warm soft lighting",
  anime3d:
    "a cel-shaded 3D anime character: crisp outlines, vibrant shading, large detailed eyes keeping the real eye colour",
  chrome:
    "a futuristic cyber 3D character: polished chrome and glass accents, neon cyan and violet rim light, dark sleek background",
  figure:
    "a premium collectible vinyl action figure: plastic toy materials, slight sheen, studio product-shot lighting",
};

const INTENSITY: Record<number, string> = {
  1: "Keep stylisation subtle — close to realistic proportions.",
  2: "Use balanced stylisation.",
  3: "Use bold, strong stylisation while keeping the likeness.",
};

const ENHANCE_PROMPT = `Enhance this photo: improve lighting, remove noise, improve colour and
sharpness, make it look professional. Keep the person completely natural — no
filters, no stylisation, no face changes. Return only the improved photo.`;

const MAX_DATA_URL_CHARS = 14_000_000; // ~10MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Auth: only signed-in users may spend AI credits
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in first." }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.slice(7));
    if (authErr || !claims?.claims?.sub) return json({ error: "Please sign in first." }, 401);

    // Validate input
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";
    const mode = body?.mode === "enhance" ? "enhance" : "stylize";
    const style =
      typeof body?.style === "string" && STYLES[body.style] ? (body.style as string) : "pixar";
    const intensity = [1, 2, 3].includes(body?.intensity as number) ? (body.intensity as number) : 2;
    const extra =
      typeof body?.extra === "string" ? body.extra.slice(0, 300).replace(/[<>]/g, "") : "";

    if (!imageUrl) return json({ error: "imageUrl is required" }, 400);
    const isData = /^data:image\/(png|jpe?g|webp);base64,/i.test(imageUrl);
    const isHttp = /^https:\/\//i.test(imageUrl);
    if (!isData && !isHttp)
      return json({ error: "Image must be a JPG/PNG/WEBP data URL or https URL" }, 400);
    if (imageUrl.length > MAX_DATA_URL_CHARS)
      return json({ error: "Image too large — use a smaller photo." }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI is not configured on the server." }, 500);

    const prompt =
      mode === "enhance"
        ? ENHANCE_PROMPT
        : `Transform this real photograph into ${STYLES[style]}.
${LIKENESS}
${INTENSITY[intensity]}
Head-and-shoulders portrait, centred, facing forward, friendly expression unless
the photo shows a strong one. Clean soft gradient background, square framing,
sharp focus. No text, no watermark, no logos, no extra people.
${extra ? `Extra details from the user: ${extra}` : ""}
Return only the final 3D character image.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!ai.ok) {
      const text = await ai.text();
      console.error("AI gateway error", ai.status, text);
      let upstream = "";
      try {
        const parsed = JSON.parse(text);
        upstream = parsed?.error?.message ?? parsed?.message ?? "";
      } catch {
        /* ignore */
      }
      if (ai.status === 429) return json({ error: "Too many requests — try again in a moment." }, 429);
      if (ai.status === 402)
        return json(
          { error: upstream || "AI credits are used up. Add credits in workspace settings." },
          402,
        );
      if (ai.status === 403)
        return json({ error: upstream || "AI access is blocked for this workspace." }, 403);
      if (ai.status === 400)
        return json({ error: "That photo couldn't be processed. Try a different one." }, 400);
      return json({ error: "The AI service is busy. Please try again." }, 502);
    }

    const data = await ai.json();
    const out = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!out) {
      return json(
        {
          error:
            "The AI couldn't create an image from this photo. Try a clear, front-facing selfie.",
        },
        422,
      );
    }
    return json({ imageUrl: out, mode, style });
  } catch (err) {
    console.error("avatar-3d error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
