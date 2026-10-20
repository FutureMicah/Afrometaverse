/**
 * Avatar 3D Studio — photo → stylized 3D character (Pixar, Memoji, clay, anime…).
 * Keeps the person's real likeness. Also supports plain "Enhance only" mode.
 *
 * Backend: supabase/functions/avatar-3d
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Wand2, Sparkles, Download, RefreshCw, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "avatar-3d";
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.9;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export type AvatarStyle =
  | "pixar"
  | "memoji"
  | "clay"
  | "anime3d"
  | "chrome"
  | "figure";

export type AvatarMode = "stylize" | "enhance";

export const AVATAR_STYLES: { id: AvatarStyle; label: string; hint: string }[] = [
  { id: "pixar", label: "Pixar", hint: "Glossy animated-film look" },
  { id: "memoji", label: "Memoji", hint: "Apple-style big-head avatar" },
  { id: "clay", label: "Clay", hint: "Soft hand-made claymation" },
  { id: "anime3d", label: "Anime 3D", hint: "Cel-shaded 3D anime" },
  { id: "chrome", label: "Cyber Chrome", hint: "Futuristic neon + metal" },
  { id: "figure", label: "Action Figure", hint: "Collectible toy in a box-art pose" },
];

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/** Shrink + re-encode so phone photos upload fast and stay under size limits. */
export async function prepareImage(src: string, maxSide = MAX_SIDE): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ConvertOptions {
  mode?: AvatarMode;
  style?: AvatarStyle;
  intensity?: 1 | 2 | 3;
  extra?: string;
}

export class AvatarConvertError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function convertTo3D(imageDataUrl: string, opts: ConvertOptions = {}): Promise<string> {
  const body = {
    imageUrl: imageDataUrl,
    mode: opts.mode ?? "stylize",
    style: opts.style ?? "pixar",
    intensity: opts.intensity ?? 2,
    extra: (opts.extra ?? "").slice(0, 300),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });

    if (!error && data?.imageUrl) return data.imageUrl as string;

    let status: number | undefined;
    let message = data?.error || "Conversion failed";
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.status === "number") {
      status = ctx.status;
      try {
        const j = await ctx.clone().json();
        if (j?.error) message = j.error;
      } catch {
        /* ignore */
      }
    }

    const retryable = status === 429 || (status !== undefined && status >= 500);
    if (retryable && attempt === 0) {
      await sleep(2000 + Math.random() * 1000);
      continue;
    }
    throw new AvatarConvertError(message, status);
  }
  throw new AvatarConvertError("Conversion failed");
}

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="am-avatar-compare">
      <img src={after} alt="3D result" className="am-avatar-compare-img" />
      <div className="am-avatar-compare-before" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt="Original"
          className="am-avatar-compare-img"
          style={{ width: `${10000 / Math.max(pos, 1)}%`, maxWidth: "none" }}
        />
      </div>
      <div className="am-avatar-compare-line" style={{ left: `${pos}%` }} />
      <span className="am-avatar-compare-label am-avatar-compare-label-l">Before</span>
      <span className="am-avatar-compare-label am-avatar-compare-label-r">After</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="am-avatar-compare-range"
      />
    </div>
  );
}

export interface Avatar3DStudioProps {
  initialImage?: string;
  onSave?: (imageDataUrl: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function Avatar3DStudio({ initialImage, onSave, onCancel, className = "" }: Avatar3DStudioProps) {
  const [source, setSource] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [style, setStyle] = useState<AvatarStyle>("pixar");
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<AvatarMode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialImage) return;
    prepareImage(initialImage)
      .then(setSource)
      .catch(() => setSource(initialImage));
  }, [initialImage]);

  const handleFile = useCallback(async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || /heic|heif/i.test(file.type)) {
      toast.error("Please choose a JPG, PNG or WEBP photo.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("Photo is too large (max 20MB).");
      return;
    }
    try {
      const raw = await fileToDataUrl(file);
      setSource(await prepareImage(raw));
      setResult(null);
      setErrorMsg(null);
    } catch {
      toast.error("Could not read that photo.");
    }
  }, []);

  const run = async (mode: AvatarMode) => {
    if (!source || busy) return;
    setBusy(mode);
    setErrorMsg(null);
    try {
      const url = await convertTo3D(source, { mode, style, intensity, extra });
      setResult(url);
      toast.success(mode === "enhance" ? "Photo enhanced!" : "Your 3D character is ready!");
    } catch (e) {
      const err = e as AvatarConvertError;
      setErrorMsg(err.message);
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `avatar-3d-${style}-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className={`am-avatar-studio ${className}`.trim()}>
      <div className="am-avatar-studio-header">
        <h2 className="am-avatar-studio-title">
          <Sparkles className="am-icon" /> 3D Avatar Studio
        </h2>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Close" className="am-avatar-icon-btn">
            <X className="am-icon" />
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="am-avatar-preview-wrap"
      >
        {source && result ? (
          <CompareSlider before={source} after={result} />
        ) : source ? (
          <img src={source} alt="Your photo" className="am-avatar-preview-img" />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="am-avatar-dropzone">
            <Upload className="am-icon-lg" />
            <span>Tap or drop a clear, front-facing selfie</span>
          </button>
        )}

        {busy && (
          <div className="am-avatar-busy">
            <Loader2 className="am-icon-lg am-spin" />
            <span>{busy === "enhance" ? "Enhancing…" : "Building your 3D character…"}</span>
            <span className="am-muted">Usually 10–30 seconds</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="am-hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="am-avatar-styles">
        {AVATAR_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            title={s.hint}
            className={`am-avatar-style-btn ${style === s.id ? "am-avatar-style-active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="am-avatar-intensity">
        <span className="am-muted">Style strength</span>
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setIntensity(n)}
            className={`am-avatar-intensity-btn ${intensity === n ? "am-avatar-style-active" : ""}`}
          >
            {n === 1 ? "Subtle" : n === 2 ? "Balanced" : "Bold"}
          </button>
        ))}
      </div>

      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value.slice(0, 300))}
        placeholder="Extra details (optional) e.g. smiling, gold chain"
        className="am-avatar-extra"
      />

      {errorMsg && <p className="am-avatar-error">{errorMsg}</p>}

      <div className="am-avatar-actions">
        <button
          type="button"
          onClick={() => run("stylize")}
          disabled={!source || !!busy}
          className="am-avatar-btn-primary"
        >
          {result ? <RefreshCw className="am-icon" /> : <Wand2 className="am-icon" />}
          {result ? "Regenerate" : "Make 3D"}
        </button>
        <button
          type="button"
          onClick={() => run("enhance")}
          disabled={!source || !!busy}
          className="am-avatar-btn"
        >
          <Sparkles className="am-icon" /> Enhance only
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          className="am-avatar-btn"
        >
          <Upload className="am-icon" /> New photo
        </button>
        <button type="button" onClick={download} disabled={!result || !!busy} className="am-avatar-btn">
          <Download className="am-icon" /> Download
        </button>
      </div>

      {onSave && (
        <button
          type="button"
          onClick={() => result && onSave(result)}
          disabled={!result || !!busy}
          className="am-avatar-btn-save"
        >
          <Check className="am-icon" /> Use this avatar
        </button>
      )}
    </div>
  );
}

export default Avatar3DStudio;
