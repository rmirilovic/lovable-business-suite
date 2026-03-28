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
      advance_invoice_items: {
        Row: {
          advance_invoice_id: string
          company_id: string
          created_at: string
          description: string
          id: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          quantity: number
          tax_category_code: string
          tax_exemption_reason: string | null
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          advance_invoice_id: string
          company_id: string
          created_at?: string
          description?: string
          id?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          advance_invoice_id?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "advance_invoice_items_advance_invoice_id_fkey"
            columns: ["advance_invoice_id"]
            isOneToOne: false
            referencedRelation: "advance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_invoices: {
        Row: {
          advance_date: string
          advance_number: string
          bank_account_id: string | null
          business_year_id: string
          company_id: string
          composed_by: string | null
          contract_reference: string | null
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          header_note: string | null
          id: string
          internal_note: string | null
          journal_entry_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_address: string | null
          partner_city: string | null
          partner_country_code: string
          partner_id: string
          partner_jbkjs: string | null
          partner_mb: string | null
          partner_name: string | null
          partner_pib: string | null
          partner_postal_code: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_means_code: string
          payment_reference: string | null
          posted_at: string | null
          posted_by: string | null
          status: string
          subtotal: number
          tax_category_code: string
          tax_exemption_reason: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          advance_date?: string
          advance_number: string
          bank_account_id?: string | null
          business_year_id: string
          company_id: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_means_code?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          advance_date?: string
          advance_number?: string
          bank_account_id?: string | null
          business_year_id?: string
          company_id?: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id?: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_means_code?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "advance_invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_invoices_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_purchase_invoice_items: {
        Row: {
          advance_purchase_invoice_id: string
          company_id: string
          created_at: string
          description: string
          id: string
          item_order: number
          line_subtotal: number
          line_total: number
          line_vat: number
          quantity: number
          tax_category_code: string
          tax_exemption_reason: string | null
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          advance_purchase_invoice_id: string
          company_id: string
          created_at?: string
          description?: string
          id?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          advance_purchase_invoice_id?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          quantity?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "advance_purchase_invoice_items_advance_purchase_invoice_id_fkey"
            columns: ["advance_purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "advance_purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_purchase_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_purchase_invoices: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          exchange_rate: number
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
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
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
          supplier_invoice_number?: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          exchange_rate?: number
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
        }
        Relationships: [
          {
            foreignKeyName: "advance_purchase_invoices_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_purchase_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_purchase_invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_purchase_invoices_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_purchase_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_accounts: {
        Row: {
          account_number: string
          bank_name: string
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          updated_at: string
        }
        Insert: {
          account_number: string
          bank_name: string
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          account_number?: string
          bank_name?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_items: {
        Row: {
          bank_statement_id: string
          company_id: string
          cost_center_code: string | null
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          document_reference: string | null
          id: string
          item_order: number
          partner_account_number: string | null
          partner_id: string | null
          payment_code_id: string | null
          reference_number: string | null
        }
        Insert: {
          bank_statement_id: string
          company_id: string
          cost_center_code?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          document_reference?: string | null
          id?: string
          item_order?: number
          partner_account_number?: string | null
          partner_id?: string | null
          payment_code_id?: string | null
          reference_number?: string | null
        }
        Update: {
          bank_statement_id?: string
          company_id?: string
          cost_center_code?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          document_reference?: string | null
          id?: string
          item_order?: number
          partner_account_number?: string | null
          partner_id?: string | null
          payment_code_id?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_items_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_items_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_items_payment_code_id_fkey"
            columns: ["payment_code_id"]
            isOneToOne: false
            referencedRelation: "payment_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          bank_serial_number: string | null
          business_year_id: string
          closing_balance: number
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          journal_entry_id: string | null
          opening_balance: number
          posted_at: string | null
          posted_by: string | null
          statement_date: string
          statement_number: string
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          bank_serial_number?: string | null
          business_year_id: string
          closing_balance?: number
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          opening_balance?: number
          posted_at?: string | null
          posted_by?: string | null
          statement_date?: string
          statement_number: string
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          bank_serial_number?: string | null
          business_year_id?: string
          closing_balance?: number
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          journal_entry_id?: string | null
          opening_balance?: number
          posted_at?: string | null
          posted_by?: string | null
          statement_date?: string
          statement_number?: string
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
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
          idle_timeout_hours: number | null
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
          vat_period_type: string
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
          idle_timeout_hours?: number | null
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
          vat_period_type?: string
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
          idle_timeout_hours?: number | null
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
          vat_period_type?: string
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          article_id: string | null
          company_id: string
          created_at: string
          credit_note_id: string
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
          tax_category_code: string
          tax_exemption_reason: string | null
          unit: string
          unit_price: number
          vat_rate: number
        }
        Insert: {
          article_id?: string | null
          company_id: string
          created_at?: string
          credit_note_id: string
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
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          article_id?: string | null
          company_id?: string
          created_at?: string
          credit_note_id?: string
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
          tax_category_code?: string
          tax_exemption_reason?: string | null
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          bank_account_id: string | null
          billing_reference_date: string | null
          billing_reference_number: string | null
          business_year_id: string
          company_id: string
          composed_by: string | null
          contract_reference: string | null
          created_at: string
          created_by: string
          credit_note_date: string
          credit_note_number: string
          currency: string
          due_date: string | null
          header_note: string | null
          id: string
          internal_note: string | null
          journal_entry_id: string | null
          note: string | null
          org_unit_id: string | null
          partner_address: string | null
          partner_city: string | null
          partner_country_code: string
          partner_id: string
          partner_jbkjs: string | null
          partner_mb: string | null
          partner_name: string | null
          partner_pib: string | null
          partner_postal_code: string | null
          payment_amount: number
          payment_date: string | null
          payment_means_code: string
          payment_reference: string | null
          posted_at: string | null
          posted_by: string | null
          source_invoice_id: string | null
          status: string
          subtotal: number
          tax_category_code: string
          tax_exemption_reason: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          bank_account_id?: string | null
          billing_reference_date?: string | null
          billing_reference_number?: string | null
          business_year_id: string
          company_id: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by: string
          credit_note_date?: string
          credit_note_number: string
          currency?: string
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_amount?: number
          payment_date?: string | null
          payment_means_code?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_invoice_id?: string | null
          status?: string
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          bank_account_id?: string | null
          billing_reference_date?: string | null
          billing_reference_number?: string | null
          business_year_id?: string
          company_id?: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string
          credit_note_date?: string
          credit_note_number?: string
          currency?: string
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          journal_entry_id?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id?: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_amount?: number
          payment_date?: string | null
          payment_means_code?: string
          payment_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          source_invoice_id?: string | null
          status?: string
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cases: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          case_number: string
          closed_at: string | null
          closing_reason: string | null
          company_id: string
          contact_person: string | null
          created_at: string
          created_by: string
          crm_type_id: string
          deadline: string | null
          description: string | null
          id: string
          owner_user_id: string
          partner_id: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          case_number: string
          closed_at?: string | null
          closing_reason?: string | null
          company_id: string
          contact_person?: string | null
          created_at?: string
          created_by: string
          crm_type_id: string
          deadline?: string | null
          description?: string | null
          id?: string
          owner_user_id: string
          partner_id?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          case_number?: string
          closed_at?: string | null
          closing_reason?: string | null
          company_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string
          crm_type_id?: string
          deadline?: string | null
          description?: string | null
          id?: string
          owner_user_id?: string
          partner_id?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_crm_type_id_fkey"
            columns: ["crm_type_id"]
            isOneToOne: false
            referencedRelation: "crm_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_communications: {
        Row: {
          body: string | null
          case_id: string
          comm_date: string
          comm_type: string
          contact_info: string | null
          contact_name: string | null
          created_at: string
          created_by: string
          direction: string | null
          id: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          case_id: string
          comm_date?: string
          comm_type?: string
          contact_info?: string | null
          contact_name?: string | null
          created_at?: string
          created_by: string
          direction?: string | null
          id?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          case_id?: string
          comm_date?: string
          comm_type?: string
          contact_info?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string
          direction?: string | null
          id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_communications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_documents: {
        Row: {
          case_id: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_workflow: {
        Row: {
          action_type: string
          case_id: string
          from_status: string | null
          id: string
          note: string | null
          performed_at: string
          performed_by: string
          to_status: string | null
        }
        Insert: {
          action_type: string
          case_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          performed_at?: string
          performed_by: string
          to_status?: string | null
        }
        Update: {
          action_type?: string
          case_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          performed_at?: string
          performed_by?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_workflow_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
        ]
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
          line_value: number
          quantity: number
          unit: string
          unit_price: number
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
          line_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
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
          line_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
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
          delivery_address: string | null
          delivery_date: string
          delivery_method: string | null
          delivery_number: string
          id: string
          internal_note: string | null
          invoice_id: string | null
          issued_by: string | null
          note: string | null
          org_unit_id: string | null
          partner_id: string
          posted_at: string | null
          posted_by: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          delivery_address?: string | null
          delivery_date?: string
          delivery_method?: string | null
          delivery_number: string
          id?: string
          internal_note?: string | null
          invoice_id?: string | null
          issued_by?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id: string
          posted_at?: string | null
          posted_by?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          delivery_address?: string | null
          delivery_date?: string
          delivery_method?: string | null
          delivery_number?: string
          id?: string
          internal_note?: string | null
          invoice_id?: string | null
          issued_by?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_id?: string
          posted_at?: string | null
          posted_by?: string | null
          received_by?: string | null
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
      delivery_order_items: {
        Row: {
          article_id: string
          company_id: string
          created_at: string
          delivery_order_id: string
          description: string | null
          id: string
          item_code: string
          item_name: string
          item_order: number
          line_total: number
          quantity: number
          unit: string
          unit_price: number
        }
        Insert: {
          article_id: string
          company_id: string
          created_at?: string
          delivery_order_id: string
          description?: string | null
          id?: string
          item_code: string
          item_name: string
          item_order?: number
          line_total?: number
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          article_id?: string
          company_id?: string
          created_at?: string
          delivery_order_id?: string
          description?: string | null
          id?: string
          item_code?: string
          item_name?: string
          item_order?: number
          line_total?: number
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_year_id: string
          company_id: string
          composed_by: string | null
          contact_person: string | null
          created_at: string
          created_by: string
          delivery_address: string | null
          delivery_deadline: string | null
          delivery_method: string | null
          delivery_note_id: string | null
          id: string
          invoice_id: string | null
          note: string | null
          order_date: string
          order_number: string
          ordered_by: string | null
          partner_id: string
          payment_method: string | null
          source_quote_id: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_year_id: string
          company_id: string
          composed_by?: string | null
          contact_person?: string | null
          created_at?: string
          created_by: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          delivery_method?: string | null
          delivery_note_id?: string | null
          id?: string
          invoice_id?: string | null
          note?: string | null
          order_date?: string
          order_number: string
          ordered_by?: string | null
          partner_id: string
          payment_method?: string | null
          source_quote_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_year_id?: string
          company_id?: string
          composed_by?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          delivery_method?: string | null
          delivery_note_id?: string | null
          id?: string
          invoice_id?: string | null
          note?: string | null
          order_date?: string
          order_number?: string
          ordered_by?: string | null
          partner_id?: string
          payment_method?: string | null
          source_quote_id?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      document_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string
          company_id: string
          document_id: string
          document_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by?: string
          company_id: string
          document_id: string
          document_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string
          company_id?: string
          document_id?: string
          document_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
        }
        Relationships: []
      }
      employee_absences: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          company_id: string
          created_at: string
          created_by: string
          employee_id: string
          end_date: string
          id: string
          note: string | null
          start_date: string
          updated_at: string
          work_days: number
        }
        Insert: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          company_id: string
          created_at?: string
          created_by: string
          employee_id: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
          updated_at?: string
          work_days?: number
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          company_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
          updated_at?: string
          work_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave_funds: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          note: string | null
          total_days: number
          updated_at: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
          total_days?: number
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
          total_days?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_funds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_funds_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account: string | null
          city: string | null
          company_id: string
          contract_end_date: string | null
          created_at: string | null
          created_by: string
          date_of_birth: string | null
          education_level: string | null
          email: string | null
          employee_number: string
          employment_date: string | null
          employment_type: string | null
          first_name: string
          gender: string | null
          id: string
          is_active: boolean | null
          is_owner: boolean
          jmbg: string | null
          job_title: string | null
          last_name: string
          leave_days_default: number
          middle_name: string | null
          note: string | null
          org_unit_id: string | null
          phone: string | null
          postal_code: string | null
          status: string | null
          termination_date: string | null
          updated_at: string | null
          work_experience_months: number | null
          work_experience_years: number | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          city?: string | null
          company_id: string
          contract_end_date?: string | null
          created_at?: string | null
          created_by: string
          date_of_birth?: string | null
          education_level?: string | null
          email?: string | null
          employee_number: string
          employment_date?: string | null
          employment_type?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_owner?: boolean
          jmbg?: string | null
          job_title?: string | null
          last_name: string
          leave_days_default?: number
          middle_name?: string | null
          note?: string | null
          org_unit_id?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
          work_experience_months?: number | null
          work_experience_years?: number | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          city?: string | null
          company_id?: string
          contract_end_date?: string | null
          created_at?: string | null
          created_by?: string
          date_of_birth?: string | null
          education_level?: string | null
          email?: string | null
          employee_number?: string
          employment_date?: string | null
          employment_type?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_owner?: boolean
          jmbg?: string | null
          job_title?: string | null
          last_name?: string
          leave_days_default?: number
          middle_name?: string | null
          note?: string | null
          org_unit_id?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
          work_experience_months?: number | null
          work_experience_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
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
      incoming_mail: {
        Row: {
          amount: number | null
          archive_label: string | null
          attachment_name: string | null
          attachment_path: string | null
          business_year_id: string
          company_id: string
          cost_center_distribution: string | null
          created_at: string
          created_by: string
          document_date: string
          document_number: string
          document_type: string
          id: string
          incorrect_reason: string | null
          is_correct: boolean | null
          liquidation_date: string | null
          liquidator_name: string | null
          liquidator_user_id: string | null
          mail_number: string
          note: string | null
          partner_id: string | null
          registration_date: string | null
          sender_mb: string | null
          sender_name: string
          sender_pib: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          archive_label?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          business_year_id: string
          company_id: string
          cost_center_distribution?: string | null
          created_at?: string
          created_by: string
          document_date: string
          document_number: string
          document_type: string
          id?: string
          incorrect_reason?: string | null
          is_correct?: boolean | null
          liquidation_date?: string | null
          liquidator_name?: string | null
          liquidator_user_id?: string | null
          mail_number: string
          note?: string | null
          partner_id?: string | null
          registration_date?: string | null
          sender_mb?: string | null
          sender_name: string
          sender_pib?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          archive_label?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          business_year_id?: string
          company_id?: string
          cost_center_distribution?: string | null
          created_at?: string
          created_by?: string
          document_date?: string
          document_number?: string
          document_type?: string
          id?: string
          incorrect_reason?: string | null
          is_correct?: boolean | null
          liquidation_date?: string | null
          liquidator_name?: string | null
          liquidator_user_id?: string | null
          mail_number?: string
          note?: string | null
          partner_id?: string | null
          registration_date?: string | null
          sender_mb?: string | null
          sender_name?: string
          sender_pib?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_mail_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_mail_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_mail_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
          tax_category_code: string
          tax_exemption_reason: string | null
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
          tax_category_code?: string
          tax_exemption_reason?: string | null
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
          tax_category_code?: string
          tax_exemption_reason?: string | null
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
          advance_invoice_id: string | null
          bank_account_id: string | null
          billing_reference_date: string | null
          billing_reference_number: string | null
          business_year_id: string
          company_id: string
          composed_by: string | null
          contract_reference: string | null
          created_at: string
          created_by: string
          currency: string
          datum_prometa: string | null
          due_date: string | null
          header_note: string | null
          id: string
          internal_note: string | null
          invoice_date: string
          invoice_number: string
          invoice_type_code: string
          journal_entry_id: string | null
          mesto_prometa: string | null
          note: string | null
          org_unit_id: string | null
          partner_address: string | null
          partner_city: string | null
          partner_country_code: string
          partner_id: string
          partner_jbkjs: string | null
          partner_mb: string | null
          partner_name: string | null
          partner_pib: string | null
          partner_postal_code: string | null
          payment_means_code: string
          posted_at: string | null
          posted_by: string | null
          source_delivery_note_id: string | null
          source_quote_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_category_code: string
          tax_exemption_reason: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          advance_invoice_id?: string | null
          bank_account_id?: string | null
          billing_reference_date?: string | null
          billing_reference_number?: string | null
          business_year_id: string
          company_id: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by: string
          currency?: string
          datum_prometa?: string | null
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type_code?: string
          journal_entry_id?: string | null
          mesto_prometa?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_means_code?: string
          posted_at?: string | null
          posted_by?: string | null
          source_delivery_note_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          advance_invoice_id?: string | null
          bank_account_id?: string | null
          billing_reference_date?: string | null
          billing_reference_number?: string | null
          business_year_id?: string
          company_id?: string
          composed_by?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          datum_prometa?: string | null
          due_date?: string | null
          header_note?: string | null
          id?: string
          internal_note?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type_code?: string
          journal_entry_id?: string | null
          mesto_prometa?: string | null
          note?: string | null
          org_unit_id?: string | null
          partner_address?: string | null
          partner_city?: string | null
          partner_country_code?: string
          partner_id?: string
          partner_jbkjs?: string | null
          partner_mb?: string | null
          partner_name?: string | null
          partner_pib?: string | null
          partner_postal_code?: string | null
          payment_means_code?: string
          posted_at?: string | null
          posted_by?: string | null
          source_delivery_note_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_category_code?: string
          tax_exemption_reason?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_advance_invoice_id_fkey"
            columns: ["advance_invoice_id"]
            isOneToOne: false
            referencedRelation: "advance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
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
      material_requisition_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          item_value: number
          quantity: number
          requisition_id: string
          unit: string
          unit_price: number
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          id?: string
          item_order?: number
          item_value?: number
          quantity?: number
          requisition_id: string
          unit?: string
          unit_price?: number
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          id?: string
          item_order?: number
          item_value?: number
          quantity?: number
          requisition_id?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_requisition_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisition_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "material_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requisitions: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          issued_by: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          received_by: string
          requisition_date: string
          requisition_number: string
          status: string
          updated_at: string
          warehouse_id: string
          work_order_id: string | null
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          issued_by?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_by?: string
          requisition_date?: string
          requisition_number: string
          status?: string
          updated_at?: string
          warehouse_id: string
          work_order_id?: string | null
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          issued_by?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_by?: string
          requisition_date?: string
          requisition_number?: string
          status?: string
          updated_at?: string
          warehouse_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requisitions_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisitions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisitions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requisitions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
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
      nbs_payment_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
      outgoing_mail: {
        Row: {
          amount: number | null
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          document_date: string
          document_number: string
          document_type: string
          id: string
          mail_number: string
          note: string | null
          recipient_address: string | null
          recipient_name: string
          recipient_partner_id: string | null
          registration_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          document_date?: string
          document_number?: string
          document_type: string
          id?: string
          mail_number: string
          note?: string | null
          recipient_address?: string | null
          recipient_name?: string
          recipient_partner_id?: string | null
          registration_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          document_date?: string
          document_number?: string
          document_type?: string
          id?: string
          mail_number?: string
          note?: string | null
          recipient_address?: string | null
          recipient_name?: string
          recipient_partner_id?: string | null
          registration_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_mail_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outgoing_mail_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outgoing_mail_recipient_partner_id_fkey"
            columns: ["recipient_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
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
      payment_codes: {
        Row: {
          account_code: string
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_code: string
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_code?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          approved_amount: number
          approved_date: string | null
          bank_account_id: string | null
          booking_date: string
          company_id: string
          created_at: string
          created_by: string
          document_amount: number
          due_date: string | null
          id: string
          nbs_payment_code: string | null
          note: string | null
          paid_amount: number | null
          paid_date: string | null
          partner_bank_account: string | null
          partner_code: string | null
          partner_id: string | null
          partner_name: string | null
          payment_reference: string | null
          previously_paid: number
          sent_date: string | null
          source_document_id: string | null
          source_document_number: string | null
          source_document_type: string | null
          status: string
          supplier_document_date: string | null
          supplier_document_number: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number
          approved_date?: string | null
          bank_account_id?: string | null
          booking_date?: string
          company_id: string
          created_at?: string
          created_by: string
          document_amount?: number
          due_date?: string | null
          id?: string
          nbs_payment_code?: string | null
          note?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          partner_bank_account?: string | null
          partner_code?: string | null
          partner_id?: string | null
          partner_name?: string | null
          payment_reference?: string | null
          previously_paid?: number
          sent_date?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          status?: string
          supplier_document_date?: string | null
          supplier_document_number?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number
          approved_date?: string | null
          bank_account_id?: string | null
          booking_date?: string
          company_id?: string
          created_at?: string
          created_by?: string
          document_amount?: number
          due_date?: string | null
          id?: string
          nbs_payment_code?: string | null
          note?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          partner_bank_account?: string | null
          partner_code?: string | null
          partner_id?: string | null
          partner_name?: string | null
          payment_reference?: string | null
          previously_paid?: number
          sent_date?: string | null
          source_document_id?: string | null
          source_document_number?: string | null
          source_document_type?: string | null
          status?: string
          supplier_document_date?: string | null
          supplier_document_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_calculation_items: {
        Row: {
          calculation_id: string
          company_id: string
          created_at: string
          employee_id: string
          employee_name: string
          employee_number: string
          gross_salary: number
          health_employee: number
          health_employer: number
          hours_overtime: number
          hours_regular: number
          id: string
          income_tax: number
          item_order: number
          meal_allowance: number
          net_salary: number
          non_taxable_amount: number
          note: string | null
          other_additions: number
          other_deductions: number
          pio_employee: number
          pio_employer: number
          tax_base: number
          total_cost: number
          total_employee_contributions: number
          total_employer_contributions: number
          transport_allowance: number
          unemployment: number
          worked_days: number
          working_days: number
        }
        Insert: {
          calculation_id: string
          company_id: string
          created_at?: string
          employee_id: string
          employee_name: string
          employee_number: string
          gross_salary?: number
          health_employee?: number
          health_employer?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          income_tax?: number
          item_order?: number
          meal_allowance?: number
          net_salary?: number
          non_taxable_amount?: number
          note?: string | null
          other_additions?: number
          other_deductions?: number
          pio_employee?: number
          pio_employer?: number
          tax_base?: number
          total_cost?: number
          total_employee_contributions?: number
          total_employer_contributions?: number
          transport_allowance?: number
          unemployment?: number
          worked_days?: number
          working_days?: number
        }
        Update: {
          calculation_id?: string
          company_id?: string
          created_at?: string
          employee_id?: string
          employee_name?: string
          employee_number?: string
          gross_salary?: number
          health_employee?: number
          health_employer?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          income_tax?: number
          item_order?: number
          meal_allowance?: number
          net_salary?: number
          non_taxable_amount?: number
          note?: string | null
          other_additions?: number
          other_deductions?: number
          pio_employee?: number
          pio_employer?: number
          tax_base?: number
          total_cost?: number
          total_employee_contributions?: number
          total_employer_contributions?: number
          transport_allowance?: number
          unemployment?: number
          worked_days?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_items_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "payroll_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_calculations: {
        Row: {
          business_year_id: string
          calculation_date: string
          calculation_number: string
          calculation_type: Database["public"]["Enums"]["payroll_calculation_type"]
          company_id: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          parameter_id: string | null
          period_month: number
          period_year: number
          posted_at: string | null
          posted_by: string | null
          status: string
          total_cost: number
          total_employee_contributions: number
          total_employer_contributions: number
          total_gross: number
          total_meal_allowance: number
          total_net: number
          total_tax: number
          total_transport_allowance: number
          updated_at: string
        }
        Insert: {
          business_year_id: string
          calculation_date?: string
          calculation_number: string
          calculation_type?: Database["public"]["Enums"]["payroll_calculation_type"]
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          parameter_id?: string | null
          period_month: number
          period_year: number
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_cost?: number
          total_employee_contributions?: number
          total_employer_contributions?: number
          total_gross?: number
          total_meal_allowance?: number
          total_net?: number
          total_tax?: number
          total_transport_allowance?: number
          updated_at?: string
        }
        Update: {
          business_year_id?: string
          calculation_date?: string
          calculation_number?: string
          calculation_type?: Database["public"]["Enums"]["payroll_calculation_type"]
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          parameter_id?: string | null
          period_month?: number
          period_year?: number
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          total_cost?: number
          total_employee_contributions?: number
          total_employer_contributions?: number
          total_gross?: number
          total_meal_allowance?: number
          total_net?: number
          total_tax?: number
          total_transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculations_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculations_parameter_id_fkey"
            columns: ["parameter_id"]
            isOneToOne: false
            referencedRelation: "payroll_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_parameters: {
        Row: {
          company_id: string
          created_at: string
          health_employee_rate: number
          health_employer_rate: number
          id: string
          income_tax_rate: number
          is_active: boolean
          max_base_pio: number
          min_base_health: number
          min_base_pio: number
          non_taxable_amount: number
          note: string | null
          pio_employee_rate: number
          pio_employer_rate: number
          unemployment_rate: number
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          income_tax_rate?: number
          is_active?: boolean
          max_base_pio?: number
          min_base_health?: number
          min_base_pio?: number
          non_taxable_amount?: number
          note?: string | null
          pio_employee_rate?: number
          pio_employer_rate?: number
          unemployment_rate?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          income_tax_rate?: number
          is_active?: boolean
          max_base_pio?: number
          min_base_health?: number
          min_base_pio?: number
          non_taxable_amount?: number
          note?: string | null
          pio_employee_rate?: number
          pio_employer_rate?: number
          unemployment_rate?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      popdv_report_cells: {
        Row: {
          auto_value: number
          column_code: string
          company_id: string
          created_at: string
          id: string
          manual_override: number | null
          report_id: string
          row_code: string
          section: string
          updated_at: string
        }
        Insert: {
          auto_value?: number
          column_code: string
          company_id: string
          created_at?: string
          id?: string
          manual_override?: number | null
          report_id: string
          row_code: string
          section: string
          updated_at?: string
        }
        Update: {
          auto_value?: number
          column_code?: string
          company_id?: string
          created_at?: string
          id?: string
          manual_override?: number | null
          report_id?: string
          row_code?: string
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "popdv_report_cells_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "popdv_report_cells_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "popdv_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      popdv_report_detail_rows: {
        Row: {
          company_id: string
          created_at: string
          document_date: string | null
          document_type_number: string | null
          id: string
          item_order: number
          partner_info: string | null
          report_id: string
          row_code: string
          section: string
          source_document_id: string | null
          supplier_document_number: string | null
          updated_at: string
          values: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          document_date?: string | null
          document_type_number?: string | null
          id?: string
          item_order?: number
          partner_info?: string | null
          report_id: string
          row_code: string
          section: string
          source_document_id?: string | null
          supplier_document_number?: string | null
          updated_at?: string
          values?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          document_date?: string | null
          document_type_number?: string | null
          id?: string
          item_order?: number
          partner_info?: string | null
          report_id?: string
          row_code?: string
          section?: string
          source_document_id?: string | null
          supplier_document_number?: string | null
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "popdv_report_detail_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "popdv_report_detail_rows_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "popdv_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      popdv_reports: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          note: string | null
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          status: string
          updated_at: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          note?: string | null
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          note?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          period_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "popdv_reports_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "popdv_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pp_pdv_returns: {
        Row: {
          activity_code: string | null
          business_year_id: string
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string
          email: string | null
          field_001: number
          field_002: number
          field_003: number
          field_004: number
          field_005: number
          field_006: number
          field_007: number
          field_008: number
          field_009: number
          field_010: number
          field_011: number
          field_101: number
          field_102: number
          field_103: number
          field_104: number
          field_105: number
          field_106: number
          field_107: number
          field_108: number
          field_201: number
          field_202: number
          finalized_at: string | null
          finalized_by: string | null
          id: string
          municipality_code: string | null
          note: string | null
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          pib: string | null
          popdv_report_id: string | null
          responsible_person_jmbg: string | null
          responsible_person_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activity_code?: string | null
          business_year_id: string
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          field_001?: number
          field_002?: number
          field_003?: number
          field_004?: number
          field_005?: number
          field_006?: number
          field_007?: number
          field_008?: number
          field_009?: number
          field_010?: number
          field_011?: number
          field_101?: number
          field_102?: number
          field_103?: number
          field_104?: number
          field_105?: number
          field_106?: number
          field_107?: number
          field_108?: number
          field_201?: number
          field_202?: number
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          municipality_code?: string | null
          note?: string | null
          period_end: string
          period_label: string
          period_start: string
          period_type?: string
          pib?: string | null
          popdv_report_id?: string | null
          responsible_person_jmbg?: string | null
          responsible_person_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activity_code?: string | null
          business_year_id?: string
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          field_001?: number
          field_002?: number
          field_003?: number
          field_004?: number
          field_005?: number
          field_006?: number
          field_007?: number
          field_008?: number
          field_009?: number
          field_010?: number
          field_011?: number
          field_101?: number
          field_102?: number
          field_103?: number
          field_104?: number
          field_105?: number
          field_106?: number
          field_107?: number
          field_108?: number
          field_201?: number
          field_202?: number
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          municipality_code?: string | null
          note?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          period_type?: string
          pib?: string | null
          popdv_report_id?: string | null
          responsible_person_jmbg?: string | null
          responsible_person_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pp_pdv_returns_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pp_pdv_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pp_pdv_returns_popdv_report_id_fkey"
            columns: ["popdv_report_id"]
            isOneToOne: false
            referencedRelation: "popdv_reports"
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
      production_delivery_note_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          delivered_kg: number
          delivered_m: number
          delivered_pcs: number
          delivery_note_id: string
          id: string
          item_order: number
          item_value: number
          kg_per_unit: number
          launched_qty: number
          qty_shift_1: number
          qty_shift_2: number
          qty_shift_3: number
          qty_total: number
          scrap_qty: number
          unit: string
          unit_price: number
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          delivered_kg?: number
          delivered_m?: number
          delivered_pcs?: number
          delivery_note_id: string
          id?: string
          item_order?: number
          item_value?: number
          kg_per_unit?: number
          launched_qty?: number
          qty_shift_1?: number
          qty_shift_2?: number
          qty_shift_3?: number
          qty_total?: number
          scrap_qty?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          delivered_kg?: number
          delivered_m?: number
          delivered_pcs?: number
          delivery_note_id?: string
          id?: string
          item_order?: number
          item_value?: number
          kg_per_unit?: number
          launched_qty?: number
          qty_shift_1?: number
          qty_shift_2?: number
          qty_shift_3?: number
          qty_total?: number
          scrap_qty?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_delivery_note_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "production_delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_delivery_notes: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          delivery_date: string
          delivery_number: string
          id: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          production_line: number
          responsible_person: string
          shift_manager_1_id: string | null
          shift_manager_2_id: string | null
          shift_manager_3_id: string | null
          status: string
          total_kg: number
          total_value: number
          updated_at: string
          warehouse_id: string
          work_order_id: string | null
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          delivery_date?: string
          delivery_number: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          production_line?: number
          responsible_person?: string
          shift_manager_1_id?: string | null
          shift_manager_2_id?: string | null
          shift_manager_3_id?: string | null
          status?: string
          total_kg?: number
          total_value?: number
          updated_at?: string
          warehouse_id: string
          work_order_id?: string | null
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          delivery_date?: string
          delivery_number?: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          production_line?: number
          responsible_person?: string
          shift_manager_1_id?: string | null
          shift_manager_2_id?: string | null
          shift_manager_3_id?: string | null
          status?: string
          total_kg?: number
          total_value?: number
          updated_at?: string
          warehouse_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_delivery_notes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_shift_manager_1_id_fkey"
            columns: ["shift_manager_1_id"]
            isOneToOne: false
            referencedRelation: "shift_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_shift_manager_2_id_fkey"
            columns: ["shift_manager_2_id"]
            isOneToOne: false
            referencedRelation: "shift_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_shift_manager_3_id_fkey"
            columns: ["shift_manager_3_id"]
            isOneToOne: false
            referencedRelation: "shift_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
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
          approved_by_name: string | null
          bank_account_id: string | null
          business_year_id: string
          company_id: string
          composed_by: string | null
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
          payment_method: string | null
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
          approved_by_name?: string | null
          bank_account_id?: string | null
          business_year_id: string
          company_id: string
          composed_by?: string | null
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
          payment_method?: string | null
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
          approved_by_name?: string | null
          bank_account_id?: string | null
          business_year_id?: string
          company_id?: string
          composed_by?: string | null
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
          payment_method?: string | null
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
            foreignKeyName: "quotes_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
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
      received_credit_note_items: {
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
          received_credit_note_id: string
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
          item_name?: string
          item_order?: number
          line_subtotal?: number
          line_total?: number
          line_vat?: number
          org_unit_id?: string | null
          quantity?: number
          received_credit_note_id: string
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
          received_credit_note_id?: string
          unit?: string
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "received_credit_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_note_items_input_cost_id_fkey"
            columns: ["input_cost_id"]
            isOneToOne: false
            referencedRelation: "input_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_note_items_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_note_items_received_credit_note_id_fkey"
            columns: ["received_credit_note_id"]
            isOneToOne: false
            referencedRelation: "received_credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      received_credit_notes: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          currency: string
          document_date: string
          due_date: string | null
          exchange_rate: number
          has_internal_vat_calculation: boolean
          id: string
          internal_note: string | null
          internal_number: string
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
          supplier_document_number: string
          supplier_is_in_pdv: boolean
          supplier_mb: string | null
          supplier_name: string | null
          supplier_pib: string | null
          supplier_postal_code: string | null
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          currency?: string
          document_date?: string
          due_date?: string | null
          exchange_rate?: number
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number: string
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
          supplier_document_number?: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          document_date?: string
          due_date?: string | null
          exchange_rate?: number
          has_internal_vat_calculation?: boolean
          id?: string
          internal_note?: string | null
          internal_number?: string
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
          supplier_document_number?: string
          supplier_is_in_pdv?: boolean
          supplier_mb?: string | null
          supplier_name?: string | null
          supplier_pib?: string | null
          supplier_postal_code?: string | null
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "received_credit_notes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_notes_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "organizational_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_credit_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_delivery_note_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          delivered_kg: number
          delivered_m: number
          delivered_pcs: number
          delivery_note_id: string
          id: string
          item_order: number
          item_value: number
          kg_per_unit: number
          launched_qty: number
          qty_shift_1: number
          qty_shift_2: number
          qty_shift_3: number
          qty_total: number
          scrap_qty: number
          unit: string
          unit_price: number
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at?: string
          delivered_kg?: number
          delivered_m?: number
          delivered_pcs?: number
          delivery_note_id: string
          id?: string
          item_order?: number
          item_value?: number
          kg_per_unit?: number
          launched_qty?: number
          qty_shift_1?: number
          qty_shift_2?: number
          qty_shift_3?: number
          qty_total?: number
          scrap_qty?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          company_id?: string
          created_at?: string
          delivered_kg?: number
          delivered_m?: number
          delivered_pcs?: number
          delivery_note_id?: string
          id?: string
          item_order?: number
          item_value?: number
          kg_per_unit?: number
          launched_qty?: number
          qty_shift_1?: number
          qty_shift_2?: number
          qty_shift_3?: number
          qty_total?: number
          scrap_qty?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_delivery_note_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "reprocessing_delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_delivery_notes: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          delivery_date: string
          delivery_number: string
          id: string
          journal_entry_id: string | null
          note: string | null
          posted_at: string | null
          posted_by: string | null
          production_line: number
          responsible_person: string
          shift_manager_1_id: string | null
          shift_manager_2_id: string | null
          shift_manager_3_id: string | null
          status: string
          total_kg: number
          total_value: number
          updated_at: string
          warehouse_id: string
          work_order_id: string
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          delivery_date?: string
          delivery_number: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          production_line?: number
          responsible_person?: string
          shift_manager_1_id?: string | null
          shift_manager_2_id?: string | null
          shift_manager_3_id?: string | null
          status?: string
          total_kg?: number
          total_value?: number
          updated_at?: string
          warehouse_id: string
          work_order_id: string
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          delivery_date?: string
          delivery_number?: string
          id?: string
          journal_entry_id?: string | null
          note?: string | null
          posted_at?: string | null
          posted_by?: string | null
          production_line?: number
          responsible_person?: string
          shift_manager_1_id?: string | null
          shift_manager_2_id?: string | null
          shift_manager_3_id?: string | null
          status?: string
          total_kg?: number
          total_value?: number
          updated_at?: string
          warehouse_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_delivery_notes_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_delivery_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "reprocessing_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_wo_input_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          item_value: number
          quantity: number
          unit: string
          unit_price: number
          warehouse_id: string | null
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
          item_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
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
          item_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_wo_input_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_input_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_input_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_input_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "reprocessing_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_wo_materials: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          item_value: number
          quantity: number
          unit: string
          unit_price: number
          warehouse_id: string | null
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
          item_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
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
          item_value?: number
          quantity?: number
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_wo_materials_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_materials_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_materials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "reprocessing_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_wo_output_items: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          company_id: string
          created_at: string
          id: string
          item_order: number
          kg_per_unit: number
          launched_qty: number
          launched_value: number
          unit: string
          unit_price: number
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
          launched_qty?: number
          launched_value?: number
          unit?: string
          unit_price?: number
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
          launched_qty?: number
          launched_value?: number
          unit?: string
          unit_price?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_wo_output_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_output_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_wo_output_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "reprocessing_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reprocessing_work_orders: {
        Row: {
          business_year_id: string
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string
          deadline_date: string | null
          id: string
          journal_entry_id: string | null
          launched_at: string | null
          launched_by: string | null
          note: string | null
          order_date: string
          order_number: string
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
          journal_entry_id?: string | null
          launched_at?: string | null
          launched_by?: string | null
          note?: string | null
          order_date?: string
          order_number: string
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
          journal_entry_id?: string | null
          launched_at?: string | null
          launched_by?: string | null
          note?: string | null
          order_date?: string
          order_number?: string
          status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reprocessing_work_orders_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_work_orders_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reprocessing_work_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      shift_managers: {
        Row: {
          company_id: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          slot_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          slot_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          slot_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_managers_company_id_fkey"
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
      warehouse_reservations: {
        Row: {
          article_code: string
          article_id: string
          article_name: string
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          created_by_name: string
          document_id: string | null
          document_number: string
          document_type: string
          id: string
          note: string | null
          partner_code: string | null
          partner_id: string | null
          partner_name: string | null
          quantity: number
          reservation_date: string
          unit: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          article_code: string
          article_id: string
          article_name: string
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          created_by_name: string
          document_id?: string | null
          document_number: string
          document_type: string
          id?: string
          note?: string | null
          partner_code?: string | null
          partner_id?: string | null
          partner_name?: string | null
          quantity?: number
          reservation_date?: string
          unit?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          article_code?: string
          article_id?: string
          article_name?: string
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          document_id?: string | null
          document_number?: string
          document_type?: string
          id?: string
          note?: string | null
          partner_code?: string | null
          partner_id?: string | null
          partner_name?: string | null
          quantity?: number
          reservation_date?: string
          unit?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_reservations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_reservations_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_reservations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
      work_hours: {
        Row: {
          business_year_id: string
          company_id: string
          created_at: string
          created_by: string
          employee_id: string
          hours_holiday: number
          hours_night: number
          hours_overtime: number
          hours_regular: number
          id: string
          month: number
          note: string | null
          updated_at: string
          worked_days: number
          working_days: number
          year: number
        }
        Insert: {
          business_year_id: string
          company_id: string
          created_at?: string
          created_by: string
          employee_id: string
          hours_holiday?: number
          hours_night?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          month: number
          note?: string | null
          updated_at?: string
          worked_days?: number
          working_days?: number
          year: number
        }
        Update: {
          business_year_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          hours_holiday?: number
          hours_night?: number
          hours_overtime?: number
          hours_regular?: number
          id?: string
          month?: number
          note?: string | null
          updated_at?: string
          worked_days?: number
          working_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_hours_business_year_id_fkey"
            columns: ["business_year_id"]
            isOneToOne: false
            referencedRelation: "business_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_hours_company_id_fkey"
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
      can_edit_crm_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
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
      close_reprocessing_work_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: string
      }
      ensure_popdv_report: {
        Args: {
          _business_year_id: string
          _company_id: string
          _document_date: string
          _user_id: string
        }
        Returns: string
      }
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
      get_company_users_for_display: {
        Args: { _company_id: string }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_document_updated_at: {
        Args: { _document_id: string; _table_name: string }
        Returns: string
      }
      get_next_bank_statement_number: {
        Args: { _company_id: string; _year_id: string }
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
        Args: { _company_id: string; _invoice_type?: string; _year_id: string }
        Returns: string
      }
      get_next_reprocessing_wo_number: {
        Args: { _company_id: string; _year_id: string }
        Returns: string
      }
      get_next_requisition_number: {
        Args: { _company_id: string; _year_id: string }
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
      get_warehouse_stock_with_reservations: {
        Args: {
          p_company_id: string
          p_date_to?: string
          p_warehouse_id: string
        }
        Returns: {
          article_code: string
          article_id: string
          article_name: string
          available_qty: number
          balance_qty: number
          balance_value: number
          reserved_delivery_notes: number
          reserved_delivery_orders: number
          reserved_other: number
          total_reserved: number
          unit: string
          unit_price: number
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
      post_advance_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      post_advance_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      post_article_swap: {
        Args: { _swap_id: string; _user_id: string }
        Returns: string
      }
      post_bank_statement: {
        Args: { _statement_id: string; _user_id: string }
        Returns: string
      }
      post_credit_note: {
        Args: { _credit_note_id: string; _user_id: string }
        Returns: boolean
      }
      post_delivery_note: {
        Args: { _delivery_note_id: string; _user_id: string }
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
      post_material_requisition: {
        Args: { _requisition_id: string; _user_id: string }
        Returns: string
      }
      post_price_adjustment: {
        Args: { _adjustment_id: string; _user_id: string }
        Returns: undefined
      }
      post_production_delivery_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: string
      }
      post_purchase_price_calculation:
        | { Args: { _calculation_id: string }; Returns: undefined }
        | {
            Args: { _calculation_id: string; _user_id: string }
            Returns: string
          }
      post_received_credit_note: {
        Args: { _doc_id: string; _user_id: string }
        Returns: undefined
      }
      post_reprocessing_delivery_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: string
      }
      post_service_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: string
      }
      reopen_reprocessing_work_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_advance_invoice: {
        Args: { _invoice_id: string }
        Returns: boolean
      }
      unpost_advance_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_article_swap: {
        Args: { _swap_id: string; _user_id: string }
        Returns: string
      }
      unpost_bank_statement: {
        Args: { _statement_id: string; _user_id: string }
        Returns: undefined
      }
      unpost_credit_note: {
        Args: { _credit_note_id: string }
        Returns: boolean
      }
      unpost_delivery_note: {
        Args: { _delivery_note_id: string; _user_id: string }
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
      unpost_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_journal_entry: {
        Args: { _entry_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_material_requisition: {
        Args: { _requisition_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_price_adjustment: {
        Args: { _adjustment_id: string; _user_id: string }
        Returns: undefined
      }
      unpost_production_delivery_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_purchase_price_calculation: {
        Args: { _calculation_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_received_credit_note: {
        Args: { _doc_id: string; _user_id: string }
        Returns: undefined
      }
      unpost_reprocessing_delivery_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      unpost_service_purchase_invoice: {
        Args: { _invoice_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      absence_type:
        | "godisnji_odmor"
        | "bolovanje"
        | "placeno_odsustvo"
        | "neplaceno_odsustvo"
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
      document_status: "draft" | "approved" | "posted" | "cancelled" | "renewed"
      module_type:
        | "sifarnici"
        | "robno_materijalno"
        | "proizvodnja"
        | "nabavka"
        | "prodaja"
        | "finansije"
        | "racunovodstvo"
        | "administracija"
        | "pisarnica"
        | "zarade"
      payroll_calculation_type:
        | "redovna_zarada"
        | "ugovor_o_delu"
        | "autorski_ugovor"
        | "vlasnik"
        | "penzioner"
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
      absence_type: [
        "godisnji_odmor",
        "bolovanje",
        "placeno_odsustvo",
        "neplaceno_odsustvo",
      ],
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
      document_status: ["draft", "approved", "posted", "cancelled", "renewed"],
      module_type: [
        "sifarnici",
        "robno_materijalno",
        "proizvodnja",
        "nabavka",
        "prodaja",
        "finansije",
        "racunovodstvo",
        "administracija",
        "pisarnica",
        "zarade",
      ],
      payroll_calculation_type: [
        "redovna_zarada",
        "ugovor_o_delu",
        "autorski_ugovor",
        "vlasnik",
        "penzioner",
      ],
      sales_document_type: ["quote", "invoice", "delivery_note"],
      svk_type: ["0", "1", "2", "6", "8", "9"],
      warehouse_type: ["1", "2", "6", "9", "12"],
    },
  },
} as const
