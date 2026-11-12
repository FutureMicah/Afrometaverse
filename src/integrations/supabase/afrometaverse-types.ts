import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CitizenGearRow = {
  equipped: string;
  unlocked: string[];
  ammo: Record<string, number>;
};

type CitizenRowShape = {
  id: string;
  display_name: string;
  avatar_initials: string;
  balance: number;
  reputation: number;
  city_day: number;
  completed_jobs: string[];
  purchased_goods: string[];
  voted_for: string | null;
  done_courses: string[];
  liked_posts: string[];
  heat_points: number;
  gear: CitizenGearRow;
  created_at: string;
  updated_at: string;
};

type TownPostRow = {
  id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  likes: number;
  created_at: string;
};

type PresenceRow = {
  user_id: string;
  display_name: string;
  district_id: string | null;
  last_seen: string;
};

type CityEventRow = {
  id: string;
  title: string;
  body: string;
  event_type: string;
  starts_on_day: number;
  ends_on_day: number;
  is_active: boolean;
  created_at: string;
};

type VoteProposalRow = {
  id: string;
  season: string;
  title: string;
  blurb: string;
  vote_count: number;
  status: string;
  closes_on_day: number;
  outcome_note: string | null;
  created_at: string;
};

export type AfroMetaverseDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: {
      citizens: Table<CitizenRowShape, Partial<CitizenRowShape> & Pick<CitizenRowShape, "id">>;
      town_posts: Table<
        TownPostRow,
        Partial<TownPostRow> & Pick<TownPostRow, "author_name" | "body">
      >;
      presence: Table<
        PresenceRow,
        Partial<PresenceRow> & Pick<PresenceRow, "user_id" | "display_name">
      >;
      city_events: Table<CityEventRow, Partial<CityEventRow>>;
      vote_proposals: Table<VoteProposalRow, Partial<VoteProposalRow> & Pick<VoteProposalRow, "id" | "title" | "blurb">>;
      citizen_votes: Table<
        { citizen_id: string; proposal_id: string; season: string; created_at: string },
        { citizen_id: string; proposal_id: string; season?: string; created_at?: string }
      >;
    };
    Functions: {
      resolve_votes_for_day: { Args: { p_day: number }; Returns: undefined };
      cast_civic_vote: {
        Args: { p_proposal_id: string; p_season?: string };
        Returns: undefined;
      };
    };
  };
};

export type CitizenRow = AfroMetaverseDatabase["public"]["Tables"]["citizens"]["Row"];

export const afroMetaverseSupabase = supabase as unknown as SupabaseClient<AfroMetaverseDatabase>;