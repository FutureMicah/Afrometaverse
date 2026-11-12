import type { Database, Json } from "@/integrations/supabase/types";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CitizenRow = {
  id: string;
  display_name: string;
  avatar_initials: string;
  balance: number;
  reputation: number;
  city_day: number;
  completed_jobs: Json;
  purchased_goods: Json;
  voted_for: string | null;
  done_courses: Json;
  liked_posts: Json;
  heat_points: number;
  gear: Json;
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
      citizens: Table<CitizenRow, Partial<CitizenRow> & Pick<CitizenRow, "id">>;
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