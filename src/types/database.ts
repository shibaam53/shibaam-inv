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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          entity: string
          entity_id: string | null
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          entity: string
          entity_id?: string | null
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          entity?: string
          entity_id?: string | null
          id?: never
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      conversion_rules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          factor: number
          from_uom_id: string
          id: string
          is_active: boolean
          notes: string | null
          product_id: string | null
          source: string | null
          to_uom_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          factor: number
          from_uom_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string | null
          source?: string | null
          to_uom_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          factor?: number
          from_uom_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string | null
          source?: string | null
          to_uom_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversion_rules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_rules_from_uom_id_fkey"
            columns: ["from_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "conversion_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_rules_to_uom_id_fkey"
            columns: ["to_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      open_area_formulas: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          hole_pattern: Database["public"]["Enums"]["hole_pattern"]
          hole_shape: Database["public"]["Enums"]["hole_shape"]
          is_active: boolean
          source: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          hole_pattern: Database["public"]["Enums"]["hole_pattern"]
          hole_shape: Database["public"]["Enums"]["hole_shape"]
          is_active?: boolean
          source?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          hole_pattern?: Database["public"]["Enums"]["hole_pattern"]
          hole_shape?: Database["public"]["Enums"]["hole_shape"]
          is_active?: boolean
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_area_formulas_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_perforation: {
        Row: {
          hole_diameter_mm: number
          pitch_mm: number
          product_id: string
        }
        Insert: {
          hole_diameter_mm: number
          pitch_mm: number
          product_id: string
        }
        Update: {
          hole_diameter_mm?: number
          pitch_mm?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_perforation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_perforation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_uoms: {
        Row: {
          product_id: string
          requires_measurement: boolean
          uom_id: string
        }
        Insert: {
          product_id: string
          requires_measurement?: boolean
          uom_id: string
        }
        Update: {
          product_id?: string
          requires_measurement?: boolean
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_uoms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_uoms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_uoms_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_uom_id: string
          category_id: string | null
          code: string
          created_at: string
          description: string | null
          gauge: string | null
          id: string
          low_stock_threshold: number
          name: string
          paano_in_feet: number | null
          paano_unit: string | null
          paano_value: number | null
          specs: Json
          status: Database["public"]["Enums"]["product_status"]
          tracking_mode: Database["public"]["Enums"]["tracking_mode"]
          updated_at: string
        }
        Insert: {
          base_uom_id: string
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          gauge?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          paano_in_feet?: number | null
          paano_unit?: string | null
          paano_value?: number | null
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          tracking_mode?: Database["public"]["Enums"]["tracking_mode"]
          updated_at?: string
        }
        Update: {
          base_uom_id?: string
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          gauge?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          paano_in_feet?: number | null
          paano_unit?: string | null
          paano_value?: number | null
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          tracking_mode?: Database["public"]["Enums"]["tracking_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_base_uom_id_fkey"
            columns: ["base_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_gauge_fkey"
            columns: ["gauge"]
            isOneToOne: false
            referencedRelation: "swg_reference"
            referencedColumns: ["gauge"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number
          balance_before: number
          bill_status: Database["public"]["Enums"]["bill_status"] | null
          conversion_factor: number | null
          conversion_rule_id: string | null
          conversion_rule_version: number | null
          created_at: string
          created_by: string
          entered_qty: number
          entered_uom_id: string
          id: string
          measured_base_qty: number | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          qty_delta: number
          reason: string | null
          reference: string | null
          reversed_movement_id: string | null
          roll_id: string | null
        }
        Insert: {
          balance_after: number
          balance_before: number
          bill_status?: Database["public"]["Enums"]["bill_status"] | null
          conversion_factor?: number | null
          conversion_rule_id?: string | null
          conversion_rule_version?: number | null
          created_at?: string
          created_by: string
          entered_qty: number
          entered_uom_id: string
          id?: string
          measured_base_qty?: number | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          qty_delta: number
          reason?: string | null
          reference?: string | null
          reversed_movement_id?: string | null
          roll_id?: string | null
        }
        Update: {
          balance_after?: number
          balance_before?: number
          bill_status?: Database["public"]["Enums"]["bill_status"] | null
          conversion_factor?: number | null
          conversion_rule_id?: string | null
          conversion_rule_version?: number | null
          created_at?: string
          created_by?: string
          entered_qty?: number
          entered_uom_id?: string
          id?: string
          measured_base_qty?: number | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          product_id?: string
          qty_delta?: number
          reason?: string | null
          reference?: string | null
          reversed_movement_id?: string | null
          roll_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_conversion_rule_id_fkey"
            columns: ["conversion_rule_id"]
            isOneToOne: false
            referencedRelation: "conversion_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_entered_uom_id_fkey"
            columns: ["entered_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reversed_movement_id_fkey"
            columns: ["reversed_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "stock_rolls"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_rolls: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          initial_qty: number
          label: string
          product_id: string
          remaining_qty: number
          status: Database["public"]["Enums"]["roll_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          initial_qty: number
          label: string
          product_id: string
          remaining_qty: number
          status?: Database["public"]["Enums"]["roll_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          initial_qty?: number
          label?: string
          product_id?: string
          remaining_qty?: number
          status?: Database["public"]["Enums"]["roll_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_rolls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_rolls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_rolls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      swg_reference: {
        Row: {
          created_at: string
          diameter_inch: number
          diameter_mm: number
          gauge: string
          id: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          diameter_inch: number
          diameter_mm: number
          gauge: string
          id?: string
          notes?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          diameter_inch?: number
          diameter_mm?: number
          gauge?: string
          id?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      uoms: {
        Row: {
          code: string
          created_at: string
          dimension: Database["public"]["Enums"]["uom_dimension"]
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          dimension: Database["public"]["Enums"]["uom_dimension"]
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          dimension?: Database["public"]["Enums"]["uom_dimension"]
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      inventory_overview: {
        Row: {
          base_uom_code: string | null
          base_uom_id: string | null
          category_id: string | null
          category_name: string | null
          code: string | null
          gauge: string | null
          low_stock_threshold: number | null
          name: string | null
          paano_in_feet: number | null
          paano_unit: string | null
          paano_value: number | null
          physical_size: string | null
          product_id: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock_qty: number | null
          stock_status: string | null
          tracking_mode: Database["public"]["Enums"]["tracking_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "products_base_uom_id_fkey"
            columns: ["base_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_gauge_fkey"
            columns: ["gauge"]
            isOneToOne: false
            referencedRelation: "swg_reference"
            referencedColumns: ["gauge"]
          },
        ]
      }
      perforated_sheet_specs: {
        Row: {
          hole_diameter_mm: number | null
          pitch_mm: number | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_perforation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "inventory_overview"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_perforation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_stock: {
        Args: {
          p_bill_status: Database["public"]["Enums"]["bill_status"]
          p_entered_qty: number
          p_measured_base_qty?: number
          p_product_id: string
          p_reference?: string
          p_roll_label?: string
          p_uom_id: string
        }
        Returns: string
      }
      admin_update_profile: {
        Args: {
          p_full_name?: string
          p_is_active?: boolean
          p_role?: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      calc_open_area_pct: {
        Args: {
          p_d: number
          p_p: number
          p_pattern: Database["public"]["Enums"]["hole_pattern"]
          p_shape: Database["public"]["Enums"]["hole_shape"]
        }
        Returns: number
      }
      correct_stock: {
        Args: {
          p_delta_base_qty: number
          p_product_id: string
          p_reason: string
          p_roll_id?: string
        }
        Returns: string
      }
      lookup_swg: {
        Args: { p_gauge: string }
        Returns: {
          diameter_inch: number
          diameter_mm: number
          gauge: string
        }[]
      }
      remove_stock: {
        Args: {
          p_bill_status: Database["public"]["Enums"]["bill_status"]
          p_entered_qty: number
          p_measured_base_qty?: number
          p_product_id: string
          p_reference?: string
          p_roll_id?: string
          p_uom_id: string
        }
        Returns: string
      }
      reverse_stock_movement: {
        Args: { p_movement_id: string; p_reason: string }
        Returns: string
      }
      set_opening_stock: {
        Args: {
          p_entered_qty: number
          p_measured_base_qty?: number
          p_product_id: string
          p_reference?: string
          p_roll_label?: string
          p_uom_id: string
        }
        Returns: string
      }
    }
    Enums: {
      bill_status: "with_bill" | "without_bill"
      hole_pattern: "staggered_60" | "straight_90" | "other"
      hole_shape: "round" | "other"
      movement_type: "opening" | "add" | "remove" | "correction" | "reversal"
      product_status: "active" | "archived"
      roll_status: "in_stock" | "consumed" | "voided"
      tracking_mode: "aggregate" | "roll"
      uom_dimension: "length" | "weight" | "area" | "count" | "other"
      user_role: "super_user" | "normal_user"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bill_status: ["with_bill", "without_bill"],
      hole_pattern: ["staggered_60", "straight_90", "other"],
      hole_shape: ["round", "other"],
      movement_type: ["opening", "add", "remove", "correction", "reversal"],
      product_status: ["active", "archived"],
      roll_status: ["in_stock", "consumed", "voided"],
      tracking_mode: ["aggregate", "roll"],
      uom_dimension: ["length", "weight", "area", "count", "other"],
      user_role: ["super_user", "normal_user"],
    },
  },
} as const
