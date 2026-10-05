import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CitizenRow = Tables<"citizens">;

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
};

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
  };
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function useCitizenAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<CitizenProgress>(DEFAULT_PROGRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      (u.user_metadata?.full_name as string | undefined) ||
      (u.user_metadata?.name as string | undefined) ||
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
        if (row) setProgress(rowToProgress(row));
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
          if (row) setProgress(rowToProgress(row));
        });
      } else {
        setProgress(DEFAULT_PROGRESS);
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
      options: { redirectTo },
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
  }, []);

  const saveProgress = useCallback(
    async (next: Partial<CitizenProgress>) => {
      if (!user) return false;

      const merged: CitizenProgress = { ...progress, ...next };
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      setSaving(false);
      if (error) {
        console.error("[citizen] save failed", error);
        setAuthError(error.message);
        return false;
      }
      return true;
    },
    [progress, user],
  );

  return {
    session,
    user,
    isAuthenticated: !!user,
    progress,
    loading,
    saving,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    saveProgress,
    setProgressLocal: setProgress,
    defaultProgress: DEFAULT_PROGRESS,
  };
}
