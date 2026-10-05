import { useState } from "react";
import { LogIn, Mail, X } from "lucide-react";

type Mode = "signin" | "signup";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  authError: string | null;
  onSignInEmail: (email: string, password: string) => Promise<boolean>;
  onSignUpEmail: (email: string, password: string, displayName?: string) => Promise<boolean>;
  onSignInGoogle: () => Promise<boolean>;
};

export function AuthModal({
  open,
  onClose,
  authError,
  onSignInEmail,
  onSignUpEmail,
  onSignInGoogle,
}: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || password.length < 6) {
      setLocalError("Use a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const ok =
      mode === "signin"
        ? await onSignInEmail(email.trim(), password)
        : await onSignUpEmail(email.trim(), password, displayName.trim() || undefined);
    setBusy(false);
    if (ok) onClose();
  }

  async function handleGoogle() {
    setLocalError(null);
    setBusy(true);
    await onSignInGoogle();
    setBusy(false);
  }

  const error = localError || authError;

  return (
    <div className="am-auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="am-auth-title">
      <div className="am-auth-card">
        <div className="am-auth-head">
          <div>
            <h2 id="am-auth-title">{mode === "signin" ? "Welcome back" : "Join the city"}</h2>
            <p>Save your wallet, reputation and city day across devices.</p>
          </div>
          <button type="button" className="am-panel-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <button
          type="button"
          className="am-btn am-btn-secondary am-auth-google"
          onClick={handleGoogle}
          disabled={busy}
        >
          <LogIn size={16} />
          Continue with Google
        </button>

        <div className="am-auth-divider">
          <span>or email</span>
        </div>

        <form className="am-auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="am-auth-field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ekene Okoro"
                autoComplete="name"
              />
            </label>
          )}
          <label className="am-auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="am-auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {error && <p className="am-auth-error">{error}</p>}

          <button type="submit" className="am-btn am-btn-primary am-auth-submit" disabled={busy}>
            <Mail size={16} />
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="am-auth-switch">
          {mode === "signin" ? (
            <>
              New citizen?{" "}
              <button type="button" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button type="button" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="am-note am-auth-note">
          City Coins stay play money. Signing in only saves your progress in this simulation.
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
