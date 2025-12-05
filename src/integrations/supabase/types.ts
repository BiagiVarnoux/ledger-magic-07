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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          normal_side: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          normal_side: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normal_side?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      auxiliary_ledger: {
        Row: {
          account_id: string
          client_name: string
          created_at: string
          definition_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          client_name: string
          created_at?: string
          definition_id?: string | null
          id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          client_name?: string
          created_at?: string
          definition_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auxiliary_ledger_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "auxiliary_ledger_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      auxiliary_ledger_definitions: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      auxiliary_movement_details: {
        Row: {
          amount: number
          aux_entry_id: string
          created_at: string
          id: string
          journal_entry_id: string
          movement_date: string
          movement_type: string
          user_id: string
        }
        Insert: {
          amount: number
          aux_entry_id: string
          created_at?: string
          id?: string
          journal_entry_id: string
          movement_date: string
          movement_type: string
          user_id: string
        }
        Update: {
          amount?: number
          aux_entry_id?: string
          created_at?: string
          id?: string
          journal_entry_id?: string
          movement_date?: string
          movement_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_aux_entry"
            columns: ["aux_entry_id"]
            isOneToOne: false
            referencedRelation: "auxiliary_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_codes: {
        Row: {
          can_view_accounts: boolean
          can_view_auxiliary: boolean
          can_view_journal: boolean
          can_view_ledger: boolean
          can_view_reports: boolean
          code: string
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          used: boolean
          used_by: string | null
        }
        Insert: {
          can_view_accounts?: boolean
          can_view_auxiliary?: boolean
          can_view_journal?: boolean
          can_view_ledger?: boolean
          can_view_reports?: boolean
          code: string
          created_at?: string
          expires_at: string
          id?: string
          owner_id: string
          used?: boolean
          used_by?: string | null
        }
        Update: {
          can_view_accounts?: boolean
          can_view_auxiliary?: boolean
          can_view_journal?: boolean
          can_view_ledger?: boolean
          can_view_reports?: boolean
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          used?: boolean
          used_by?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          memo: string | null
          user_id: string
          void_of: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id: string
          memo?: string | null
          user_id: string
          void_of?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          user_id?: string
          void_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_void_of_fkey"
            columns: ["void_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: number
          line_memo: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: number
          line_memo?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: number
          line_memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kardex_definitions: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      kardex_entries: {
        Row: {
          account_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      kardex_movements: {
        Row: {
          concepto: string
          costo_total: number
          costo_unitario: number
          created_at: string
          entrada: number
          fecha: string
          id: string
          journal_entry_id: string | null
          kardex_id: string
          saldo: number
          saldo_valorado: number
          salidas: number
          user_id: string
        }
        Insert: {
          concepto: string
          costo_total?: number
          costo_unitario?: number
          created_at?: string
          entrada?: number
          fecha: string
          id?: string
          journal_entry_id?: string | null
          kardex_id: string
          saldo?: number
          saldo_valorado?: number
          salidas?: number
          user_id: string
        }
        Update: {
          concepto?: string
          costo_total?: number
          costo_unitario?: number
          created_at?: string
          entrada?: number
          fecha?: string
          id?: string
          journal_entry_id?: string | null
          kardex_id?: string
          saldo?: number
          saldo_valorado?: number
          salidas?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kardex_movements_kardex_id_fkey"
            columns: ["kardex_id"]
            isOneToOne: false
            referencedRelation: "kardex_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_closures: {
        Row: {
          balances: Json
          closure_date: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balances?: Json
          closure_date: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balances?: Json
          closure_date?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_access: {
        Row: {
          can_view_accounts: boolean
          can_view_auxiliary: boolean
          can_view_journal: boolean
          can_view_ledger: boolean
          can_view_reports: boolean
          created_at: string
          id: string
          owner_id: string
          viewer_id: string
        }
        Insert: {
          can_view_accounts?: boolean
          can_view_auxiliary?: boolean
          can_view_journal?: boolean
          can_view_ledger?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          owner_id: string
          viewer_id: string
        }
        Update: {
          can_view_accounts?: boolean
          can_view_auxiliary?: boolean
          can_view_journal?: boolean
          can_view_ledger?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          owner_id?: string
          viewer_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_balance_sheet: {
        Args: { as_of_date: string }
        Returns: {
          saldo: number
          tipo: string
        }[]
      }
      get_income_statement: {
        Args: { from_date: string; to_date: string }
        Returns: {
          gastos: number
          ingresos: number
          utilidad: number
        }[]
      }
      get_trial_balance: {
        Args: { period: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          id: string
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_access: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      redeem_invitation_code: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      revoke_shared_access: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "viewer"
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
      app_role: ["owner", "viewer"],
    },
  },
} as const
