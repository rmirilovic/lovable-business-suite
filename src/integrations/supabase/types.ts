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
      article_swaps: {
        Row: {
          article_1_code: string
          article_1_id: string
          article_1_name: string
          article_1_unit: string
          article_2_code: string
          article_2_id: string
          article_2_name: string
          article_2_unit: string
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          posted_at: string | null
          posted_by: string | null
          price_1: number
          price_2: number
          quantity_1: number
          quantity_2: number
          status: string
          swap_date: string
          swap_number: string
          swap_value: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          article_1_code: string
          article_1_id: string
          article_1_name: string
          article_1_unit?: string
          article_2_code: string
          article_2_id: string
          article_2_name: string
          article_2_unit?: string
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          price_1?: number
          price_2?: number
          quantity_1?: number
          quantity_2?: number
          status?: string
          swap_date?: string
          swap_number: string
          swap_value?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          article_1_code?: string
          article_1_id?: string
          article_1_name?: string
          article_1_unit?: string
          article_2_code?: string
          article_2_id?: string
          article_2_name?: string
          article_2_unit?: string
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          price_1?: number
          price_2?: number
          quantity_1?: number
          quantity_2?: number
          status?: string
          swap_date?: string
          swap_number?: string
          swap_value?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_swaps_article_1_id_fkey"
            columns: ["article_1_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_swaps_article_2_id_fkey"
            columns: ["article_2_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_swaps_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_swaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_swaps_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_group: string | null
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
          vat_rate: number
        }
        Insert: {
          article_group?: string | null
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
          vat_rate?: number
        }
        Update: {
          article_group?: string | null
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
          vat_rate?: number
        }
        Relationships: [
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
      calculation_additional_costs: {
        Row: {
          amount: number
          calculation_id: string
          company_id: string
          created_at: string
          description: string
          distribution_method: string
          id: string
          item_order: number
          partner_id: string | null
          source_ufu_id: string | null
          source_ufu_item_id: string | null
        }
        Insert: {
          amount?: number
          calculation_id: string
          company_id: string
          created_at?: string
          description: string
          distribution_method?: string
          id?: string
          item_order?: number
          partner_id?: string | null
          source_ufu_id?: string | null
          source_ufu_item_id?: string | null
        }
        Update: {
          amount?: number
          calculation_id?: string
          company_id?: string
          created_at?: string
          description?: string
          distribution_method?: string
          id?: string
          item_order?: number
          partner_id?: string | null
          source_ufu_id?: string | null
          source_ufu_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_additional_costs_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "purchase_price_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_additional_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_additional_costs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_additional_costs_source_ufu_id_fkey"
            columns: ["source_ufu_id"]
            isOneToOne: false
            referencedRelation: "service_purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_additional_costs_source_ufu_item_id_fkey"
            columns: ["source_ufu_item_id"]
            isOneToOne: false
            referencedRelation: "service_purchase_invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_items: {
        Row: {
          allocated_costs: number
          article_id: string | null
          calculation_id: string
          company_id: string
          cost_price: number
          cost_value: number
          created_at: string
          goods_receipt_item_id: string | null
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          markup_amount: number
          markup_percent: number
          purchase_price: number
          purchase_value: number
          quantity: number
          selling_price: number
          selling_value: number
          svk: string | null
          unit: string
        }
        Insert: {
          allocated_costs?: number
          article_id?: string | null
          calculation_id: string
          company_id: string
          cost_price?: number
          cost_value?: number
          created_at?: string
          goods_receipt_item_id?: string | null
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          markup_amount?: number
          markup_percent?: number
          purchase_price?: number
          purchase_value?: number
          quantity?: number
          selling_price?: number
          selling_value?: number
          svk?: string | null
          unit?: string
        }
        Update: {
          allocated_costs?: number
          article_id?: string | null
          calculation_id?: string
          company_id?: string
          cost_price?: number
          cost_value?: number
          created_at?: string
          goods_receipt_item_id?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          markup_amount?: number
          markup_percent?: number
          purchase_price?: number
          purchase_value?: number
          quantity?: number
          selling_price?: number
          selling_value?: number
          svk?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "purchase_price_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_goods_receipt_item_id_fkey"
            columns: ["goods_receipt_item_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_ufu_links: {
        Row: {
          calculation_id: string
          company_id: string
          created_at: string
          id: string
          service_invoice_id: string
        }
        Insert: {
          calculation_id: string
          company_id: string
          created_at?: string
          id?: string
          service_invoice_id: string
        }
        Update: {
          calculation_id?: string
          company_id?: string
          created_at?: string
          id?: string
          service_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_ufu_links_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "purchase_price_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_ufu_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_ufu_links_service_invoice_id_fkey"
            columns: ["service_invoice_id"]
            isOneToOne: true
            referencedRelation: "service_purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_posting_allowed: boolean
          level: number
          name: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_posting_allowed?: boolean
          level?: number
          name: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_posting_allowed?: boolean
          level?: number
          name?: string
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
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
      delivery_note_items: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          delivery_note_id: string
          description: string | null
          id: string
          item_code: string
          item_name: string
          item_order: number
          quantity: number
          unit: string
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          delivery_note_id: string
          description?: string | null
          id?: string
          item_code: string
          item_name: string
          item_order?: number
          quantity?: number
          unit?: string
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          delivery_note_id?: string
          description?: string | null
          id?: string
          item_code?: string
          item_name?: string
          item_order?: number
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          delivery_date: string
          delivery_number: string
          id: string
          internal_note: string | null
          invoice_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_id: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          delivery_date?: string
          delivery_number: string
          id?: string
          internal_note?: string | null
          invoice_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          delivery_date?: string
          delivery_number?: string
          id?: string
          internal_note?: string | null
          invoice_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_purchase_invoice_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          foreign_unit_price: number
          goods_purchase_invoice_id: string
          id: string
          is_vat_deductible: boolean
          item_code: string | null
          item_name: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          foreign_unit_price?: number
          goods_purchase_invoice_id: string
          id?: string
          is_vat_deductible?: boolean
          item_code?: string | null
          item_name: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          foreign_unit_price?: number
          goods_purchase_invoice_id?: string
          id?: string
          is_vat_deductible?: boolean
          item_code?: string | null
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_purchase_invoice_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoice_items_goods_purchase_invoice_id_fkey"
            columns: ["goods_purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "goods_purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_purchase_invoices: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          exchange_rate: number
          goods_receipt_id: string | null
          has_internal_vat_calculation: boolean
          id: string
          internal_note: string | null
          internal_number: string
          invoice_date: string
          journal_entry_id: string | null
          linked_calculation_id: string | null
          note: string | null
          partner_id: string
          payment_reference: string | null
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          status: string
          subtotal: number
          supplier_address: string | null
          supplier_bank_account: string | null
          supplier_city: string | null
          supplier_invoice_number: string
          supplier_is_in_pdv: boolean
          supplier_mb: string | null
          supplier_name: string | null
          supplier_pib: string | null
          supplier_postal_code: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_calculation_type: string
          warehouse_id: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          goods_receipt_id?: string | null
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number: string
          invoice_date?: string
          journal_entry_id?: string | null
          linked_calculation_id?: string | null
          note?: string | null
          partner_id: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
          subtotal?: number
          supplier_address?: string | null
          supplier_bank_account?: string | null
          supplier_city?: string | null
          supplier_invoice_number: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_calculation_type?: string
          warehouse_id: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          goods_receipt_id?: string | null
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number?: string
          invoice_date?: string
          journal_entry_id?: string | null
          linked_calculation_id?: string | null
          note?: string | null
          partner_id?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
          subtotal?: number
          supplier_address?: string | null
          supplier_bank_account?: string | null
          supplier_city?: string | null
          supplier_invoice_number?: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_calculation_type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_purchase_invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoices_linked_calculation_id_fkey"
            columns: ["linked_calculation_id"]
            isOneToOne: false
            referencedRelation: "purchase_price_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          goods_receipt_id: string
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          quantity: number
          unit: string
          unit_price: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          goods_receipt_id: string
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          goods_receipt_id?: string
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          linked_calculation_id: string | null
          note: string | null
          partner_id: string | null
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          receipt_number: string
          source_invoice_id: string | null
          status: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          linked_calculation_id?: string | null
          note?: string | null
          partner_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          receipt_number: string
          source_invoice_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          linked_calculation_id?: string | null
          note?: string | null
          partner_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          receipt_number?: string
          source_invoice_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_linked_calculation_id_fkey"
            columns: ["linked_calculation_id"]
            isOneToOne: false
            referencedRelation: "purchase_price_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "goods_purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      input_costs: {
        Row: {
          account_code: string
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_procurement_cost: boolean
          is_vat_deductible: boolean
          name: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          account_code: string
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_procurement_cost?: boolean
          is_vat_deductible?: boolean
          name: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          account_code?: string
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_procurement_cost?: boolean
          is_vat_deductible?: boolean
          name?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "input_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_warehouse_transfer_items: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          quantity: number
          transfer_id: string
          unit: string
          unit_price: number
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          quantity?: number
          transfer_id: string
          unit?: string
          unit_price?: number
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          quantity?: number
          transfer_id?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inter_warehouse_transfer_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfer_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inter_warehouse_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_warehouse_transfers: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          destination_warehouse_id: string
          id: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          source_warehouse_id: string
          status: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          destination_warehouse_id: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_warehouse_id: string
          status?: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          destination_warehouse_id?: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_warehouse_id?: string
          status?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_warehouse_transfers_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfers_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfers_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_warehouse_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_items: {
        Row: {
          article_id: string
          book_quantity: number
          company_id: string
          counted_quantity: number
          created_at: string
          deficit_qty: number
          deficit_value: number
          id: string
          inventory_count_id: string
          item_code: string | null
          item_name: string
          item_order: number
          price: number
          surplus_qty: number
          surplus_value: number
          unit: string
        }
        Insert: {
          article_id: string
          book_quantity?: number
          company_id: string
          counted_quantity?: number
          created_at?: string
          deficit_qty?: number
          deficit_value?: number
          id?: string
          inventory_count_id: string
          item_code?: string | null
          item_name: string
          item_order?: number
          price?: number
          surplus_qty?: number
          surplus_value?: number
          unit?: string
        }
        Update: {
          article_id?: string
          book_quantity?: number
          company_id?: string
          counted_quantity?: number
          created_at?: string
          deficit_qty?: number
          deficit_value?: number
          id?: string
          inventory_count_id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          price?: number
          surplus_qty?: number
          surplus_value?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          business_year_id: string
          company_id: string
          count_date: string
          count_number: string
          created_at: string
          created_by: string
          id: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          count_date?: string
          count_number: string
          created_at?: string
          created_by: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          count_date?: string
          count_number?: string
          created_at?: string
          created_by?: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          invoice_id: string
          item_code: string | null
          item_name: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id: string
          item_code?: string | null
          item_name: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          internal_note: string | null
          invoice_date: string
          invoice_number: string
          journal_entry_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_id: string
          posted_at: string | null
          posted_by: string | null
          source_delivery_note_id: string | null
          source_quote_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          invoice_date?: string
          invoice_number: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id: string
          posted_at?: string | null
          posted_by?: string | null
          source_delivery_note_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          invoice_date?: string
          invoice_number?: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id?: string
          posted_at?: string | null
          posted_by?: string | null
          source_delivery_note_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_source_delivery_note_id_fkey"
            columns: ["source_delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          description: string
          document_date: string | null
          document_number: string | null
          entry_date: string
          entry_number: string
          id: string
          org_unit_id: string | null
          posted_at: string | null
          posted_by: string | null
          source_document_id: string | null
          source_document_type: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["document_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          description: string
          document_date?: string | null
          document_number?: string | null
          entry_date: string
          entry_number: string
          id?: string
          org_unit_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          document_date?: string | null
          document_number?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          org_unit_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_items: {
        Row: {
          account_code: string
          company_id: string
          cost_center_code: string | null
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          document_date: string | null
          id: string
          item_order: number
          journal_entry_id: string
          partner_id: string | null
        }
        Insert: {
          account_code: string
          company_id: string
          cost_center_code?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          document_date?: string | null
          id?: string
          item_order?: number
          journal_entry_id: string
          partner_id?: string | null
        }
        Update: {
          account_code?: string
          company_id?: string
          cost_center_code?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          document_date?: string | null
          id?: string
          item_order?: number
          journal_entry_id?: string
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_items_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      material_norm_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          qty_per_kg: number
          qty_per_m: number
          qty_per_pc: number
          unit: string
          variant_id: string
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          id?: string
          item_order?: number
          qty_per_kg?: number
          qty_per_m?: number
          qty_per_pc?: number
          unit?: string
          variant_id: string
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          id?: string
          item_order?: number
          qty_per_kg?: number
          qty_per_m?: number
          qty_per_pc?: number
          unit?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_norm_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_norm_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_norm_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "material_norm_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      material_norm_variants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          norm_id: string
          note: string | null
          status: string
          updated_at: string
          variant_date: string | null
          variant_name: string
          variant_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          norm_id: string
          note?: string | null
          status?: string
          updated_at?: string
          variant_date?: string | null
          variant_name?: string
          variant_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          norm_id?: string
          note?: string | null
          status?: string
          updated_at?: string
          variant_date?: string | null
          variant_name?: string
          variant_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_norm_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_norm_variants_norm_id_fkey"
            columns: ["norm_id"]
            isOneToOne: false
            referencedRelation: "material_norms"
            referencedColumns: ["id"]
          },
        ]
      }
      material_norms: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_norms_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_norms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          module_type: Database["public"]["Enums"]["module_type"]
          name: string
          parent_code: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module_type: Database["public"]["Enums"]["module_type"]
          name: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module_type?: Database["public"]["Enums"]["module_type"]
          name?: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["code"]
          },
        ]
      }
      organizational_units: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_code?: string | null
          updated_at?: string
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
          is_in_pdv: boolean
          is_supplier: boolean
          jbkjs: string | null
          legal_status: number
          mb: string | null
          name: string
          note: string | null
          other_data: string | null
          payment_priority: number | null
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
          is_in_pdv?: boolean
          is_supplier?: boolean
          jbkjs?: string | null
          legal_status?: number
          mb?: string | null
          name: string
          note?: string | null
          other_data?: string | null
          payment_priority?: number | null
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
          is_in_pdv?: boolean
          is_supplier?: boolean
          jbkjs?: string | null
          legal_status?: number
          mb?: string | null
          name?: string
          note?: string | null
          other_data?: string | null
          payment_priority?: number | null
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
      price_adjustment_items: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          new_price: number
          old_price: number
          price_adjustment_id: string
          price_difference: number
          quantity: number
          unit: string
          value_difference: number
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          new_price?: number
          old_price?: number
          price_adjustment_id: string
          price_difference?: number
          quantity?: number
          unit?: string
          value_difference?: number
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          new_price?: number
          old_price?: number
          price_adjustment_id?: string
          price_difference?: number
          quantity?: number
          unit?: string
          value_difference?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_adjustment_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustment_items_price_adjustment_id_fkey"
            columns: ["price_adjustment_id"]
            isOneToOne: false
            referencedRelation: "price_adjustments"
            referencedColumns: ["id"]
          },
        ]
      }
      price_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          total_decrease: number
          total_increase: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_number: string
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_decrease?: number
          total_increase?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_decrease?: number
          total_increase?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_adjustments_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      purchase_invoice_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          purchase_invoice_id: string
          quantity: number
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          purchase_invoice_id: string
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          purchase_invoice_id?: string
          quantity?: number
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          internal_note: string | null
          internal_number: string
          invoice_date: string
          journal_entry_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_id: string
          payment_reference: string | null
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          supplier_bank_account: string | null
          supplier_invoice_number: string
          total_amount: number
          updated_at: string
          vat_amount: number
          warehouse_id: string | null
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          internal_number: string
          invoice_date?: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_bank_account?: string | null
          supplier_invoice_number: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          warehouse_id?: string | null
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          internal_note?: string | null
          internal_number?: string
          invoice_date?: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_bank_account?: string | null
          supplier_invoice_number?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_price_calculations: {
        Row: {
          business_year_id: string
          calculation_date: string
          calculation_number: string
          company_id: string
          created_at: string
          created_by: string
          goods_receipt_id: string
          id: string
          note: string | null
          posted_at: string | null
          posted_by: string | null
          source_goods_invoice_id: string | null
          status: string
          total_additional_costs: number
          total_cost_value: number
          total_markup_value: number
          total_purchase_value: number
          total_selling_value: number
          updated_at: string
        }
        Insert: {
          business_year_id: string
          calculation_date?: string
          calculation_number: string
          company_id: string
          created_at?: string
          created_by: string
          goods_receipt_id: string
          id?: string
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_goods_invoice_id?: string | null
          status?: string
          total_additional_costs?: number
          total_cost_value?: number
          total_markup_value?: number
          total_purchase_value?: number
          total_selling_value?: number
          updated_at?: string
        }
        Update: {
          business_year_id?: string
          calculation_date?: string
          calculation_number?: string
          company_id?: string
          created_at?: string
          created_by?: string
          goods_receipt_id?: string
          id?: string
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_goods_invoice_id?: string | null
          status?: string
          total_additional_costs?: number
          total_cost_value?: number
          total_markup_value?: number
          total_purchase_value?: number
          total_selling_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_price_calculations_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_price_calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_price_calculations_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_price_calculations_source_goods_invoice_id_fkey"
            columns: ["source_goods_invoice_id"]
            isOneToOne: false
            referencedRelation: "goods_purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          item_code: string | null
          item_name: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          quantity: number
          quote_id: string
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          item_code?: string | null
          item_name: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          quote_id: string
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          item_code?: string | null
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          quote_id?: string
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_year_id: string
          company_id: string
          converted_at: string | null
          converted_to_invoice_id: string | null
          created_at: string
          created_by: string
          header_note: string | null
          id: string
          internal_note: string | null
          note: string | null
          org_unit_id: string | null
          partner_address: string | null
          partner_city: string | null
          partner_id: string
          partner_mb: string | null
          partner_name: string | null
          partner_pib: string | null
          partner_postal_code: string | null
          quote_date: string
          quote_number: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          valid_until: string | null
          vat_amount: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_year_id: string
          company_id: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          created_by: string
          header_note?: string | null
          id?: string
          internal_note?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_id: string
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          quote_date?: string
          quote_number: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_year_id?: string
          company_id?: string
          converted_at?: string | null
          converted_to_invoice_id?: string | null
          created_at?: string
          created_by?: string
          header_note?: string | null
          id?: string
          internal_note?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_id?: string
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          quote_date?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_to_invoice_id_fkey"
            columns: ["converted_to_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          can_post: boolean
          can_unpost: boolean
          created_at: string
          id: string
          module_code: string
          role_id: string
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          can_post?: boolean
          can_unpost?: boolean
          created_at?: string
          id?: string
          module_code: string
          role_id: string
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          can_post?: boolean
          can_unpost?: boolean
          created_at?: string
          id?: string
          module_code?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      service_purchase_invoice_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          foreign_unit_price: number
          id: string
          input_cost_id: string | null
          is_vat_deductible: boolean
          item_code: string | null
          item_name: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          org_unit_id: string | null
          quantity: number
          service_purchase_invoice_id: string
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          foreign_unit_price?: number
          id?: string
          input_cost_id?: string | null
          is_vat_deductible?: boolean
          item_code?: string | null
          item_name: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          org_unit_id?: string | null
          quantity?: number
          service_purchase_invoice_id: string
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          foreign_unit_price?: number
          id?: string
          input_cost_id?: string | null
          is_vat_deductible?: boolean
          item_code?: string | null
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          org_unit_id?: string | null
          quantity?: number
          service_purchase_invoice_id?: string
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_purchase_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoice_items_input_cost_id_fkey"
            columns: ["input_cost_id"]
            isOneToOne: false
            referencedRelation: "input_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoice_items_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoice_items_service_purchase_invoice_id_fkey"
            columns: ["service_purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "service_purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      service_purchase_invoices: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          exchange_rate: number
          has_internal_vat_calculation: boolean
          id: string
          internal_note: string | null
          internal_number: string
          invoice_date: string
          journal_entry_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_id: string
          payment_reference: string | null
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          status: string
          subtotal: number
          supplier_address: string | null
          supplier_bank_account: string | null
          supplier_city: string | null
          supplier_invoice_number: string
          supplier_is_in_pdv: boolean
          supplier_mb: string | null
          supplier_name: string | null
          supplier_pib: string | null
          supplier_postal_code: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_calculation_type: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number: string
          invoice_date?: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
          subtotal?: number
          supplier_address?: string | null
          supplier_bank_account?: string | null
          supplier_city?: string | null
          supplier_invoice_number: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_calculation_type?: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number?: string
          invoice_date?: string
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: string
          subtotal?: number
          supplier_address?: string | null
          supplier_bank_account?: string | null
          supplier_city?: string | null
          supplier_invoice_number?: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_calculation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_purchase_invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoices_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_purchase_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
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
      user_permission_overrides: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          can_post: boolean | null
          can_unpost: boolean | null
          company_id: string
          created_at: string
          id: string
          module_code: string
          org_unit_id: string | null
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          can_post?: boolean | null
          can_unpost?: boolean | null
          company_id: string
          created_at?: string
          id?: string
          module_code: string
          org_unit_id?: string | null
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          can_post?: boolean | null
          can_unpost?: boolean | null
          company_id?: string
          created_at?: string
          id?: string
          module_code?: string
          org_unit_id?: string | null
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_permission_overrides_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          org_unit_id: string | null
          role_id: string
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          org_unit_id?: string | null
          role_id: string
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          org_unit_id?: string | null
          role_id?: string
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
      work_order_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          kg_per_unit: number
          launched_kg: number
          launched_m: number
          launched_pcs: number
          launched_qty: number
          launched_value: number
          unit: string
          unit_price: number
          variant_id: string | null
          variant_name: string | null
          work_order_id: string
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          id?: string
          item_order?: number
          kg_per_unit?: number
          launched_kg?: number
          launched_m?: number
          launched_pcs?: number
          launched_qty?: number
          launched_value?: number
          unit?: string
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
          work_order_id: string
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          id?: string
          item_order?: number
          kg_per_unit?: number
          launched_kg?: number
          launched_m?: number
          launched_pcs?: number
          launched_qty?: number
          launched_value?: number
          unit?: string
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "material_norm_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_materials: {
        Row: {
          approved_qty: number
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          material_value: number
          norm_qty: number
          unit: string
          unit_price: number
          warehouse_id: string | null
          work_order_id: string
        }
        Insert: {
          approved_qty?: number
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          id?: string
          item_order?: number
          material_value?: number
          norm_qty?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
          work_order_id: string
        }
        Update: {
          approved_qty?: number
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          id?: string
          item_order?: number
          material_value?: number
          norm_qty?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_materials_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          business_year_id: string
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string
          deadline_date: string | null
          id: string
          issued_by: string
          launched_at: string | null
          launched_by: string | null
          order_date: string
          order_number: string
          plant_note: string | null
          production_note: string | null
          status: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          business_year_id: string
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          deadline_date?: string | null
          id?: string
          issued_by?: string
          launched_at?: string | null
          launched_by?: string | null
          order_date?: string
          order_number: string
          plant_note?: string | null
          production_note?: string | null
          status?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          business_year_id?: string
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          deadline_date?: string | null
          id?: string
          issued_by?: string
          launched_at?: string | null
          launched_by?: string | null
          order_date?: string
          order_number?: string
          plant_note?: string | null
          production_note?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_post: {
        Args: {
          _company_id: string
          _module_code: string
          _org_unit_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      can_user_read: {
        Args: {
          _company_id: string
          _module_code: string
          _org_unit_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      can_user_write: {
        Args: {
          _company_id: string
          _module_code: string
          _org_unit_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      cleanup_orphaned_goods_receipts: { Args: never; Returns: number }
      get_article_warehouse_card: {
        Args: {
          p_article_id: string
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_warehouse_id: string
        }
        Returns: {
          credit_value: number
          debit_value: number
          document_number: string
          document_type: string
          in_quantity: number
          movement_date: string
          out_quantity: number
          partner_name: string
          unit_price: number
        }[]
      }
      get_document_updated_at: {
        Args: { _document_id: string; _table_name: string }
        Returns: string
      }
      get_next_calculation_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_document_number: {
        Args: { _company_id: string; _doc_type: string; _year_id: string }
        Returns: string
      }
      get_next_goods_receipt_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_inventory_count_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_journal_entry_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_price_adjustment_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_purchase_invoice_number: {
        Args: { _company_id: string; _invoice_type: string; _year_id: string }
        Returns: string
      }
      get_next_swap_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_transfer_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_work_order_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_uninvoiced_delivery_notes: {
        Args: { _company_id: string; _partner_id?: string }
        Returns: {
          delivery_date: string
          delivery_number: string
          id: string
          item_count: number
          partner_code: string
          partner_id: string
          partner_name: string
        }[]
      }
      get_user_access_level: {
        Args: {
          _company_id: string
          _module_code: string
          _org_unit_id?: string
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["access_level"]
      }
      get_warehouse_inventory_list: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_warehouse_id: string
        }
        Returns: {
          article_code: string
          article_id: string
          article_name: string
          closing_qty: number
          in_qty: number
          opening_qty: number
          out_qty: number
          turnover_qty: number
          unit: string
        }[]
      }
      get_warehouse_stock: {
        Args: {
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_warehouse_id: string
        }
        Returns: {
          article_code: string
          article_id: string
          article_name: string
          balance_qty: number
          balance_value: number
          total_in_qty: number
          total_in_value: number
          total_out_qty: number
          total_out_value: number
          unit: string
        }[]
      }
      get_warehouse_turnover: {
        Args: { p_company_id: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          balance_value: number
          credit_value: number
          debit_value: number
          document_type: string
          warehouse_code: string
          warehouse_id: string
          warehouse_name: string
        }[]
      }
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
      post_article_swap: {
        Args: { _swap_id: string; _user_id: string }
        Returns: string
      }
      post_goods_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: string
      }
      post_goods_receipt: {
        Args: { _receipt_id: string; _user_id: string }
        Returns: string
      }
      post_inter_warehouse_transfer: {
        Args: { _transfer_id: string; _user_id: string }
        Returns: string
      }
      post_inventory_count: {
        Args: { _count_id: string; _user_id: string }
        Returns: undefined
      }
      post_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      post_journal_entry: {
        Args: { _entry_id: string; _user_id: string }
        Returns: boolean
      }
      post_price_adjustment: {
        Args: { _adjustment_id: string; _user_id: string }
        Returns: undefined
      }
      post_purchase_price_calculation:
        | { Args: { _calculation_id: string }; Returns: undefined }
        | {
            Args: { _calculation_id: string; _user_id: string }
            Returns: string
          }
      post_service_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: string
      }
      unpost_article_swap: {
        Args: { _swap_id: string; _user_id: string }
        Returns: string
      }
      unpost_goods_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_goods_receipt: {
        Args: { _receipt_id: string; _user_id: string }
        Returns: string
      }
      unpost_inter_warehouse_transfer: {
        Args: { _transfer_id: string; _user_id: string }
        Returns: string
      }
      unpost_inventory_count: {
        Args: { _count_id: string; _user_id: string }
        Returns: undefined
      }
      unpost_journal_entry: {
        Args: { _entry_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_price_adjustment: {
        Args: { _adjustment_id: string; _user_id: string }
        Returns: undefined
      }
      unpost_purchase_price_calculation: {
        Args: { _calculation_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_service_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "none" | "read" | "write" | "admin"
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "super_admin" | "local_admin" | "user"
      attribute_data_type:
        | "text"
        | "string"
        | "predefined"
        | "bit"
        | "integer"
        | "decimal"
        | "date"
      document_status: "draft" | "approved" | "posted" | "cancelled"
      module_type:
        | "sifarnici"
        | "robno_materijalno"
        | "proizvodnja"
        | "nabavka"
        | "prodaja"
        | "finansije"
        | "racunovodstvo"
        | "administracija"
      sales_document_type: "quote" | "invoice" | "delivery_note"
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
      access_level: ["none", "read", "write", "admin"],
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
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
      document_status: ["draft", "approved", "posted", "cancelled"],
      module_type: [
        "sifarnici",
        "robno_materijalno",
        "proizvodnja",
        "nabavka",
        "prodaja",
        "finansije",
        "racunovodstvo",
        "administracija",
      ],
      sales_document_type: ["quote", "invoice", "delivery_note"],
      svk_type: ["0", "1", "2", "6", "8", "9"],
      warehouse_type: ["1", "2", "6", "9", "12"],
    },
  },
} as const
