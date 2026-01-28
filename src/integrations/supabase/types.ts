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
          entry_number: number
          id: string
          org_unit_id: string | null
          posted_at: string | null
          posted_by: string | null
          source_document_id: string | null
          source_document_type: string | null
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
          entry_number: number
          id?: string
          org_unit_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
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
          entry_number?: number
          id?: string
          org_unit_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
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
          posted_at: string | null
          posted_by: string | null
          receipt_date: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
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
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
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
          posted_at?: string | null
          posted_by?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
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
      get_next_document_number: {
        Args: { _company_id: string; _doc_type: string; _year_id: string }
        Returns: string
      }
      get_next_journal_entry_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: number
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
      post_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      post_journal_entry: {
        Args: { _entry_id: string; _user_id: string }
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
