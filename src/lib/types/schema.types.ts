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
      acc_accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          type: Database["public"]["Enums"]["acc_account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          type: Database["public"]["Enums"]["acc_account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["acc_account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_adjustments: {
        Row: {
          adj_type: string
          adjustment_no: string
          amount: number
          cgst_amount: number
          created_at: string
          id: string
          igst_amount: number
          invoice_id: string | null
          org_id: string
          po_id: string | null
          reason: string | null
          sgst_amount: number
        }
        Insert: {
          adj_type: string
          adjustment_no: string
          amount: number
          cgst_amount?: number
          created_at?: string
          id?: string
          igst_amount?: number
          invoice_id?: string | null
          org_id: string
          po_id?: string | null
          reason?: string | null
          sgst_amount?: number
        }
        Update: {
          adj_type?: string
          adjustment_no?: string
          amount?: number
          cgst_amount?: number
          created_at?: string
          id?: string
          igst_amount?: number
          invoice_id?: string | null
          org_id?: string
          po_id?: string | null
          reason?: string | null
          sgst_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "acc_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "mv_ar_aging"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "acc_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "acc_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_adjustments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_bank_statement_lines: {
        Row: {
          amount: number
          description: string
          id: string
          is_reconciled: boolean
          payment_id: string | null
          statement_id: string
          transaction_date: string
        }
        Insert: {
          amount: number
          description: string
          id?: string
          is_reconciled?: boolean
          payment_id?: string | null
          statement_id: string
          transaction_date: string
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          is_reconciled?: boolean
          payment_id?: string | null
          statement_id?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_bank_statement_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "acc_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "acc_bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_bank_statements: {
        Row: {
          account_number: string
          closing_balance: number
          created_at: string
          id: string
          opening_balance: number
          org_id: string
          statement_date: string
        }
        Insert: {
          account_number: string
          closing_balance?: number
          created_at?: string
          id?: string
          opening_balance?: number
          org_id: string
          statement_date: string
        }
        Update: {
          account_number?: string
          closing_balance?: number
          created_at?: string
          id?: string
          opening_balance?: number
          org_id?: string
          statement_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_bank_statements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_invoices: {
        Row: {
          cgst_amount: number | null
          cgst_pct: number
          created_at: string
          due_date: string
          id: string
          igst_amount: number | null
          igst_pct: number
          invoice_date: string
          invoice_number: string
          org_id: string
          project_id: string
          sgst_amount: number | null
          sgst_pct: number
          status: Database["public"]["Enums"]["invoice_status"]
          taxable_amount: number
          tds_deducted: number
          total_invoice: number | null
          updated_at: string
        }
        Insert: {
          cgst_amount?: number | null
          cgst_pct?: number
          created_at?: string
          due_date: string
          id?: string
          igst_amount?: number | null
          igst_pct?: number
          invoice_date?: string
          invoice_number: string
          org_id: string
          project_id: string
          sgst_amount?: number | null
          sgst_pct?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          taxable_amount: number
          tds_deducted?: number
          total_invoice?: number | null
          updated_at?: string
        }
        Update: {
          cgst_amount?: number | null
          cgst_pct?: number
          created_at?: string
          due_date?: string
          id?: string
          igst_amount?: number | null
          igst_pct?: number
          invoice_date?: string
          invoice_number?: string
          org_id?: string
          project_id?: string
          sgst_amount?: number | null
          sgst_pct?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          taxable_amount?: number
          tds_deducted?: number
          total_invoice?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acc_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "acc_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "acc_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      acc_journal_entries: {
        Row: {
          created_at: string
          description: string | null
          entry_date: string
          id: string
          org_id: string
          reference_no: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          org_id: string
          reference_no?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          org_id?: string
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      acc_journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          entry_id: string
          id: string
          org_id: string
          project_id: string | null
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          org_id: string
          project_id?: string | null
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          org_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "acc_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "acc_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "acc_journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "acc_journal_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      acc_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          payment_date: string
          payment_number: string
          po_id: string | null
          reference_no: string | null
          tds_deducted: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          org_id: string
          payment_date?: string
          payment_number: string
          po_id?: string | null
          reference_no?: string | null
          tds_deducted?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          org_id?: string
          payment_date?: string
          payment_number?: string
          po_id?: string | null
          reference_no?: string | null
          tds_deducted?: number
        }
        Relationships: [
          {
            foreignKeyName: "acc_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "acc_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "mv_ar_aging"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "acc_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "acc_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acc_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisition_bundles: {
        Row: {
          acquisition_id: string
          allocation_strategy: string
          bundle_preset_id: string | null
          created_at: string
          effective_bundle_price: number
          gst_pct: number | null
          id: string
          name: string
          qty: number
        }
        Insert: {
          acquisition_id: string
          allocation_strategy?: string
          bundle_preset_id?: string | null
          created_at?: string
          effective_bundle_price?: number
          gst_pct?: number | null
          id?: string
          name: string
          qty?: number
        }
        Update: {
          acquisition_id?: string
          allocation_strategy?: string
          bundle_preset_id?: string | null
          created_at?: string
          effective_bundle_price?: number
          gst_pct?: number | null
          id?: string
          name?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_bundles_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisition_bundles_bundle_preset_id_fkey"
            columns: ["bundle_preset_id"]
            isOneToOne: false
            referencedRelation: "bundle_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisition_items: {
        Row: {
          acquisition_bundle_id: string | null
          acquisition_id: string
          catalog_item_id: string
          category: Database["public"]["Enums"]["bom_section"] | null
          created_at: string
          gst_pct: number | null
          id: string
          item_description: string
          qty: number
          rate_per_unit: number
          unit: string | null
        }
        Insert: {
          acquisition_bundle_id?: string | null
          acquisition_id: string
          catalog_item_id: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          created_at?: string
          gst_pct?: number | null
          id?: string
          item_description: string
          qty?: number
          rate_per_unit?: number
          unit?: string | null
        }
        Update: {
          acquisition_bundle_id?: string | null
          acquisition_id?: string
          catalog_item_id?: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          created_at?: string
          gst_pct?: number | null
          id?: string
          item_description?: string
          qty?: number
          rate_per_unit?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_items_acquisition_bundle_id_fkey"
            columns: ["acquisition_bundle_id"]
            isOneToOne: false
            referencedRelation: "acquisition_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisition_items_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisition_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      acquisitions: {
        Row: {
          created_at: string
          grn_processed: boolean
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          org_id: string
          status: Database["public"]["Enums"]["acquisition_status"]
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          grn_processed?: boolean
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["acquisition_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          grn_processed?: boolean
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["acquisition_status"]
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "acquisitions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "acquisitions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "acquisitions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_keys: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          batch_id: string | null
          created_at: string
          created_by: string
          device_id: string | null
          expires_at: string | null
          id: string
          key_encrypted: string
          key_hash: string
          key_prefix: string
          key_version: number
          org_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
          max_uses: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by: string
          device_id?: string | null
          expires_at?: string | null
          id?: string
          key_encrypted: string
          key_hash: string
          key_prefix: string
          key_version?: number
          org_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          max_uses?: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          batch_id?: string | null
          created_at?: string
          created_by?: string
          device_id?: string | null
          expires_at?: string | null
          id?: string
          key_encrypted?: string
          key_hash?: string
          key_prefix?: string
          key_version?: number
          org_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          max_uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "activation_keys_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          default_grid_tariff_inr: number
          default_validity_days: number
          electricity_inflation_pct: number
          id: string
          org_id: string
          orientation_factor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          default_grid_tariff_inr?: number
          default_validity_days?: number
          electricity_inflation_pct?: number
          id?: string
          org_id: string
          orientation_factor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          default_grid_tariff_inr?: number
          default_validity_days?: number
          electricity_inflation_pct?: number
          id?: string
          org_id?: string
          orientation_factor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_categories: {
        Row: {
          display_order: number
          id: string
          is_optional: boolean
          name: string
          org_id: string | null
        }
        Insert: {
          display_order: number
          id?: string
          is_optional?: boolean
          name: string
          org_id?: string | null
        }
        Update: {
          display_order?: number
          id?: string
          is_optional?: boolean
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_template_items: {
        Row: {
          category_id: string
          civil_required_only: boolean
          default_rate: number | null
          description: string
          id: string
          is_survey_dependent: boolean
          notes: string | null
          org_id: string | null
          qty_formula: string | null
          specification_details: string | null
          sku_code: string
          unit: string
          unit_rate_max: number | null
          unit_rate_min: number | null
        }
        Insert: {
          category_id: string
          civil_required_only?: boolean
          default_rate?: number | null
          description: string
          id?: string
          is_survey_dependent?: boolean
          notes?: string | null
          org_id?: string | null
          qty_formula?: string | null
          specification_details?: string | null
          sku_code: string
          unit: string
          unit_rate_max?: number | null
          unit_rate_min?: number | null
        }
        Update: {
          category_id?: string
          civil_required_only?: boolean
          default_rate?: number | null
          description?: string
          id?: string
          is_survey_dependent?: boolean
          notes?: string | null
          org_id?: string | null
          qty_formula?: string | null
          specification_details?: string | null
          sku_code?: string
          unit?: string
          unit_rate_max?: number | null
          unit_rate_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_template_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "bom_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_template_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_preset_items: {
        Row: {
          allocated_cost_override: number | null
          base_cost: number
          bundle_preset_id: string
          catalog_item_id: string
          category: Database["public"]["Enums"]["bom_section"]
          created_at: string
          gst_pct: number | null
          id: string
          item_description: string
          qty: number
          unit: string
        }
        Insert: {
          allocated_cost_override?: number | null
          base_cost?: number
          bundle_preset_id: string
          catalog_item_id: string
          category: Database["public"]["Enums"]["bom_section"]
          created_at?: string
          gst_pct?: number | null
          id?: string
          item_description: string
          qty?: number
          unit?: string
        }
        Update: {
          allocated_cost_override?: number | null
          base_cost?: number
          bundle_preset_id?: string
          catalog_item_id?: string
          category?: Database["public"]["Enums"]["bom_section"]
          created_at?: string
          gst_pct?: number | null
          id?: string
          item_description?: string
          qty?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_preset_items_bundle_preset_id_fkey"
            columns: ["bundle_preset_id"]
            isOneToOne: false
            referencedRelation: "bundle_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_preset_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_presets: {
        Row: {
          allocation_strategy: string
          created_at: string
          created_by: string | null
          effective_bundle_price: number
          gst_pct: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          updated_at: string
          vendor_id: string | null
          version: number
        }
        Insert: {
          allocation_strategy?: string
          created_at?: string
          created_by?: string | null
          effective_bundle_price?: number
          gst_pct?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          updated_at?: string
          vendor_id?: string | null
          version?: number
        }
        Update: {
          allocation_strategy?: string
          created_at?: string
          created_by?: string | null
          effective_bundle_price?: number
          gst_pct?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
          vendor_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_presets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "bundle_presets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "bundle_presets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "bundle_presets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_schemes: {
        Row: {
          applies_to: Database["public"]["Enums"]["project_type"]
          code: string
          created_at: string
          description: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          max_absolute_subsidy: number
          max_capacity_kw: number
          name: string
          snapshot_locked: boolean
          updated_at: string
          version: number
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["project_type"]
          code: string
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          max_absolute_subsidy?: number
          max_capacity_kw?: number
          name: string
          snapshot_locked?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["project_type"]
          code?: string
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          max_absolute_subsidy?: number
          max_capacity_kw?: number
          name?: string
          snapshot_locked?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          category: Database["public"]["Enums"]["bom_section"]
          created_at: string
          gst_pct: number
          id: string
          item_id: string | null
          item_type: string
          name: string
          org_id: string | null
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["bom_section"]
          created_at?: string
          gst_pct?: number
          id?: string
          item_id?: string | null
          item_type: string
          name: string
          org_id?: string | null
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["bom_section"]
          created_at?: string
          gst_pct?: number
          id?: string
          item_id?: string | null
          item_type?: string
          name?: string
          org_id?: string | null
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      category_margins: {
        Row: {
          category: Database["public"]["Enums"]["system_category"]
          created_at: string
          default_margin_pct: number
          id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["system_category"]
          created_at?: string
          default_margin_pct?: number
          id?: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["system_category"]
          created_at?: string
          default_margin_pct?: number
          id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_margins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_margins_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          lead_source: string
          monthly_bill: number | null
          org_id: string
          phone: string
          roof_area_estimate: number | null
          status: Database["public"]["Enums"]["crm_lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          lead_source?: string
          monthly_bill?: number | null
          org_id: string
          phone: string
          roof_area_estimate?: number | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          lead_source?: string
          monthly_bill?: number | null
          org_id?: string
          phone?: string
          roof_area_estimate?: number | null
          status?: Database["public"]["Enums"]["crm_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          close_date: string | null
          created_at: string
          expected_value: number
          id: string
          lead_id: string
          org_id: string
          probability_pct: number
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          close_date?: string | null
          created_at?: string
          expected_value?: number
          id?: string
          lead_id: string
          org_id: string
          probability_pct?: number
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          close_date?: string | null
          created_at?: string
          expected_value?: number
          id?: string
          lead_id?: string
          org_id?: string
          probability_pct?: number
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_site_surveys: {
        Row: {
          conducted_at: string | null
          conducted_by: string | null
          consumer_number: string | null
          created_at: string | null
          discom_name: string | null
          distance_inverter_to_meter_m: number | null
          distance_panel_to_inverter_m: number | null
          existing_load_kw: number | null
          id: string
          lead_id: string
          meter_phase: string | null
          net_metering_available: boolean | null
          org_id: string
          photo_urls: Json | null
          quote_id: string | null
          roof_area_sqft: number | null
          roof_height_ft: number | null
          roof_type: string | null
          sanctioned_load_kw: number | null
          shadowing_notes: string | null
          status: string
          survey_notes: string | null
          updated_at: string | null
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          conducted_at?: string | null
          conducted_by?: string | null
          consumer_number?: string | null
          created_at?: string | null
          discom_name?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          existing_load_kw?: number | null
          id?: string
          lead_id: string
          meter_phase?: string | null
          net_metering_available?: boolean | null
          org_id: string
          photo_urls?: Json | null
          quote_id?: string | null
          roof_area_sqft?: number | null
          roof_height_ft?: number | null
          roof_type?: string | null
          sanctioned_load_kw?: number | null
          shadowing_notes?: string | null
          status?: string
          survey_notes?: string | null
          updated_at?: string | null
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          conducted_at?: string | null
          conducted_by?: string | null
          consumer_number?: string | null
          created_at?: string | null
          discom_name?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          existing_load_kw?: number | null
          id?: string
          lead_id?: string
          meter_phase?: string | null
          net_metering_available?: boolean | null
          org_id?: string
          photo_urls?: Json | null
          quote_id?: string | null
          roof_area_sqft?: number | null
          roof_height_ft?: number | null
          roof_type?: string | null
          sanctioned_load_kw?: number | null
          shadowing_notes?: string | null
          status?: string
          survey_notes?: string | null
          updated_at?: string | null
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_site_surveys_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_site_surveys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_site_surveys_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_site_surveys_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_site_surveys_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_timeline: {
        Row: {
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["crm_timeline_event"]
          id: string
          lead_id: string
          logged_by: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["crm_timeline_event"]
          id?: string
          lead_id: string
          logged_by?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["crm_timeline_event"]
          id?: string
          lead_id?: string
          logged_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_timeline_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_presets: {
        Row: {
          capacity_kw: number
          config_json: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          capacity_kw: number
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          capacity_kw?: number
          config_json?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_reset_requests: {
        Row: {
          id: string
          old_device_id: string | null
          org_id: string
          requested_at: string
          requested_device_info: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          old_device_id?: string | null
          org_id: string
          requested_at?: string
          requested_device_info?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          old_device_id?: string | null
          org_id?: string
          requested_at?: string
          requested_device_info?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_reset_requests_old_device_id_fkey"
            columns: ["old_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_reset_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_quotes: {
        Row: {
          id: string
          org_id: string
          state_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          state_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          state_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      engineering_rules_metadata_deprecated: {
        Row: {
          category: string
          created_at: string
          formula: string
          id: string
          inputs: string[]
          metadata_json: Json
          output_var: string | null
          rule_name: string
          source_row: number | null
          source_sheet: string | null
          source_workbook: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          formula: string
          id?: string
          inputs: string[]
          metadata_json?: Json
          output_var?: string | null
          rule_name: string
          source_row?: number | null
          source_sheet?: string | null
          source_workbook?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          formula?: string
          id?: string
          inputs?: string[]
          metadata_json?: Json
          output_var?: string | null
          rule_name?: string
          source_row?: number | null
          source_sheet?: string | null
          source_workbook?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epc_commissioning_reports: {
        Row: {
          capacity_tested_kw: number | null
          commissioned_by: string
          created_at: string
          customer_signoff: boolean
          id: string
          is_approved: boolean
          net_meter_number: string | null
          org_id: string
          project_id: string
          remarks: string | null
          signoff_date: string | null
          updated_at: string
        }
        Insert: {
          capacity_tested_kw?: number | null
          commissioned_by: string
          created_at?: string
          customer_signoff?: boolean
          id?: string
          is_approved?: boolean
          net_meter_number?: string | null
          org_id: string
          project_id: string
          remarks?: string | null
          signoff_date?: string | null
          updated_at?: string
        }
        Update: {
          capacity_tested_kw?: number | null
          commissioned_by?: string
          created_at?: string
          customer_signoff?: boolean
          id?: string
          is_approved?: boolean
          net_meter_number?: string | null
          org_id?: string
          project_id?: string
          remarks?: string | null
          signoff_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epc_commissioning_reports_commissioned_by_fkey"
            columns: ["commissioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_commissioning_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_commissioning_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_commissioning_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "epc_commissioning_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "epc_commissioning_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      epc_projects: {
        Row: {
          actual_cost: number | null
          actual_end: string | null
          actual_start: string | null
          assigned_pm_id: string | null
          budgeted_cost: number | null
          created_at: string
          id: string
          org_id: string
          planned_end: string | null
          planned_start: string | null
          project_notes: string | null
          project_number: string
          quote_id: string | null
          recognized_revenue: number | null
          status: Database["public"]["Enums"]["epc_project_status"]
          updated_at: string
          version: number
          wip_balance: number | null
        }
        Insert: {
          actual_cost?: number | null
          actual_end?: string | null
          actual_start?: string | null
          assigned_pm_id?: string | null
          budgeted_cost?: number | null
          created_at?: string
          id?: string
          org_id: string
          planned_end?: string | null
          planned_start?: string | null
          project_notes?: string | null
          project_number: string
          quote_id?: string | null
          recognized_revenue?: number | null
          status?: Database["public"]["Enums"]["epc_project_status"]
          updated_at?: string
          version?: number
          wip_balance?: number | null
        }
        Update: {
          actual_cost?: number | null
          actual_end?: string | null
          actual_start?: string | null
          assigned_pm_id?: string | null
          budgeted_cost?: number | null
          created_at?: string
          id?: string
          org_id?: string
          planned_end?: string | null
          planned_start?: string | null
          project_notes?: string | null
          project_number?: string
          quote_id?: string | null
          recognized_revenue?: number | null
          status?: Database["public"]["Enums"]["epc_project_status"]
          updated_at?: string
          version?: number
          wip_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epc_projects_assigned_pm_id_fkey"
            columns: ["assigned_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      epc_work_orders: {
        Row: {
          assigned_crew_id: string | null
          created_at: string
          id: string
          instructions: string | null
          project_id: string
          scheduled_end: string | null
          scheduled_start: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          wo_number: string
        }
        Insert: {
          assigned_crew_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          project_id: string
          scheduled_end?: string | null
          scheduled_start: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          wo_number: string
        }
        Update: {
          assigned_crew_id?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          project_id?: string
          scheduled_end?: string | null
          scheduled_start?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "epc_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epc_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "epc_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "epc_work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      eq_batteries: {
        Row: {
          brand: string
          buy_price: number
          capacity_kwh: number
          chemistry: Database["public"]["Enums"]["battery_chemistry"]
          created_at: string
          description: string | null
          dod_pct: number
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          is_custom: boolean
          model: string
          org_id: string | null
          rate: number | null
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
          voltage_v: number | null
        }
        Insert: {
          brand: string
          buy_price?: number
          capacity_kwh: number
          chemistry?: Database["public"]["Enums"]["battery_chemistry"]
          created_at?: string
          description?: string | null
          dod_pct?: number
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          model: string
          org_id?: string | null
          rate?: number | null
          row_number?: number | null
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          voltage_v?: number | null
        }
        Update: {
          brand?: string
          buy_price?: number
          capacity_kwh?: number
          chemistry?: Database["public"]["Enums"]["battery_chemistry"]
          created_at?: string
          description?: string | null
          dod_pct?: number
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          model?: string
          org_id?: string | null
          rate?: number | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          voltage_v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eq_batteries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_batteries_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_batteries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_bom_items_deprecated: {
        Row: {
          buy_price: number
          created_at: string
          description: string
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          org_id: string | null
          remarks: string | null
          row_number: number | null
          section: Database["public"]["Enums"]["bom_section"]
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          sub_type: string
          unit: string
          updated_at: string
          version: number
        }
        Insert: {
          buy_price?: number
          created_at?: string
          description: string
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          org_id?: string | null
          remarks?: string | null
          row_number?: number | null
          section: Database["public"]["Enums"]["bom_section"]
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          sub_type: string
          unit?: string
          updated_at?: string
          version?: number
        }
        Update: {
          buy_price?: number
          created_at?: string
          description?: string
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          org_id?: string | null
          remarks?: string | null
          row_number?: number | null
          section?: Database["public"]["Enums"]["bom_section"]
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          sub_type?: string
          unit?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_bom_items_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_bom_items_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_bom_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_communication_devices: {
        Row: {
          brand: string
          buy_price: number
          compatible_inverter_brand: string | null
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          model: string
          org_id: string | null
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand: string
          buy_price?: number
          compatible_inverter_brand?: string | null
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          model: string
          org_id?: string | null
          row_number?: number | null
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand?: string
          buy_price?: number
          compatible_inverter_brand?: string | null
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          model?: string
          org_id?: string | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_communication_devices_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_communication_devices_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_communication_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_inverters: {
        Row: {
          brand: string
          buy_price: number
          capacity_kw: number
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          inverter_type: Database["public"]["Enums"]["inverter_type"]
          is_active: boolean
          is_custom: boolean
          model: string
          org_id: string | null
          phases: number
          rate: number | null
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand: string
          buy_price?: number
          capacity_kw: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          inverter_type: Database["public"]["Enums"]["inverter_type"]
          is_active?: boolean
          is_custom?: boolean
          model: string
          org_id?: string | null
          phases?: number
          rate?: number | null
          row_number?: number | null
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand?: string
          buy_price?: number
          capacity_kw?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          inverter_type?: Database["public"]["Enums"]["inverter_type"]
          is_active?: boolean
          is_custom?: boolean
          model?: string
          org_id?: string | null
          phases?: number
          rate?: number | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_inverters_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_inverters_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_inverters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_lightning_arresters: {
        Row: {
          brand: string | null
          buy_price: number
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          la_type: Database["public"]["Enums"]["la_type"]
          max_capacity_kw: number | null
          model: string
          org_id: string | null
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand?: string | null
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          la_type: Database["public"]["Enums"]["la_type"]
          max_capacity_kw?: number | null
          model: string
          org_id?: string | null
          row_number?: number | null
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand?: string | null
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          la_type?: Database["public"]["Enums"]["la_type"]
          max_capacity_kw?: number | null
          model?: string
          org_id?: string | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_lightning_arresters_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_lightning_arresters_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_lightning_arresters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_meters: {
        Row: {
          brand: string | null
          buy_price: number
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          is_smart: boolean
          meter_type: Database["public"]["Enums"]["meter_type"]
          model: string
          org_id: string | null
          phases: number
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand?: string | null
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_smart?: boolean
          meter_type: Database["public"]["Enums"]["meter_type"]
          model: string
          org_id?: string | null
          phases?: number
          row_number?: number | null
          selling_price: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand?: string | null
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_smart?: boolean
          meter_type?: Database["public"]["Enums"]["meter_type"]
          model?: string
          org_id?: string | null
          phases?: number
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_meters_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_meters_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_meters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_mounting_structures: {
        Row: {
          base_weight_kg: number
          buy_price: number
          created_at: string
          description: string | null
          elevation_height_mm: number
          fabrication_rate: number
          fastener_weight_pct: number
          galvanizing_rate: number
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          is_custom: boolean
          material: Database["public"]["Enums"]["structure_material"]
          name: string
          org_id: string | null
          per_watt_rate: number | null
          rate_per_kg: number | null
          raw_material_rate: number
          roof_mount_type: Database["public"]["Enums"]["roof_mount_type"]
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
          wastage_pct: number
        }
        Insert: {
          base_weight_kg?: number
          buy_price?: number
          created_at?: string
          description?: string | null
          elevation_height_mm?: number
          fabrication_rate?: number
          fastener_weight_pct?: number
          galvanizing_rate?: number
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          material?: Database["public"]["Enums"]["structure_material"]
          name: string
          org_id?: string | null
          per_watt_rate?: number | null
          rate_per_kg?: number | null
          raw_material_rate?: number
          roof_mount_type?: Database["public"]["Enums"]["roof_mount_type"]
          row_number?: number | null
          selling_price?: number | null
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          wastage_pct?: number
        }
        Update: {
          base_weight_kg?: number
          buy_price?: number
          created_at?: string
          description?: string | null
          elevation_height_mm?: number
          fabrication_rate?: number
          fastener_weight_pct?: number
          galvanizing_rate?: number
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          material?: Database["public"]["Enums"]["structure_material"]
          name?: string
          org_id?: string | null
          per_watt_rate?: number | null
          rate_per_kg?: number | null
          raw_material_rate?: number
          roof_mount_type?: Database["public"]["Enums"]["roof_mount_type"]
          row_number?: number | null
          selling_price?: number | null
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          wastage_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_mounting_structures_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_mounting_structures_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_mounting_structures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_orientation_multipliers: {
        Row: {
          created_at: string | null
          id: string
          multiplier: number
          org_id: string | null
          orientation: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          multiplier: number
          org_id?: string | null
          orientation: string
        }
        Update: {
          created_at?: string | null
          id?: string
          multiplier?: number
          org_id?: string | null
          orientation?: string
        }
        Relationships: [
          {
            foreignKeyName: "eq_orientation_multipliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_panels: {
        Row: {
          brand: string
          buy_price: number
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          is_custom: boolean
          model: string
          org_id: string | null
          panel_type: string
          rate_per_watt: number | null
          row_number: number | null
          selling_price: number
          sheet_name: string | null
          source_file: string | null
          specification_details: string | null
          updated_at: string
          version: number
          wattage_w: number
        }
        Insert: {
          brand: string
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          model: string
          org_id?: string | null
          panel_type?: string
          rate_per_watt?: number | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          wattage_w: number
        }
        Update: {
          brand?: string
          buy_price?: number
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          model?: string
          org_id?: string | null
          panel_type?: string
          rate_per_watt?: number | null
          row_number?: number | null
          selling_price?: number
          sheet_name?: string | null
          source_file?: string | null
          specification_details?: string | null
          updated_at?: string
          version?: number
          wattage_w?: number
        }
        Relationships: [
          {
            foreignKeyName: "eq_panels_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_panels_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_panels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_structure_addons: {
        Row: {
          buy_price: number
          created_at: string
          gst_pct: number
          id: string
          is_active: boolean
          material: string
          name: string
          notes: string | null
          org_id: string | null
          rate_per_unit: number
          unit: string
        }
        Insert: {
          buy_price?: number
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          material?: string
          name: string
          notes?: string | null
          org_id?: string | null
          rate_per_unit: number
          unit?: string
        }
        Update: {
          buy_price?: number
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          material?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          rate_per_unit?: number
          unit?: string
        }
        Relationships: []
      }
      eq_structure_bom: {
        Row: {
          capacity_kw_max: number
          capacity_kw_min: number
          component_id: string
          id: string
          notes: string | null
          panel_qty: number | null
          qty: number
          structure_id: string
          total_weight_kg: number | null
        }
        Insert: {
          capacity_kw_max: number
          capacity_kw_min: number
          component_id: string
          id?: string
          notes?: string | null
          panel_qty?: number | null
          qty?: number
          structure_id: string
          total_weight_kg?: number | null
        }
        Update: {
          capacity_kw_max?: number
          capacity_kw_min?: number
          component_id?: string
          id?: string
          notes?: string | null
          panel_qty?: number | null
          qty?: number
          structure_id?: string
          total_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eq_structure_bom_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "eq_structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_structure_bom_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eq_structure_bom_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      eq_structure_components: {
        Row: {
          buy_price: number
          category: string
          created_at: string
          description: string | null
          gst_pct: number
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          selling_price: number
          structure_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          buy_price?: number
          category: string
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          selling_price?: number
          structure_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          buy_price?: number
          category?: string
          created_at?: string
          description?: string | null
          gst_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          selling_price?: number
          structure_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eq_structure_components_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      field_amc_contracts: {
        Row: {
          amc_price: number
          asset_id: string | null
          completed_visits: number
          contract_number: string
          created_at: string
          customer_name: string
          customer_phone: string
          end_date: string
          id: string
          org_id: string
          start_date: string
          status: Database["public"]["Enums"]["amc_status"]
          updated_at: string
          visits_per_year: number
        }
        Insert: {
          amc_price?: number
          asset_id?: string | null
          completed_visits?: number
          contract_number: string
          created_at?: string
          customer_name: string
          customer_phone: string
          end_date: string
          id?: string
          org_id: string
          start_date: string
          status?: Database["public"]["Enums"]["amc_status"]
          updated_at?: string
          visits_per_year?: number
        }
        Update: {
          amc_price?: number
          asset_id?: string | null
          completed_visits?: number
          contract_number?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          end_date?: string
          id?: string
          org_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["amc_status"]
          updated_at?: string
          visits_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "field_amc_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "field_customer_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_amc_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_amc_visits: {
        Row: {
          conducted_by: string | null
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          photos: string[] | null
          status: string
          updated_at: string
          visit_date: string
          visit_type: string
        }
        Insert: {
          conducted_by?: string | null
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          photos?: string[] | null
          status?: string
          updated_at?: string
          visit_date: string
          visit_type?: string
        }
        Update: {
          conducted_by?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          photos?: string[] | null
          status?: string
          updated_at?: string
          visit_date?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_amc_visits_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_amc_visits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "field_amc_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_amc_visits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_checklist_items: {
        Row: {
          completed_at: string | null
          id: string
          is_checked: boolean
          measured_value: string | null
          photo_s3_key: string | null
          task_label: string
          ticket_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_checked?: boolean
          measured_value?: string | null
          photo_s3_key?: string | null
          task_label: string
          ticket_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_checked?: boolean
          measured_value?: string | null
          photo_s3_key?: string | null
          task_label?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_checklist_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "field_service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      field_customer_assets: {
        Row: {
          brand: string
          created_at: string
          id: string
          installation_date: string
          item_type: string
          model: string
          org_id: string
          project_id: string | null
          serial_number: string
          warranty_certificate: string | null
          warranty_expiry_date: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          installation_date?: string
          item_type: string
          model: string
          org_id: string
          project_id?: string | null
          serial_number: string
          warranty_certificate?: string | null
          warranty_expiry_date: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          installation_date?: string
          item_type?: string
          model?: string
          org_id?: string
          project_id?: string | null
          serial_number?: string
          warranty_certificate?: string | null
          warranty_expiry_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_customer_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_customer_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_customer_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_customer_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_customer_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      field_service_tickets: {
        Row: {
          action_taken: string | null
          amc_contract_id: string | null
          arrival_lat: number | null
          arrival_lng: number | null
          assigned_crew_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          issue_details: string
          project_id: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["service_ticket_status"]
          ticket_number: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          amc_contract_id?: string | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          assigned_crew_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          issue_details: string
          project_id?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["service_ticket_status"]
          ticket_number: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          amc_contract_id?: string | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          assigned_crew_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          issue_details?: string
          project_id?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["service_ticket_status"]
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_service_tickets_amc_contract_id_fkey"
            columns: ["amc_contract_id"]
            isOneToOne: false
            referencedRelation: "field_amc_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_service_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "field_service_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      gst_master_deprecated: {
        Row: {
          created_at: string
          effective_gst_rate_on_total: number | null
          gst_amount: number | null
          gst_formula: string | null
          gst_formula_inputs: string[] | null
          gst_pct: number
          gst_rate: number | null
          id: string
          pricing_formula: string | null
          source_gst_cell: string | null
          source_row: number | null
          source_sheet: string | null
          source_total_cell: string | null
          source_workbook: string | null
          total_price: number | null
          total_price_formula: string | null
          total_price_formula_inputs: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_gst_rate_on_total?: number | null
          gst_amount?: number | null
          gst_formula?: string | null
          gst_formula_inputs?: string[] | null
          gst_pct: number
          gst_rate?: number | null
          id?: string
          pricing_formula?: string | null
          source_gst_cell?: string | null
          source_row?: number | null
          source_sheet?: string | null
          source_total_cell?: string | null
          source_workbook?: string | null
          total_price?: number | null
          total_price_formula?: string | null
          total_price_formula_inputs?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_gst_rate_on_total?: number | null
          gst_amount?: number | null
          gst_formula?: string | null
          gst_formula_inputs?: string[] | null
          gst_pct?: number
          gst_rate?: number | null
          id?: string
          pricing_formula?: string | null
          source_gst_cell?: string | null
          source_row?: number | null
          source_sheet?: string | null
          source_total_cell?: string | null
          source_workbook?: string | null
          total_price?: number | null
          total_price_formula?: string | null
          total_price_formula_inputs?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      inv_serialized_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          item_id: string | null
          item_type: string | null
          org_id: string
          project_id: string | null
          serial_number: string
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          org_id: string
          project_id?: string | null
          serial_number: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          org_id?: string
          project_id?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_serialized_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_serialized_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_serialized_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_serialized_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_serialized_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_serialized_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_serialized_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_balances: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          item_id: string | null
          item_type: string | null
          qty_damaged: number
          qty_on_hand: number
          qty_reserved: number
          updated_at: string
          wac_price: number
          warehouse_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty_damaged?: number
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
          wac_price?: number
          warehouse_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty_damaged?: number
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
          wac_price?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_balances_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_stock_transactions: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          item_id: string | null
          item_type: string | null
          org_id: string
          project_id: string | null
          qty: number
          reference_id: string | null
          transaction_type: string
          unit_cost_wac: number
          warehouse_id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: string | null
          org_id: string
          project_id?: string | null
          qty: number
          reference_id?: string | null
          transaction_type: string
          unit_cost_wac: number
          warehouse_id: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: string | null
          org_id?: string
          project_id?: string | null
          qty?: number
          reference_id?: string | null
          transaction_type?: string
          unit_cost_wac?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_transactions_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inv_stock_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_transfer_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          item_id: string | null
          item_type: string | null
          qty: number
          serials: string[] | null
          transfer_id: string
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty: number
          serials?: string[] | null
          transfer_id: string
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty?: number
          serials?: string[] | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_transfer_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inv_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_transfers: {
        Row: {
          created_at: string
          from_warehouse_id: string
          id: string
          org_id: string
          received_at: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_warehouse_id: string
          id?: string
          org_id: string
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_warehouse_id?: string
          id?: string
          org_id?: string
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ledger: {
        Row: {
          acquisition_item_id: string | null
          catalog_item_id: string
          category: Database["public"]["Enums"]["bom_section"] | null
          change_qty: number
          created_at: string
          id: string
          item_description: string
          org_id: string
          processed_at: string | null
          rate_at_time: number | null
          reference_id: string | null
          transaction_type: string
        }
        Insert: {
          acquisition_item_id?: string | null
          catalog_item_id: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          change_qty: number
          created_at?: string
          id?: string
          item_description: string
          org_id: string
          processed_at?: string | null
          rate_at_time?: number | null
          reference_id?: string | null
          transaction_type: string
        }
        Update: {
          acquisition_item_id?: string | null
          catalog_item_id?: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          change_qty?: number
          created_at?: string
          id?: string
          item_description?: string
          org_id?: string
          processed_at?: string | null
          rate_at_time?: number | null
          reference_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ledger_acquisition_item_id_fkey"
            columns: ["acquisition_item_id"]
            isOneToOne: false
            referencedRelation: "acquisition_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          driver_contact: string | null
          from_state: string | null
          id: string
          item_id: string
          moved_at: string
          moved_by: string | null
          notes: string | null
          org_id: string | null
          project_id: string
          quantity: number
          site_received_at: string | null
          site_received_by: string | null
          to_state: string
          vehicle_number: string | null
        }
        Insert: {
          created_at?: string
          driver_contact?: string | null
          from_state?: string | null
          id?: string
          item_id: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          org_id?: string | null
          project_id: string
          quantity: number
          site_received_at?: string | null
          site_received_by?: string | null
          to_state: string
          vehicle_number?: string | null
        }
        Update: {
          created_at?: string
          driver_contact?: string | null
          from_state?: string | null
          id?: string
          item_id?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          org_id?: string | null
          project_id?: string
          quantity?: number
          site_received_at?: string | null
          site_received_by?: string | null
          to_state?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      inventory_summary: {
        Row: {
          catalog_item_id: string
          category: Database["public"]["Enums"]["bom_section"] | null
          current_qty: number
          item_description: string
          last_updated: string
          org_id: string
          reorder_level: number
          weighted_avg_cost: number
        }
        Insert: {
          catalog_item_id: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          current_qty?: number
          item_description: string
          last_updated?: string
          org_id: string
          reorder_level?: number
          weighted_avg_cost?: number
        }
        Update: {
          catalog_item_id?: string
          category?: Database["public"]["Enums"]["bom_section"] | null
          current_qty?: number
          item_description?: string
          last_updated?: string
          org_id?: string
          reorder_level?: number
          weighted_avg_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_summary_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_summary_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_templates: {
        Row: {
          cost: number
          cost_per_meter: number
          created_at: string
          id: string
          length_m: number
          template: string
        }
        Insert: {
          cost: number
          cost_per_meter: number
          created_at?: string
          id?: string
          length_m: number
          template: string
        }
        Update: {
          cost?: number
          cost_per_meter?: number
          created_at?: string
          id?: string
          length_m?: number
          template?: string
        }
        Relationships: []
      }
      license_events: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_data: Json
          event_type: string
          id: string
          ip_address: unknown
          org_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_data?: Json
          event_type: string
          id?: string
          ip_address?: unknown
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_data?: Json
          event_type?: string
          id?: string
          ip_address?: unknown
          org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_data_changes_log: {
        Row: {
          change_type: string
          entity_id: string
          entity_type: string
          id: string
          import_batch_id: string | null
          logged_at: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          change_type: string
          entity_id: string
          entity_type: string
          id?: string
          import_batch_id?: string | null
          logged_at?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          change_type?: string
          entity_id?: string
          entity_type?: string
          id?: string
          import_batch_id?: string | null
          logged_at?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "master_data_changes_log_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      master_data_imports: {
        Row: {
          id: string
          imported_at: string
          imported_by: string | null
          source_file: string
          status: string
          summary: Json | null
        }
        Insert: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          source_file: string
          status: string
          summary?: Json | null
        }
        Update: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          source_file?: string
          status?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "master_data_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      net_metering_applications: {
        Row: {
          application_date: string | null
          commissioning_cert_url: string | null
          consumer_number: string
          created_at: string
          current_stage: string
          discom_name: string
          document_urls: Json
          estimated_completion_date: string | null
          id: string
          inspection_date: string | null
          last_updated_by: string | null
          net_meter_serial: string | null
          notes: string | null
          project_id: string
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          application_date?: string | null
          commissioning_cert_url?: string | null
          consumer_number: string
          created_at?: string
          current_stage?: string
          discom_name: string
          document_urls?: Json
          estimated_completion_date?: string | null
          id?: string
          inspection_date?: string | null
          last_updated_by?: string | null
          net_meter_serial?: string | null
          notes?: string | null
          project_id: string
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          application_date?: string | null
          commissioning_cert_url?: string | null
          consumer_number?: string
          created_at?: string
          current_stage?: string
          discom_name?: string
          document_urls?: Json
          estimated_completion_date?: string | null
          id?: string
          inspection_date?: string | null
          last_updated_by?: string | null
          net_meter_serial?: string | null
          notes?: string | null
          project_id?: string
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "net_metering_applications_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "net_metering_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "net_metering_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "net_metering_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "net_metering_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan_id: string
          seat_limit: number
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan_id: string
          seat_limit?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          seat_limit?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          grn_counter: number
          gstin: string | null
          id: string
          invoice_counter: number
          logo_url: string | null
          name: string
          phone: string | null
          pincode: string | null
          po_counter: number
          project_counter: number
          quote_counter: number
          quote_prefix: string
          state: string | null
          transfer_counter: number
          updated_at: string
          version: number
          website: string | null
          work_order_counter: number
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          grn_counter?: number
          gstin?: string | null
          id?: string
          invoice_counter?: number
          logo_url?: string | null
          name: string
          phone?: string | null
          pincode?: string | null
          po_counter?: number
          project_counter?: number
          quote_counter?: number
          quote_prefix?: string
          state?: string | null
          transfer_counter?: number
          updated_at?: string
          version?: number
          website?: string | null
          work_order_counter?: number
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          grn_counter?: number
          gstin?: string | null
          id?: string
          invoice_counter?: number
          logo_url?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          po_counter?: number
          project_counter?: number
          quote_counter?: number
          quote_prefix?: string
          state?: string | null
          transfer_counter?: number
          updated_at?: string
          version?: number
          website?: string | null
          work_order_counter?: number
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          link_sent_at: string | null
          org_id: string
          rejected_at: string | null
          rejected_by: string | null
          requested_at: string
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          link_sent_at?: string | null
          org_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          link_sent_at?: string | null
          org_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          requested_at?: string
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          milestone_name: string
          paid_at: string | null
          payment_reference: string | null
          percent: number
          quote_id: string
          trigger_event: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          milestone_name: string
          paid_at?: string | null
          payment_reference?: string | null
          percent: number
          quote_id: string
          trigger_event: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          milestone_name?: string
          paid_at?: string | null
          payment_reference?: string | null
          percent?: number
          quote_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_favorites: {
        Row: {
          created_at: string | null
          preset_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          preset_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          preset_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_favorites_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "system_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_line_items: {
        Row: {
          brand: string | null
          catalog_item_id: string | null
          catalog_type: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          is_included: boolean
          is_survey_dependent: boolean
          model: string | null
          org_id: string | null
          preset_id: string
          quantity: number
          sku_code: string | null
          sort_order: number
          unit: string
          unit_rate: number
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          catalog_item_id?: string | null
          catalog_type?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          is_included?: boolean
          is_survey_dependent?: boolean
          model?: string | null
          org_id?: string | null
          preset_id: string
          quantity?: number
          sku_code?: string | null
          sort_order?: number
          unit?: string
          unit_rate?: number
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          catalog_item_id?: string | null
          catalog_type?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          is_included?: boolean
          is_survey_dependent?: boolean
          model?: string | null
          org_id?: string | null
          preset_id?: string
          quantity?: number
          sku_code?: string | null
          sort_order?: number
          unit?: string
          unit_rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preset_line_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_line_items_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "system_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_tag_mappings: {
        Row: {
          preset_id: string
          tag_id: string
        }
        Insert: {
          preset_id: string
          tag_id: string
        }
        Update: {
          preset_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_tag_mappings_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "system_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_tag_mappings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "preset_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      preset_usage_history: {
        Row: {
          id: string
          preset_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          preset_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          preset_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preset_usage_history_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "system_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_reference_deprecated: {
        Row: {
          beneficiary_contribution: number
          capacity_kw: number
          id: string
          import_batch_id: string | null
          imported_at: string
          imported_by: string | null
          inverter_kw: number | null
          panels: number
          row_number: number | null
          sheet_name: string | null
          source_file: string | null
          subsidy: number | null
          system_price: number
          type: string
        }
        Insert: {
          beneficiary_contribution: number
          capacity_kw: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          imported_by?: string | null
          inverter_kw?: number | null
          panels: number
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          subsidy?: number | null
          system_price: number
          type: string
        }
        Update: {
          beneficiary_contribution?: number
          capacity_kw?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          imported_by?: string | null
          inverter_kw?: number | null
          panels?: number
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          subsidy?: number | null
          system_price?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_reference_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_reference_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_goods_receipt_notes: {
        Row: {
          created_at: string
          created_by: string | null
          grn_number: string
          id: string
          idempotency_key: string | null
          is_processed: boolean
          org_id: string
          po_id: string
          processed_at: string | null
          receipt_date: string
          status: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grn_number: string
          id?: string
          idempotency_key?: string | null
          is_processed?: boolean
          org_id: string
          po_id: string
          processed_at?: string | null
          receipt_date?: string
          status?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grn_number?: string
          id?: string
          idempotency_key?: string | null
          is_processed?: boolean
          org_id?: string
          po_id?: string
          processed_at?: string | null
          receipt_date?: string
          status?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_goods_receipt_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_goods_receipt_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_goods_receipt_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_grn_items: {
        Row: {
          catalog_item_id: string
          grn_id: string
          id: string
          item_description: string | null
          item_id: string | null
          item_type: string | null
          qty_received: number
          serials: string[] | null
          unit: string
        }
        Insert: {
          catalog_item_id: string
          grn_id: string
          id?: string
          item_description?: string | null
          item_id?: string | null
          item_type?: string | null
          qty_received: number
          serials?: string[] | null
          unit?: string
        }
        Update: {
          catalog_item_id?: string
          grn_id?: string
          id?: string
          item_description?: string | null
          item_id?: string | null
          item_type?: string | null
          qty_received?: number
          serials?: string[] | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_grn_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "proc_goods_receipt_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_po_items: {
        Row: {
          catalog_item_id: string
          category: string | null
          estimated_rate: number | null
          gst_pct: number
          id: string
          is_pr_item: boolean
          item_description: string | null
          item_id: string | null
          item_type: string | null
          po_id: string
          qty_ordered: number
          qty_received: number
          unit: string
          unit_price: number
        }
        Insert: {
          catalog_item_id: string
          category?: string | null
          estimated_rate?: number | null
          gst_pct?: number
          id?: string
          is_pr_item?: boolean
          item_description?: string | null
          item_id?: string | null
          item_type?: string | null
          po_id: string
          qty_ordered: number
          qty_received?: number
          unit?: string
          unit_price: number
        }
        Update: {
          catalog_item_id?: string
          category?: string | null
          estimated_rate?: number | null
          gst_pct?: number
          id?: string
          is_pr_item?: boolean
          item_description?: string | null
          item_id?: string | null
          item_type?: string | null
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proc_po_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_po_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_purchase_orders: {
        Row: {
          cgst_amount: number
          created_at: string
          delivery_date: string | null
          id: string
          igst_amount: number
          items_count: number
          notes: string | null
          org_id: string
          po_number: string
          pr_status: string
          project_id: string | null
          requested_by: string | null
          sgst_amount: number
          status: Database["public"]["Enums"]["po_status"]
          total_amount: number
          total_taxable: number
          updated_at: string
          vendor_id: string
          version: number
        }
        Insert: {
          cgst_amount?: number
          created_at?: string
          delivery_date?: string | null
          id?: string
          igst_amount?: number
          items_count?: number
          notes?: string | null
          org_id: string
          po_number: string
          pr_status?: string
          project_id?: string | null
          requested_by?: string | null
          sgst_amount?: number
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          total_taxable?: number
          updated_at?: string
          vendor_id: string
          version?: number
        }
        Update: {
          cgst_amount?: number
          created_at?: string
          delivery_date?: string | null
          id?: string
          igst_amount?: number
          items_count?: number
          notes?: string | null
          org_id?: string
          po_number?: string
          pr_status?: string
          project_id?: string | null
          requested_by?: string | null
          sgst_amount?: number
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          total_taxable?: number
          updated_at?: string
          vendor_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_rfq_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          item_id: string | null
          item_type: string | null
          qty_requested: number
          rfq_id: string
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty_requested: number
          rfq_id: string
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          qty_requested?: number
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_rfq_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "proc_rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_rfqs: {
        Row: {
          created_at: string
          id: string
          org_id: string
          rfq_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          rfq_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          rfq_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_rfqs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_vendor_bids: {
        Row: {
          created_at: string
          id: string
          is_selected: boolean | null
          lead_time_days: number
          rfq_id: string
          unit_price: number
          valid_until: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_selected?: boolean | null
          lead_time_days?: number
          rfq_id: string
          unit_price?: number
          valid_until: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_selected?: boolean | null
          lead_time_days?: number
          rfq_id?: string
          unit_price?: number
          valid_until?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_vendor_bids_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "proc_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_vendor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_vendor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_vendor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_vendor_bids_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_warranty_claims: {
        Row: {
          asset_id: string
          claim_number: string
          created_at: string
          id: string
          issue_description: string | null
          org_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          ticket_id: string | null
          updated_at: string
          vendor_id: string
          vendor_rma_number: string | null
        }
        Insert: {
          asset_id: string
          claim_number: string
          created_at?: string
          id?: string
          issue_description?: string | null
          org_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          vendor_id: string
          vendor_rma_number?: string | null
        }
        Update: {
          asset_id?: string
          claim_number?: string
          created_at?: string
          id?: string
          issue_description?: string | null
          org_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          vendor_id?: string
          vendor_rma_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_warranty_claims_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "field_customer_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "field_service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_warranty_claims_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_super_admin: boolean
          key_id: string | null
          org_id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          is_super_admin?: boolean
          key_id?: string | null
          org_id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          key_id?: string | null
          org_id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_additional_costs: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          quote_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          quote_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quote_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_additional_costs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_additional_costs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_format_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          org_id: string
          template_json: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          org_id: string
          template_json?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          org_id?: string
          template_json?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_format_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          quote_data: Json
          quote_id: string
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          quote_data: Json
          quote_id: string
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          quote_data?: Json
          quote_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          gst_pct: number
          id: string
          is_gst_overridden: boolean
          is_included: boolean
          is_mandatory: boolean
          is_qty_overridden: boolean
          is_rate_overridden: boolean
          line_gst: number
          line_subtotal: number
          line_total: number
          original_gst: number | null
          original_qty: number | null
          original_rate: number | null
          qty: number
          quote_id: string
          rate_per_unit: number
          remarks: string | null
          quoted_rate_date: string
          section: Database["public"]["Enums"]["bom_section"]
          sort_order: number
          source_item_id: string | null
          source_label: string | null
          source_table: string | null
          unit: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description: string
          gst_pct?: number
          id?: string
          is_gst_overridden?: boolean
          is_included?: boolean
          is_mandatory?: boolean
          is_qty_overridden?: boolean
          is_rate_overridden?: boolean
          line_gst?: number
          line_subtotal?: number
          line_total?: number
          original_gst?: number | null
          original_qty?: number | null
          original_rate?: number | null
          qty?: number
          quote_id: string
          rate_per_unit?: number
          remarks?: string | null
          quoted_rate_date?: string
          section: Database["public"]["Enums"]["bom_section"]
          sort_order?: number
          source_item_id?: string | null
          source_label?: string | null
          source_table?: string | null
          unit?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          gst_pct?: number
          id?: string
          is_gst_overridden?: boolean
          is_included?: boolean
          is_mandatory?: boolean
          is_qty_overridden?: boolean
          is_rate_overridden?: boolean
          line_gst?: number
          line_subtotal?: number
          line_total?: number
          original_gst?: number | null
          original_qty?: number | null
          original_rate?: number | null
          qty?: number
          quote_id?: string
          rate_per_unit?: number
          remarks?: string | null
          quoted_rate_date?: string
          section?: Database["public"]["Enums"]["bom_section"]
          sort_order?: number
          source_item_id?: string | null
          source_label?: string | null
          source_table?: string | null
          unit?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["quote_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["quote_status"] | null
          quote_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["quote_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["quote_status"] | null
          quote_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["quote_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["quote_status"] | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_status_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_status_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_variants: {
        Row: {
          beneficiary_contribution: number | null
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_val: number
          final_customer_price: number | null
          id: string
          is_selected: boolean
          mrp_incl_gst: number | null
          name: string
          overrides_json: Json
          quote_id: string
          subsidy_amount: number | null
          target_margin_pct: number | null
          updated_at: string
        }
        Insert: {
          beneficiary_contribution?: number | null
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_val?: number
          final_customer_price?: number | null
          id?: string
          is_selected?: boolean
          mrp_incl_gst?: number | null
          name: string
          overrides_json?: Json
          quote_id: string
          subsidy_amount?: number | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Update: {
          beneficiary_contribution?: number | null
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_val?: number
          final_customer_price?: number | null
          id?: string
          is_selected?: boolean
          mrp_incl_gst?: number | null
          name?: string
          overrides_json?: Json
          quote_id?: string
          subsidy_amount?: number | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_variants_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_variants_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          additional_costs_total: number
          address_line1: string | null
          address_line2: string | null
          annual_generation_kwh: number | null
          annual_savings_inr: number | null
          battery_brand_model: string | null
          battery_qty: number | null
          battery_rate: number | null
          battery_total_kwh: number | null
          beneficiary_contribution: number
          city: string | null
          civil_applicable: boolean
          co2_offset_kg_per_year: number | null
          cost_before_gst: number
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_whatsapp: string | null
          discount_amount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_val: number
          effective_margin_pct: number
          exec_id: string | null
          exec_name: string | null
          final_customer_price: number
          gst_output_override: number | null
          gst_output_rate: number
          gst_rate: number
          id: string
          inverter_brand_model: string | null
          inverter_qty: number | null
          inverter_rate: number | null
          la_id: string | null
          la_qty: number | null
          lead_id: string | null
          lifetime_savings_inr: number | null
          logistics_cost_estimated: number | null
          margin_mode: string
          margin_alert: boolean
          margin_alert_threshold: number
          meter_number: string | null
          monthly_bill_inr: number | null
          mrp_excl_gst: number
          mrp_incl_gst: number
          net_meter_id: string | null
          net_meter_qty: number | null
          notes: string | null
          org_id: string
          output_gst_amount: number
          panel_brand_model: string | null
          panel_qty: number | null
          panel_rate_per_panel: number | null
          parent_quote_id: string | null
          payback_years: number | null
          per_kw_excl_gst: number | null
          per_kw_incl_gst: number | null
          pincode: string | null
          project_title: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          quote_number: string
          roof_area_sqft: number | null
          roof_type: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          sanctioned_load_kw: number | null
          solar_meter_id: string | null
          solar_meter_qty: number | null
          state_id: string | null
          state_name: string | null
          status: Database["public"]["Enums"]["quote_status"]
          structure_id: string | null
          structure_pricing_mode: string | null
          structure_type: string
          subsidy_amount: number
          subsidy_breakdown: string | null
          subsidy_eligible: boolean
          subsidy_scheme_id: string | null
          survey_id: string | null
          system_capacity_kw: number | null
          system_category: Database["public"]["Enums"]["system_category"] | null
          system_id: string | null
          system_name: string | null
          target_margin_amount: number | null
          target_mrp_incl_gst: number | null
          target_mrp_per_watt: number | null
          total_incl_gst: number
          total_input_gst: number
          updated_at: string
          valid_until: string | null
          validation_acknowledged: Json
          version: number
          version_reason: string | null
          company_cin: string | null
          company_gstin: string | null
          company_pan: string | null
          company_phone: string | null
          company_email: string | null
          company_website: string | null
          company_address: string | null
          ceo_name: string | null
          ceo_designation: string | null
          ceo_signature_url: string | null
          sales_exec_role: string | null
          sales_exec_phone: string | null
          sales_exec_email: string | null
          bank_account_holder: string | null
          bank_name: string | null
          bank_account_no: string | null
          bank_ifsc: string | null
          bank_upi_id: string | null
          terms_json: Json | null
          why_solar_json: Json | null
          equipment_json: Json | null
        }
        Insert: {
          additional_costs_total?: number
          address_line1?: string | null
          address_line2?: string | null
          annual_generation_kwh?: number | null
          annual_savings_inr?: number | null
          battery_brand_model?: string | null
          battery_qty?: number | null
          battery_rate?: number | null
          battery_total_kwh?: number | null
          beneficiary_contribution?: number
          city?: string | null
          civil_applicable?: boolean
          co2_offset_kg_per_year?: number | null
          cost_before_gst?: number
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_val?: number
          effective_margin_pct?: number
          exec_id?: string | null
          exec_name?: string | null
          final_customer_price?: number
          gst_output_override?: number | null
          gst_output_rate?: number
          gst_rate?: number
          id?: string
          inverter_brand_model?: string | null
          inverter_qty?: number | null
          inverter_rate?: number | null
          la_id?: string | null
          la_qty?: number | null
          lead_id?: string | null
          lifetime_savings_inr?: number | null
          logistics_cost_estimated?: number | null
          margin_mode?: string
          margin_alert?: boolean
          margin_alert_threshold?: number
          meter_number?: string | null
          monthly_bill_inr?: number | null
          mrp_excl_gst?: number
          mrp_incl_gst?: number
          net_meter_id?: string | null
          net_meter_qty?: number | null
          notes?: string | null
          org_id: string
          output_gst_amount?: number
          panel_brand_model?: string | null
          panel_qty?: number | null
          panel_rate_per_panel?: number | null
          parent_quote_id?: string | null
          payback_years?: number | null
          per_kw_excl_gst?: number | null
          per_kw_incl_gst?: number | null
          pincode?: string | null
          project_title?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          quote_number: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          sanctioned_load_kw?: number | null
          solar_meter_id?: string | null
          solar_meter_qty?: number | null
          state_id?: string | null
          state_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          structure_id?: string | null
          structure_pricing_mode?: string | null
          structure_type?: string
          subsidy_amount?: number
          subsidy_breakdown?: string | null
          subsidy_eligible?: boolean
          subsidy_scheme_id?: string | null
          survey_id?: string | null
          system_capacity_kw?: number | null
          system_category?:
            | Database["public"]["Enums"]["system_category"]
            | null
          system_id?: string | null
          system_name?: string | null
          target_margin_amount?: number | null
          target_mrp_incl_gst?: number | null
          target_mrp_per_watt?: number | null
          total_incl_gst?: number
          total_input_gst?: number
          updated_at?: string
          valid_until?: string | null
          validation_acknowledged?: Json
          version?: number
          version_reason?: string | null
          company_cin?: string | null
          company_gstin?: string | null
          company_pan?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_website?: string | null
          company_address?: string | null
          ceo_name?: string | null
          ceo_designation?: string | null
          ceo_signature_url?: string | null
          sales_exec_role?: string | null
          sales_exec_phone?: string | null
          sales_exec_email?: string | null
          bank_account_holder?: string | null
          bank_name?: string | null
          bank_account_no?: string | null
          bank_ifsc?: string | null
          bank_upi_id?: string | null
          terms_json?: Json | null
          why_solar_json?: Json | null
          equipment_json?: Json | null
        }
        Update: {
          additional_costs_total?: number
          address_line1?: string | null
          address_line2?: string | null
          annual_generation_kwh?: number | null
          annual_savings_inr?: number | null
          battery_brand_model?: string | null
          battery_qty?: number | null
          battery_rate?: number | null
          battery_total_kwh?: number | null
          beneficiary_contribution?: number
          city?: string | null
          civil_applicable?: boolean
          co2_offset_kg_per_year?: number | null
          cost_before_gst?: number
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_val?: number
          effective_margin_pct?: number
          exec_id?: string | null
          exec_name?: string | null
          final_customer_price?: number
          gst_output_override?: number | null
          gst_output_rate?: number
          gst_rate?: number
          id?: string
          inverter_brand_model?: string | null
          inverter_qty?: number | null
          inverter_rate?: number | null
          la_id?: string | null
          la_qty?: number | null
          lead_id?: string | null
          lifetime_savings_inr?: number | null
          logistics_cost_estimated?: number | null
          margin_mode?: string
          margin_alert?: boolean
          margin_alert_threshold?: number
          meter_number?: string | null
          monthly_bill_inr?: number | null
          mrp_excl_gst?: number
          mrp_incl_gst?: number
          net_meter_id?: string | null
          net_meter_qty?: number | null
          notes?: string | null
          org_id?: string
          output_gst_amount?: number
          panel_brand_model?: string | null
          panel_qty?: number | null
          panel_rate_per_panel?: number | null
          parent_quote_id?: string | null
          payback_years?: number | null
          per_kw_excl_gst?: number | null
          per_kw_incl_gst?: number | null
          pincode?: string | null
          project_title?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          quote_number?: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          sanctioned_load_kw?: number | null
          solar_meter_id?: string | null
          solar_meter_qty?: number | null
          state_id?: string | null
          state_name?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          structure_id?: string | null
          structure_pricing_mode?: string | null
          structure_type?: string
          subsidy_amount?: number
          subsidy_breakdown?: string | null
          subsidy_eligible?: boolean
          subsidy_scheme_id?: string | null
          survey_id?: string | null
          system_capacity_kw?: number | null
          system_category?:
            | Database["public"]["Enums"]["system_category"]
            | null
          system_id?: string | null
          system_name?: string | null
          target_margin_amount?: number | null
          target_mrp_incl_gst?: number | null
          target_mrp_per_watt?: number | null
          total_incl_gst?: number
          total_input_gst?: number
          updated_at?: string
          valid_until?: string | null
          validation_acknowledged?: Json
          version?: number
          version_reason?: string | null
          company_cin?: string | null
          company_gstin?: string | null
          company_pan?: string | null
          company_phone?: string | null
          company_email?: string | null
          company_website?: string | null
          company_address?: string | null
          ceo_name?: string | null
          ceo_designation?: string | null
          ceo_signature_url?: string | null
          sales_exec_role?: string | null
          sales_exec_phone?: string | null
          sales_exec_email?: string | null
          bank_account_holder?: string | null
          bank_name?: string | null
          bank_account_no?: string | null
          bank_ifsc?: string | null
          bank_upi_id?: string | null
          terms_json?: Json | null
          why_solar_json?: Json | null
          equipment_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_exec_id_fkey"
            columns: ["exec_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_la_id_fkey"
            columns: ["la_id"]
            isOneToOne: false
            referencedRelation: "eq_lightning_arresters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_net_meter_id_fkey"
            columns: ["net_meter_id"]
            isOneToOne: false
            referencedRelation: "eq_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_solar_meter_id_fkey"
            columns: ["solar_meter_id"]
            isOneToOne: false
            referencedRelation: "eq_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "state_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_subsidy_scheme_id_fkey"
            columns: ["subsidy_scheme_id"]
            isOneToOne: false
            referencedRelation: "calculation_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "crm_site_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_system_bom_totals"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_master: {
        Row: {
          bom_item_id: string | null
          created_at: string
          id: string
          is_active: boolean
          item_name: string
          org_id: string
          override_rate: number
          updated_at: string
        }
        Insert: {
          bom_item_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_name: string
          org_id: string
          override_rate: number
          updated_at?: string
        }
        Update: {
          bom_item_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_name?: string
          org_id?: string
          override_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_master_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_master_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          item_name: string
          new_rate: number | null
          old_rate: number | null
          org_id: string
          rate_master_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_name: string
          new_rate?: number | null
          old_rate?: number | null
          org_id: string
          rate_master_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_name?: string
          new_rate?: number | null
          old_rate?: number | null
          org_id?: string
          rate_master_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_master_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_audit_log_rate_master_id_fkey"
            columns: ["rate_master_id"]
            isOneToOne: false
            referencedRelation: "rate_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_audit_log_rate_master_id_fkey"
            columns: ["rate_master_id"]
            isOneToOne: false
            referencedRelation: "v_rate_master_canonical"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_master_audit_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_rate: number | null
          old_rate: number | null
          org_id: string
          rate_master_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_rate?: number | null
          old_rate?: number | null
          org_id: string
          rate_master_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_rate?: number | null
          old_rate?: number | null
          org_id?: string
          rate_master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_master_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_slabs: {
        Row: {
          created_at: string
          end_kw: number | null
          fixed_amount: number | null
          id: string
          is_fixed_amount: boolean
          rate_per_kw: number
          scheme_id: string
          slab_index: number
          start_kw: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_kw?: number | null
          fixed_amount?: number | null
          id?: string
          is_fixed_amount?: boolean
          rate_per_kw?: number
          scheme_id: string
          slab_index: number
          start_kw: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_kw?: number | null
          fixed_amount?: number | null
          id?: string
          is_fixed_amount?: boolean
          rate_per_kw?: number
          scheme_id?: string
          slab_index?: number
          start_kw?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_slabs_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "calculation_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_surveys: {
        Row: {
          conducted_at: string | null
          conducted_by: string | null
          consumer_number: string | null
          created_at: string
          discom_name: string | null
          distance_inverter_to_meter_m: number | null
          distance_panel_to_inverter_m: number | null
          existing_load_kw: number | null
          id: string
          lead_id: string
          meter_phase: string | null
          net_metering_available: boolean | null
          photo_urls: Json
          quote_id: string | null
          roof_area_sqft: number | null
          roof_height_ft: number | null
          roof_type: string | null
          sanctioned_load_kw: number | null
          shadowing_notes: string | null
          status: string
          survey_notes: string | null
          updated_at: string
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          conducted_at?: string | null
          conducted_by?: string | null
          consumer_number?: string | null
          created_at?: string
          discom_name?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          existing_load_kw?: number | null
          id?: string
          lead_id: string
          meter_phase?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json
          quote_id?: string | null
          roof_area_sqft?: number | null
          roof_height_ft?: number | null
          roof_type?: string | null
          sanctioned_load_kw?: number | null
          shadowing_notes?: string | null
          status?: string
          survey_notes?: string | null
          updated_at?: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          conducted_at?: string | null
          conducted_by?: string | null
          consumer_number?: string | null
          created_at?: string
          discom_name?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          existing_load_kw?: number | null
          id?: string
          lead_id?: string
          meter_phase?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json
          quote_id?: string | null
          roof_area_sqft?: number | null
          roof_height_ft?: number | null
          roof_type?: string | null
          sanctioned_load_kw?: number | null
          shadowing_notes?: string | null
          status?: string
          survey_notes?: string | null
          updated_at?: string
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_surveys_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_surveys_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      state_rules: {
        Row: {
          created_at: string
          grid_tariff_inr: number
          gst_on_output: number
          id: string
          is_active: boolean
          labour_multiplier: number
          performance_ratio: number
          state_code: string
          state_name: string
          sun_hours_per_day: number
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          grid_tariff_inr?: number
          gst_on_output?: number
          id?: string
          is_active?: boolean
          labour_multiplier?: number
          performance_ratio?: number
          state_code: string
          state_name: string
          sun_hours_per_day: number
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          grid_tariff_inr?: number
          gst_on_output?: number
          id?: string
          is_active?: boolean
          labour_multiplier?: number
          performance_ratio?: number
          state_code?: string
          state_name?: string
          sun_hours_per_day?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      state_scheme_overrides: {
        Row: {
          additional_state_subsidy: number
          created_at: string
          id: string
          is_active: boolean
          max_absolute_override: number | null
          scheme_id: string
          state_id: string
          updated_at: string
          version: number
        }
        Insert: {
          additional_state_subsidy?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_absolute_override?: number | null
          scheme_id: string
          state_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          additional_state_subsidy?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_absolute_override?: number | null
          scheme_id?: string
          state_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "state_scheme_overrides_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "calculation_schemes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_scheme_overrides_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "state_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_accessory_rates: {
        Row: {
          created_at: string
          gst_pct: number
          id: string
          is_active: boolean
          item_aliases: string[]
          item_name: string
          org_id: string | null
          rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          item_aliases?: string[]
          item_name: string
          org_id?: string | null
          rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          item_aliases?: string[]
          item_name?: string
          org_id?: string | null
          rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_accessory_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_component_master: {
        Row: {
          buy_price: number
          created_at: string
          gst_pct: number
          id: string
          is_active: boolean
          material: string | null
          name: string
          org_id: string | null
          selling_price: number
          specification_details: string | null
          type: string | null
          updated_at: string
          weight_per_meter: number | null
        }
        Insert: {
          buy_price?: number
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          material?: string | null
          name: string
          org_id?: string | null
          selling_price?: number
          specification_details?: string | null
          type?: string | null
          updated_at?: string
          weight_per_meter?: number | null
        }
        Update: {
          buy_price?: number
          created_at?: string
          gst_pct?: number
          id?: string
          is_active?: boolean
          material?: string | null
          name?: string
          org_id?: string | null
          selling_price?: number
          specification_details?: string | null
          type?: string | null
          updated_at?: string
          weight_per_meter?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_component_master_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_component_vendor_rates: {
        Row: {
          component_id: string
          created_at: string
          effective_from: string | null
          id: string
          rate_per_unit: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          effective_from?: string | null
          id?: string
          rate_per_unit?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          effective_from?: string | null
          id?: string
          rate_per_unit?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_component_vendor_rates_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "eq_structure_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_component_vendor_rates_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_component_vendor_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_component_vendor_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_component_vendor_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_component_vendor_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_material_rates: {
        Row: {
          created_at: string
          id: string
          material_type: string
          rate_per_kg: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_type: string
          rate_per_kg: number
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_type?: string
          rate_per_kg?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_material_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_material_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_material_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_material_rates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_rates: {
        Row: {
          component_id: string | null
          created_at: string | null
          id: string
          org_id: string | null
          rate: number | null
          updated_at: string | null
        }
        Insert: {
          component_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Update: {
          component_id?: string | null
          created_at?: string | null
          id?: string
          org_id?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_template_items: {
        Row: {
          accessory_rate_id: string | null
          created_at: string
          id: string
          item: string
          qty: number
          template_id: string
          vendor_id: string | null
          weight: number | null
        }
        Insert: {
          accessory_rate_id?: string | null
          created_at?: string
          id?: string
          item: string
          qty: number
          template_id: string
          vendor_id?: string | null
          weight?: number | null
        }
        Update: {
          accessory_rate_id?: string | null
          created_at?: string
          id?: string
          item?: string
          qty?: number
          template_id?: string
          vendor_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_template_items_accessory_rate_id_fkey"
            columns: ["accessory_rate_id"]
            isOneToOne: false
            referencedRelation: "structure_accessory_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "structure_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_template_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_template_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_template_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "structure_template_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_templates: {
        Row: {
          capacity_kw: number
          created_at: string
          id: string
          panel_count: number
          structure_type: string
        }
        Insert: {
          capacity_kw: number
          created_at?: string
          id?: string
          panel_count: number
          structure_type: string
        }
        Update: {
          capacity_kw?: number
          created_at?: string
          id?: string
          panel_count?: number
          structure_type?: string
        }
        Relationships: []
      }
      structure_vendors_deprecated: {
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
      structure_weight_lookup: {
        Row: {
          bracket_fixed_weight: number
          capacity_kw_max: number
          capacity_kw_min: number
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          notes: string | null
          panel_qty: number
          row_number: number | null
          sheet_name: string | null
          source_file: string | null
          structure_id: string
          total_weight_kg: number | null
          weight_per_panel_kg: number
        }
        Insert: {
          bracket_fixed_weight?: number
          capacity_kw_max: number
          capacity_kw_min: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          notes?: string | null
          panel_qty: number
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          structure_id: string
          total_weight_kg?: number | null
          weight_per_panel_kg: number
        }
        Update: {
          bracket_fixed_weight?: number
          capacity_kw_max?: number
          capacity_kw_min?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          notes?: string | null
          panel_qty?: number
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          structure_id?: string
          total_weight_kg?: number | null
          weight_per_panel_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "structure_weight_lookup_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_weight_lookup_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_weight_lookup_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_number: string | null
          org_id: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          org_id: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string | null
          org_id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "org_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          seat_limit: number
          updated_at: string
          yearly_price: number
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          monthly_price?: number
          name: string
          seat_limit?: number
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          seat_limit?: number
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      sys_approval_history: {
        Row: {
          action: string
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          request_id: string
          step_id: string
        }
        Insert: {
          action: string
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id: string
          step_id: string
        }
        Update: {
          action?: string
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_history_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approval_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "sys_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approval_history_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sys_approval_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approval_requests: {
        Row: {
          created_at: string
          current_step_order: number
          entity_id: string
          entity_type: string
          id: string
          org_id: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_req_status"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          current_step_order?: number
          entity_id: string
          entity_type: string
          id?: string
          org_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_req_status"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          current_step_order?: number
          entity_id?: string
          entity_type?: string
          id?: string
          org_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_req_status"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "sys_approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approval_rules: {
        Row: {
          approver_role: string
          condition_sql: string
          created_at: string
          id: string
          is_active: boolean
          module: string
          org_id: string
        }
        Insert: {
          approver_role: string
          condition_sql: string
          created_at?: string
          id?: string
          is_active?: boolean
          module: string
          org_id: string
        }
        Update: {
          approver_role?: string
          condition_sql?: string
          created_at?: string
          id?: string
          is_active?: boolean
          module?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approval_steps: {
        Row: {
          created_at: string
          id: string
          required_approvals_count: number
          required_role_id: string | null
          step_order: number
          step_type: Database["public"]["Enums"]["approval_step_type"]
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          required_approvals_count?: number
          required_role_id?: string | null
          step_order: number
          step_type?: Database["public"]["Enums"]["approval_step_type"]
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          required_approvals_count?: number
          required_role_id?: string | null
          step_order?: number
          step_type?: Database["public"]["Enums"]["approval_step_type"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_steps_required_role_id_fkey"
            columns: ["required_role_id"]
            isOneToOne: false
            referencedRelation: "sys_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "sys_approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approval_workflow_rules: {
        Row: {
          field_name: string
          id: string
          operator: Database["public"]["Enums"]["operator_type"]
          target_value: Json
          workflow_id: string
        }
        Insert: {
          field_name: string
          id?: string
          operator: Database["public"]["Enums"]["operator_type"]
          target_value: Json
          workflow_id: string
        }
        Update: {
          field_name?: string
          id?: string
          operator?: Database["public"]["Enums"]["operator_type"]
          target_value?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_workflow_rules_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "sys_approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approval_workflows: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approval_workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          document_id: string
          document_type: string
          id: string
          notes: string | null
          org_id: string
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          document_id: string
          document_type: string
          id?: string
          notes?: string | null
          org_id: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          document_id?: string
          document_type?: string
          id?: string
          notes?: string | null
          org_id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          module: string
          org_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          module: string
          org_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          module?: string
          org_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_dashboards: {
        Row: {
          created_at: string
          dashboard_name: string
          id: string
          is_default: boolean
          layout_json: Json
          org_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dashboard_name: string
          id?: string
          is_default?: boolean
          layout_json?: Json
          org_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dashboard_name?: string
          id?: string
          is_default?: boolean
          layout_json?: Json
          org_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_dashboards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_dashboards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          entity_id: string
          entity_type: string
          escalated_by: string
          id: string
          org_id: string
          reason: string
          severity: number
          status: Database["public"]["Enums"]["escalation_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          escalated_by: string
          id?: string
          org_id: string
          reason: string
          severity?: number
          status?: Database["public"]["Enums"]["escalation_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          escalated_by?: string
          id?: string
          org_id?: string
          reason?: string
          severity?: number
          status?: Database["public"]["Enums"]["escalation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_escalations_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_escalations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_event_bus: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          org_id: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_event_bus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_event_bus_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_notification_queue: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          event_payload: Json | null
          id: string
          org_id: string
          recipient_id: string
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status"]
          subject: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_payload?: Json | null
          id?: string
          org_id: string
          recipient_id: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_payload?: Json | null
          id?: string
          org_id?: string
          recipient_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_notification_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_notification_queue_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_notification_templates: {
        Row: {
          body_template: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          event_type: string
          id: string
          org_id: string
          subject_template: string | null
          updated_at: string
        }
        Insert: {
          body_template: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          subject_template?: string | null
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          subject_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_notification_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          org_id: string
          recipient_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          org_id: string
          recipient_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          org_id?: string
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["permission_type"]
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["permission_type"]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["permission_type"]
        }
        Relationships: []
      }
      sys_role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "sys_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "sys_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_roles: {
        Row: {
          created_at: string
          description: string | null
          hierarchy_level: number
          id: string
          is_system_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_system_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_system_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          org_id: string
          profile_id: string
          role_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          org_id: string
          profile_id: string
          role_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          org_id?: string
          profile_id?: string
          role_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "sys_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_items: {
        Row: {
          battery_id: string | null
          bom_item_id: string | null
          comm_device_id: string | null
          default_qty: number
          description: string
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          inverter_id: string | null
          is_included_by_default: boolean
          is_mandatory: boolean
          la_id: string | null
          net_meter_id: string | null
          panel_id: string | null
          remarks: string | null
          row_number: number | null
          section: Database["public"]["Enums"]["bom_section"]
          sheet_name: string | null
          solar_meter_id: string | null
          sort_order: number
          source_file: string | null
          structure_component_id: string | null
          structure_id: string | null
          system_id: string
          unit: string
        }
        Insert: {
          battery_id?: string | null
          bom_item_id?: string | null
          comm_device_id?: string | null
          default_qty?: number
          description: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          inverter_id?: string | null
          is_included_by_default?: boolean
          is_mandatory?: boolean
          la_id?: string | null
          net_meter_id?: string | null
          panel_id?: string | null
          remarks?: string | null
          row_number?: number | null
          section: Database["public"]["Enums"]["bom_section"]
          sheet_name?: string | null
          solar_meter_id?: string | null
          sort_order?: number
          source_file?: string | null
          structure_component_id?: string | null
          structure_id?: string | null
          system_id: string
          unit?: string
        }
        Update: {
          battery_id?: string | null
          bom_item_id?: string | null
          comm_device_id?: string | null
          default_qty?: number
          description?: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          inverter_id?: string | null
          is_included_by_default?: boolean
          is_mandatory?: boolean
          la_id?: string | null
          net_meter_id?: string | null
          panel_id?: string | null
          remarks?: string | null
          row_number?: number | null
          section?: Database["public"]["Enums"]["bom_section"]
          sheet_name?: string | null
          solar_meter_id?: string | null
          sort_order?: number
          source_file?: string | null
          structure_component_id?: string | null
          structure_id?: string | null
          system_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_items_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "eq_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "v_active_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_comm_device_id_fkey"
            columns: ["comm_device_id"]
            isOneToOne: false
            referencedRelation: "eq_communication_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "eq_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "v_active_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_la_id_fkey"
            columns: ["la_id"]
            isOneToOne: false
            referencedRelation: "eq_lightning_arresters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_net_meter_id_fkey"
            columns: ["net_meter_id"]
            isOneToOne: false
            referencedRelation: "eq_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "eq_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "v_active_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_solar_meter_id_fkey"
            columns: ["solar_meter_id"]
            isOneToOne: false
            referencedRelation: "eq_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_structure_component_id_fkey"
            columns: ["structure_component_id"]
            isOneToOne: false
            referencedRelation: "structure_component_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_items_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "v_system_bom_totals"
            referencedColumns: ["id"]
          },
        ]
      }
      system_presets: {
        Row: {
          author_id: string | null
          calculator_state: Json
          capacity_kw: number
          created_at: string | null
          created_by: string | null
          id: string
          is_default: boolean | null
          is_org_template: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          org_id: string | null
          status: string
          system_kw: number | null
          system_type: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          calculator_state: Json
          capacity_kw: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          is_org_template?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          status?: string
          system_kw?: number | null
          system_type?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          calculator_state?: Json
          capacity_kw?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          is_org_template?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          status?: string
          system_kw?: number | null
          system_type?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_presets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          capacity_kw: number
          category: Database["public"]["Enums"]["system_category"]
          created_at: string
          id: string
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean
          is_custom: boolean
          name: string
          org_id: string | null
          panel_qty: number | null
          panel_wattage_w: number | null
          row_number: number | null
          sheet_name: string | null
          source_file: string | null
          target_margin_pct: number
          updated_at: string
          version: number
        }
        Insert: {
          capacity_kw: number
          category: Database["public"]["Enums"]["system_category"]
          created_at?: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          name: string
          org_id?: string | null
          panel_qty?: number | null
          panel_wattage_w?: number | null
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          target_margin_pct?: number
          updated_at?: string
          version?: number
        }
        Update: {
          capacity_kw?: number
          category?: Database["public"]["Enums"]["system_category"]
          created_at?: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          imported_by?: string | null
          is_active?: boolean
          is_custom?: boolean
          name?: string
          org_id?: string | null
          panel_qty?: number | null
          panel_wattage_w?: number | null
          row_number?: number | null
          sheet_name?: string | null
          source_file?: string | null
          target_margin_pct?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "systems_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "master_data_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "systems_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "systems_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          browser: string | null
          device_name: string | null
          device_secret_hash: string
          fingerprint_hash: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          org_id: string
          os: string | null
          public_key: string | null
          revoked_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          device_name?: string | null
          device_secret_hash: string
          fingerprint_hash?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          org_id: string
          os?: string | null
          public_key?: string | null
          revoked_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          device_name?: string | null
          device_secret_hash?: string
          fingerprint_hash?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          org_id?: string
          os?: string | null
          public_key?: string | null
          revoked_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          cgst_amount: number | null
          created_at: string | null
          id: string
          igst_amount: number | null
          invoice_amount: number
          invoice_number: string
          project_id: string
          retention_amount: number | null
          retention_pct: number
          retention_percent: number
          retention_release_approved_by: string | null
          retention_release_notes: string | null
          retention_released: boolean
          retention_released_at: string | null
          sgst_amount: number | null
          status: string
          taxable_amount: number | null
          total_gst: number | null
          vendor_id: string
        }
        Insert: {
          cgst_amount?: number | null
          created_at?: string | null
          id?: string
          igst_amount?: number | null
          invoice_amount: number
          invoice_number: string
          project_id: string
          retention_amount?: number | null
          retention_pct?: number
          retention_percent?: number
          retention_release_approved_by?: string | null
          retention_release_notes?: string | null
          retention_released?: boolean
          retention_released_at?: string | null
          sgst_amount?: number | null
          status?: string
          taxable_amount?: number | null
          total_gst?: number | null
          vendor_id: string
        }
        Update: {
          cgst_amount?: number | null
          created_at?: string | null
          id?: string
          igst_amount?: number | null
          invoice_amount?: number
          invoice_number?: string
          project_id?: string
          retention_amount?: number | null
          retention_pct?: number
          retention_percent?: number
          retention_release_approved_by?: string | null
          retention_release_notes?: string | null
          retention_released?: boolean
          retention_released_at?: string | null
          sgst_amount?: number | null
          status?: string
          taxable_amount?: number | null
          total_gst?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_payments_retention_release_approved_by_fkey"
            columns: ["retention_release_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_structure_vendor: boolean
          name: string
          org_id: string
          phone: string | null
          quality_score: number | null
          rates_url: string | null
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
          version: number
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_structure_vendor?: boolean
          name: string
          org_id: string
          phone?: string | null
          quality_score?: number | null
          rates_url?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_structure_vendor?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          quality_score?: number | null
          rates_url?: string | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      walkway_templates: {
        Row: {
          cost: number
          cost_per_meter: number
          created_at: string
          id: string
          length_m: number
          template: string
        }
        Insert: {
          cost: number
          cost_per_meter: number
          created_at?: string
          id?: string
          length_m: number
          template: string
        }
        Update: {
          cost?: number
          cost_per_meter?: number
          created_at?: string
          id?: string
          length_m?: number
          template?: string
        }
        Relationships: []
      }
    }
    Views: {
      inventory_positions: {
        Row: {
          item_id: string | null
          project_id: string | null
          qty_at_site: number | null
          qty_in_transit: number | null
          qty_in_warehouse: number | null
          qty_installed: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "epc_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mv_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inventory_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_profitability_audit"
            referencedColumns: ["project_id"]
          },
        ]
      }
      mv_ar_aging: {
        Row: {
          days_overdue: number | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          org_id: string | null
          status: string | null
          total_invoice: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_inventory_valuation: {
        Row: {
          org_id: string | null
          total_valuation: number | null
          unique_items_count: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_margin_trends: {
        Row: {
          avg_margin_pct: number | null
          month_label: string | null
          org_id: string | null
          won_quotes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_procurement_spend: {
        Row: {
          org_id: string | null
          total_pos: number | null
          total_spend: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_project_profitability: {
        Row: {
          actual_labor_cost: number | null
          actual_material_cost: number | null
          budgeted_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
          org_id: string | null
          project_id: string | null
          project_number: string | null
          project_status: string | null
          total_actual_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epc_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_quote_pipeline: {
        Row: {
          avg_margin_pct: number | null
          org_id: string | null
          quote_count: number | null
          status: Database["public"]["Enums"]["quote_status"] | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_vendor_performance: {
        Row: {
          avg_delay_days: number | null
          org_id: string | null
          total_orders: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_active_batteries: {
        Row: {
          brand: string | null
          capacity: string | null
          eq_type: string | null
          gst_pct: number | null
          id: string | null
          is_custom: boolean | null
          model: string | null
          rate: number | null
          sub_type: string | null
        }
        Insert: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
          sub_type?: never
        }
        Update: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
          sub_type?: never
        }
        Relationships: []
      }
      v_active_inverters: {
        Row: {
          brand: string | null
          capacity: string | null
          eq_type: string | null
          gst_pct: number | null
          id: string | null
          is_custom: boolean | null
          model: string | null
          rate: number | null
          sub_type: string | null
        }
        Insert: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
          sub_type?: never
        }
        Update: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
          sub_type?: never
        }
        Relationships: []
      }
      v_active_panels: {
        Row: {
          brand: string | null
          capacity: string | null
          eq_type: string | null
          gst_pct: number | null
          id: string | null
          is_custom: boolean | null
          model: string | null
          rate: number | null
        }
        Insert: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
        }
        Update: {
          brand?: string | null
          capacity?: never
          eq_type?: never
          gst_pct?: number | null
          id?: string | null
          is_custom?: boolean | null
          model?: string | null
          rate?: number | null
        }
        Relationships: []
      }
      v_ar_aging: {
        Row: {
          days_overdue: number | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          org_id: string | null
          status: string | null
          total_invoice: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acc_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_gstr1_export: {
        Row: {
          gst_amount: number | null
          gst_rate_pct: number | null
          invoice_date: string | null
          invoice_number: string | null
          item_type: string | null
          org_id: string | null
          pos_state: string | null
          recipient_name: string | null
          taxable_value: number | null
          total_invoice_value: number | null
        }
        Relationships: []
      }
      v_inventory_valuation: {
        Row: {
          org_id: string | null
          total_valuation: number | null
          unique_items_count: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inv_stock_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inv_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_margin_trends: {
        Row: {
          avg_margin_pct: number | null
          month_label: string | null
          org_id: string | null
          won_quotes_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_procurement_spend: {
        Row: {
          org_id: string | null
          total_pos: number | null
          total_spend: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_structure_components_with_rates"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "proc_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_profitability: {
        Row: {
          actual_labor_cost: number | null
          actual_material_cost: number | null
          budgeted_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
          org_id: string | null
          project_id: string | null
          project_number: string | null
          project_status: string | null
          total_actual_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "epc_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_profitability_audit: {
        Row: {
          actual_labor_cost: number | null
          actual_material_cost: number | null
          budgeted_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
          project_id: string | null
          project_number: string | null
          project_status:
            | Database["public"]["Enums"]["epc_project_status"]
            | null
          total_actual_cost: number | null
        }
        Relationships: []
      }
      v_quote_pipeline: {
        Row: {
          avg_margin_pct: number | null
          org_id: string | null
          quote_count: number | null
          status: Database["public"]["Enums"]["quote_status"] | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_quote_section_totals: {
        Row: {
          included_items: number | null
          quote_id: string | null
          section: Database["public"]["Enums"]["bom_section"] | null
          section_cost: number | null
          section_gst: number | null
          section_subtotal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_quote_summary: {
        Row: {
          beneficiary_contribution: number | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          exec_name: string | null
          id: string | null
          inverter_brand_model: string | null
          mrp_incl_gst: number | null
          org_id: string | null
          panel_brand_model: string | null
          panel_qty: number | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          quote_number: string | null
          state_name: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subsidy_amount: number | null
          system_capacity_kw: number | null
          system_category: Database["public"]["Enums"]["system_category"] | null
          system_name: string | null
          updated_at: string | null
          valid_until: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rate_master_canonical: {
        Row: {
          bom_item_id: string | null
          effective_rate: number | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          item_name: string | null
          org_id: string | null
          section: Database["public"]["Enums"]["bom_section"] | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_master_bom_item_id_fkey"
            columns: ["bom_item_id"]
            isOneToOne: false
            referencedRelation: "bom_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_master_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_structure_components_with_rates: {
        Row: {
          buy_price: number | null
          category: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          org_id: string | null
          selling_price: number | null
          structure_id: string | null
          unit: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_rate_per_unit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eq_structure_components_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "eq_mounting_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      v_subsidy_slabs: {
        Row: {
          code: string | null
          end_kw: number | null
          fixed_amount: number | null
          is_fixed_amount: boolean | null
          max_absolute_subsidy: number | null
          max_capacity_kw: number | null
          name: string | null
          rate_per_kw: number | null
          slab_index: number | null
          start_kw: number | null
        }
        Relationships: []
      }
      v_system_bom_totals: {
        Row: {
          capacity_kw: number | null
          category: Database["public"]["Enums"]["system_category"] | null
          id: string | null
          item_count: number | null
          name: string | null
          panel_qty: number | null
          panel_wattage_w: number | null
          target_margin_pct: number | null
        }
        Relationships: []
      }
      v_vendor_performance: {
        Row: {
          avg_delay_days: number | null
          org_id: string | null
          total_orders: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vendor_retention: {
        Row: {
          created_at: string | null
          id: string | null
          invoice_amount: number | null
          invoice_number: string | null
          org_id: string | null
          project_number: string | null
          retention_amount: number | null
          retention_percent: number | null
          status: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epc_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_merged_batteries: {
        Row: {
          brand: string | null
          buy_price: number | null
          capacity_kwh: number | null
          chemistry: Database["public"]["Enums"]["battery_chemistry"] | null
          created_at: string | null
          description: string | null
          dod_pct: number | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          is_custom: boolean | null
          model: string | null
          org_id: string | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
          voltage_v: number | null
        }
        Relationships: []
      }
      vw_merged_bom_items: {
        Row: {
          buy_price: number | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          org_id: string | null
          remarks: string | null
          row_number: number | null
          section: Database["public"]["Enums"]["bom_section"] | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          sub_type: string | null
          unit: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      vw_merged_communication_devices: {
        Row: {
          brand: string | null
          buy_price: number | null
          compatible_inverter_brand: string | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          model: string | null
          org_id: string | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      vw_merged_inverters: {
        Row: {
          brand: string | null
          buy_price: number | null
          capacity_kw: number | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          inverter_type: Database["public"]["Enums"]["inverter_type"] | null
          is_active: boolean | null
          is_custom: boolean | null
          model: string | null
          org_id: string | null
          phases: number | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      vw_merged_lightning_arresters: {
        Row: {
          brand: string | null
          buy_price: number | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          la_type: Database["public"]["Enums"]["la_type"] | null
          max_capacity_kw: number | null
          model: string | null
          org_id: string | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      vw_merged_meters: {
        Row: {
          brand: string | null
          buy_price: number | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          is_smart: boolean | null
          meter_type: Database["public"]["Enums"]["meter_type"] | null
          model: string | null
          org_id: string | null
          phases: number | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
      vw_merged_mounting_structures: {
        Row: {
          base_weight_kg: number | null
          buy_price: number | null
          created_at: string | null
          description: string | null
          elevation_height_mm: number | null
          fabrication_rate: number | null
          fastener_weight_pct: number | null
          galvanizing_rate: number | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          is_custom: boolean | null
          material: Database["public"]["Enums"]["structure_material"] | null
          name: string | null
          org_id: string | null
          per_watt_rate: number | null
          rate_per_kg: number | null
          raw_material_rate: number | null
          roof_mount_type: Database["public"]["Enums"]["roof_mount_type"] | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
          wastage_pct: number | null
        }
        Relationships: []
      }
      vw_merged_panels: {
        Row: {
          brand: string | null
          buy_price: number | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          is_custom: boolean | null
          model: string | null
          org_id: string | null
          panel_type: string | null
          row_number: number | null
          selling_price: number | null
          sheet_name: string | null
          source_file: string | null
          updated_at: string | null
          version: number | null
          wattage_w: number | null
        }
        Relationships: []
      }
      vw_merged_structure_accessory_rates: {
        Row: {
          created_at: string | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          item_aliases: string[] | null
          item_name: string | null
          org_id: string | null
          rate: number | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_merged_structure_addons: {
        Row: {
          buy_price: number | null
          created_at: string | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          material: string | null
          name: string | null
          notes: string | null
          org_id: string | null
          rate_per_unit: number | null
          unit: string | null
        }
        Relationships: []
      }
      vw_merged_structure_component_master: {
        Row: {
          buy_price: number | null
          created_at: string | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          material: string | null
          name: string | null
          org_id: string | null
          selling_price: number | null
          type: string | null
          updated_at: string | null
          weight_per_meter: number | null
        }
        Relationships: []
      }
      vw_merged_structure_components: {
        Row: {
          buy_price: number | null
          category: string | null
          created_at: string | null
          description: string | null
          gst_pct: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          org_id: string | null
          selling_price: number | null
          structure_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_merged_systems: {
        Row: {
          capacity_kw: number | null
          category: Database["public"]["Enums"]["system_category"] | null
          created_at: string | null
          id: string | null
          import_batch_id: string | null
          imported_at: string | null
          imported_by: string | null
          is_active: boolean | null
          is_custom: boolean | null
          name: string | null
          org_id: string | null
          panel_qty: number | null
          panel_wattage_w: number | null
          row_number: number | null
          sheet_name: string | null
          source_file: string | null
          target_margin_pct: number | null
          updated_at: string | null
          version: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      calculate_subsidy: {
        Args: {
          p_capacity_kw: number
          p_scheme_code: string
          p_state_code?: string
        }
        Returns: number
      }
      convert_pr_to_po: {
        Args: {
          p_delivery_date: string
          p_items: Json
          p_po_id: string
          p_vendor_id: string
        }
        Returns: boolean
      }
      create_acquisition_atomic: {
        Args: { p_acquisition: Json; p_items: Json }
        Returns: Json
      }
      create_bundle_preset_atomic: {
        Args: { p_items: Json; p_preset: Json }
        Returns: Json
      }
      create_grn_atomic: {
        Args: {
          p_idempotency_key?: string
          p_items: Json
          p_org_id: string
          p_po_id: string
        }
        Returns: Json
      }
      create_project_with_quote: {
        Args: {
          p_assigned_pm_id: string
          p_capacity_kw: number
          p_customer_name: string
          p_customer_phone: string
          p_org_id: string
          p_planned_end: string
          p_planned_start: string
          p_project_number: string
          p_project_type: string
          p_quote_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_purchase_request: {
        Args: {
          p_items: Json
          p_notes: string
          p_org_id: string
          p_project_id: string
          p_requested_by: string
          p_vendor_id: string
        }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      dispatch_inventory: {
        Args: {
          p_driver_contact?: string
          p_item_id: string
          p_moved_by?: string
          p_project_id: string
          p_quantity: number
          p_vehicle_number?: string
        }
        Returns: undefined
      }
      dispatch_reserved_stock: {
        Args: {
          p_catalog_item_id: string
          p_org_id: string
          p_qty: number
          p_warehouse_id: string
        }
        Returns: boolean
      }
      fn_ensure_default_warehouse: {
        Args: { p_org_id: string }
        Returns: string
      }
      fn_generate_grn_number: { Args: { p_org_id: string }; Returns: string }
      fn_generate_invoice_number: {
        Args: { p_org_id: string }
        Returns: string
      }
      fn_generate_po_number: { Args: { p_org_id: string }; Returns: string }
      fn_generate_quote_number: { Args: { p_org_id: string }; Returns: string }
      fn_generate_transfer_number: {
        Args: { p_org_id: string }
        Returns: string
      }
      get_or_create_account: {
        Args: {
          p_code: string
          p_name: string
          p_org_id: string
          p_type: Database["public"]["Enums"]["acc_account_type"]
        }
        Returns: string
      }
      get_structure_rate: {
        Args: { p_capacity_kw: number; p_structure_id: string }
        Returns: number
      }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      mark_acquisition_as_received: {
        Args: { p_acquisition_id: string }
        Returns: Json
      }
      process_grn_receipt: { Args: { p_grn_id: string }; Returns: Json }
      refresh_materialized_views: { Args: never; Returns: undefined }
      release_stock_reservation: {
        Args: {
          p_catalog_item_id: string
          p_org_id: string
          p_qty: number
          p_warehouse_id: string
        }
        Returns: boolean
      }
      reserve_stock: {
        Args: {
          p_catalog_item_id: string
          p_org_id: string
          p_qty: number
          p_warehouse_id: string
        }
        Returns: boolean
      }
      save_bom: {
        Args: {
          p_bom_items: Json
          p_org_id: string
          p_project_id: string
          p_warehouse_id: string
        }
        Returns: undefined
      }
      set_claim: {
        Args: { claim: string; uid: string; value: Json }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_bundle_preset_atomic: {
        Args: { p_items?: Json; p_preset_id: string; p_updates: Json }
        Returns: Json
      }
      user_org_id: { Args: never; Returns: string }
      user_role: { Args: never; Returns: string }
    }
    Enums: {
      acc_account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      acquisition_status: "pending" | "received" | "cancelled"
      amc_status:
        | "draft"
        | "active"
        | "pending_renewal"
        | "expired"
        | "suspended"
        | "cancelled"
      approval_req_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
        | "escalated"
      approval_status: "pending" | "approved" | "rejected"
      approval_step_type: "sequential" | "parallel"
      battery_chemistry: "LFP" | "Li-Ion" | "Lead-Acid" | "NMC"
      bom_section:
        | "solar_panels"
        | "power_electronics"
        | "metering"
        | "mounting_structure"
        | "electrical_protection"
        | "earthing"
        | "cabling"
        | "wiring"
        | "services"
      claim_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "resolved"
      crm_lead_status:
        | "new"
        | "qualified"
        | "site_survey_requested"
        | "quote_presented"
        | "negotiation"
        | "won"
        | "lost"
      crm_timeline_event:
        | "lead_created"
        | "phone_call"
        | "whatsapp_sent"
        | "whatsapp_received"
        | "email_sent"
        | "email_received"
        | "quote_generated"
        | "status_changed"
      discount_type: "none" | "flat" | "percent"
      epc_project_status:
        | "draft"
        | "survey_phase"
        | "engineering_design"
        | "permitting"
        | "material_dispatched"
        | "installation_started"
        | "net_metering_pending"
        | "commissioned"
        | "closed"
        | "cancelled"
      escalation_status:
        | "open"
        | "acknowledged"
        | "investigating"
        | "resolved"
        | "closed"
      event_status: "pending" | "processed" | "failed"
      inverter_type: "on_grid" | "hybrid" | "micro" | "3_phase"
      invoice_status:
        | "draft"
        | "issued"
        | "posted"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      la_type: "single" | "multi"
      meter_type: "solar_meter" | "net_meter"
      milestone_type:
        | "survey_approved"
        | "structural_design_freeze"
        | "civil_foundation_done"
        | "panel_installation_done"
        | "inverter_wiring_done"
        | "net_metering_approved"
        | "discom_charging"
        | "handover"
      notif_channel: "in_app" | "email" | "whatsapp" | "sms" | "push"
      notif_status: "queued" | "sent" | "failed" | "read"
      operator_type:
        | "eq"
        | "neq"
        | "gt"
        | "gte"
        | "lt"
        | "lte"
        | "in"
        | "contains"
      payment_method:
        | "upi"
        | "neft"
        | "rtgs"
        | "cheque"
        | "cash"
        | "credit_card"
      permission_type: "feature" | "action" | "field"
      po_status:
        | "draft"
        | "submitted_for_approval"
        | "approved"
        | "sent"
        | "partially_received"
        | "received"
        | "closed"
        | "cancelled"
      project_type: "residential" | "commercial"
      quote_extended_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent"
        | "revision_requested"
        | "won"
        | "lost"
        | "expired"
      quote_status: "draft" | "sent" | "won" | "lost"
      roof_mount_type:
        | "rcc_flat"
        | "rcc_sloped"
        | "tin_shed"
        | "metal_sheet"
        | "ground_mount"
        | "elevated"
        | "custom"
      sale_type: "new" | "upgrade" | "referral"
      service_ticket_status:
        | "unassigned"
        | "scheduled"
        | "ongoing"
        | "resolved"
        | "failed"
      site_survey_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "needs_rework"
        | "cancelled"
      structure_material:
        | "gi_galvanized"
        | "hot_dip_galvanized"
        | "aluminum"
        | "stainless_steel"
        | "custom"
      system_category:
        | "on_grid"
        | "3_phase"
        | "micro_inverter"
        | "hybrid"
        | "upgrade"
        | "commercial"
      transfer_status: "draft" | "transit" | "completed" | "cancelled"
      vendor_status: "draft" | "active" | "suspended" | "blacklisted"
      work_order_status:
        | "draft"
        | "assigned"
        | "in_progress"
        | "completed"
        | "blocked"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acc_account_type: ["asset", "liability", "equity", "revenue", "expense"],
      acquisition_status: ["pending", "received", "cancelled"],
      amc_status: [
        "draft",
        "active",
        "pending_renewal",
        "expired",
        "suspended",
        "cancelled",
      ],
      approval_req_status: [
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "cancelled",
        "escalated",
      ],
      approval_status: ["pending", "approved", "rejected"],
      approval_step_type: ["sequential", "parallel"],
      battery_chemistry: ["LFP", "Li-Ion", "Lead-Acid", "NMC"],
      bom_section: [
        "solar_panels",
        "power_electronics",
        "metering",
        "mounting_structure",
        "electrical_protection",
        "earthing",
        "cabling",
        "wiring",
        "services",
      ],
      claim_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "resolved",
      ],
      crm_lead_status: [
        "new",
        "qualified",
        "site_survey_requested",
        "quote_presented",
        "negotiation",
        "won",
        "lost",
      ],
      crm_timeline_event: [
        "lead_created",
        "phone_call",
        "whatsapp_sent",
        "whatsapp_received",
        "email_sent",
        "email_received",
        "quote_generated",
        "status_changed",
      ],
      discount_type: ["none", "flat", "percent"],
      epc_project_status: [
        "draft",
        "survey_phase",
        "engineering_design",
        "permitting",
        "material_dispatched",
        "installation_started",
        "net_metering_pending",
        "commissioned",
        "closed",
        "cancelled",
      ],
      escalation_status: [
        "open",
        "acknowledged",
        "investigating",
        "resolved",
        "closed",
      ],
      event_status: ["pending", "processed", "failed"],
      inverter_type: ["on_grid", "hybrid", "micro", "3_phase"],
      invoice_status: [
        "draft",
        "issued",
        "posted",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      la_type: ["single", "multi"],
      meter_type: ["solar_meter", "net_meter"],
      milestone_type: [
        "survey_approved",
        "structural_design_freeze",
        "civil_foundation_done",
        "panel_installation_done",
        "inverter_wiring_done",
        "net_metering_approved",
        "discom_charging",
        "handover",
      ],
      notif_channel: ["in_app", "email", "whatsapp", "sms", "push"],
      notif_status: ["queued", "sent", "failed", "read"],
      operator_type: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"],
      payment_method: ["upi", "neft", "rtgs", "cheque", "cash", "credit_card"],
      permission_type: ["feature", "action", "field"],
      po_status: [
        "draft",
        "submitted_for_approval",
        "approved",
        "sent",
        "partially_received",
        "received",
        "closed",
        "cancelled",
      ],
      project_type: ["residential", "commercial"],
      quote_extended_status: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "revision_requested",
        "won",
        "lost",
        "expired",
      ],
      quote_status: ["draft", "sent", "won", "lost"],
      roof_mount_type: [
        "rcc_flat",
        "rcc_sloped",
        "tin_shed",
        "metal_sheet",
        "ground_mount",
        "elevated",
        "custom",
      ],
      sale_type: ["new", "upgrade", "referral"],
      service_ticket_status: [
        "unassigned",
        "scheduled",
        "ongoing",
        "resolved",
        "failed",
      ],
      site_survey_status: [
        "scheduled",
        "in_progress",
        "completed",
        "needs_rework",
        "cancelled",
      ],
      structure_material: [
        "gi_galvanized",
        "hot_dip_galvanized",
        "aluminum",
        "stainless_steel",
        "custom",
      ],
      system_category: [
        "on_grid",
        "3_phase",
        "micro_inverter",
        "hybrid",
        "upgrade",
        "commercial",
      ],
      transfer_status: ["draft", "transit", "completed", "cancelled"],
      vendor_status: ["draft", "active", "suspended", "blacklisted"],
      work_order_status: [
        "draft",
        "assigned",
        "in_progress",
        "completed",
        "blocked",
        "cancelled",
      ],
    },
  },
} as const
