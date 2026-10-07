import { useCallback, useRef, useState } from "react";
import { Check, RotateCw, X, ZoomIn, Sparkles } from "lucide-react";

type Props = {
  imageSrc: string;
  title?: string;
  /** round face crop vs full body */
  mode: "face" | "body";
  onSave: (editedDataUrl: string) => void;
  onCancel: () => void;
};

const FILTERS = [
  { name: "Original", value: "none" },
  { name: "Warm", value: "sepia(35%) saturate(120%)" },
  { name: "Cool", value: "hue-rotate(12deg) saturate(110%)" },
  { name: "Clear", value: "contrast(115%) brightness(105%)" },
  { name: "Soft", value: "brightness(108%) contrast(95%)" },
];

/**
 * Lightweight photo editor for character creation (no extra deps).
 * Face mode → square/round passport crop. Body mode → full-frame polish.
 */
export function PhotoImageEditor({ imageSrc, title, mode, onSave, onCancel }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState("none");
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSave = useCallback(async () => {
    setProcessing(true);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        image.onload = () => res();
        image.onerror = rej;
        image.src = imageSrc;
      });

      const size = mode === "face" ? 512 : 768;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");

      ctx.fillStyle = "#0f0f14";
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.filter = filter === "none" ? "none" : filter;

      const scale = zoom * Math.min(size / image.width, size / image.height) * (mode === "face" ? 1.15 : 1);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      // Circular mask for face passport style
      if (mode === "face") {
        const masked = document.createElement("canvas");
        masked.width = size;
        masked.height = size;
        const mctx = masked.getContext("2d");
        if (mctx) {
          mctx.beginPath();
          mctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
          mctx.closePath();
          mctx.clip();
          mctx.drawImage(canvas, 0, 0);
          onSave(masked.toDataURL("image/jpeg", 0.92));
          return;
        }
      }

      onSave(canvas.toDataURL("image/jpeg", 0.92));
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  }, [imageSrc, zoom, rotation, filter, mode, onSave]);

  return (
    <div className="am-photo-editor">
      <div className="am-photo-editor-head">
        <strong>{title ?? (mode === "face" ? "Edit face photo" : "Edit full-body photo")}</strong>
        <button type="button" className="am-icon-btn" onClick={onCancel} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="am-photo-editor-stage">
        <div
          className={`am-photo-editor-frame ${mode === "face" ? "am-photo-round" : ""}`}
          style={{ filter: filter === "none" ? undefined : filter }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Edit"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>

      <div className="am-photo-editor-controls">
        <label className="am-photo-slider">
          <span>
            <ZoomIn size={14} /> Zoom {Math.round(zoom * 100)}%
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="am-photo-slider">
          <span>
            <RotateCw size={14} /> Rotate {rotation}°
          </span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </label>

        <div className="am-character-row">
          <span className="am-gear-label">
            <Sparkles size={14} /> Filters
          </span>
          {FILTERS.map((f) => (
            <button
              key={f.name}
              type="button"
              className={`am-chip am-transport-chip ${filter === f.value ? "am-transport-active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="am-panel-actions">
          <button type="button" className="am-btn am-btn-secondary" onClick={onCancel} disabled={processing}>
            Cancel
          </button>
          <button type="button" className="am-btn am-btn-primary" onClick={handleSave} disabled={processing}>
            <Check size={16} /> {processing ? "Processing…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PhotoImageEditor;
