-- ============================================================
-- ENERMASS Solar Calculator - Missing Tables for Knowledge Base Ingestion
-- ============================================================

-- 1. GST Master table mapping to gst_rates.json
CREATE TABLE IF NOT EXISTS gst_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gst_pct NUMERIC(6,5) NOT NULL,
  source_workbook TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  gst_amount NUMERIC(15,4),
  gst_rate NUMERIC(6,5),
  effective_gst_rate_on_total NUMERIC(6,5),
  gst_formula TEXT,
  gst_formula_inputs TEXT[],
  source_gst_cell TEXT,
  pricing_formula TEXT,
  total_price_formula TEXT,
  total_price_formula_inputs TEXT[],
  source_total_cell TEXT,
  total_price NUMERIC(15,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying GST by percentage
CREATE INDEX IF NOT EXISTS idx_gst_master_pct ON gst_master(gst_pct);

-- 2. Rules and formulas metadata table
CREATE TABLE IF NOT EXISTS engineering_rules_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  formula TEXT NOT NULL,
  inputs TEXT[] NOT NULL,
  output_var TEXT,
  category TEXT NOT NULL, -- 'engineering_rule', 'calculation_rule', 'structure_formula', 'upgrade_rule', 'subsidy_rule'
  source_workbook TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rule_category UNIQUE (category, rule_name)
);

-- Index for categorization
CREATE INDEX IF NOT EXISTS idx_rules_metadata_cat ON engineering_rules_metadata(category);

-- Ensure columns exist in eq_mounting_structures if the database has an older schema
ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS flat_rate NUMERIC(12,2);
ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS per_watt_rate NUMERIC(12,2);


-- 3. Add UNIQUE constraints to make equipment/master tables idempotent for ON CONFLICT upserts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_eq_meters') THEN
    ALTER TABLE eq_meters ADD CONSTRAINT uq_eq_meters UNIQUE (brand, model, meter_type, phases);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_eq_las') THEN
    ALTER TABLE eq_lightning_arresters ADD CONSTRAINT uq_eq_las UNIQUE (brand, model, la_type);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_eq_structures') THEN
    ALTER TABLE eq_mounting_structures ADD CONSTRAINT uq_eq_structures UNIQUE (name, material, roof_mount_type, elevation_height_mm);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_eq_comm') THEN
    ALTER TABLE eq_communication_devices ADD CONSTRAINT uq_eq_comm UNIQUE (brand, model);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_vendors_name') THEN
    ALTER TABLE vendors ADD CONSTRAINT uq_vendors_name UNIQUE (org_id, name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_gst_master') THEN
    ALTER TABLE gst_master ADD CONSTRAINT uq_gst_master UNIQUE (gst_pct, source_workbook, source_sheet, source_row);
  END IF;
END $$;


