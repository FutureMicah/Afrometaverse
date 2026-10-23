import type {
  BodyShape,
  CharacterAppearance,
  EyeShape,
  Gender,
  HairStyle,
  HeightId,
} from "@/stores/characterStore";

export type PhotoAnalysis = {
  skin: string;
  bodyShape: BodyShape;
  height: HeightId;
  genderGuess: Gender;
  eyeColor: string;
  hairColor: string;
  hair: HairStyle;
  eyeShape: EyeShape;
  confidence: number;
  notes: string[];
};

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Sample dominant skin-like pixels from centre of face crop */
async function sampleFaceSkin(faceSrc: string): Promise<{ skin: string; eyeColor: string; hairColor: string }> {
  const img = await loadImage(faceSrc);
  const canvas = document.createElement("canvas");
  const w = 64;
  const h = 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { skin: "#8d5524", eyeColor: "#2c1810", hairColor: "#1a1a1a" };
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let sr = 0, sg = 0, sb = 0, sn = 0;
  let hr = 0, hg = 0, hb = 0, hn = 0;
  // Cheek / centre band for skin
  for (let y = 28; y < 48; y++) {
    for (let x = 20; x < 44; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
      // skin-ish: r > g > b roughly, not too dark/bright
      if (r > 40 && r > b && r >= g - 15) {
        sr += r; sg += g; sb += b; sn++;
      }
    }
  }
  // Top band for hair
  for (let y = 2; y < 18; y++) {
    for (let x = 16; x < 48; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
      const lum = (r + g + b) / 3;
      if (lum < 90) {
        hr += r; hg += g; hb += b; hn++;
      }
    }
  }
  // Eye region mid
  let er = 0, eg = 0, eb = 0, en = 0;
  for (let y = 24; y < 32; y++) {
    for (let x = 22; x < 42; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
      const lum = (r + g + b) / 3;
      if (lum < 70) {
        er += r; eg += g; eb += b; en++;
      }
    }
  }

  const skin =
    sn > 5
      ? rgbToHex(sr / sn, sg / sn, sb / sn)
      : "#8d5524";
  const hairColor =
    hn > 5 ? rgbToHex(hr / hn, hg / hn, hb / hn) : "#1a1a1a";
  const eyeColor =
    en > 3 ? rgbToHex(er / en, eg / en, eb / en) : "#2c1810";

  return { skin, hairColor, eyeColor };
}

async function sampleBodyShape(bodySrc: string): Promise<{ bodyShape: BodyShape; height: HeightId }> {
  const img = await loadImage(bodySrc);
  const ratio = img.height / Math.max(1, img.width);
  // Tall full-body photos tend to be taller aspect
  let height: HeightId = "average";
  if (ratio > 1.7) height = "tall";
  else if (ratio < 1.25) height = "short";

  // Sample mid-frame width occupancy vs edges — crude silhouette width
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { bodyShape: "average", height };
  ctx.drawImage(img, 0, 0, 48, 96);
  const data = ctx.getImageData(0, 0, 48, 96).data;

  // Count non-background-ish pixels in torso band
  let filled = 0;
  for (let y = 30; y < 60; y++) {
    for (let x = 8; x < 40; x++) {
      const i = (y * 48 + x) * 4;
      const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
      const lum = (r + g + b) / 3;
      // assume light/studio bg → subject darker or coloured
      if (lum < 210) filled++;
    }
  }
  const density = filled / (30 * 32);
  let bodyShape: BodyShape = "average";
  if (density > 0.62) bodyShape = "broad";
  else if (density > 0.52) bodyShape = "athletic";
  else if (density < 0.35) bodyShape = "slim";
  else if (density > 0.45 && density < 0.55) bodyShape = "curvy";

  return { bodyShape, height };
}

/**
 * Convert passport face + full-body photos into a unique CharacterAppearance seed.
 * Client-side heuristic — not true ML reconstruction, but every pair of photos
 * yields a distinct citizen that can then be edited by level.
 */
export async function analyzePhotosToAppearance(opts: {
  faceSrc: string;
  bodySrc: string;
  displayName?: string;
  genderHint?: Gender;
}): Promise<{ appearance: Partial<CharacterAppearance>; analysis: PhotoAnalysis }> {
  const notes: string[] = [];
  const face = await sampleFaceSkin(opts.faceSrc);
  const body = await sampleBodyShape(opts.bodySrc);

  notes.push(`Skin sampled from face photo (${face.skin}).`);
  notes.push(`Body read as ${body.bodyShape} / ${body.height}.`);

  // Seed from image data length + colour
  const seed =
    (opts.faceSrc.length * 13 + opts.bodySrc.length * 7 + parseInt(face.skin.slice(1, 3), 16)) %
    9999;

  const hairs: HairStyle[] = ["short", "afro", "braids", "bob", "bun", "long"];
  const eyes: EyeShape[] = ["almond", "round", "hooded", "wide"];

  const gender = opts.genderHint ?? (seed % 2 === 0 ? "female" : "male");

  const analysis: PhotoAnalysis = {
    skin: face.skin,
    bodyShape: body.bodyShape,
    height: body.height,
    genderGuess: gender,
    eyeColor: face.eyeColor,
    hairColor: face.hairColor,
    hair: hairs[seed % hairs.length] ?? "short",
    eyeShape: eyes[seed % eyes.length] ?? "almond",
    confidence: 0.55 + (seed % 30) / 100,
    notes,
  };

  const appearance: Partial<CharacterAppearance> = {
    displayName: opts.displayName?.trim() || "Citizen",
    gender: analysis.genderGuess,
    skin: analysis.skin,
    bodyShape: analysis.bodyShape,
    height: analysis.height,
    hair: analysis.hair,
    hairColor: analysis.hairColor,
    eyeColor: analysis.eyeColor,
    eyeShape: analysis.eyeShape,
    detailSeed: seed,
    faceMark: seed % 5 === 0 ? "freckles" : seed % 7 === 0 ? "cheek-mole" : "none",
    leftEarPiercing: seed % 3 === 0,
    rightEarPiercing: seed % 4 === 0,
    browStrength: 0.45 + (seed % 5) * 0.1,
    posture: (["relaxed", "confident", "upright", "shy"] as const)[seed % 4] ?? "relaxed",
  };

  return { appearance, analysis };
}

/** Level-gated edit unlocks */
export function editsUnlockedAtLevel(level: number): {
  basic: boolean;
  face: boolean;
  marks: boolean;
  tailor: boolean;
  advanced: boolean;
} {
  return {
    basic: true, // gender, body, height, skin, hair — after create
    face: level >= 2,
    marks: level >= 3,
    tailor: level >= 4,
    advanced: level >= 5, // randomize, piercings stack, etc.
  };
}
