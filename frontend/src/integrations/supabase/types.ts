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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      api_access_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          request_data: Json | null
          response_status: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown
          request_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          request_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_audit_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string | null
          method: string
          request_hash: string | null
          request_meta: Json | null
          response_meta: Json | null
          status_code: number
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key?: string | null
          method: string
          request_hash?: string | null
          request_meta?: Json | null
          response_meta?: Json | null
          status_code: number
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string | null
          method?: string
          request_hash?: string | null
          request_meta?: Json | null
          response_meta?: Json | null
          status_code?: number
          user_id?: string | null
        }
        Relationships: []
      }
      api_idempotency: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string
          method: string
          response_body: Json
          status_code: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key: string
          method: string
          response_body: Json
          status_code: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string
          method?: string
          response_body?: Json
          status_code?: number
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          request_count: number
          updated_at: string
          window_duration_minutes: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string
          window_duration_minutes?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string
          window_duration_minutes?: number
          window_start?: string
        }
        Relationships: []
      }
      contract_participants: {
        Row: {
          contract_id: string
          contribution_amount: number
          created_at: string
          id: string
          joined_at: string
          status: string
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          contract_id: string
          contribution_amount: number
          created_at?: string
          id?: string
          joined_at?: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          contract_id?: string
          contribution_amount?: number
          created_at?: string
          id?: string
          joined_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_participants_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          current_amount: number
          current_participants: number
          description: string | null
          end_date: string | null
          id: string
          maximum_participants: number
          minimum_contribution: number
          name: string
          start_date: string | null
          status: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          current_amount?: number
          current_participants?: number
          description?: string | null
          end_date?: string | null
          id?: string
          maximum_participants?: number
          minimum_contribution?: number
          name: string
          start_date?: string | null
          status?: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          current_amount?: number
          current_participants?: number
          description?: string | null
          end_date?: string | null
          id?: string
          maximum_participants?: number
          minimum_contribution?: number
          name?: string
          start_date?: string | null
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          category_index: number
          completed_at: string
          created_at: string
          id: string
          module_id: string
          module_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_index: number
          completed_at?: string
          created_at?: string
          id?: string
          module_id: string
          module_index: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_index?: number
          completed_at?: string
          created_at?: string
          id?: string
          module_id?: string
          module_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          eth_address: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          eth_address?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          eth_address?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          created_at: string
          created_via: string
          id: string
          last_used_at: string | null
          network: string
          provenance: Database["public"]["Enums"]["wallet_provenance"]
          provider: string
          turnkey_sub_org_id: string | null
          turnkey_wallet_id: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          created_via?: string
          id?: string
          last_used_at?: string | null
          network?: string
          provenance?: Database["public"]["Enums"]["wallet_provenance"]
          provider?: string
          turnkey_sub_org_id?: string | null
          turnkey_wallet_id?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          created_via?: string
          id?: string
          last_used_at?: string | null
          network?: string
          provenance?: Database["public"]["Enums"]["wallet_provenance"]
          provider?: string
          turnkey_sub_org_id?: string | null
          turnkey_wallet_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_api_keys: { Args: never; Returns: boolean }
      check_contract_owner: {
        Args: { p_contract_id: string }
        Returns: boolean
      }
      check_enhanced_rate_limit: {
        Args: {
          p_burst_limit?: number
          p_burst_window_minutes?: number
          p_identifier: string
          p_limit?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_limit?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      generate_api_key: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_contracts: {
        Args: never
        Returns: {
          contract_id: string
          contract_name: string
          contract_type: string
          created_at: string
          current_amount: number
          is_creator: boolean
          is_participant: boolean
          status: string
          target_amount: number
        }[]
      }
      get_user_progress: {
        Args: never
        Returns: {
          category_index: number
          completed_at: string
          module_id: string
          module_index: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_api_key: { Args: { api_key: string }; Returns: string }
      is_contract_owner: { Args: { contract_id: string }; Returns: boolean }
      is_contract_participant: {
        Args: { p_contract_id: string }
        Returns: boolean
      }
      is_owner_of_subclub: { Args: { p_subclub_id: string }; Returns: boolean }
      is_wallet_owner: { Args: { wallet_user_id: string }; Returns: boolean }
      join_contract: {
        Args: {
          p_contract_id: string
          p_contribution_amount: number
          p_wallet_address?: string
        }
        Returns: boolean
      }
      log_api_access: {
        Args: {
          p_api_key_id: string
          p_endpoint: string
          p_ip_address: unknown
          p_request_data: Json
          p_response_status: number
          p_user_agent: string
        }
        Returns: undefined
      }
      save_learning_progress: {
        Args: {
          p_category_index: number
          p_module_id: string
          p_module_index: number
        }
        Returns: undefined
      }
      sync_user_email: { Args: never; Returns: undefined }
      validate_api_key: {
        Args: { input_api_key: string }
        Returns: {
          is_valid: boolean
          key_id: string
          permissions: Json
          user_id: string
        }[]
      }
      validate_api_permissions: {
        Args: { p_api_key_id: string; p_required_permission: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      wallet_provenance:
        | "sequence_embedded"
        | "external_import"
        | "self_custody"
        | "turnkey_invisible"
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
      app_role: ["admin", "user"],
      wallet_provenance: [
        "sequence_embedded",
        "external_import",
        "self_custody",
        "turnkey_invisible",
      ],
    },
  },
} as const
