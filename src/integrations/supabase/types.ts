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
      line_specs: {
        Row: {
          created_at: string
          factory_length_mm: number
          id: string
          label: string
          line_group: Database["public"]["Enums"]["line_group"]
          model_id: string
          row_index: number
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
          model_id: string
          row_index?: number
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
          model_id?: string
          row_index?: number
          sort_order?: number
          tolerance_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_specs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "wing_models"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_sessions: {
        Row: {
          checksum: string | null
          created_at: string
          id: string
          notes: string | null
          session_date: string
          share_token: string
          status: Database["public"]["Enums"]["session_status"]
          technician_id: string
          updated_at: string
          wing_id: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          share_token?: string
          status?: Database["public"]["Enums"]["session_status"]
          technician_id: string
          updated_at?: string
          wing_id: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          share_token?: string
          status?: Database["public"]["Enums"]["session_status"]
          technician_id?: string
          updated_at?: string
          wing_id?: string
        }
        Relationships: [
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
          id: string
          line_spec_id: string
          measured_mm: number
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deviation_mm?: number | null
          id?: string
          line_spec_id: string
          measured_mm: number
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deviation_mm?: number | null
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
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      wing_models: {
        Row: {
          brand: string
          cells: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          brand?: string
          cells?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          cells?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          model_id: string
          owner_note: string | null
          serial_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          model_id: string
          owner_note?: string | null
          serial_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string
          owner_note?: string | null
          serial_number?: string
          updated_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician"
      line_group: "A" | "B" | "C" | "D" | "BR" | "STAB"
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
      session_status: ["draft", "complete", "published"],
    },
  },
} as const
