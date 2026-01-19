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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      article_attribute_assignments: {
        Row: {
          article_id: string
          attribute_id: string
          company_id: string
          created_at: string
          id: string
          updated_at: string
          value: string
        }
        Insert: {
          article_id: string
          attribute_id: string
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
          value: string
        }
        Update: {
          article_id?: string
          attribute_id?: string
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_attribute_assignments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_attribute_assignments_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "article_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_attribute_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      article_attribute_predefined_values: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          sort_order: number
          value: string
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          sort_order?: number
          value: string
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_attribute_predefined_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "article_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      article_attributes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          data_type: Database["public"]["Enums"]["attribute_data_type"]
          id: string
          is_repeatable: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          data_type?: Database["public"]["Enums"]["attribute_data_type"]
          id?: string
          is_repeatable?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          data_type?: Database["public"]["Enums"]["attribute_data_type"]
          id?: string
          is_repeatable?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_attributes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      article_classifications: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_classifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      article_history: {
        Row: {
          article_id: string
          change_type: string
          changed_at: string
          changed_by: string
          company_id: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          article_id: string
          change_type: string
          changed_at?: string
          changed_by: string
          company_id: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          article_id?: string
          change_type?: string
          changed_at?: string
          changed_by?: string
          company_id?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          article_group: string | null
          business_year_id: string
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          kg_po_jm: number | null
          kol_mas: number | null
          min_stock: number | null
          name: string
          purchase_price: number | null
          selling_price: number | null
          stock: number | null
          svk: Database["public"]["Enums"]["svk_type"] | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          article_group?: string | null
          business_year_id: string
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kg_po_jm?: number | null
          kol_mas?: number | null
          min_stock?: number | null
          name: string
          purchase_price?: number | null
          selling_price?: number | null
          stock?: number | null
          svk?: Database["public"]["Enums"]["svk_type"] | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          article_group?: string | null
          business_year_id?: string
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kg_po_jm?: number | null
          kol_mas?: number | null
          min_stock?: number | null
          name?: string
          purchase_price?: number | null
          selling_price?: number | null
          stock?: number | null
          svk?: Database["public"]["Enums"]["svk_type"] | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_years: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_closed: boolean | null
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          activity_code: string | null
          address: string | null
          api_demo_token: string | null
          api_token: string | null
          city: string | null
          code: string
          created_at: string | null
          email: string | null
          id: string
          invoice_note_1: string | null
          invoice_note_2: string | null
          is_active: boolean | null
          logo_text: string | null
          logo_url: string | null
          mb: string | null
          mesto_prometa: string | null
          municipality: string | null
          municipality_code: string | null
          name: string
          phone: string | null
          pib: string | null
          postal_code: string | null
          quote_note_1: string | null
          quote_note_2: string | null
          responsible_person_email: string | null
          responsible_person_jmbg: string | null
          responsible_person_name: string | null
          updated_at: string | null
        }
        Insert: {
          activity_code?: string | null
          address?: string | null
          api_demo_token?: string | null
          api_token?: string | null
          city?: string | null
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          invoice_note_1?: string | null
          invoice_note_2?: string | null
          is_active?: boolean | null
          logo_text?: string | null
          logo_url?: string | null
          mb?: string | null
          mesto_prometa?: string | null
          municipality?: string | null
          municipality_code?: string | null
          name: string
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          quote_note_1?: string | null
          quote_note_2?: string | null
          responsible_person_email?: string | null
          responsible_person_jmbg?: string | null
          responsible_person_name?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_code?: string | null
          address?: string | null
          api_demo_token?: string | null
          api_token?: string | null
          city?: string | null
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          invoice_note_1?: string | null
          invoice_note_2?: string | null
          is_active?: boolean | null
          logo_text?: string | null
          logo_url?: string | null
          mb?: string | null
          mesto_prometa?: string | null
          municipality?: string | null
          municipality_code?: string | null
          name?: string
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          quote_note_1?: string | null
          quote_note_2?: string | null
          responsible_person_email?: string | null
          responsible_person_jmbg?: string | null
          responsible_person_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      partner_bank_accounts: {
        Row: {
          account_number: string
          company_id: string
          created_at: string
          id: string
          partner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_number: string
          company_id: string
          created_at?: string
          id?: string
          partner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_number?: string
          company_id?: string
          created_at?: string
          id?: string
          partner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_bank_accounts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          company_id: string
          contact_name: string
          created_at: string
          email: string | null
          id: string
          note: string | null
          partner_id: string
          phone1: string | null
          phone2: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          note?: string | null
          partner_id: string
          phone1?: string | null
          phone2?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          note?: string | null
          partner_id?: string
          phone1?: string | null
          phone2?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_groups: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          activity_code: string | null
          address: string | null
          assigned_to: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_customer: boolean
          is_supplier: boolean
          jbkjs: string | null
          legal_status: number
          mb: string | null
          name: string
          note: string | null
          other_data: string | null
          phone: string | null
          pib: string | null
          postal_code: string | null
          responsible_person: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          activity_code?: string | null
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_customer?: boolean
          is_supplier?: boolean
          jbkjs?: string | null
          legal_status?: number
          mb?: string | null
          name: string
          note?: string | null
          other_data?: string | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          responsible_person?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          activity_code?: string | null
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_customer?: boolean
          is_supplier?: boolean
          jbkjs?: string | null
          legal_status?: number
          mb?: string | null
          name?: string
          note?: string | null
          other_data?: string | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          responsible_person?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "partner_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_local_admin: boolean | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_local_admin?: boolean | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_local_admin?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          accountant: string | null
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          inventory_account: string | null
          is_active: boolean
          name: string
          updated_at: string
          warehouse_type: Database["public"]["Enums"]["warehouse_type"]
        }
        Insert: {
          accountant?: string | null
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          inventory_account?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
          warehouse_type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Update: {
          accountant?: string | null
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          inventory_account?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
          warehouse_type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_local_admin_for_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "local_admin" | "user"
      attribute_data_type:
        | "text"
        | "string"
        | "predefined"
        | "bit"
        | "integer"
        | "decimal"
        | "date"
      svk_type: "0" | "1" | "2" | "6" | "8" | "9"
      warehouse_type: "1" | "2" | "6" | "9" | "12"
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
      app_role: ["super_admin", "local_admin", "user"],
      attribute_data_type: [
        "text",
        "string",
        "predefined",
        "bit",
        "integer",
        "decimal",
        "date",
      ],
      svk_type: ["0", "1", "2", "6", "8", "9"],
      warehouse_type: ["1", "2", "6", "9", "12"],
    },
  },
} as const
