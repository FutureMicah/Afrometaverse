import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TownPost = {
  id: string;
  author: string;
  text: string;
  likes: number;
  createdAt?: string;
};

export type CityEvent = {
  id: string;
  title: string;
  body: string;
  eventType: string;
  startsOnDay: number;
  endsOnDay: number;
};

export type VoteProposal = {
  id: string;
  title: string;
  blurb: string;
  votes: number;
  status: string;
  closesOnDay: number;
  outcomeNote: string | null;
};

export type PresencePeer = {
  userId: string;
  displayName: string;
  districtId: string | null;
};

const PRESENCE_TTL_MS = 90_000;
const HEARTBEAT_MS = 25_000;

function mapPost(row: Tables<"town_posts">): TownPost {
  return {
    id: row.id,
    author: row.author_name,
    text: row.body,
    likes: row.likes,
    createdAt: row.created_at,
  };
}

function mapEvent(row: Tables<"city_events">): CityEvent {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    eventType: row.event_type,
    startsOnDay: row.starts_on_day,
    endsOnDay: row.ends_on_day,
  };
}

function mapProposal(row: Tables<"vote_proposals">): VoteProposal {
  return {
    id: row.id,
    title: row.title,
    blurb: row.blurb,
    votes: row.vote_count,
    status: row.status,
    closesOnDay: row.closes_on_day,
    outcomeNote: row.outcome_note,
  };
}

type UseCityLiveArgs = {
  enabled: boolean;
  userId: string | null;
  displayName: string;
  districtId: string | null;
  cityDay: number;
  fallbackPosts: TownPost[];
  fallbackProposals: VoteProposal[];
};

export function useCityLive({
  enabled,
  userId,
  displayName,
  districtId,
  cityDay,
  fallbackPosts,
  fallbackProposals,
}: UseCityLiveArgs) {
  const [posts, setPosts] = useState<TownPost[]>(fallbackPosts);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [proposals, setProposals] = useState<VoteProposal[]>(fallbackProposals);
  const [online, setOnline] = useState<PresencePeer[]>([]);
  const [liveReady, setLiveReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heartbeatRef = useRef<number | undefined>(undefined);

  const loadStatic = useCallback(async () => {
    if (!enabled) {
      setPosts(fallbackPosts);
      setProposals(fallbackProposals);
      setEvents([]);
      setOnline([]);
      setLiveReady(false);
      return;
    }

    setError(null);
    try {
      const [postsRes, eventsRes, proposalsRes, presenceRes] = await Promise.all([
        supabase.from("town_posts").select("*").order("created_at", { ascending: false }).limit(40),
        supabase
          .from("city_events")
          .select("*")
          .eq("is_active", true)
          .lte("starts_on_day", cityDay)
          .gte("ends_on_day", cityDay)
          .order("starts_on_day", { ascending: true }),
        supabase.from("vote_proposals").select("*").order("id", { ascending: true }),
        supabase
          .from("presence")
          .select("*")
          .gte("last_seen", new Date(Date.now() - PRESENCE_TTL_MS).toISOString()),
      ]);

      if (postsRes.error) throw postsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (proposalsRes.error) throw proposalsRes.error;
      if (presenceRes.error) throw presenceRes.error;

      const remotePosts = (postsRes.data ?? []).map(mapPost);
      setPosts(remotePosts.length > 0 ? remotePosts : fallbackPosts);
      setEvents((eventsRes.data ?? []).map(mapEvent));
      const remoteProps = (proposalsRes.data ?? []).map(mapProposal);
      setProposals(remoteProps.length > 0 ? remoteProps : fallbackProposals);
      setOnline(
        (presenceRes.data ?? []).map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          districtId: row.district_id,
        })),
      );
      setLiveReady(true);

      // Resolve votes if the city day has passed the close day
      void supabase.rpc("resolve_votes_for_day", { p_day: cityDay }).then(({ error: rpcErr }) => {
        if (rpcErr) console.warn("[city-live] resolve votes", rpcErr.message);
        else {
          void supabase
            .from("vote_proposals")
            .select("*")
            .order("id", { ascending: true })
            .then(({ data }) => {
              if (data?.length) setProposals(data.map(mapProposal));
            });
        }
      });
    } catch (err) {
      console.error("[city-live] load failed", err);
      setError(err instanceof Error ? err.message : "Could not load live city data");
      setPosts(fallbackPosts);
      setProposals(fallbackProposals);
      setLiveReady(false);
    }
  }, [cityDay, enabled, fallbackPosts, fallbackProposals]);

  // Initial + day change load
  useEffect(() => {
    void loadStatic();
  }, [loadStatic]);

  // Realtime subscriptions
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("city-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "town_posts" },
        (payload) => {
          const row = payload.new as Tables<"town_posts">;
          setPosts((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [mapPost(row), ...prev].slice(0, 50);
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "town_posts" },
        (payload) => {
          const row = payload.new as Tables<"town_posts">;
          setPosts((prev) => prev.map((p) => (p.id === row.id ? mapPost(row) : p)));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        () => {
          void supabase
            .from("presence")
            .select("*")
            .gte("last_seen", new Date(Date.now() - PRESENCE_TTL_MS).toISOString())
            .then(({ data }) => {
              setOnline(
                (data ?? []).map((row) => ({
                  userId: row.user_id,
                  displayName: row.display_name,
                  districtId: row.district_id,
                })),
              );
            });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vote_proposals" },
        (payload) => {
          const row = payload.new as Tables<"vote_proposals">;
          setProposals((prev) => {
            const next = prev.map((p) => (p.id === row.id ? mapProposal(row) : p));
            if (!next.some((p) => p.id === row.id)) next.push(mapProposal(row));
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  // Presence heartbeat
  useEffect(() => {
    if (!enabled || !userId) return;

    const beat = async () => {
      const { error: upErr } = await supabase.from("presence").upsert({
        user_id: userId,
        display_name: displayName,
        district_id: districtId,
        last_seen: new Date().toISOString(),
      });
      if (upErr) console.warn("[presence]", upErr.message);
    };

    void beat();
    heartbeatRef.current = window.setInterval(() => void beat(), HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    };
  }, [districtId, displayName, enabled, userId]);

  const publishPost = useCallback(
    async (text: string) => {
      if (!enabled || !userId) return null;
      const body = text.trim().slice(0, 280);
      if (!body) return null;

      const { data, error: insertError } = await supabase
        .from("town_posts")
        .insert({
          author_id: userId,
          author_name: displayName,
          body,
        })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }
      const mapped = mapPost(data);
      setPosts((prev) => (prev.some((p) => p.id === mapped.id) ? prev : [mapped, ...prev]));
      return mapped;
    },
    [displayName, enabled, userId],
  );

  const likeRemotePost = useCallback(
    async (postId: string) => {
      if (!enabled) return false;
      const current = posts.find((p) => p.id === postId);
      if (!current) return false;
      const { error: upErr } = await supabase
        .from("town_posts")
        .update({ likes: current.likes + 1 })
        .eq("id", postId);
      if (upErr) {
        setError(upErr.message);
        return false;
      }
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: p.likes + 1 } : p)),
      );
      return true;
    },
    [enabled, posts],
  );

  const castLiveVote = useCallback(
    async (proposalId: string) => {
      if (!enabled || !userId) return false;
      const { error: rpcErr } = await supabase.rpc("cast_civic_vote", {
        p_proposal_id: proposalId,
        p_season: "003",
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return false;
      }
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, votes: p.votes + 1 } : p)),
      );
      return true;
    },
    [enabled, userId],
  );

  return {
    posts,
    setPosts,
    events,
    proposals,
    onlineCount: online.length,
    online,
    liveReady,
    error,
    publishPost,
    likeRemotePost,
    castLiveVote,
    refresh: loadStatic,
  };
}
