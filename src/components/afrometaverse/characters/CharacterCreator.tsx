import { useRef, useState } from "react";
import { Camera, IdCard, User, Wand2 } from "lucide-react";
import { analyzePhotosToAppearance } from "@/lib/photoToCharacter";
import { useCharacterStore, type Gender } from "@/stores/characterStore";
import { CharacterPreview } from "./CharacterPreview";
import { PhotoImageEditor } from "./PhotoImageEditor";

type Props = {
  open: boolean;
  displayName?: string;
  onComplete: () => void;
  onSkip?: () => void;
};

type Step = "upload" | "edit-face" | "edit-body" | "review";

/**
 * Account profile character creation:
 * 1) Upload clear full-body + passport-style face photos
 * 2) Edit each (crop/zoom/rotate/filter)
 * 3) Convert → unique procedural citizen resembling the photos
 * 4) Review on turntable, then enter city (further edits unlock by level)
 */
export function CharacterCreator({ open, displayName, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [faceRaw, setFaceRaw] = useState<string | null>(null);
  const [bodyRaw, setBodyRaw] = useState<string | null>(null);
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [bodyPhoto, setBodyPhoto] = useState<string | null>(null);
  const [genderHint, setGenderHint] = useState<Gender>("female");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const applyFromPhotos = useCharacterStore((s) => s.applyFromPhotos);
  const appearance = useCharacterStore((s) => s.appearance);

  const faceInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function onPickFace(file: File | null) {
    if (!file) return;
    const data = await readFile(file);
    setFaceRaw(data);
    setStep("edit-face");
  }

  async function onPickBody(file: File | null) {
    if (!file) return;
    const data = await readFile(file);
    setBodyRaw(data);
    setStep("edit-body");
  }

  async function buildCharacter() {
    if (!facePhoto || !bodyPhoto) {
      setError("Add both a face photo and a full-body photo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { appearance: partial, analysis } = await analyzePhotosToAppearance({
        faceSrc: facePhoto,
        bodySrc: bodyPhoto,
        displayName,
        genderHint,
      });
      applyFromPhotos({
        appearance: partial,
        facePhoto,
        bodyPhoto,
      });
      setNotes(analysis.notes);
      setStep("review");
    } catch (e) {
      console.error(e);
      setError("Could not read those photos. Try clearer, well-lit images.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="am-creator-overlay">
      <div className="am-creator-card">
        <div className="am-creator-head">
          <Wand2 size={20} />
          <div>
            <strong>Create your citizen</strong>
            <p className="am-panel-tip">
              Upload a clear face (passport-style) and a clear full-body photo. We build a unique
              3D character from your images — then you refine it as you level up.
            </p>
          </div>
        </div>

        {step === "upload" && (
          <div className="am-creator-body">
            <div className="am-character-row">
              <span className="am-gear-label">I present as</span>
              {(["female", "male"] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`am-chip am-transport-chip ${genderHint === g ? "am-transport-active" : ""}`}
                  onClick={() => setGenderHint(g)}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="am-creator-uploads">
              <button type="button" className="am-upload-tile" onClick={() => faceInput.current?.click()}>
                <IdCard size={28} />
                <strong>Face photo</strong>
                <span>Clear, front-facing, like a passport / ID</span>
                {facePhoto && <span className="am-chip am-transport-active">Ready</span>}
              </button>
              <button type="button" className="am-upload-tile" onClick={() => bodyInput.current?.click()}>
                <User size={28} />
                <strong>Full-body photo</strong>
                <span>Standing, well lit, whole figure visible</span>
                {bodyPhoto && <span className="am-chip am-transport-active">Ready</span>}
              </button>
            </div>

            <input
              ref={faceInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickFace(e.target.files?.[0] ?? null)}
            />
            <input
              ref={bodyInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickBody(e.target.files?.[0] ?? null)}
            />

            {error && <p className="am-auth-error">{error}</p>}

            <div className="am-panel-actions">
              {onSkip && (
                <button type="button" className="am-btn am-btn-secondary" onClick={onSkip}>
                  Skip for now
                </button>
              )}
              <button
                type="button"
                className="am-btn am-btn-primary"
                disabled={!facePhoto || !bodyPhoto || busy}
                onClick={buildCharacter}
              >
                <Camera size={16} /> {busy ? "Building…" : "Build my character"}
              </button>
            </div>
          </div>
        )}

        {step === "edit-face" && faceRaw && (
          <PhotoImageEditor
            imageSrc={faceRaw}
            mode="face"
            title="Frame your face"
            onCancel={() => setStep("upload")}
            onSave={(data) => {
              setFacePhoto(data);
              setStep("upload");
            }}
          />
        )}

        {step === "edit-body" && bodyRaw && (
          <PhotoImageEditor
            imageSrc={bodyRaw}
            mode="body"
            title="Frame your full body"
            onCancel={() => setStep("upload")}
            onSave={(data) => {
              setBodyPhoto(data);
              setStep("upload");
            }}
          />
        )}

        {step === "review" && (
          <div className="am-creator-body">
            <p className="am-panel-tip">
              This citizen is unique to your photos. Basic edits are open now; face marks, tailor
              fit, and advanced details unlock as you level up in Port Harcourt.
            </p>
            <CharacterPreview height={280} />
            <div className="am-creator-photos">
              {facePhoto && <img src={facePhoto} alt="Face ref" className="am-creator-thumb am-photo-round" />}
              {bodyPhoto && <img src={bodyPhoto} alt="Body ref" className="am-creator-thumb" />}
            </div>
            <ul className="am-outfit-tips">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                Name: <strong>{appearance.displayName}</strong> · seed #{appearance.detailSeed}
              </li>
            </ul>
            <div className="am-panel-actions">
              <button
                type="button"
                className="am-btn am-btn-secondary"
                onClick={() => {
                  setStep("upload");
                }}
              >
                Rebuild
              </button>
              <button type="button" className="am-btn am-btn-primary" onClick={onComplete}>
                Enter the city
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterCreator;
