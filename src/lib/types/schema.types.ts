// ============================================================
// ENERMASS — DATABASE TYPES (auto-generated from schema)
// DO NOT EDIT MANUALLY — regenerate when schema changes.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      acc_accounts: {
        Row: {
          id: string
          org_id: string
          code: string
          name: string
          type: Database['public']['Enums']['acc_account_type']
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          code: string
          name: string
          type: Database['public']['Enums']['acc_account_type']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          name?: string
          type?: Database['public']['Enums']['acc_account_type']
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      acc_adjustments: {
        Row: {
          id: string
          org_id: string
          invoice_id: string | null
          po_id: string | null
          adjustment_no: string
          adj_type: string
          amount: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id?: string | null
          po_id?: string | null
          adjustment_no: string
          adj_type: string
          amount: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          invoice_id?: string | null
          po_id?: string | null
          adjustment_no?: string
          adj_type?: string
          amount?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      acc_bank_statement_lines: {
        Row: {
          id: string
          statement_id: string
          transaction_date: string
          description: string
          amount: number
          is_reconciled: boolean
          payment_id: string | null
        }
        Insert: {
          id?: string
          statement_id: string
          transaction_date: string
          description: string
          amount: number
          is_reconciled?: boolean
          payment_id?: string | null
        }
        Update: {
          id?: string
          statement_id?: string
          transaction_date?: string
          description?: string
          amount?: number
          is_reconciled?: boolean
          payment_id?: string | null
        }
        Relationships: []
      }
      acc_bank_statements: {
        Row: {
          id: string
          org_id: string
          statement_date: string
          account_number: string
          opening_balance: number
          closing_balance: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          statement_date: string
          account_number: string
          opening_balance?: number
          closing_balance?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          statement_date?: string
          account_number?: string
          opening_balance?: number
          closing_balance?: number
          created_at?: string
        }
        Relationships: []
      }
      acc_invoices: {
        Row: {
          id: string
          org_id: string
          project_id: string
          invoice_number: string
          invoice_date: string
          due_date: string
          taxable_amount: number
          cgst_pct: number
          sgst_pct: number
          igst_pct: number
          cgst_amount: number | null
          sgst_amount: number | null
          igst_amount: number | null
          total_invoice: number | null
          tds_deducted: number
          status: Database['public']['Enums']['invoice_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          invoice_number: string
          invoice_date?: string
          due_date: string
          taxable_amount: number
          cgst_pct?: number
          sgst_pct?: number
          igst_pct?: number
          cgst_amount?: number | null
          sgst_amount?: number | null
          igst_amount?: number | null
          total_invoice?: number | null
          tds_deducted?: number
          status?: Database['public']['Enums']['invoice_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          invoice_number?: string
          invoice_date?: string
          due_date?: string
          taxable_amount?: number
          cgst_pct?: number
          sgst_pct?: number
          igst_pct?: number
          cgst_amount?: number | null
          sgst_amount?: number | null
          igst_amount?: number | null
          total_invoice?: number | null
          tds_deducted?: number
          status?: Database['public']['Enums']['invoice_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      acc_journal_entries: {
        Row: {
          id: string
          org_id: string
          entry_date: string
          reference_no: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          entry_date?: string
          reference_no?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          entry_date?: string
          reference_no?: string | null
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      acc_journal_lines: {
        Row: {
          id: string
          org_id: string
          entry_id: string
          account_id: string
          debit: number
          credit: number
          project_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          entry_id: string
          account_id: string
          debit?: number
          credit?: number
          project_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          entry_id?: string
          account_id?: string
          debit?: number
          credit?: number
          project_id?: string | null
        }
        Relationships: []
      }
      acc_payments: {
        Row: {
          id: string
          org_id: string
          invoice_id: string | null
          po_id: string | null
          payment_number: string
          payment_date: string
          amount: number
          method: Database['public']['Enums']['payment_method']
          reference_no: string | null
          tds_deducted: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          invoice_id?: string | null
          po_id?: string | null
          payment_number: string
          payment_date?: string
          amount: number
          method?: Database['public']['Enums']['payment_method']
          reference_no?: string | null
          tds_deducted?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          invoice_id?: string | null
          po_id?: string | null
          payment_number?: string
          payment_date?: string
          amount?: number
          method?: Database['public']['Enums']['payment_method']
          reference_no?: string | null
          tds_deducted?: number
          created_at?: string
        }
        Relationships: []
      }
      acquisition_bundles: {
        Row: {
          id: string
          acquisition_id: string
          bundle_preset_id: string | null
          name: string
          qty: number
          effective_bundle_price: number
          allocation_strategy: string
          gst_pct: number | null
          created_at: string
        }
        Insert: {
          id?: string
          acquisition_id: string
          bundle_preset_id?: string | null
          name: string
          qty?: number
          effective_bundle_price?: number
          allocation_strategy?: string
          gst_pct?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          acquisition_id?: string
          bundle_preset_id?: string | null
          name?: string
          qty?: number
          effective_bundle_price?: number
          allocation_strategy?: string
          gst_pct?: number | null
          created_at?: string
        }
        Relationships: []
      }
      acquisition_items: {
        Row: {
          id: string
          acquisition_id: string
          item_description: string
          category: Database['public']['Enums']['bom_section'] | null
          qty: number
          unit: string | null
          rate_per_unit: number
          gst_pct: number | null
          created_at: string
          acquisition_bundle_id: string | null
          catalog_item_id: string
        }
        Insert: {
          id?: string
          acquisition_id: string
          item_description: string
          category?: Database['public']['Enums']['bom_section'] | null
          qty?: number
          unit?: string | null
          rate_per_unit?: number
          gst_pct?: number | null
          created_at?: string
          acquisition_bundle_id?: string | null
          catalog_item_id: string
        }
        Update: {
          id?: string
          acquisition_id?: string
          item_description?: string
          category?: Database['public']['Enums']['bom_section'] | null
          qty?: number
          unit?: string | null
          rate_per_unit?: number
          gst_pct?: number | null
          created_at?: string
          acquisition_bundle_id?: string | null
          catalog_item_id?: string
        }
        Relationships: []
      }
      acquisitions: {
        Row: {
          id: string
          org_id: string
          vendor_id: string | null
          invoice_number: string | null
          invoice_date: string
          total_amount: number
          status: Database['public']['Enums']['acquisition_status']
          notes: string | null
          created_at: string
          updated_at: string
          grn_processed: boolean
        }
        Insert: {
          id?: string
          org_id: string
          vendor_id?: string | null
          invoice_number?: string | null
          invoice_date?: string
          total_amount?: number
          status?: Database['public']['Enums']['acquisition_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
          grn_processed?: boolean
        }
        Update: {
          id?: string
          org_id?: string
          vendor_id?: string | null
          invoice_number?: string | null
          invoice_date?: string
          total_amount?: number
          status?: Database['public']['Enums']['acquisition_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
          grn_processed?: boolean
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          org_id: string
          default_grid_tariff_inr: number
          default_validity_days: number
          electricity_inflation_pct: number
          orientation_factor: number
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          default_grid_tariff_inr?: number
          default_validity_days?: number
          electricity_inflation_pct?: number
          orientation_factor?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          default_grid_tariff_inr?: number
          default_validity_days?: number
          electricity_inflation_pct?: number
          orientation_factor?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_hsn_sac: {
        Row: {
          id: string
          code: string
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      tax_gst_rates: {
        Row: {
          id: string
          hsn_sac_id: string
          effective_from: string
          cgst_rate: number
          sgst_rate: number
          igst_rate: number
          cess_rate: number
        }
        Insert: {
          id?: string
          hsn_sac_id: string
          effective_from: string
          cgst_rate?: number
          sgst_rate?: number
          igst_rate?: number
          cess_rate?: number
        }
        Update: {
          id?: string
          hsn_sac_id?: string
          effective_from?: string
          cgst_rate?: number
          sgst_rate?: number
          igst_rate?: number
          cess_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_gst_rates_hsn_sac_id_fkey"
            columns: ["hsn_sac_id"]
            isOneToOne: false
            referencedRelation: "tax_hsn_sac"
            referencedColumns: ["id"]
          }
        ]
      }
      inv_cost_layers: {
        Row: {
          id: string
          org_id: string
          warehouse_id: string
          catalog_item_id: string
          qty: number
          remaining_qty: number
          unit_cost: number
        }
        Insert: {
          id?: string
          org_id?: string
          warehouse_id?: string
          catalog_item_id?: string
          qty?: number
          remaining_qty?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          org_id?: string
          warehouse_id?: string
          catalog_item_id?: string
          qty?: number
          remaining_qty?: number
          unit_cost?: number
        }
        Relationships: []
      }
      bom_categories: {
        Row: {
          id: string
          name: string
          display_order: number
          is_optional: boolean
        }
        Insert: {
          id?: string
          name: string
          display_order: number
          is_optional?: boolean
        }
        Update: {
          id?: string
          name?: string
          display_order?: number
          is_optional?: boolean
        }
        Relationships: []
      }
      bom_template_items: {
        Row: {
          id: string
          category_id: string
          sku_code: string
          description: string
          unit: string
          unit_rate_min: number | null
          unit_rate_max: number | null
          default_rate: number | null
          qty_formula: string | null
          is_survey_dependent: boolean
          civil_required_only: boolean
          notes: string | null
        }
        Insert: {
          id?: string
          category_id: string
          sku_code: string
          description: string
          unit: string
          unit_rate_min?: number | null
          unit_rate_max?: number | null
          default_rate?: number | null
          qty_formula?: string | null
          is_survey_dependent?: boolean
          civil_required_only?: boolean
          notes?: string | null
        }
        Update: {
          id?: string
          category_id?: string
          sku_code?: string
          description?: string
          unit?: string
          unit_rate_min?: number | null
          unit_rate_max?: number | null
          default_rate?: number | null
          qty_formula?: string | null
          is_survey_dependent?: boolean
          civil_required_only?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      bundle_preset_items: {
        Row: {
          id: string
          bundle_preset_id: string
          item_description: string
          category: Database['public']['Enums']['bom_section']
          qty: number
          unit: string
          base_cost: number
          allocated_cost_override: number | null
          gst_pct: number | null
          created_at: string
          catalog_item_id: string
        }
        Insert: {
          id?: string
          bundle_preset_id: string
          item_description: string
          category: Database['public']['Enums']['bom_section']
          qty?: number
          unit?: string
          base_cost?: number
          allocated_cost_override?: number | null
          gst_pct?: number | null
          created_at?: string
          catalog_item_id: string
        }
        Update: {
          id?: string
          bundle_preset_id?: string
          item_description?: string
          category?: Database['public']['Enums']['bom_section']
          qty?: number
          unit?: string
          base_cost?: number
          allocated_cost_override?: number | null
          gst_pct?: number | null
          created_at?: string
          catalog_item_id?: string
        }
        Relationships: []
      }
      bundle_presets: {
        Row: {
          id: string
          org_id: string
          vendor_id: string | null
          name: string
          effective_bundle_price: number
          allocation_strategy: string
          notes: string | null
          is_active: boolean
          gst_pct: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          org_id: string
          vendor_id?: string | null
          name: string
          effective_bundle_price?: number
          allocation_strategy?: string
          notes?: string | null
          is_active?: boolean
          gst_pct?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          org_id?: string
          vendor_id?: string | null
          name?: string
          effective_bundle_price?: number
          allocation_strategy?: string
          notes?: string | null
          is_active?: boolean
          gst_pct?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      calculation_schemes: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          applies_to: Database['public']['Enums']['project_type']
          max_capacity_kw: number
          max_absolute_subsidy: number
          is_active: boolean
          effective_from: string | null
          effective_to: string | null
          version: number
          created_at: string
          updated_at: string
          snapshot_locked: boolean
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          applies_to?: Database['public']['Enums']['project_type']
          max_capacity_kw?: number
          max_absolute_subsidy?: number
          is_active?: boolean
          effective_from?: string | null
          effective_to?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          snapshot_locked?: boolean
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          applies_to?: Database['public']['Enums']['project_type']
          max_capacity_kw?: number
          max_absolute_subsidy?: number
          is_active?: boolean
          effective_from?: string | null
          effective_to?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          snapshot_locked?: boolean
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          id: string
          org_id: string | null
          name: string
          category: Database['public']['Enums']['bom_section']
          item_type: string
          item_id: string | null
          sku: string | null
          unit: string
          gst_pct: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          category: Database['public']['Enums']['bom_section']
          item_type: string
          item_id?: string | null
          sku?: string | null
          unit?: string
          gst_pct?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          category?: Database['public']['Enums']['bom_section']
          item_type?: string
          item_id?: string | null
          sku?: string | null
          unit?: string
          gst_pct?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_margins: {
        Row: {
          id: string
          org_id: string
          category: Database['public']['Enums']['system_category']
          default_margin_pct: number
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          category: Database['public']['Enums']['system_category']
          default_margin_pct?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          category?: Database['public']['Enums']['system_category']
          default_margin_pct?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          id: string
          org_id: string
          first_name: string
          last_name: string | null
          phone: string
          email: string | null
          lead_source: string
          status: Database['public']['Enums']['crm_lead_status']
          monthly_bill: number | null
          roof_area_estimate: number | null
          assigned_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          first_name: string
          last_name?: string | null
          phone: string
          email?: string | null
          lead_source?: string
          status?: Database['public']['Enums']['crm_lead_status']
          monthly_bill?: number | null
          roof_area_estimate?: number | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          first_name?: string
          last_name?: string | null
          phone?: string
          email?: string | null
          lead_source?: string
          status?: Database['public']['Enums']['crm_lead_status']
          monthly_bill?: number | null
          roof_area_estimate?: number | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_opportunities: {
        Row: {
          id: string
          org_id: string
          lead_id: string
          title: string
          expected_value: number
          probability_pct: number
          stage: string
          close_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          lead_id: string
          title: string
          expected_value?: number
          probability_pct?: number
          stage?: string
          close_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          lead_id?: string
          title?: string
          expected_value?: number
          probability_pct?: number
          stage?: string
          close_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_site_surveys: {
        Row: {
          id: string
          org_id: string
          lead_id: string
          quote_id: string | null
          conducted_by: string | null
          conducted_at: string | null
          status: string
          roof_area_sqft: number | null
          roof_type: string | null
          roof_height_ft: number | null
          shadowing_notes: string | null
          existing_load_kw: number | null
          sanctioned_load_kw: number | null
          meter_phase: string | null
          distance_inverter_to_meter_m: number | null
          distance_panel_to_inverter_m: number | null
          discom_name: string | null
          consumer_number: string | null
          net_metering_available: boolean | null
          photo_urls: Json | null
          survey_notes: string | null
          waived_by: string | null
          waive_reason: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          lead_id: string
          quote_id?: string | null
          conducted_by?: string | null
          conducted_at?: string | null
          status?: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          roof_height_ft?: number | null
          shadowing_notes?: string | null
          existing_load_kw?: number | null
          sanctioned_load_kw?: number | null
          meter_phase?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          discom_name?: string | null
          consumer_number?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json | null
          survey_notes?: string | null
          waived_by?: string | null
          waive_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          lead_id?: string
          quote_id?: string | null
          conducted_by?: string | null
          conducted_at?: string | null
          status?: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          roof_height_ft?: number | null
          shadowing_notes?: string | null
          existing_load_kw?: number | null
          sanctioned_load_kw?: number | null
          meter_phase?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          discom_name?: string | null
          consumer_number?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json | null
          survey_notes?: string | null
          waived_by?: string | null
          waive_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_timeline: {
        Row: {
          id: string
          lead_id: string
          event_type: string
          title: string
          description: string | null
          logged_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          event_type: string
          title: string
          description?: string | null
          logged_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          event_type?: string
          title?: string
          description?: string | null
          logged_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      custom_presets: {
        Row: {
          id: string
          org_id: string | null
          user_id: string | null
          name: string
          capacity_kw: number
          config_json: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          user_id?: string | null
          name: string
          capacity_kw: number
          config_json?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          user_id?: string | null
          name?: string
          capacity_kw?: number
          config_json?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      draft_quotes: {
        Row: {
          id: string
          user_id: string
          org_id: string
          state_json: Json
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          state_json?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          state_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      engineering_rules_metadata_deprecated: {
        Row: {
          id: string
          rule_name: string
          formula: string
          inputs: string[]
          output_var: string | null
          category: string
          source_workbook: string | null
          source_sheet: string | null
          source_row: number | null
          metadata_json: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rule_name: string
          formula: string
          inputs: string[]
          output_var?: string | null
          category: string
          source_workbook?: string | null
          source_sheet?: string | null
          source_row?: number | null
          metadata_json?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rule_name?: string
          formula?: string
          inputs?: string[]
          output_var?: string | null
          category?: string
          source_workbook?: string | null
          source_sheet?: string | null
          source_row?: number | null
          metadata_json?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      epc_commissioning_reports: {
        Row: {
          id: string
          org_id: string
          project_id: string
          commissioned_by: string
          net_meter_number: string | null
          capacity_tested_kw: number | null
          is_approved: boolean
          customer_signoff: boolean
          signoff_date: string | null
          remarks: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          commissioned_by: string
          net_meter_number?: string | null
          capacity_tested_kw?: number | null
          is_approved?: boolean
          customer_signoff?: boolean
          signoff_date?: string | null
          remarks?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          commissioned_by?: string
          net_meter_number?: string | null
          capacity_tested_kw?: number | null
          is_approved?: boolean
          customer_signoff?: boolean
          signoff_date?: string | null
          remarks?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      epc_project_milestones: {
        Row: {
          id: string
          project_id: string
          milestone: Database['public']['Enums']['milestone_type']
          target_date: string
          actual_date: string | null
          status: string
          completed_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          milestone: Database['public']['Enums']['milestone_type']
          target_date: string
          actual_date?: string | null
          status?: string
          completed_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          milestone?: Database['public']['Enums']['milestone_type']
          target_date?: string
          actual_date?: string | null
          status?: string
          completed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      epc_projects: {
        Row: {
          id: string
          org_id: string
          quote_id: string | null
          project_number: string
          status: Database['public']['Enums']['epc_project_status']
          assigned_pm_id: string | null
          planned_start: string | null
          planned_end: string | null
          actual_start: string | null
          actual_end: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          org_id: string
          quote_id?: string | null
          project_number: string
          status?: Database['public']['Enums']['epc_project_status']
          assigned_pm_id?: string | null
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          org_id?: string
          quote_id?: string | null
          project_number?: string
          status?: Database['public']['Enums']['epc_project_status']
          assigned_pm_id?: string | null
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      epc_site_surveys: {
        Row: {
          id: string
          project_id: string
          surveyor_id: string | null
          surveyed_at: string | null
          roof_mount_type: Database['public']['Enums']['roof_mount_type']
          tilt_angle_deg: number | null
          usable_area_sqft: number | null
          roof_load_capacity_kgm2: number | null
          distribution_distance_m: number | null
          shading_percentage: number | null
          solar_access_pct: number | null
          survey_notes: string | null
          gps_lat: number | null
          gps_lng: number | null
          created_at: string
          status: Database['public']['Enums']['site_survey_status']
        }
        Insert: {
          id?: string
          project_id: string
          surveyor_id?: string | null
          surveyed_at?: string | null
          roof_mount_type?: Database['public']['Enums']['roof_mount_type']
          tilt_angle_deg?: number | null
          usable_area_sqft?: number | null
          roof_load_capacity_kgm2?: number | null
          distribution_distance_m?: number | null
          shading_percentage?: number | null
          solar_access_pct?: number | null
          survey_notes?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          created_at?: string
          status?: Database['public']['Enums']['site_survey_status']
        }
        Update: {
          id?: string
          project_id?: string
          surveyor_id?: string | null
          surveyed_at?: string | null
          roof_mount_type?: Database['public']['Enums']['roof_mount_type']
          tilt_angle_deg?: number | null
          usable_area_sqft?: number | null
          roof_load_capacity_kgm2?: number | null
          distribution_distance_m?: number | null
          shading_percentage?: number | null
          solar_access_pct?: number | null
          survey_notes?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          created_at?: string
          status?: Database['public']['Enums']['site_survey_status']
        }
        Relationships: []
      }
      epc_work_orders: {
        Row: {
          id: string
          project_id: string
          wo_number: string
          assigned_crew_id: string | null
          instructions: string | null
          scheduled_start: string
          scheduled_end: string | null
          status: Database['public']['Enums']['work_order_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          wo_number: string
          assigned_crew_id?: string | null
          instructions?: string | null
          scheduled_start: string
          scheduled_end?: string | null
          status?: Database['public']['Enums']['work_order_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          wo_number?: string
          assigned_crew_id?: string | null
          instructions?: string | null
          scheduled_start?: string
          scheduled_end?: string | null
          status?: Database['public']['Enums']['work_order_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      eq_batteries: {
        Row: {
          id: string
          org_id: string | null
          brand: string
          model: string
          capacity_kwh: number
          voltage_v: number | null
          chemistry: Database['public']['Enums']['battery_chemistry']
          dod_pct: number
          selling_price: number
          gst_pct: number
          description: string | null
          is_active: boolean
          is_custom: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          brand: string
          model: string
          capacity_kwh: number
          voltage_v?: number | null
          chemistry?: Database['public']['Enums']['battery_chemistry']
          dod_pct?: number
          selling_price: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          brand?: string
          model?: string
          capacity_kwh?: number
          voltage_v?: number | null
          chemistry?: Database['public']['Enums']['battery_chemistry']
          dod_pct?: number
          selling_price?: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_bom_items: {
        Row: {
          id: string
          org_id: string | null
          section: Database['public']['Enums']['bom_section']
          sub_type: string
          description: string
          remarks: string | null
          unit: string
          selling_price: number
          gst_pct: number
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          section: Database['public']['Enums']['bom_section']
          sub_type: string
          description: string
          remarks?: string | null
          unit?: string
          selling_price: number
          gst_pct?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          section?: Database['public']['Enums']['bom_section']
          sub_type?: string
          description?: string
          remarks?: string | null
          unit?: string
          selling_price?: number
          gst_pct?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_communication_devices: {
        Row: {
          id: string
          org_id: string | null
          brand: string
          model: string
          compatible_inverter_brand: string | null
          selling_price: number
          gst_pct: number
          description: string | null
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          brand: string
          model: string
          compatible_inverter_brand?: string | null
          selling_price: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          brand?: string
          model?: string
          compatible_inverter_brand?: string | null
          selling_price?: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_inverters: {
        Row: {
          id: string
          org_id: string | null
          brand: string
          model: string
          capacity_kw: number
          inverter_type: Database['public']['Enums']['inverter_type']
          phases: number
          selling_price: number
          gst_pct: number
          description: string | null
          is_active: boolean
          is_custom: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          brand: string
          model: string
          capacity_kw: number
          inverter_type: Database['public']['Enums']['inverter_type']
          phases?: number
          selling_price: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          brand?: string
          model?: string
          capacity_kw?: number
          inverter_type?: Database['public']['Enums']['inverter_type']
          phases?: number
          selling_price?: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_lightning_arresters: {
        Row: {
          id: string
          org_id: string | null
          la_type: Database['public']['Enums']['la_type']
          brand: string | null
          model: string
          max_capacity_kw: number | null
          selling_price: number
          gst_pct: number
          description: string | null
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          la_type: Database['public']['Enums']['la_type']
          brand?: string | null
          model: string
          max_capacity_kw?: number | null
          selling_price: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          la_type?: Database['public']['Enums']['la_type']
          brand?: string | null
          model?: string
          max_capacity_kw?: number | null
          selling_price?: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_meters: {
        Row: {
          id: string
          org_id: string | null
          meter_type: Database['public']['Enums']['meter_type']
          brand: string | null
          model: string
          phases: number
          is_smart: boolean
          selling_price: number
          gst_pct: number
          description: string | null
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          meter_type: Database['public']['Enums']['meter_type']
          brand?: string | null
          model: string
          phases?: number
          is_smart?: boolean
          selling_price: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          meter_type?: Database['public']['Enums']['meter_type']
          brand?: string | null
          model?: string
          phases?: number
          is_smart?: boolean
          selling_price?: number
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_mounting_structures: {
        Row: {
          id: string
          org_id: string | null
          name: string
          material: Database['public']['Enums']['structure_material']
          roof_mount_type: Database['public']['Enums']['roof_mount_type']
          elevation_height_mm: number
          raw_material_rate: number
          fabrication_rate: number
          galvanizing_rate: number
          rate_per_kg: number | null
          wastage_pct: number
          fastener_weight_pct: number
          base_weight_kg: number
          selling_price: number | null
          gst_pct: number
          description: string | null
          is_active: boolean
          is_custom: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          per_watt_rate: number | null
          buy_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          material?: Database['public']['Enums']['structure_material']
          roof_mount_type?: Database['public']['Enums']['roof_mount_type']
          elevation_height_mm?: number
          raw_material_rate?: number
          fabrication_rate?: number
          galvanizing_rate?: number
          rate_per_kg?: number | null
          wastage_pct?: number
          fastener_weight_pct?: number
          base_weight_kg?: number
          selling_price?: number | null
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          per_watt_rate?: number | null
          buy_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          material?: Database['public']['Enums']['structure_material']
          roof_mount_type?: Database['public']['Enums']['roof_mount_type']
          elevation_height_mm?: number
          raw_material_rate?: number
          fabrication_rate?: number
          galvanizing_rate?: number
          rate_per_kg?: number | null
          wastage_pct?: number
          fastener_weight_pct?: number
          base_weight_kg?: number
          selling_price?: number | null
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          per_watt_rate?: number | null
          buy_price?: number
        }
        Relationships: []
      }
      eq_orientation_multipliers: {
        Row: {
          id: string
          org_id: string | null
          orientation: string
          multiplier: number
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          orientation: string
          multiplier: number
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string | null
          orientation?: string
          multiplier?: number
          created_at?: string | null
        }
        Relationships: []
      }
      eq_panels: {
        Row: {
          id: string
          org_id: string | null
          brand: string
          model: string
          wattage_w: number
          panel_type: string
          gst_pct: number
          description: string | null
          is_active: boolean
          is_custom: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          buy_price: number
          selling_price: number
        }
        Insert: {
          id?: string
          org_id?: string | null
          brand: string
          model: string
          wattage_w: number
          panel_type?: string
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
          selling_price?: number
        }
        Update: {
          id?: string
          org_id?: string | null
          brand?: string
          model?: string
          wattage_w?: number
          panel_type?: string
          gst_pct?: number
          description?: string | null
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          buy_price?: number
          selling_price?: number
        }
        Relationships: []
      }
      eq_structure_addons: {
        Row: {
          id: string
          org_id: string | null
          name: string
          material: string
          unit: string
          rate_per_unit: number
          buy_price: number
          gst_pct: number
          is_active: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          material?: string
          unit?: string
          rate_per_unit: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          material?: string
          unit?: string
          rate_per_unit?: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      eq_structure_bom: {
        Row: {
          id: string
          component_id: string
          structure_id: string
          capacity_kw_min: number
          capacity_kw_max: number
          panel_qty: number | null
          qty: number
          total_weight_kg: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          component_id: string
          structure_id: string
          capacity_kw_min: number
          capacity_kw_max: number
          panel_qty?: number | null
          qty?: number
          total_weight_kg?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          component_id?: string
          structure_id?: string
          capacity_kw_min?: number
          capacity_kw_max?: number
          panel_qty?: number | null
          qty?: number
          total_weight_kg?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      eq_structure_components: {
        Row: {
          id: string
          org_id: string | null
          structure_id: string | null
          category: string
          name: string
          description: string | null
          unit: string
          selling_price: number
          buy_price: number
          gst_pct: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          structure_id?: string | null
          category: string
          name: string
          description?: string | null
          unit?: string
          selling_price?: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          structure_id?: string | null
          category?: string
          name?: string
          description?: string | null
          unit?: string
          selling_price?: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_amc_contracts: {
        Row: {
          id: string
          org_id: string
          customer_name: string
          customer_phone: string
          asset_id: string | null
          contract_number: string
          start_date: string
          end_date: string
          amc_price: number
          visits_per_year: number
          completed_visits: number
          status: Database['public']['Enums']['amc_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          customer_name: string
          customer_phone: string
          asset_id?: string | null
          contract_number: string
          start_date: string
          end_date: string
          amc_price?: number
          visits_per_year?: number
          completed_visits?: number
          status?: Database['public']['Enums']['amc_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          customer_name?: string
          customer_phone?: string
          asset_id?: string | null
          contract_number?: string
          start_date?: string
          end_date?: string
          amc_price?: number
          visits_per_year?: number
          completed_visits?: number
          status?: Database['public']['Enums']['amc_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_amc_visits: {
        Row: {
          id: string
          org_id: string
          contract_id: string
          visit_date: string
          visit_type: string
          conducted_by: string | null
          status: string
          notes: string | null
          photos: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          contract_id: string
          visit_date: string
          visit_type?: string
          conducted_by?: string | null
          status?: string
          notes?: string | null
          photos?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          contract_id?: string
          visit_date?: string
          visit_type?: string
          conducted_by?: string | null
          status?: string
          notes?: string | null
          photos?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_checklist_items: {
        Row: {
          id: string
          ticket_id: string
          task_label: string
          is_checked: boolean
          measured_value: string | null
          photo_s3_key: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          ticket_id: string
          task_label: string
          is_checked?: boolean
          measured_value?: string | null
          photo_s3_key?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          ticket_id?: string
          task_label?: string
          is_checked?: boolean
          measured_value?: string | null
          photo_s3_key?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      field_customer_assets: {
        Row: {
          id: string
          org_id: string
          project_id: string | null
          item_type: string
          brand: string
          model: string
          serial_number: string
          installation_date: string
          warranty_expiry_date: string
          warranty_certificate: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id?: string | null
          item_type: string
          brand: string
          model: string
          serial_number: string
          installation_date?: string
          warranty_expiry_date: string
          warranty_certificate?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string | null
          item_type?: string
          brand?: string
          model?: string
          serial_number?: string
          installation_date?: string
          warranty_expiry_date?: string
          warranty_certificate?: string | null
          created_at?: string
        }
        Relationships: []
      }
      field_service_tickets: {
        Row: {
          id: string
          project_id: string | null
          ticket_number: string
          status: Database['public']['Enums']['service_ticket_status']
          assigned_crew_id: string | null
          scheduled_date: string
          completed_at: string | null
          issue_details: string
          action_taken: string | null
          arrival_lat: number | null
          arrival_lng: number | null
          created_at: string
          updated_at: string
          amc_contract_id: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          ticket_number: string
          status?: Database['public']['Enums']['service_ticket_status']
          assigned_crew_id?: string | null
          scheduled_date: string
          completed_at?: string | null
          issue_details: string
          action_taken?: string | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          created_at?: string
          updated_at?: string
          amc_contract_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          ticket_number?: string
          status?: Database['public']['Enums']['service_ticket_status']
          assigned_crew_id?: string | null
          scheduled_date?: string
          completed_at?: string | null
          issue_details?: string
          action_taken?: string | null
          arrival_lat?: number | null
          arrival_lng?: number | null
          created_at?: string
          updated_at?: string
          amc_contract_id?: string | null
        }
        Relationships: []
      }
      gst_master_deprecated: {
        Row: {
          id: string
          gst_pct: number
          source_workbook: string | null
          source_sheet: string | null
          source_row: number | null
          gst_amount: number | null
          gst_rate: number | null
          effective_gst_rate_on_total: number | null
          gst_formula: string | null
          gst_formula_inputs: string[] | null
          source_gst_cell: string | null
          pricing_formula: string | null
          total_price_formula: string | null
          total_price_formula_inputs: string[] | null
          source_total_cell: string | null
          total_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gst_pct: number
          source_workbook?: string | null
          source_sheet?: string | null
          source_row?: number | null
          gst_amount?: number | null
          gst_rate?: number | null
          effective_gst_rate_on_total?: number | null
          gst_formula?: string | null
          gst_formula_inputs?: string[] | null
          source_gst_cell?: string | null
          pricing_formula?: string | null
          total_price_formula?: string | null
          total_price_formula_inputs?: string[] | null
          source_total_cell?: string | null
          total_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gst_pct?: number
          source_workbook?: string | null
          source_sheet?: string | null
          source_row?: number | null
          gst_amount?: number | null
          gst_rate?: number | null
          effective_gst_rate_on_total?: number | null
          gst_formula?: string | null
          gst_formula_inputs?: string[] | null
          source_gst_cell?: string | null
          pricing_formula?: string | null
          total_price_formula?: string | null
          total_price_formula_inputs?: string[] | null
          source_total_cell?: string | null
          total_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inv_serialized_items: {
        Row: {
          id: string
          org_id: string
          serial_number: string
          item_type: string | null
          item_id: string | null
          warehouse_id: string | null
          project_id: string | null
          status: string
          updated_at: string
          catalog_item_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          serial_number: string
          item_type?: string | null
          item_id?: string | null
          warehouse_id?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          catalog_item_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          serial_number?: string
          item_type?: string | null
          item_id?: string | null
          warehouse_id?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          catalog_item_id?: string | null
        }
        Relationships: []
      }
      inv_stock_balances: {
        Row: {
          id: string
          warehouse_id: string
          item_type: string | null
          item_id: string | null
          qty_on_hand: number
          qty_reserved: number
          qty_damaged: number
          wac_price: number
          created_at: string
          updated_at: string
          catalog_item_id: string
        }
        Insert: {
          id?: string
          warehouse_id: string
          item_type?: string | null
          item_id?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          qty_damaged?: number
          wac_price?: number
          created_at?: string
          updated_at?: string
          catalog_item_id: string
        }
        Update: {
          id?: string
          warehouse_id?: string
          item_type?: string | null
          item_id?: string | null
          qty_on_hand?: number
          qty_reserved?: number
          qty_damaged?: number
          wac_price?: number
          created_at?: string
          updated_at?: string
          catalog_item_id?: string
        }
        Relationships: []
      }
      inv_stock_transactions: {
        Row: {
          id: string
          org_id: string
          project_id: string | null
          warehouse_id: string
          item_type: string | null
          item_id: string | null
          transaction_type: string
          qty: number
          unit_cost_wac: number
          reference_id: string | null
          created_at: string
          catalog_item_id: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id?: string | null
          warehouse_id: string
          item_type?: string | null
          item_id?: string | null
          transaction_type: string
          qty: number
          unit_cost_wac: number
          reference_id?: string | null
          created_at?: string
          catalog_item_id: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string | null
          warehouse_id?: string
          item_type?: string | null
          item_id?: string | null
          transaction_type?: string
          qty?: number
          unit_cost_wac?: number
          reference_id?: string | null
          created_at?: string
          catalog_item_id?: string
        }
        Relationships: []
      }
      inv_transfer_items: {
        Row: {
          id: string
          transfer_id: string
          item_type: string | null
          item_id: string | null
          qty: number
          serials: string[] | null
          catalog_item_id: string | null
        }
        Insert: {
          id?: string
          transfer_id: string
          item_type?: string | null
          item_id?: string | null
          qty: number
          serials?: string[] | null
          catalog_item_id?: string | null
        }
        Update: {
          id?: string
          transfer_id?: string
          item_type?: string | null
          item_id?: string | null
          qty?: number
          serials?: string[] | null
          catalog_item_id?: string | null
        }
        Relationships: []
      }
      inv_transfers: {
        Row: {
          id: string
          org_id: string
          transfer_number: string
          from_warehouse_id: string
          to_warehouse_id: string
          status: Database['public']['Enums']['transfer_status']
          shipped_at: string | null
          received_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          transfer_number: string
          from_warehouse_id: string
          to_warehouse_id: string
          status?: Database['public']['Enums']['transfer_status']
          shipped_at?: string | null
          received_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          transfer_number?: string
          from_warehouse_id?: string
          to_warehouse_id?: string
          status?: Database['public']['Enums']['transfer_status']
          shipped_at?: string | null
          received_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inv_warehouses: {
        Row: {
          id: string
          org_id: string
          name: string
          code: string
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          code: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          code?: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_ledger: {
        Row: {
          id: string
          org_id: string
          item_description: string
          category: Database['public']['Enums']['bom_section'] | null
          change_qty: number
          transaction_type: string
          reference_id: string | null
          rate_at_time: number | null
          created_at: string
          catalog_item_id: string
          acquisition_item_id: string | null
          processed_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          item_description: string
          category?: Database['public']['Enums']['bom_section'] | null
          change_qty: number
          transaction_type: string
          reference_id?: string | null
          rate_at_time?: number | null
          created_at?: string
          catalog_item_id: string
          acquisition_item_id?: string | null
          processed_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          item_description?: string
          category?: Database['public']['Enums']['bom_section'] | null
          change_qty?: number
          transaction_type?: string
          reference_id?: string | null
          rate_at_time?: number | null
          created_at?: string
          catalog_item_id?: string
          acquisition_item_id?: string | null
          processed_at?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          id: string
          item_id: string
          project_id: string
          from_state: string | null
          to_state: string
          quantity: number
          moved_by: string | null
          moved_at: string
          vehicle_number: string | null
          driver_contact: string | null
          site_received_by: string | null
          site_received_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          project_id: string
          from_state?: string | null
          to_state: string
          quantity: number
          moved_by?: string | null
          moved_at?: string
          vehicle_number?: string | null
          driver_contact?: string | null
          site_received_by?: string | null
          site_received_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          project_id?: string
          from_state?: string | null
          to_state?: string
          quantity?: number
          moved_by?: string | null
          moved_at?: string
          vehicle_number?: string | null
          driver_contact?: string | null
          site_received_by?: string | null
          site_received_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      inventory_summary: {
        Row: {
          org_id: string
          item_description: string
          category: Database['public']['Enums']['bom_section'] | null
          current_qty: number
          weighted_avg_cost: number
          last_updated: string
          catalog_item_id: string
          reorder_level: number
        }
        Insert: {
          org_id: string
          item_description: string
          category?: Database['public']['Enums']['bom_section'] | null
          current_qty?: number
          weighted_avg_cost?: number
          last_updated?: string
          catalog_item_id: string
          reorder_level?: number
        }
        Update: {
          org_id?: string
          item_description?: string
          category?: Database['public']['Enums']['bom_section'] | null
          current_qty?: number
          weighted_avg_cost?: number
          last_updated?: string
          catalog_item_id?: string
          reorder_level?: number
        }
        Relationships: []
      }
      ladder_templates: {
        Row: {
          id: string
          template: string
          length_m: number
          cost: number
          cost_per_meter: number
          created_at: string
        }
        Insert: {
          id?: string
          template: string
          length_m: number
          cost: number
          cost_per_meter: number
          created_at?: string
        }
        Update: {
          id?: string
          template?: string
          length_m?: number
          cost?: number
          cost_per_meter?: number
          created_at?: string
        }
        Relationships: []
      }
      master_data_changes_log: {
        Row: {
          id: string
          import_batch_id: string | null
          entity_type: string
          entity_id: string
          change_type: string
          old_values: Json | null
          new_values: Json | null
          logged_at: string
        }
        Insert: {
          id?: string
          import_batch_id?: string | null
          entity_type: string
          entity_id: string
          change_type: string
          old_values?: Json | null
          new_values?: Json | null
          logged_at?: string
        }
        Update: {
          id?: string
          import_batch_id?: string | null
          entity_type?: string
          entity_id?: string
          change_type?: string
          old_values?: Json | null
          new_values?: Json | null
          logged_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
      net_metering_applications: {
        Row: {
          id: string
          project_id: string
          discom_name: string
          consumer_number: string
          current_stage: string
          application_date: string | null
          registration_number: string | null
          inspection_date: string | null
          net_meter_serial: string | null
          commissioning_cert_url: string | null
          document_urls: Json
          estimated_completion_date: string | null
          notes: string | null
          last_updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          discom_name: string
          consumer_number: string
          current_stage?: string
          application_date?: string | null
          registration_number?: string | null
          inspection_date?: string | null
          net_meter_serial?: string | null
          commissioning_cert_url?: string | null
          document_urls?: Json
          estimated_completion_date?: string | null
          notes?: string | null
          last_updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          discom_name?: string
          consumer_number?: string
          current_stage?: string
          application_date?: string | null
          registration_number?: string | null
          inspection_date?: string | null
          net_meter_serial?: string | null
          commissioning_cert_url?: string | null
          document_urls?: Json
          estimated_completion_date?: string | null
          notes?: string | null
          last_updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organisations: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          state: string | null
          pincode: string | null
          phone: string | null
          email: string | null
          gstin: string | null
          logo_url: string | null
          website: string | null
          quote_counter: number
          quote_prefix: string
          version: number
          created_at: string
          updated_at: string
          project_counter: number
          po_counter: number
          grn_counter: number
          invoice_counter: number
          transfer_counter: number
          work_order_counter: number
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          logo_url?: string | null
          website?: string | null
          quote_counter?: number
          quote_prefix?: string
          version?: number
          created_at?: string
          updated_at?: string
          project_counter?: number
          po_counter?: number
          grn_counter?: number
          invoice_counter?: number
          transfer_counter?: number
          work_order_counter?: number
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          gstin?: string | null
          logo_url?: string | null
          website?: string | null
          quote_counter?: number
          quote_prefix?: string
          version?: number
          created_at?: string
          updated_at?: string
          project_counter?: number
          po_counter?: number
          grn_counter?: number
          invoice_counter?: number
          transfer_counter?: number
          work_order_counter?: number
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          id: string
          quote_id: string
          milestone_name: string
          trigger_event: string
          percent: number
          amount: number
          due_date: string | null
          paid_at: string | null
          payment_reference: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          milestone_name: string
          trigger_event: string
          percent: number
          amount: number
          due_date?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          milestone_name?: string
          trigger_event?: string
          percent?: number
          amount?: number
          due_date?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          created_at?: string
        }
        Relationships: []
      }
      preset_favorites: {
        Row: {
          preset_id: string
          user_id: string
          created_at: string | null
        }
        Insert: {
          preset_id: string
          user_id: string
          created_at?: string | null
        }
        Update: {
          preset_id?: string
          user_id?: string
          created_at?: string | null
        }
        Relationships: []
      }
      preset_line_items: {
        Row: {
          id: string
          preset_id: string
          org_id: string | null
          category: string
          catalog_item_id: string | null
          catalog_type: string | null
          sku_code: string | null
          description: string
          brand: string | null
          model: string | null
          unit: string
          quantity: number
          unit_rate: number
          is_included: boolean
          is_survey_dependent: boolean
          sort_order: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          preset_id: string
          org_id?: string | null
          category: string
          catalog_item_id?: string | null
          catalog_type?: string | null
          sku_code?: string | null
          description: string
          brand?: string | null
          model?: string | null
          unit?: string
          quantity?: number
          unit_rate?: number
          is_included?: boolean
          is_survey_dependent?: boolean
          sort_order?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          preset_id?: string
          org_id?: string | null
          category?: string
          catalog_item_id?: string | null
          catalog_type?: string | null
          sku_code?: string | null
          description?: string
          brand?: string | null
          model?: string | null
          unit?: string
          quantity?: number
          unit_rate?: number
          is_included?: boolean
          is_survey_dependent?: boolean
          sort_order?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      preset_tags: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          color?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string | null
        }
        Relationships: []
      }
      preset_usage_history: {
        Row: {
          id: string
          preset_id: string | null
          user_id: string | null
          used_at: string | null
        }
        Insert: {
          id?: string
          preset_id?: string | null
          user_id?: string | null
          used_at?: string | null
        }
        Update: {
          id?: string
          preset_id?: string | null
          user_id?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      pricing_reference_deprecated: {
        Row: {
          id: string
          capacity_kw: number
          panels: number
          inverter_kw: number | null
          type: string
          beneficiary_contribution: number
          subsidy: number | null
          system_price: number
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string
          imported_by: string | null
        }
        Insert: {
          id?: string
          capacity_kw: number
          panels: number
          inverter_kw?: number | null
          type: string
          beneficiary_contribution: number
          subsidy?: number | null
          system_price: number
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string
          imported_by?: string | null
        }
        Update: {
          id?: string
          capacity_kw?: number
          panels?: number
          inverter_kw?: number | null
          type?: string
          beneficiary_contribution?: number
          subsidy?: number | null
          system_price?: number
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string
          imported_by?: string | null
        }
        Relationships: []
      }
      proc_goods_receipt_notes: {
        Row: {
          id: string
          org_id: string
          po_id: string
          warehouse_id: string
          grn_number: string
          receipt_date: string
          created_at: string
          status: string
          is_processed: boolean
          processed_at: string | null
          created_by: string | null
          idempotency_key: string | null
        }
        Insert: {
          id?: string
          org_id: string
          po_id: string
          warehouse_id: string
          grn_number: string
          receipt_date?: string
          created_at?: string
          status?: string
          is_processed?: boolean
          processed_at?: string | null
          created_by?: string | null
          idempotency_key?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          po_id?: string
          warehouse_id?: string
          grn_number?: string
          receipt_date?: string
          created_at?: string
          status?: string
          is_processed?: boolean
          processed_at?: string | null
          created_by?: string | null
          idempotency_key?: string | null
        }
        Relationships: []
      }
      proc_grn_items: {
        Row: {
          id: string
          grn_id: string
          item_type: string | null
          item_id: string | null
          qty_received: number
          serials: string[] | null
          catalog_item_id: string
          item_description: string | null
          unit: string
        }
        Insert: {
          id?: string
          grn_id: string
          item_type?: string | null
          item_id?: string | null
          qty_received: number
          serials?: string[] | null
          catalog_item_id: string
          item_description?: string | null
          unit?: string
        }
        Update: {
          id?: string
          grn_id?: string
          item_type?: string | null
          item_id?: string | null
          qty_received?: number
          serials?: string[] | null
          catalog_item_id?: string
          item_description?: string | null
          unit?: string
        }
        Relationships: []
      }
      proc_po_items: {
        Row: {
          id: string
          po_id: string
          item_type: string | null
          item_id: string | null
          qty_ordered: number
          qty_received: number
          unit_price: number
          gst_pct: number
          catalog_item_id: string
          item_description: string | null
          unit: string
          estimated_rate: number | null
          category: string | null
          is_pr_item: boolean
        }
        Insert: {
          id?: string
          po_id: string
          item_type?: string | null
          item_id?: string | null
          qty_ordered: number
          qty_received?: number
          unit_price: number
          gst_pct?: number
          catalog_item_id: string
          item_description?: string | null
          unit?: string
          estimated_rate?: number | null
          category?: string | null
          is_pr_item?: boolean
        }
        Update: {
          id?: string
          po_id?: string
          item_type?: string | null
          item_id?: string | null
          qty_ordered?: number
          qty_received?: number
          unit_price?: number
          gst_pct?: number
          catalog_item_id?: string
          item_description?: string | null
          unit?: string
          estimated_rate?: number | null
          category?: string | null
          is_pr_item?: boolean
        }
        Relationships: []
      }
      proc_purchase_orders: {
        Row: {
          id: string
          org_id: string
          vendor_id: string
          po_number: string
          status: Database['public']['Enums']['po_status']
          delivery_date: string | null
          total_taxable: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          total_amount: number
          created_at: string
          updated_at: string
          version: number
          project_id: string | null
          requested_by: string | null
          pr_status: string
          notes: string | null
          items_count: number
        }
        Insert: {
          id?: string
          org_id: string
          vendor_id: string
          po_number: string
          status?: Database['public']['Enums']['po_status']
          delivery_date?: string | null
          total_taxable?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_amount?: number
          created_at?: string
          updated_at?: string
          version?: number
          project_id?: string | null
          requested_by?: string | null
          pr_status?: string
          notes?: string | null
          items_count?: number
        }
        Update: {
          id?: string
          org_id?: string
          vendor_id?: string
          po_number?: string
          status?: Database['public']['Enums']['po_status']
          delivery_date?: string | null
          total_taxable?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          total_amount?: number
          created_at?: string
          updated_at?: string
          version?: number
          project_id?: string | null
          requested_by?: string | null
          pr_status?: string
          notes?: string | null
          items_count?: number
        }
        Relationships: []
      }
      proc_rfq_items: {
        Row: {
          id: string
          rfq_id: string
          item_type: string | null
          item_id: string | null
          qty_requested: number
          catalog_item_id: string | null
        }
        Insert: {
          id?: string
          rfq_id: string
          item_type?: string | null
          item_id?: string | null
          qty_requested: number
          catalog_item_id?: string | null
        }
        Update: {
          id?: string
          rfq_id?: string
          item_type?: string | null
          item_id?: string | null
          qty_requested?: number
          catalog_item_id?: string | null
        }
        Relationships: []
      }
      proc_rfqs: {
        Row: {
          id: string
          org_id: string
          rfq_number: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          rfq_number: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          rfq_number?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      proc_vendor_bids: {
        Row: {
          id: string
          rfq_id: string
          vendor_id: string
          unit_price: number
          lead_time_days: number
          valid_until: string
          is_selected: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          rfq_id: string
          vendor_id: string
          unit_price?: number
          lead_time_days?: number
          valid_until: string
          is_selected?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          rfq_id?: string
          vendor_id?: string
          unit_price?: number
          lead_time_days?: number
          valid_until?: string
          is_selected?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      proc_warranty_claims: {
        Row: {
          id: string
          org_id: string
          asset_id: string
          vendor_id: string
          ticket_id: string | null
          claim_number: string
          status: Database['public']['Enums']['claim_status']
          issue_description: string | null
          vendor_rma_number: string | null
          submitted_at: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          asset_id: string
          vendor_id: string
          ticket_id?: string | null
          claim_number: string
          status?: Database['public']['Enums']['claim_status']
          issue_description?: string | null
          vendor_rma_number?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          asset_id?: string
          vendor_id?: string
          ticket_id?: string | null
          claim_number?: string
          status?: Database['public']['Enums']['claim_status']
          issue_description?: string | null
          vendor_rma_number?: string | null
          submitted_at?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          org_id: string
          full_name: string
          role: string
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          full_name: string
          role?: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          full_name?: string
          role?: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_additional_costs: {
        Row: {
          id: string
          quote_id: string
          description: string
          amount: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          amount: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          amount?: number
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      quote_format_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          template_json: Json
          is_default: boolean
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          template_json?: Json
          is_default?: boolean
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          template_json?: Json
          is_default?: boolean
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_history: {
        Row: {
          id: string
          quote_id: string
          version: number
          quote_data: Json
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          version: number
          quote_data: Json
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          version?: number
          quote_data?: Json
          changed_by?: string | null
          changed_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          sort_order: number
          section: Database['public']['Enums']['bom_section']
          description: string
          remarks: string | null
          unit: string
          qty: number
          rate_per_unit: number
          gst_pct: number
          original_qty: number | null
          original_rate: number | null
          is_qty_overridden: boolean
          is_rate_overridden: boolean
          is_included: boolean
          is_mandatory: boolean
          line_total: number
          line_gst: number
          line_subtotal: number
          created_at: string
          updated_at: string
          is_gst_overridden: boolean
          original_gst: number | null
          version: number
        }
        Insert: {
          id?: string
          quote_id: string
          sort_order?: number
          section: Database['public']['Enums']['bom_section']
          description: string
          remarks?: string | null
          unit?: string
          qty?: number
          rate_per_unit?: number
          gst_pct?: number
          original_qty?: number | null
          original_rate?: number | null
          is_qty_overridden?: boolean
          is_rate_overridden?: boolean
          is_included?: boolean
          is_mandatory?: boolean
          line_total?: number
          line_gst?: number
          line_subtotal?: number
          created_at?: string
          updated_at?: string
          is_gst_overridden?: boolean
          original_gst?: number | null
          version?: number
        }
        Update: {
          id?: string
          quote_id?: string
          sort_order?: number
          section?: Database['public']['Enums']['bom_section']
          description?: string
          remarks?: string | null
          unit?: string
          qty?: number
          rate_per_unit?: number
          gst_pct?: number
          original_qty?: number | null
          original_rate?: number | null
          is_qty_overridden?: boolean
          is_rate_overridden?: boolean
          is_included?: boolean
          is_mandatory?: boolean
          line_total?: number
          line_gst?: number
          line_subtotal?: number
          created_at?: string
          updated_at?: string
          is_gst_overridden?: boolean
          original_gst?: number | null
          version?: number
        }
        Relationships: []
      }
      quote_status_history: {
        Row: {
          id: string
          quote_id: string
          old_status: Database['public']['Enums']['quote_status'] | null
          new_status: Database['public']['Enums']['quote_status']
          changed_by: string | null
          notes: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          old_status?: Database['public']['Enums']['quote_status'] | null
          new_status: Database['public']['Enums']['quote_status']
          changed_by?: string | null
          notes?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          old_status?: Database['public']['Enums']['quote_status'] | null
          new_status?: Database['public']['Enums']['quote_status']
          changed_by?: string | null
          notes?: string | null
          changed_at?: string
        }
        Relationships: []
      }
      quote_variants: {
        Row: {
          id: string
          quote_id: string
          name: string
          description: string | null
          overrides_json: Json
          target_margin_pct: number | null
          discount_type: Database['public']['Enums']['discount_type']
          discount_val: number
          mrp_incl_gst: number | null
          discount_amount: number | null
          final_customer_price: number | null
          subsidy_amount: number | null
          beneficiary_contribution: number | null
          is_selected: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          name: string
          description?: string | null
          overrides_json?: Json
          target_margin_pct?: number | null
          discount_type?: Database['public']['Enums']['discount_type']
          discount_val?: number
          mrp_incl_gst?: number | null
          discount_amount?: number | null
          final_customer_price?: number | null
          subsidy_amount?: number | null
          beneficiary_contribution?: number | null
          is_selected?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          name?: string
          description?: string | null
          overrides_json?: Json
          target_margin_pct?: number | null
          discount_type?: Database['public']['Enums']['discount_type']
          discount_val?: number
          mrp_incl_gst?: number | null
          discount_amount?: number | null
          final_customer_price?: number | null
          subsidy_amount?: number | null
          beneficiary_contribution?: number | null
          is_selected?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          org_id: string
          quote_number: string
          status: Database['public']['Enums']['quote_status']
          project_type: Database['public']['Enums']['project_type']
          customer_name: string
          customer_phone: string | null
          customer_whatsapp: string | null
          customer_email: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state_id: string | null
          state_name: string | null
          pincode: string | null
          meter_number: string | null
          sanctioned_load_kw: number | null
          monthly_bill_inr: number | null
          roof_type: string | null
          roof_area_sqft: number | null
          exec_id: string | null
          exec_name: string | null
          sale_type: Database['public']['Enums']['sale_type']
          project_title: string | null
          notes: string | null
          system_id: string | null
          system_name: string | null
          system_category: Database['public']['Enums']['system_category'] | null
          system_capacity_kw: number | null
          panel_brand_model: string | null
          panel_qty: number | null
          panel_rate_per_panel: number | null
          inverter_brand_model: string | null
          inverter_qty: number | null
          inverter_rate: number | null
          battery_brand_model: string | null
          battery_qty: number | null
          battery_rate: number | null
          battery_total_kwh: number | null
          discount_type: Database['public']['Enums']['discount_type']
          discount_val: number
          cost_before_gst: number
          total_input_gst: number
          total_incl_gst: number
          effective_margin_pct: number
          mrp_excl_gst: number
          gst_output_rate: number
          output_gst_amount: number
          mrp_incl_gst: number
          discount_amount: number
          additional_costs_total: number
          final_customer_price: number
          subsidy_scheme_id: string | null
          subsidy_amount: number
          beneficiary_contribution: number
          per_kw_excl_gst: number | null
          per_kw_incl_gst: number | null
          annual_generation_kwh: number | null
          annual_savings_inr: number | null
          payback_years: number | null
          lifetime_savings_inr: number | null
          co2_offset_kg_per_year: number | null
          valid_until: string | null
          version: number
          created_by: string | null
          created_at: string
          updated_at: string
          structure_id: string | null
          structure_pricing_mode: string | null
          solar_meter_id: string | null
          solar_meter_qty: number | null
          net_meter_id: string | null
          net_meter_qty: number | null
          la_id: string | null
          la_qty: number | null
          lead_id: string | null
          parent_quote_id: string | null
          version_reason: string | null
          survey_id: string | null
          gst_rate: number
          structure_type: string
          validation_acknowledged: Json
          civil_applicable: boolean
          logistics_cost_estimated: number | null
          subsidy_breakdown: string | null
          subsidy_eligible: boolean
          margin_alert: boolean
          margin_alert_threshold: number
          gst_output_override: number | null
          target_mrp_incl_gst: number | null
          target_mrp_per_watt: number | null
        }
        Insert: {
          id?: string
          org_id: string
          quote_number: string
          status?: Database['public']['Enums']['quote_status']
          project_type?: Database['public']['Enums']['project_type']
          customer_name: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          customer_email?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state_id?: string | null
          state_name?: string | null
          pincode?: string | null
          meter_number?: string | null
          sanctioned_load_kw?: number | null
          monthly_bill_inr?: number | null
          roof_type?: string | null
          roof_area_sqft?: number | null
          exec_id?: string | null
          exec_name?: string | null
          sale_type?: Database['public']['Enums']['sale_type']
          project_title?: string | null
          notes?: string | null
          system_id?: string | null
          system_name?: string | null
          system_category?: Database['public']['Enums']['system_category'] | null
          system_capacity_kw?: number | null
          panel_brand_model?: string | null
          panel_qty?: number | null
          panel_rate_per_panel?: number | null
          inverter_brand_model?: string | null
          inverter_qty?: number | null
          inverter_rate?: number | null
          battery_brand_model?: string | null
          battery_qty?: number | null
          battery_rate?: number | null
          battery_total_kwh?: number | null
          discount_type?: Database['public']['Enums']['discount_type']
          discount_val?: number
          cost_before_gst?: number
          total_input_gst?: number
          total_incl_gst?: number
          effective_margin_pct?: number
          mrp_excl_gst?: number
          gst_output_rate?: number
          output_gst_amount?: number
          mrp_incl_gst?: number
          discount_amount?: number
          additional_costs_total?: number
          final_customer_price?: number
          subsidy_scheme_id?: string | null
          subsidy_amount?: number
          beneficiary_contribution?: number
          per_kw_excl_gst?: number | null
          per_kw_incl_gst?: number | null
          annual_generation_kwh?: number | null
          annual_savings_inr?: number | null
          payback_years?: number | null
          lifetime_savings_inr?: number | null
          co2_offset_kg_per_year?: number | null
          valid_until?: string | null
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          structure_id?: string | null
          structure_pricing_mode?: string | null
          solar_meter_id?: string | null
          solar_meter_qty?: number | null
          net_meter_id?: string | null
          net_meter_qty?: number | null
          la_id?: string | null
          la_qty?: number | null
          lead_id?: string | null
          parent_quote_id?: string | null
          version_reason?: string | null
          survey_id?: string | null
          gst_rate?: number
          structure_type?: string
          validation_acknowledged?: Json
          civil_applicable?: boolean
          logistics_cost_estimated?: number | null
          subsidy_breakdown?: string | null
          subsidy_eligible?: boolean
          margin_alert?: boolean
          margin_alert_threshold?: number
          gst_output_override?: number | null
          target_mrp_incl_gst?: number | null
          target_mrp_per_watt?: number | null
        }
        Update: {
          id?: string
          org_id?: string
          quote_number?: string
          status?: Database['public']['Enums']['quote_status']
          project_type?: Database['public']['Enums']['project_type']
          customer_name?: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          customer_email?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state_id?: string | null
          state_name?: string | null
          pincode?: string | null
          meter_number?: string | null
          sanctioned_load_kw?: number | null
          monthly_bill_inr?: number | null
          roof_type?: string | null
          roof_area_sqft?: number | null
          exec_id?: string | null
          exec_name?: string | null
          sale_type?: Database['public']['Enums']['sale_type']
          project_title?: string | null
          notes?: string | null
          system_id?: string | null
          system_name?: string | null
          system_category?: Database['public']['Enums']['system_category'] | null
          system_capacity_kw?: number | null
          panel_brand_model?: string | null
          panel_qty?: number | null
          panel_rate_per_panel?: number | null
          inverter_brand_model?: string | null
          inverter_qty?: number | null
          inverter_rate?: number | null
          battery_brand_model?: string | null
          battery_qty?: number | null
          battery_rate?: number | null
          battery_total_kwh?: number | null
          discount_type?: Database['public']['Enums']['discount_type']
          discount_val?: number
          cost_before_gst?: number
          total_input_gst?: number
          total_incl_gst?: number
          effective_margin_pct?: number
          mrp_excl_gst?: number
          gst_output_rate?: number
          output_gst_amount?: number
          mrp_incl_gst?: number
          discount_amount?: number
          additional_costs_total?: number
          final_customer_price?: number
          subsidy_scheme_id?: string | null
          subsidy_amount?: number
          beneficiary_contribution?: number
          per_kw_excl_gst?: number | null
          per_kw_incl_gst?: number | null
          annual_generation_kwh?: number | null
          annual_savings_inr?: number | null
          payback_years?: number | null
          lifetime_savings_inr?: number | null
          co2_offset_kg_per_year?: number | null
          valid_until?: string | null
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          structure_id?: string | null
          structure_pricing_mode?: string | null
          solar_meter_id?: string | null
          solar_meter_qty?: number | null
          net_meter_id?: string | null
          net_meter_qty?: number | null
          la_id?: string | null
          la_qty?: number | null
          lead_id?: string | null
          parent_quote_id?: string | null
          version_reason?: string | null
          survey_id?: string | null
          gst_rate?: number
          structure_type?: string
          validation_acknowledged?: Json
          civil_applicable?: boolean
          logistics_cost_estimated?: number | null
          subsidy_breakdown?: string | null
          subsidy_eligible?: boolean
          margin_alert?: boolean
          margin_alert_threshold?: number
          gst_output_override?: number | null
          target_mrp_incl_gst?: number | null
          target_mrp_per_watt?: number | null
        }
        Relationships: []
      }
      rate_master: {
        Row: {
          id: string
          org_id: string
          bom_item_id: string | null
          item_name: string
          override_rate: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          bom_item_id?: string | null
          item_name: string
          override_rate: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          bom_item_id?: string | null
          item_name?: string
          override_rate?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_master_audit_log: {
        Row: {
          id: string
          org_id: string
          rate_master_id: string | null
          item_name: string
          old_rate: number | null
          new_rate: number | null
          changed_by: string | null
          changed_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          org_id: string
          rate_master_id?: string | null
          item_name: string
          old_rate?: number | null
          new_rate?: number | null
          changed_by?: string | null
          changed_at?: string
          reason?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          rate_master_id?: string | null
          item_name?: string
          old_rate?: number | null
          new_rate?: number | null
          changed_by?: string | null
          changed_at?: string
          reason?: string | null
        }
        Relationships: []
      }
      scheme_slabs: {
        Row: {
          id: string
          scheme_id: string
          slab_index: number
          start_kw: number
          end_kw: number | null
          rate_per_kw: number
          is_fixed_amount: boolean
          fixed_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scheme_id: string
          slab_index: number
          start_kw: number
          end_kw?: number | null
          rate_per_kw?: number
          is_fixed_amount?: boolean
          fixed_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scheme_id?: string
          slab_index?: number
          start_kw?: number
          end_kw?: number | null
          rate_per_kw?: number
          is_fixed_amount?: boolean
          fixed_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_surveys: {
        Row: {
          id: string
          lead_id: string
          quote_id: string | null
          conducted_by: string | null
          conducted_at: string | null
          status: string
          roof_area_sqft: number | null
          roof_type: string | null
          roof_height_ft: number | null
          shadowing_notes: string | null
          existing_load_kw: number | null
          sanctioned_load_kw: number | null
          meter_phase: string | null
          distance_inverter_to_meter_m: number | null
          distance_panel_to_inverter_m: number | null
          discom_name: string | null
          consumer_number: string | null
          net_metering_available: boolean | null
          photo_urls: Json
          survey_notes: string | null
          waived_by: string | null
          waive_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          quote_id?: string | null
          conducted_by?: string | null
          conducted_at?: string | null
          status?: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          roof_height_ft?: number | null
          shadowing_notes?: string | null
          existing_load_kw?: number | null
          sanctioned_load_kw?: number | null
          meter_phase?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          discom_name?: string | null
          consumer_number?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json
          survey_notes?: string | null
          waived_by?: string | null
          waive_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          quote_id?: string | null
          conducted_by?: string | null
          conducted_at?: string | null
          status?: string
          roof_area_sqft?: number | null
          roof_type?: string | null
          roof_height_ft?: number | null
          shadowing_notes?: string | null
          existing_load_kw?: number | null
          sanctioned_load_kw?: number | null
          meter_phase?: string | null
          distance_inverter_to_meter_m?: number | null
          distance_panel_to_inverter_m?: number | null
          discom_name?: string | null
          consumer_number?: string | null
          net_metering_available?: boolean | null
          photo_urls?: Json
          survey_notes?: string | null
          waived_by?: string | null
          waive_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_rules: {
        Row: {
          id: string
          state_code: string
          state_name: string
          sun_hours_per_day: number
          performance_ratio: number
          labour_multiplier: number
          gst_on_output: number
          grid_tariff_inr: number
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          state_code: string
          state_name: string
          sun_hours_per_day: number
          performance_ratio?: number
          labour_multiplier?: number
          gst_on_output?: number
          grid_tariff_inr?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          state_code?: string
          state_name?: string
          sun_hours_per_day?: number
          performance_ratio?: number
          labour_multiplier?: number
          gst_on_output?: number
          grid_tariff_inr?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_scheme_overrides: {
        Row: {
          id: string
          state_id: string
          scheme_id: string
          max_absolute_override: number | null
          additional_state_subsidy: number
          is_active: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          state_id: string
          scheme_id: string
          max_absolute_override?: number | null
          additional_state_subsidy?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          state_id?: string
          scheme_id?: string
          max_absolute_override?: number | null
          additional_state_subsidy?: number
          is_active?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      structure_accessory_rates: {
        Row: {
          id: string
          org_id: string | null
          item_name: string
          item_aliases: string[]
          unit: string
          rate: number
          gst_pct: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          item_name: string
          item_aliases?: string[]
          unit?: string
          rate?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          item_name?: string
          item_aliases?: string[]
          unit?: string
          rate?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      structure_component_master: {
        Row: {
          id: string
          org_id: string | null
          name: string
          type: string | null
          weight_per_meter: number | null
          material: string | null
          selling_price: number
          buy_price: number
          gst_pct: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          type?: string | null
          weight_per_meter?: number | null
          material?: string | null
          selling_price?: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          type?: string | null
          weight_per_meter?: number | null
          material?: string | null
          selling_price?: number
          buy_price?: number
          gst_pct?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      structure_component_vendor_rates: {
        Row: {
          id: string
          component_id: string
          vendor_id: string
          rate_per_unit: number
          effective_from: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          component_id: string
          vendor_id: string
          rate_per_unit?: number
          effective_from?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          component_id?: string
          vendor_id?: string
          rate_per_unit?: number
          effective_from?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      structure_material_rates: {
        Row: {
          id: string
          vendor_id: string
          material_type: string
          rate_per_kg: number
          created_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          material_type: string
          rate_per_kg: number
          created_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          material_type?: string
          rate_per_kg?: number
          created_at?: string
        }
        Relationships: []
      }
      structure_rates: {
        Row: {
          id: string
          component_id: string | null
          rate: number | null
          created_at: string | null
          updated_at: string | null
          org_id: string | null
        }
        Insert: {
          id?: string
          component_id?: string | null
          rate?: number | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string | null
        }
        Update: {
          id?: string
          component_id?: string | null
          rate?: number | null
          created_at?: string | null
          updated_at?: string | null
          org_id?: string | null
        }
        Relationships: []
      }
      structure_template_items: {
        Row: {
          id: string
          template_id: string
          item: string
          qty: number
          weight: number | null
          vendor_id: string | null
          created_at: string
          accessory_rate_id: string | null
        }
        Insert: {
          id?: string
          template_id: string
          item: string
          qty: number
          weight?: number | null
          vendor_id?: string | null
          created_at?: string
          accessory_rate_id?: string | null
        }
        Update: {
          id?: string
          template_id?: string
          item?: string
          qty?: number
          weight?: number | null
          vendor_id?: string | null
          created_at?: string
          accessory_rate_id?: string | null
        }
        Relationships: []
      }
      structure_templates: {
        Row: {
          id: string
          capacity_kw: number
          panel_count: number
          structure_type: string
          created_at: string
        }
        Insert: {
          id?: string
          capacity_kw: number
          panel_count: number
          structure_type: string
          created_at?: string
        }
        Update: {
          id?: string
          capacity_kw?: number
          panel_count?: number
          structure_type?: string
          created_at?: string
        }
        Relationships: []
      }
      structure_vendors_deprecated: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      structure_weight_lookup: {
        Row: {
          id: string
          structure_id: string
          capacity_kw_min: number
          capacity_kw_max: number
          panel_qty: number
          weight_per_panel_kg: number
          bracket_fixed_weight: number
          total_weight_kg: number | null
          notes: string | null
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
        }
        Insert: {
          id?: string
          structure_id: string
          capacity_kw_min: number
          capacity_kw_max: number
          panel_qty: number
          weight_per_panel_kg: number
          bracket_fixed_weight?: number
          total_weight_kg?: number | null
          notes?: string | null
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
        }
        Update: {
          id?: string
          structure_id?: string
          capacity_kw_min?: number
          capacity_kw_max?: number
          panel_qty?: number
          weight_per_panel_kg?: number
          bracket_fixed_weight?: number
          total_weight_kg?: number | null
          notes?: string | null
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
        }
        Relationships: []
      }
      sys_approval_history: {
        Row: {
          id: string
          request_id: string
          step_id: string
          approver_id: string
          action: string
          comments: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          step_id: string
          approver_id: string
          action: string
          comments?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          step_id?: string
          approver_id?: string
          action?: string
          comments?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sys_approval_requests: {
        Row: {
          id: string
          org_id: string
          workflow_id: string
          entity_type: string
          entity_id: string
          status: Database['public']['Enums']['approval_req_status']
          current_step_order: number
          requested_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          workflow_id: string
          entity_type: string
          entity_id: string
          status?: Database['public']['Enums']['approval_req_status']
          current_step_order?: number
          requested_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          workflow_id?: string
          entity_type?: string
          entity_id?: string
          status?: Database['public']['Enums']['approval_req_status']
          current_step_order?: number
          requested_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_approval_rules: {
        Row: {
          id: string
          org_id: string
          module: string
          condition_sql: string
          approver_role: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          module: string
          condition_sql: string
          approver_role: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          module?: string
          condition_sql?: string
          approver_role?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      sys_approval_steps: {
        Row: {
          id: string
          workflow_id: string
          step_order: number
          step_type: Database['public']['Enums']['approval_step_type']
          required_role_id: string | null
          required_approvals_count: number
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          step_order: number
          step_type?: Database['public']['Enums']['approval_step_type']
          required_role_id?: string | null
          required_approvals_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          step_order?: number
          step_type?: Database['public']['Enums']['approval_step_type']
          required_role_id?: string | null
          required_approvals_count?: number
          created_at?: string
        }
        Relationships: []
      }
      sys_approval_workflow_rules: {
        Row: {
          id: string
          workflow_id: string
          field_name: string
          operator: Database['public']['Enums']['operator_type']
          target_value: Json
        }
        Insert: {
          id?: string
          workflow_id: string
          field_name: string
          operator: Database['public']['Enums']['operator_type']
          target_value: Json
        }
        Update: {
          id?: string
          workflow_id?: string
          field_name?: string
          operator?: Database['public']['Enums']['operator_type']
          target_value?: Json
        }
        Relationships: []
      }
      sys_approval_workflows: {
        Row: {
          id: string
          org_id: string
          entity_type: string
          name: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          entity_type: string
          name: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          entity_type?: string
          name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_approvals: {
        Row: {
          id: string
          org_id: string
          document_type: string
          document_id: string
          requested_by: string | null
          approved_by: string | null
          status: Database['public']['Enums']['approval_status']
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          document_type: string
          document_id: string
          requested_by?: string | null
          approved_by?: string | null
          status?: Database['public']['Enums']['approval_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          document_type?: string
          document_id?: string
          requested_by?: string | null
          approved_by?: string | null
          status?: Database['public']['Enums']['approval_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_audit_logs: {
        Row: {
          id: string
          org_id: string
          module: string
          entity_type: string
          entity_id: string
          action: string
          actor_id: string | null
          before_state: Json | null
          after_state: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          module: string
          entity_type: string
          entity_id: string
          action: string
          actor_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          module?: string
          entity_type?: string
          entity_id?: string
          action?: string
          actor_id?: string | null
          before_state?: Json | null
          after_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sys_dashboards: {
        Row: {
          id: string
          org_id: string
          profile_id: string
          dashboard_name: string
          layout_json: Json
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          profile_id: string
          dashboard_name: string
          layout_json?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          profile_id?: string
          dashboard_name?: string
          layout_json?: Json
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_escalations: {
        Row: {
          id: string
          org_id: string
          entity_type: string
          entity_id: string
          escalated_by: string
          assigned_to: string | null
          reason: string
          status: Database['public']['Enums']['escalation_status']
          severity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          entity_type: string
          entity_id: string
          escalated_by: string
          assigned_to?: string | null
          reason: string
          status?: Database['public']['Enums']['escalation_status']
          severity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          entity_type?: string
          entity_id?: string
          escalated_by?: string
          assigned_to?: string | null
          reason?: string
          status?: Database['public']['Enums']['escalation_status']
          severity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_event_bus: {
        Row: {
          id: string
          org_id: string
          event_type: string
          entity_type: string
          entity_id: string
          payload: Json
          triggered_by: string | null
          status: Database['public']['Enums']['event_status']
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          event_type: string
          entity_type: string
          entity_id: string
          payload?: Json
          triggered_by?: string | null
          status?: Database['public']['Enums']['event_status']
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          event_type?: string
          entity_type?: string
          entity_id?: string
          payload?: Json
          triggered_by?: string | null
          status?: Database['public']['Enums']['event_status']
          created_at?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      sys_notification_queue: {
        Row: {
          id: string
          org_id: string
          recipient_id: string
          channel: Database['public']['Enums']['notif_channel']
          subject: string | null
          body: string
          status: Database['public']['Enums']['notif_status']
          retry_count: number
          event_payload: Json | null
          created_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          recipient_id: string
          channel: Database['public']['Enums']['notif_channel']
          subject?: string | null
          body: string
          status?: Database['public']['Enums']['notif_status']
          retry_count?: number
          event_payload?: Json | null
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          recipient_id?: string
          channel?: Database['public']['Enums']['notif_channel']
          subject?: string | null
          body?: string
          status?: Database['public']['Enums']['notif_status']
          retry_count?: number
          event_payload?: Json | null
          created_at?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      sys_notification_templates: {
        Row: {
          id: string
          org_id: string
          event_type: string
          channel: Database['public']['Enums']['notif_channel']
          subject_template: string | null
          body_template: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          event_type: string
          channel: Database['public']['Enums']['notif_channel']
          subject_template?: string | null
          body_template: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          event_type?: string
          channel?: Database['public']['Enums']['notif_channel']
          subject_template?: string | null
          body_template?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_notifications: {
        Row: {
          id: string
          org_id: string
          recipient_id: string
          title: string
          body: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          recipient_id: string
          title: string
          body: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          recipient_id?: string
          title?: string
          body?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      sys_permissions: {
        Row: {
          id: string
          code: string
          type: Database['public']['Enums']['permission_type']
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          type: Database['public']['Enums']['permission_type']
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          type?: Database['public']['Enums']['permission_type']
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sys_role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
        Relationships: []
      }
      sys_roles: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          is_system_default: boolean
          hierarchy_level: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          is_system_default?: boolean
          hierarchy_level?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          is_system_default?: boolean
          hierarchy_level?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_user_roles: {
        Row: {
          id: string
          org_id: string
          profile_id: string
          role_id: string
          valid_from: string | null
          valid_to: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          profile_id: string
          role_id: string
          valid_from?: string | null
          valid_to?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          profile_id?: string
          role_id?: string
          valid_from?: string | null
          valid_to?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      system_items: {
        Row: {
          id: string
          system_id: string
          panel_id: string | null
          inverter_id: string | null
          battery_id: string | null
          solar_meter_id: string | null
          net_meter_id: string | null
          la_id: string | null
          structure_id: string | null
          bom_item_id: string | null
          comm_device_id: string | null
          section: Database['public']['Enums']['bom_section']
          description: string
          remarks: string | null
          unit: string
          default_qty: number
          is_mandatory: boolean
          is_included_by_default: boolean
          sort_order: number
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
          structure_component_id: string | null
        }
        Insert: {
          id?: string
          system_id: string
          panel_id?: string | null
          inverter_id?: string | null
          battery_id?: string | null
          solar_meter_id?: string | null
          net_meter_id?: string | null
          la_id?: string | null
          structure_id?: string | null
          bom_item_id?: string | null
          comm_device_id?: string | null
          section: Database['public']['Enums']['bom_section']
          description: string
          remarks?: string | null
          unit?: string
          default_qty?: number
          is_mandatory?: boolean
          is_included_by_default?: boolean
          sort_order?: number
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          structure_component_id?: string | null
        }
        Update: {
          id?: string
          system_id?: string
          panel_id?: string | null
          inverter_id?: string | null
          battery_id?: string | null
          solar_meter_id?: string | null
          net_meter_id?: string | null
          la_id?: string | null
          structure_id?: string | null
          bom_item_id?: string | null
          comm_device_id?: string | null
          section?: Database['public']['Enums']['bom_section']
          description?: string
          remarks?: string | null
          unit?: string
          default_qty?: number
          is_mandatory?: boolean
          is_included_by_default?: boolean
          sort_order?: number
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
          structure_component_id?: string | null
        }
        Relationships: []
      }
      system_presets: {
        Row: {
          id: string
          name: string
          capacity_kw: number
          type: string
          status: string
          author_id: string | null
          is_org_template: boolean
          calculator_state: Json
          created_at: string | null
          updated_at: string | null
          system_type: string | null
          system_kw: number | null
          last_used_at: string | null
          is_default: boolean | null
          created_by: string | null
          org_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          name: string
          capacity_kw: number
          type: string
          status?: string
          author_id?: string | null
          is_org_template?: boolean
          calculator_state: Json
          created_at?: string | null
          updated_at?: string | null
          system_type?: string | null
          system_kw?: number | null
          last_used_at?: string | null
          is_default?: boolean | null
          created_by?: string | null
          org_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          name?: string
          capacity_kw?: number
          type?: string
          status?: string
          author_id?: string | null
          is_org_template?: boolean
          calculator_state?: Json
          created_at?: string | null
          updated_at?: string | null
          system_type?: string | null
          system_kw?: number | null
          last_used_at?: string | null
          is_default?: boolean | null
          created_by?: string | null
          org_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      systems: {
        Row: {
          id: string
          org_id: string | null
          name: string
          category: Database['public']['Enums']['system_category']
          capacity_kw: number
          panel_wattage_w: number | null
          panel_qty: number | null
          target_margin_pct: number
          is_active: boolean
          is_custom: boolean
          version: number
          created_at: string
          updated_at: string
          import_batch_id: string | null
          source_file: string | null
          sheet_name: string | null
          row_number: number | null
          imported_at: string | null
          imported_by: string | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          name: string
          category: Database['public']['Enums']['system_category']
          capacity_kw: number
          panel_wattage_w?: number | null
          panel_qty?: number | null
          target_margin_pct?: number
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
        }
        Update: {
          id?: string
          org_id?: string | null
          name?: string
          category?: Database['public']['Enums']['system_category']
          capacity_kw?: number
          panel_wattage_w?: number | null
          panel_qty?: number | null
          target_margin_pct?: number
          is_active?: boolean
          is_custom?: boolean
          version?: number
          created_at?: string
          updated_at?: string
          import_batch_id?: string | null
          source_file?: string | null
          sheet_name?: string | null
          row_number?: number | null
          imported_at?: string | null
          imported_by?: string | null
        }
        Relationships: []
      }
      vendor_payments: {
        Row: {
          id: string
          project_id: string
          vendor_id: string
          invoice_number: string
          invoice_amount: number
          status: string
          taxable_amount: number | null
          cgst_amount: number | null
          sgst_amount: number | null
          igst_amount: number | null
          total_gst: number | null
          created_at: string | null
          retention_percent: number
          retention_released_at: string | null
          retention_release_approved_by: string | null
          retention_amount: number | null
          retention_pct: number
          retention_released: boolean
          retention_release_notes: string | null
        }
        Insert: {
          id?: string
          project_id: string
          vendor_id: string
          invoice_number: string
          invoice_amount: number
          status?: string
          taxable_amount?: number | null
          cgst_amount?: number | null
          sgst_amount?: number | null
          igst_amount?: number | null
          total_gst?: number | null
          created_at?: string | null
          retention_percent?: number
          retention_released_at?: string | null
          retention_release_approved_by?: string | null
          retention_amount?: number | null
          retention_pct?: number
          retention_released?: boolean
          retention_release_notes?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          vendor_id?: string
          invoice_number?: string
          invoice_amount?: number
          status?: string
          taxable_amount?: number | null
          cgst_amount?: number | null
          sgst_amount?: number | null
          igst_amount?: number | null
          total_gst?: number | null
          created_at?: string | null
          retention_percent?: number
          retention_released_at?: string | null
          retention_release_approved_by?: string | null
          retention_amount?: number | null
          retention_pct?: number
          retention_released?: boolean
          retention_release_notes?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          id: string
          org_id: string
          name: string
          contact_person: string | null
          email: string | null
          phone: string | null
          gst_number: string | null
          address: string | null
          created_at: string
          updated_at: string
          status: Database['public']['Enums']['vendor_status']
          is_structure_vendor: boolean
          version: number
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          gst_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          status?: Database['public']['Enums']['vendor_status']
          is_structure_vendor?: boolean
          version?: number
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          contact_person?: string | null
          email?: string | null
          phone?: string | null
          gst_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          status?: Database['public']['Enums']['vendor_status']
          is_structure_vendor?: boolean
          version?: number
        }
        Relationships: []
      }
      walkway_templates: {
        Row: {
          id: string
          template: string
          length_m: number
          cost: number
          cost_per_meter: number
          created_at: string
        }
        Insert: {
          id?: string
          template: string
          length_m: number
          cost: number
          cost_per_meter: number
          created_at?: string
        }
        Update: {
          id?: string
          template?: string
          length_m?: number
          cost?: number
          cost_per_meter?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      inventory_positions: {
        Row: {
          item_id: string | null
          project_id: string | null
          qty_in_warehouse: number | null
          qty_in_transit: number | null
          qty_at_site: number | null
          qty_installed: number | null
        }
        Relationships: []
      }
      v_active_batteries: {
        Row: {
          id: string | null
          eq_type: string | null
          brand: string | null
          model: string | null
          capacity: string | null
          rate: number | null
          gst_pct: number | null
          sub_type: string | null
          is_custom: boolean | null
        }
        Relationships: []
      }
      v_active_inverters: {
        Row: {
          id: string | null
          eq_type: string | null
          brand: string | null
          model: string | null
          capacity: string | null
          rate: number | null
          gst_pct: number | null
          sub_type: string | null
          is_custom: boolean | null
        }
        Relationships: []
      }
      v_active_panels: {
        Row: {
          id: string | null
          eq_type: string | null
          brand: string | null
          model: string | null
          capacity: string | null
          rate: number | null
          gst_pct: number | null
          is_custom: boolean | null
        }
        Relationships: []
      }
      v_ar_aging: {
        Row: {
          org_id: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_date: string | null
          due_date: string | null
          total_invoice: number | null
          status: Database['public']['Enums']['invoice_status'] | null
          days_overdue: number | null
        }
        Relationships: []
      }
      v_gstr1_export: {
        Row: {
          org_id: string | null
          invoice_number: string | null
          invoice_date: string | null
          recipient_name: string | null
          taxable_value: number | null
          gst_rate_pct: number | null
          gst_amount: number | null
          total_invoice_value: number | null
          pos_state: string | null
          item_type: string | null
        }
        Relationships: []
      }
      v_inventory_valuation: {
        Row: {
          org_id: string | null
          warehouse_id: string | null
          warehouse_name: string | null
          total_valuation: number | null
          unique_items_count: number | null
        }
        Relationships: []
      }
      v_margin_trends: {
        Row: {
          org_id: string | null
          month_label: string | null
          won_quotes_count: number | null
          avg_margin_pct: number | null
        }
        Relationships: []
      }
      v_procurement_spend: {
        Row: {
          org_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          total_spend: number | null
          total_pos: number | null
        }
        Relationships: []
      }
      v_project_profitability: {
        Row: {
          org_id: string | null
          project_id: string | null
          project_number: string | null
          project_status: Database['public']['Enums']['epc_project_status'] | null
          budgeted_cost: number | null
          actual_material_cost: number | null
          actual_labor_cost: number | null
          total_actual_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
        }
        Relationships: []
      }
      v_project_profitability_audit: {
        Row: {
          project_id: string | null
          project_number: string | null
          project_status: Database['public']['Enums']['epc_project_status'] | null
          budgeted_cost: number | null
          actual_material_cost: number | null
          actual_labor_cost: number | null
          total_actual_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
        }
        Relationships: []
      }
      v_quote_pipeline: {
        Row: {
          org_id: string | null
          status: Database['public']['Enums']['quote_status'] | null
          quote_count: number | null
          total_value: number | null
          avg_margin_pct: number | null
        }
        Relationships: []
      }
      v_quote_section_totals: {
        Row: {
          quote_id: string | null
          section: Database['public']['Enums']['bom_section'] | null
          section_cost: number | null
          section_gst: number | null
          section_subtotal: number | null
          included_items: number | null
        }
        Relationships: []
      }
      v_quote_summary: {
        Row: {
          id: string | null
          quote_number: string | null
          status: Database['public']['Enums']['quote_status'] | null
          project_type: Database['public']['Enums']['project_type'] | null
          customer_name: string | null
          customer_phone: string | null
          state_name: string | null
          system_name: string | null
          system_capacity_kw: number | null
          system_category: Database['public']['Enums']['system_category'] | null
          mrp_incl_gst: number | null
          subsidy_amount: number | null
          beneficiary_contribution: number | null
          discount_type: Database['public']['Enums']['discount_type'] | null
          discount_amount: number | null
          panel_brand_model: string | null
          panel_qty: number | null
          inverter_brand_model: string | null
          created_at: string | null
          updated_at: string | null
          valid_until: string | null
          exec_name: string | null
          version: number | null
        }
        Relationships: []
      }
      v_rate_master_canonical: {
        Row: {
          id: string | null
          org_id: string | null
          bom_item_id: string | null
          item_name: string | null
          effective_rate: number | null
          is_active: boolean | null
          section: Database['public']['Enums']['bom_section'] | null
          unit: string | null
          gst_pct: number | null
        }
        Relationships: []
      }
      v_structure_components_with_rates: {
        Row: {
          id: string | null
          org_id: string | null
          structure_id: string | null
          category: string | null
          name: string | null
          description: string | null
          unit: string | null
          selling_price: number | null
          buy_price: number | null
          gst_pct: number | null
          is_active: boolean | null
          vendor_name: string | null
          vendor_id: string | null
          vendor_rate_per_unit: number | null
        }
        Relationships: []
      }
      v_subsidy_slabs: {
        Row: {
          code: string | null
          name: string | null
          max_capacity_kw: number | null
          max_absolute_subsidy: number | null
          slab_index: number | null
          start_kw: number | null
          end_kw: number | null
          rate_per_kw: number | null
          is_fixed_amount: boolean | null
          fixed_amount: number | null
        }
        Relationships: []
      }
      v_system_bom_totals: {
        Row: {
          id: string | null
          name: string | null
          category: Database['public']['Enums']['system_category'] | null
          capacity_kw: number | null
          panel_wattage_w: number | null
          panel_qty: number | null
          target_margin_pct: number | null
          item_count: number | null
        }
        Relationships: []
      }
      v_vendor_performance: {
        Row: {
          org_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          total_orders: number | null
          avg_delay_days: number | null
        }
        Relationships: []
      }
      mv_ar_aging: {
        Row: {
          org_id: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_date: string | null
          due_date: string | null
          total_invoice: number | null
          status: Database['public']['Enums']['invoice_status'] | null
          days_overdue: number | null
        }
        Relationships: []
      }
      mv_inventory_valuation: {
        Row: {
          org_id: string | null
          warehouse_id: string | null
          warehouse_name: string | null
          total_valuation: number | null
          unique_items_count: number | null
        }
        Relationships: []
      }
      mv_margin_trends: {
        Row: {
          org_id: string | null
          month_label: string | null
          won_quotes_count: number | null
          avg_margin_pct: number | null
        }
        Relationships: []
      }
      mv_procurement_spend: {
        Row: {
          org_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          total_spend: number | null
          total_pos: number | null
        }
        Relationships: []
      }
      mv_project_profitability: {
        Row: {
          org_id: string | null
          project_id: string | null
          project_number: string | null
          project_status: Database['public']['Enums']['epc_project_status'] | null
          budgeted_cost: number | null
          actual_material_cost: number | null
          actual_labor_cost: number | null
          total_actual_cost: number | null
          gross_profit_variance: number | null
          margin_percentage_variance: number | null
        }
        Relationships: []
      }
      mv_quote_pipeline: {
        Row: {
          org_id: string | null
          status: Database['public']['Enums']['quote_status'] | null
          quote_count: number | null
          total_value: number | null
          avg_margin_pct: number | null
        }
        Relationships: []
      }
      mv_vendor_performance: {
        Row: {
          org_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          total_orders: number | null
          avg_delay_days: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrement_layer_qty: {
        Args: {
          p_layer_id: string
          p_qty: number
        }
        Returns: void
      }
      get_gstr3b_summary: {
        Args: {
          p_org_id: string
          p_period_start: string
          p_period_end: string
        }
        Returns: any
      }
      create_journal_entry: {
        Args: {
          p_org_id: string
          p_entry_date: string
          p_reference: string
          p_description: string
          p_source_module: string
          p_source_id: string
          p_lines: any
        }
        Returns: string
      }
      post_opening_balances: {
        Args: {
          p_org_id: string
          p_entry_date: string
          p_balances: any
        }
        Returns: string
      }
    }
    Enums: {
      acc_account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
      acquisition_status: 'pending' | 'received' | 'cancelled'
      amc_status: 'draft' | 'active' | 'pending_renewal' | 'expired' | 'suspended' | 'cancelled'
      approval_req_status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'escalated'
      approval_status: 'pending' | 'approved' | 'rejected'
      approval_step_type: 'sequential' | 'parallel'
      battery_chemistry: 'LFP' | 'Li-Ion' | 'Lead-Acid' | 'NMC'
      bom_section: 'solar_panels' | 'power_electronics' | 'metering' | 'mounting_structure' | 'electrical_protection' | 'earthing' | 'cabling' | 'wiring' | 'services'
      claim_status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resolved'
      crm_lead_status: 'new' | 'qualified' | 'site_survey_requested' | 'quote_presented' | 'negotiation' | 'won' | 'lost'
      crm_timeline_event: 'lead_created' | 'phone_call' | 'whatsapp_sent' | 'whatsapp_received' | 'email_sent' | 'email_received' | 'quote_generated' | 'status_changed'
      discount_type: 'none' | 'flat' | 'percent'
      epc_project_status: 'draft' | 'survey_phase' | 'engineering_design' | 'permitting' | 'material_dispatched' | 'installation_started' | 'net_metering_pending' | 'commissioned' | 'closed' | 'cancelled'
      escalation_status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'closed'
      event_status: 'pending' | 'processed' | 'failed'
      inverter_type: 'on_grid' | 'hybrid' | 'micro' | '3_phase'
      invoice_status: 'draft' | 'issued' | 'posted' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
      la_type: 'single' | 'multi'
      meter_type: 'solar_meter' | 'net_meter'
      milestone_type: 'survey_approved' | 'structural_design_freeze' | 'civil_foundation_done' | 'panel_installation_done' | 'inverter_wiring_done' | 'net_metering_approved' | 'discom_charging' | 'handover'
      notif_channel: 'in_app' | 'email' | 'whatsapp' | 'sms' | 'push'
      notif_status: 'queued' | 'sent' | 'failed' | 'read'
      operator_type: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'
      payment_method: 'upi' | 'neft' | 'rtgs' | 'cheque' | 'cash' | 'credit_card'
      permission_type: 'feature' | 'action' | 'field'
      po_status: 'draft' | 'submitted_for_approval' | 'approved' | 'sent' | 'partially_received' | 'received' | 'closed' | 'cancelled'
      project_type: 'residential' | 'commercial'
      quote_extended_status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'revision_requested' | 'won' | 'lost' | 'expired'
      quote_status: 'draft' | 'sent' | 'won' | 'lost'
      roof_mount_type: 'rcc_flat' | 'rcc_sloped' | 'tin_shed' | 'metal_sheet' | 'ground_mount' | 'elevated' | 'custom'
      sale_type: 'new' | 'upgrade' | 'referral'
      service_ticket_status: 'unassigned' | 'scheduled' | 'ongoing' | 'resolved' | 'failed'
      site_survey_status: 'scheduled' | 'in_progress' | 'completed' | 'needs_rework' | 'cancelled'
      structure_material: 'gi_galvanized' | 'hot_dip_galvanized' | 'aluminum' | 'stainless_steel' | 'custom'
      system_category: 'on_grid' | '3_phase' | 'micro_inverter' | 'hybrid' | 'upgrade' | 'commercial'
      transfer_status: 'draft' | 'transit' | 'completed' | 'cancelled'
      vendor_status: 'draft' | 'active' | 'suspended' | 'blacklisted'
      work_order_status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
    }
    CompositeTypes: {}
  }
}
