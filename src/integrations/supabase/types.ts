export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      citizens: {
        Row: {
          id: string
          display_name: string
          avatar_initials: string
          balance: number
          reputation: number
          city_day: number
          completed_jobs: string[]
          purchased_goods: string[]
          voted_for: string | null
          done_courses: string[]
          liked_posts: string[]
          heat_points: number
          gear: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          avatar_initials?: string
          balance?: number
          reputation?: number
          city_day?: number
          completed_jobs?: string[]
          purchased_goods?: string[]
          voted_for?: string | null
          done_courses?: string[]
          liked_posts?: string[]
          heat_points?: number
          gear?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_initials?: string
          balance?: number
          reputation?: number
          city_day?: number
          completed_jobs?: string[]
          purchased_goods?: string[]
          voted_for?: string | null
          done_courses?: string[]
          liked_posts?: string[]
          heat_points?: number
          gear?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      town_posts: {
        Row: {
          id: string
          author_id: string | null
          author_name: string
          body: string
          likes: number
          created_at: string
        }
        Insert: {
          id?: string
          author_id?: string | null
          author_name: string
          body: string
          likes?: number
          created_at?: string
        }
        Update: {
          id?: string
          author_id?: string | null
          author_name?: string
          body?: string
          likes?: number
          created_at?: string
        }
        Relationships: []
      }
      presence: {
        Row: {
          user_id: string
          display_name: string
          district_id: string | null
          last_seen: string
        }
        Insert: {
          user_id: string
          display_name: string
          district_id?: string | null
          last_seen?: string
        }
        Update: {
          user_id?: string
          display_name?: string
          district_id?: string | null
          last_seen?: string
        }
        Relationships: []
      }
      city_events: {
        Row: {
          id: string
          title: string
          body: string
          event_type: string
          starts_on_day: number
          ends_on_day: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          event_type?: string
          starts_on_day: number
          ends_on_day: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          event_type?: string
          starts_on_day?: number
          ends_on_day?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      vote_proposals: {
        Row: {
          id: string
          season: string
          title: string
          blurb: string
          vote_count: number
          status: string
          closes_on_day: number
          outcome_note: string | null
          created_at: string
        }
        Insert: {
          id: string
          season?: string
          title: string
          blurb: string
          vote_count?: number
          status?: string
          closes_on_day?: number
          outcome_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          season?: string
          title?: string
          blurb?: string
          vote_count?: number
          status?: string
          closes_on_day?: number
          outcome_note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      citizen_votes: {
        Row: {
          citizen_id: string
          proposal_id: string
          season: string
          created_at: string
        }
        Insert: {
          citizen_id: string
          proposal_id: string
          season?: string
          created_at?: string
        }
        Update: {
          citizen_id?: string
          proposal_id?: string
          season?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_civic_vote: {
        Args: { p_proposal_id: string; p_season?: string }
        Returns: undefined
      }
      resolve_votes_for_day: {
        Args: { p_day: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
