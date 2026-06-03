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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_time: string
          caller_name: string
          caller_phone: string | null
          closed_at: string | null
          closed_by: string | null
          converted_lead_id: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number
          facilities: string[]
          id: string
          inquiry_types: string[]
          notes: string | null
          respondent_name: string
          status: string
          updated_at: string
        }
        Insert: {
          call_time?: string
          caller_name: string
          caller_phone?: string | null
          closed_at?: string | null
          closed_by?: string | null
          converted_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          facilities?: string[]
          id?: string
          inquiry_types?: string[]
          notes?: string | null
          respondent_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_time?: string
          caller_name?: string
          caller_phone?: string | null
          closed_at?: string | null
          closed_by?: string | null
          converted_lead_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          facilities?: string[]
          id?: string
          inquiry_types?: string[]
          notes?: string | null
          respondent_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clearances: {
        Row: {
          actual_pax: number
          additional_food_order: number
          cleared_by: string | null
          created_at: string
          deposit: number
          event_id: string
          hameco_additional_details: string | null
          hameco_additional_spend: number
          hameco_package_spend: number
          hameco_per_person: number
          id: string
          kiddie_meal_amount: number
          out_bound_contact: string | null
          source: Database["public"]["Enums"]["source_type"]
          top_up_balance: number
          total_fameco_spend: number
          total_hameco_spend: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          actual_pax: number
          additional_food_order?: number
          cleared_by?: string | null
          created_at?: string
          deposit?: number
          event_id: string
          hameco_additional_details?: string | null
          hameco_additional_spend?: number
          hameco_package_spend?: number
          hameco_per_person?: number
          id?: string
          kiddie_meal_amount?: number
          out_bound_contact?: string | null
          source: Database["public"]["Enums"]["source_type"]
          top_up_balance?: number
          total_fameco_spend?: number
          total_hameco_spend?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          actual_pax?: number
          additional_food_order?: number
          cleared_by?: string | null
          created_at?: string
          deposit?: number
          event_id?: string
          hameco_additional_details?: string | null
          hameco_additional_spend?: number
          hameco_package_spend?: number
          hameco_per_person?: number
          id?: string
          kiddie_meal_amount?: number
          out_bound_contact?: string | null
          source?: Database["public"]["Enums"]["source_type"]
          top_up_balance?: number
          total_fameco_spend?: number
          total_hameco_spend?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          content: string
          created_at: string
          event_id: string
          generated_by: string | null
          id: string
          signature_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          generated_by?: string | null
          id?: string
          signature_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          generated_by?: string | null
          id?: string
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          birthday_persons: Json | null
          cancellation_at: string | null
          cancellation_reason: string | null
          client_name: string
          confirm_warning_ack: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          confirmed_without_deposit: boolean
          contact_number: string
          cost_per_person: number
          created_at: string
          created_by: string | null
          email: string
          end_time: string
          event_date: string
          event_space: string
          event_type: Database["public"]["Enums"]["event_type"]
          facility: Database["public"]["Enums"]["facility"]
          how_did_you_hear: string | null
          id: string
          notes: string | null
          organization: string | null
          package_name: string
          package_options: Json | null
          pax: number
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          birthday_persons?: Json | null
          cancellation_at?: string | null
          cancellation_reason?: string | null
          client_name: string
          confirm_warning_ack?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_without_deposit?: boolean
          contact_number: string
          cost_per_person?: number
          created_at?: string
          created_by?: string | null
          email: string
          end_time: string
          event_date: string
          event_space: string
          event_type: Database["public"]["Enums"]["event_type"]
          facility: Database["public"]["Enums"]["facility"]
          how_did_you_hear?: string | null
          id?: string
          notes?: string | null
          organization?: string | null
          package_name: string
          package_options?: Json | null
          pax?: number
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          birthday_persons?: Json | null
          cancellation_at?: string | null
          cancellation_reason?: string | null
          client_name?: string
          confirm_warning_ack?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          confirmed_without_deposit?: boolean
          contact_number?: string
          cost_per_person?: number
          created_at?: string
          created_by?: string | null
          email?: string
          end_time?: string
          event_date?: string
          event_space?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          facility?: Database["public"]["Enums"]["facility"]
          how_did_you_hear?: string | null
          id?: string
          notes?: string | null
          organization?: string | null
          package_name?: string
          package_options?: Json | null
          pax?: number
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: []
      }
      facility_showcase: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comments: string | null
          contact: string
          created_at: string
          facility: string
          nature_of_visit: string | null
          id: string
          name: string
          satisfaction_level: string
          score: number
        }
        Insert: {
          comments?: string | null
          contact: string
          created_at?: string
          facility: string
          nature_of_visit?: string | null
          id?: string
          name: string
          satisfaction_level: string
          score: number
        }
        Update: {
          comments?: string | null
          contact?: string
          created_at?: string
          facility?: string
          nature_of_visit?: string | null
          id?: string
          name?: string
          satisfaction_level?: string
          score?: number
        }
        Relationships: []
      }
      membership: {
        Row: {
          created_at: string
          created_by: string | null
          guardian_email: string | null
          guardian_names: string
          guardian_phone: string | null
          id: string
          kid_dob: string | null
          kid_name: string
          membership_expiry: string
          membership_start: string
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_method: string | null
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guardian_email?: string | null
          guardian_names: string
          guardian_phone?: string | null
          id?: string
          kid_dob?: string | null
          kid_name: string
          membership_expiry?: string
          membership_start?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guardian_email?: string | null
          guardian_names?: string
          guardian_phone?: string | null
          id?: string
          kid_dob?: string | null
          kid_name?: string
          membership_expiry?: string
          membership_start?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          event_type: Database["public"]["Enums"]["event_type"]
          facility: string | null
          filled_by: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          preferred_date: string | null
          preferred_end_time: string | null
          preferred_start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          event_type: Database["public"]["Enums"]["event_type"]
          facility?: string | null
          filled_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          preferred_date?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          facility?: string | null
          filled_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          preferred_date?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          confirmation_code: string
          created_at: string
          created_by: string | null
          date_paid: string
          event_id: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
        }
        Insert: {
          amount: number
          confirmation_code: string
          created_at?: string
          created_by?: string | null
          date_paid: string
          event_id: string
          id?: string
          mode: Database["public"]["Enums"]["payment_mode"]
        }
        Update: {
          amount?: number
          confirmation_code?: string
          created_at?: string
          created_by?: string | null
          date_paid?: string
          event_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_date: string | null
          facility: Database["public"]["Enums"]["facility"] | null
          id: string
          image_url: string | null
          is_active: boolean
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_date?: string | null
          facility?: Database["public"]["Enums"]["facility"] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_date?: string | null
          facility?: Database["public"]["Enums"]["facility"] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          days_of_week: number[]
          description: string | null
          end_date: string
          facility: Database["public"]["Enums"]["facility"]
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          end_date: string
          facility: Database["public"]["Enums"]["facility"]
          id?: string
          is_active?: boolean
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_of_week?: number[]
          description?: string | null
          end_date?: string
          facility?: Database["public"]["Enums"]["facility"]
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      submit_public_lead: {
        Args: {
          p_name: string
          p_phone: string
          p_email: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_facility?: string | null
          p_preferred_date?: string | null
          p_preferred_start_time?: string | null
          p_preferred_end_time?: string | null
          p_notes?: string | null
          p_filled_by?: string | null
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "general_executive"
        | "clearance_executive"
        | "school_trips_executive"
        | "birthday_executive"
        | "league_executive"
        | "marketing_executive"
        | "logistics_executive"
        | "hangout_executive"
        | "sales_executive"
      event_status: "tentative" | "confirmed" | "cleared" | "canceled"
      event_type:
        | "birthday"
        | "school_trip"
        | "hangout"
        | "league_tournament"
        | "buyout"
        | "walk_in_rsvp"
        | "third_party_event"
        | "in_house_event"
      facility:
        | "village_bowl"
        | "under_the_sea"
        | "ozone_trampoline_park"
        | "mini_golf"
        | "rev"
        | "glitch"
        | "ballpoint"
      payment_mode: "mpesa" | "card" | "cash"
      source_type: "in_bound" | "out_bound"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "general_executive",
        "clearance_executive",
        "school_trips_executive",
        "birthday_executive",
        "league_executive",
        "marketing_executive",
        "logistics_executive",
        "hangout_executive",
        "sales_executive",
      ],
      event_status: ["tentative", "confirmed", "cleared", "canceled"],
      event_type: [
        "birthday",
        "school_trip",
        "hangout",
        "league_tournament",
        "buyout",
        "walk_in_rsvp",
        "third_party_event",
        "in_house_event",
      ],
      facility: [
        "village_bowl",
        "under_the_sea",
        "ozone_trampoline_park",
        "mini_golf",
        "rev",
        "glitch",
        "ballpoint",
      ],
      payment_mode: ["mpesa", "card", "cash"],
      source_type: ["in_bound", "out_bound"],
    },
  },
} as const
