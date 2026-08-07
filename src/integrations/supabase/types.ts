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
      cascade_loop_changes: {
        Row: {
          created_at: string
          description: string
          id: string
          line_group: Database["public"]["Enums"]["line_group"]
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_group: Database["public"]["Enums"]["line_group"]
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_group?: Database["public"]["Enums"]["line_group"]
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cascade_loop_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      line_inserts: {
        Row: {
          created_at: string
          description: string
          id: string
          length_change_mm: number
          line_spec_id: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          length_change_mm?: number
          line_spec_id?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          length_change_mm?: number
          line_spec_id?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_inserts_line_spec_id_fkey"
            columns: ["line_spec_id"]
            isOneToOne: false
            referencedRelation: "line_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_inserts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      line_materials: {
        Row: {
          created_at: string
          diameter_mm: number | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diameter_mm?: number | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diameter_mm?: number | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      line_specs: {
        Row: {
          created_at: string
          factory_length_mm: number
          id: string
          label: string
          line_group: Database["public"]["Enums"]["line_group"]
          material_id: string | null
          model_id: string
          point_index: number | null
          row_index: number
          side: Database["public"]["Enums"]["line_side"] | null
          sort_order: number
          tolerance_mm: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          factory_length_mm: number
          id?: string
          label: string
          line_group: Database["public"]["Enums"]["line_group"]
          material_id?: string | null
          model_id: string
          point_index?: number | null
          row_index?: number
          side?: Database["public"]["Enums"]["line_side"] | null
          sort_order?: number
          tolerance_mm?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          factory_length_mm?: number
          id?: string
          label?: string
          line_group?: Database["public"]["Enums"]["line_group"]
          material_id?: string | null
          model_id?: string
          point_index?: number | null
          row_index?: number
          side?: Database["public"]["Enums"]["line_side"] | null
          sort_order?: number
          tolerance_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_specs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "line_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_specs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "wing_models"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_shortenings: {
        Row: {
          created_at: string
          id: string
          loop_type_id: string
          material_id: string
          shortening_mm: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          loop_type_id: string
          material_id: string
          shortening_mm: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          loop_type_id?: string
          material_id?: string
          shortening_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loop_shortenings_loop_type_id_fkey"
            columns: ["loop_type_id"]
            isOneToOne: false
            referencedRelation: "loop_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loop_shortenings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "line_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      measurement_sessions: {
        Row: {
          checksum: string | null
          comment: string | null
          created_at: string
          id: string
          includes_brakes: boolean
          measurement_order: Database["public"]["Enums"]["measurement_order"]
          notes: string | null
          offset_mm: number | null
          previous_session_id: string | null
          publish_anonymously: boolean
          session_date: string
          share_token: string
          status: Database["public"]["Enums"]["session_status"]
          technician_id: string
          tolerance_override_mm: number | null
          updated_at: string
          wing_id: string
        }
        Insert: {
          checksum?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          includes_brakes?: boolean
          measurement_order?: Database["public"]["Enums"]["measurement_order"]
          notes?: string | null
          offset_mm?: number | null
          previous_session_id?: string | null
          publish_anonymously?: boolean
          session_date?: string
          share_token?: string
          status?: Database["public"]["Enums"]["session_status"]
          technician_id: string
          tolerance_override_mm?: number | null
          updated_at?: string
          wing_id: string
        }
        Update: {
          checksum?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          includes_brakes?: boolean
          measurement_order?: Database["public"]["Enums"]["measurement_order"]
          notes?: string | null
          offset_mm?: number | null
          previous_session_id?: string | null
          publish_anonymously?: boolean
          session_date?: string
          share_token?: string
          status?: Database["public"]["Enums"]["session_status"]
          technician_id?: string
          tolerance_override_mm?: number | null
          updated_at?: string
          wing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_sessions_previous_session_id_fkey"
            columns: ["previous_session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_sessions_wing_id_fkey"
            columns: ["wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          deviation_mm: number | null
          flag_reason: string | null
          flagged: boolean
          id: string
          line_spec_id: string
          measured_mm: number
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deviation_mm?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          line_spec_id: string
          measured_mm: number
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deviation_mm?: number | null
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          line_spec_id?: string
          measured_mm?: number
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurements_line_spec_id_fkey"
            columns: ["line_spec_id"]
            isOneToOne: false
            referencedRelation: "line_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_tolerance_mm: number
          email: string | null
          full_name: string | null
          id: string
          laser_offset_mm: number
          preferred_measurement_order: Database["public"]["Enums"]["measurement_order"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_tolerance_mm?: number
          email?: string | null
          full_name?: string | null
          id: string
          laser_offset_mm?: number
          preferred_measurement_order?: Database["public"]["Enums"]["measurement_order"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_tolerance_mm?: number
          email?: string | null
          full_name?: string | null
          id?: string
          laser_offset_mm?: number
          preferred_measurement_order?: Database["public"]["Enums"]["measurement_order"]
          updated_at?: string
        }
        Relationships: []
      }
      session_loop_changes: {
        Row: {
          applied: boolean
          created_at: string
          id: string
          line_spec_id: string
          new_loop_type_id: string | null
          previous_loop_type_id: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          id?: string
          line_spec_id: string
          new_loop_type_id?: string | null
          previous_loop_type_id?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          id?: string
          line_spec_id?: string
          new_loop_type_id?: string | null
          previous_loop_type_id?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_loop_changes_line_spec_id_fkey"
            columns: ["line_spec_id"]
            isOneToOne: false
            referencedRelation: "line_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_loop_changes_new_loop_type_id_fkey"
            columns: ["new_loop_type_id"]
            isOneToOne: false
            referencedRelation: "loop_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_loop_changes_previous_loop_type_id_fkey"
            columns: ["previous_loop_type_id"]
            isOneToOne: false
            referencedRelation: "loop_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_loop_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "measurement_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      wing_loop_state: {
        Row: {
          created_at: string
          id: string
          line_spec_id: string
          loop_type_id: string | null
          updated_at: string
          updated_by: string | null
          wing_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_spec_id: string
          loop_type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          wing_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_spec_id?: string
          loop_type_id?: string | null
          updated_at?: string
          updated_by?: string | null
          wing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wing_loop_state_line_spec_id_fkey"
            columns: ["line_spec_id"]
            isOneToOne: false
            referencedRelation: "line_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wing_loop_state_loop_type_id_fkey"
            columns: ["loop_type_id"]
            isOneToOne: false
            referencedRelation: "loop_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wing_loop_state_wing_id_fkey"
            columns: ["wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
        ]
      }
      wing_models: {
        Row: {
          brake_measurement_supported: boolean
          brand: string
          cells: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          safety_notice: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          brake_measurement_supported?: boolean
          brand?: string
          cells?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          safety_notice?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          brake_measurement_supported?: boolean
          brand?: string
          cells?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          safety_notice?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wings: {
        Row: {
          created_at: string
          created_by: string | null
          first_flight_date: string | null
          id: string
          line_set_hours: number | null
          model_id: string
          owner_note: string | null
          production_date: string | null
          purchase_date: string | null
          serial_checksum_valid: boolean
          serial_number: string
          updated_at: string
          wing_hours: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          first_flight_date?: string | null
          id?: string
          line_set_hours?: number | null
          model_id: string
          owner_note?: string | null
          production_date?: string | null
          purchase_date?: string | null
          serial_checksum_valid?: boolean
          serial_number: string
          updated_at?: string
          wing_hours?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          first_flight_date?: string | null
          id?: string
          line_set_hours?: number | null
          model_id?: string
          owner_note?: string | null
          production_date?: string | null
          purchase_date?: string | null
          serial_checksum_valid?: boolean
          serial_number?: string
          updated_at?: string
          wing_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wings_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "wing_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "technician"
      line_group: "A" | "B" | "C" | "D" | "BR" | "STAB"
      line_side: "left" | "right" | "center"
      measurement_order: "rows" | "columns" | "sections"
      session_status: "draft" | "complete" | "published"
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
      app_role: ["admin", "technician"],
      line_group: ["A", "B", "C", "D", "BR", "STAB"],
      line_side: ["left", "right", "center"],
      measurement_order: ["rows", "columns", "sections"],
      session_status: ["draft", "complete", "published"],
    },
  },
} as const
