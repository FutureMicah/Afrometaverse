import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CitizenRow = Tables<"citizens">;

export type CitizenGear = {
  equipped: string;
  unlocked: string[];
  ammo: Record<string, number>;
};

export type CitizenProgress = {
  displayName: string;
  avatarInitials: string;
  balance: number;
  reputation: number;
  cityDay: number;
  completedJobs: string[];
  purchasedGoods: string[];
  votedFor: string | null;
  doneCourses: string[];
  likedPosts: string[];
  heatPoints: number;
  gear: CitizenGear;
};

const DEFAULT_GEAR: CitizenGear = {
  equipped: "none",
  unlocked: ["none", "stun"],
  ammo: { sidearm: 0, carbine: 0, stun: 12 },
};

const DEFAULT_PROGRESS: CitizenProgress = {
  displayName: "Ekene Okoro",
  avatarInitials: "EO",
  balance: 2450,
  reputation: 24,
  cityDay: 1,
  completedJobs: [],
  purchasedGoods: [],
  votedFor: null,
  doneCourses: [],
  likedPosts: [],
  heatPoints: 0,
  gear: DEFAULT_GEAR,
};

function parseGear(raw: unknown): CitizenGear {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GEAR, ammo: { ...DEFAULT_GEAR.ammo } };
  const g = raw as Record<string, unknown>;
  const ammoIn = (g["ammo"] && typeof g["ammo"] === "object" ? g["ammo"] : {}) as Record<string, number>;
  return {
    equipped: typeof g["equipped"] === "string" ? g["equipped"] : "none",
    unlocked: Array.isArray(g["unlocked"]) ? g["unlocked"].map(String) : ["none", "stun"],
    ammo: {
      sidearm: Number(ammoIn["sidearm"]) || 0,
      carbine: Number(ammoIn["carbine"]) || 0,
      stun: Number(ammoIn["stun"]) || 0,
    },
  };
}

function rowToProgress(row: CitizenRow): CitizenProgress {
  return {
    displayName: row.display_name,
    avatarInitials: row.avatar_initials,
    balance: row.balance,
    reputation: row.reputation,
    cityDay: row.city_day,
    completedJobs: Array.isArray(row.completed_jobs) ? row.completed_jobs : [],
    purchasedGoods: Array.isArray(row.purchased_goods) ? row.purchased_goods : [],
    votedFor: row.voted_for,
    doneCourses: Array.isArray(row.done_courses) ? row.done_courses : [],
    likedPosts: Array.isArray(row.liked_posts) ? row.liked_posts : [],
    heatPoints: typeof row.heat_points === "number" ? row.heat_points : 0,
    gear: parseGear(row.gear),
  };
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CI";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function useCitizenAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<CitizenProgress>(DEFAULT_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const progressRef = useRef(progress);
  const userRef = useRef(user);
  const pendingRef = useRef<Partial<CitizenProgress> | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const ensureCitizenRow = useCallback(async (u: User): Promise<CitizenRow | null> => {
    const { data: existing, error: readError } = await supabase
      .from("citizens")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();

    if (readError) {
      console.error("[citizen] load failed", readError);
      setAuthError(readError.message);
      return null;
    }

    if (existing) return existing;

    const metaName =
      (u.user_metadata?.["full_name"] as string | undefined) ||
      (u.user_metadata?.["name"] as string | undefined) ||
      u.email?.split("@")[0] ||
      "Citizen";

    const insertPayload = {
      id: u.id,
      display_name: metaName,
      avatar_initials: initialsFromName(metaName),
    };

    const { data: created, error: insertError } = await supabase
      .from("citizens")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      // Race: trigger may have created the row first
      const { data: retry } = await supabase
        .from("citizens")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();
      if (retry) return retry;
      console.error("[citizen] create failed", insertError);
      setAuthError(insertError.message);
      return null;
    }

    return created;
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const row = await ensureCitizenRow(nextSession.user);
        if (row) {
          setProgress(rowToProgress(row));
          setLastSavedAt(row.updated_at ? new Date(row.updated_at) : new Date());
        }
      } else {
        setProgress(DEFAULT_PROGRESS);
      }
    } catch (err) {
      console.error("[citizen] session error", err);
      setAuthError(err instanceof Error ? err.message : "Could not load session");
    } finally {
      setLoading(false);
    }
  }, [ensureCitizenRow]);

  useEffect(() => {
    void loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void ensureCitizenRow(nextSession.user).then((row) => {
          if (row) {
            setProgress(rowToProgress(row));
            setLastSavedAt(row.updated_at ? new Date(row.updated_at) : new Date());
          }
        });
      } else {
        setProgress(DEFAULT_PROGRESS);
        setLastSavedAt(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [ensureCitizenRow, loadSession]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    await loadSession();
    return true;
  }, [loadSession]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setAuthError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName || email.split("@")[0] },
        },
      });
      if (error) {
        setAuthError(error.message);
        return false;
      }
      await loadSession();
      return true;
    },
    [loadSession],
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : {},
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProgress(DEFAULT_PROGRESS);
    setLastSavedAt(null);
    pendingRef.current = null;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
  }, []);

  const flushSave = useCallback(async (): Promise<boolean> => {
    const u = userRef.current;
    const pending = pendingRef.current;
    if (!u || !pending) return true;

    pendingRef.current = null;
    const merged: CitizenProgress = { ...progressRef.current, ...pending };
    progressRef.current = merged;
    setProgress(merged);
    setSaving(true);
    setAuthError(null);

    const { error } = await supabase
      .from("citizens")
      .update({
        display_name: merged.displayName,
        avatar_initials: merged.avatarInitials,
        balance: merged.balance,
        reputation: merged.reputation,
        city_day: merged.cityDay,
        completed_jobs: merged.completedJobs,
        purchased_goods: merged.purchasedGoods,
        voted_for: merged.votedFor,
        done_courses: merged.doneCourses,
        liked_posts: merged.likedPosts,
        heat_points: merged.heatPoints,
        gear: merged.gear,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);

    setSaving(false);
    if (error) {
      console.error("[citizen] save failed", error);
      setAuthError(error.message);
      return false;
    }
    setLastSavedAt(new Date());
    return true;
  }, []);

  /** Optimistic local merge + debounced write (450ms). */
  const saveProgress = useCallback(
    async (next: Partial<CitizenProgress>) => {
      if (!userRef.current) return false;

      pendingRef.current = { ...(pendingRef.current ?? {}), ...next };
      const merged: CitizenProgress = { ...progressRef.current, ...pendingRef.current };
      progressRef.current = merged;
      setProgress(merged);

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      return new Promise<boolean>((resolve) => {
        saveTimerRef.current = window.setTimeout(() => {
          void flushSave().then(resolve);
        }, 450);
      });
    },
    [flushSave],
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !userRef.current) return false;
      const initials = initialsFromName(trimmed);
      return saveProgress({ displayName: trimmed, avatarInitials: initials });
    },
    [saveProgress],
  );

  return {
    session,
    user,
    isAuthenticated: !!user,
    progress,
    loading,
    saving,
    lastSavedAt,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    saveProgress,
    updateDisplayName,
    flushSave,
    setProgressLocal: setProgress,
    defaultProgress: DEFAULT_PROGRESS,
  };
}
