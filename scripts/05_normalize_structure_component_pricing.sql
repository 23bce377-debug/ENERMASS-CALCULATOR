-- ============================================================
-- MIGRATION 05: Normalize eq_structure_components Vendor Pricing
-- Remove vendor-specific price columns (rate_appolo, rate_tata, rate_deemac)
-- Replace with structure_component_vendor_rates junction table
-- ============================================================
-- BEFORE running: ensure migration 04 (vendor merge) has been applied,
-- so vendor_id values in the new table point to vendors.id correctly.
-- ============================================================

BEGIN;

-- Step 5.1: Create normalized vendor pricing table
CREATE TABLE IF NOT EXISTS structure_component_vendor_rates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID        NOT NULL REFERENCES eq_structure_components(id) ON DELETE CASCADE,
  vendor_id    UUID        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  rate_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
  effective_from DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_component_vendor UNIQUE (component_id, vendor_id)
);

CREATE OR REPLACE TRIGGER trg_structure_comp_vendor_rates_updated_at
  BEFORE UPDATE ON structure_component_vendor_rates
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Step 5.2: Migrate Apollo rates
INSERT INTO structure_component_vendor_rates (component_id, vendor_id, rate_per_unit)
SELECT sc.id, v.id, sc.rate_appolo
FROM eq_structure_components sc
CROSS JOIN vendors v
WHERE UPPER(TRIM(v.name)) = 'APOLLO'
  AND v.is_structure_vendor = TRUE
  AND sc.rate_appolo IS NOT NULL
  AND sc.rate_appolo > 0
ON CONFLICT (component_id, vendor_id) DO UPDATE
  SET rate_per_unit = EXCLUDED.rate_per_unit,
      updated_at    = NOW();

-- Step 5.3: Migrate Tata rates
INSERT INTO structure_component_vendor_rates (component_id, vendor_id, rate_per_unit)
SELECT sc.id, v.id, sc.rate_tata
FROM eq_structure_components sc
CROSS JOIN vendors v
WHERE UPPER(TRIM(v.name)) = 'TATA'
  AND v.is_structure_vendor = TRUE
  AND sc.rate_tata IS NOT NULL
  AND sc.rate_tata > 0
ON CONFLICT (component_id, vendor_id) DO UPDATE
  SET rate_per_unit = EXCLUDED.rate_per_unit,
      updated_at    = NOW();

-- Step 5.4: Migrate Deemac rates
INSERT INTO structure_component_vendor_rates (component_id, vendor_id, rate_per_unit)
SELECT sc.id, v.id, sc.rate_deemac
FROM eq_structure_components sc
CROSS JOIN vendors v
WHERE UPPER(TRIM(v.name)) = 'DEEMAC'
  AND v.is_structure_vendor = TRUE
  AND sc.rate_deemac IS NOT NULL
  AND sc.rate_deemac > 0
ON CONFLICT (component_id, vendor_id) DO UPDATE
  SET rate_per_unit = EXCLUDED.rate_per_unit,
      updated_at    = NOW();

-- Step 5.5: Validate row counts before dropping columns
DO $$
DECLARE 
  v_before_apollo  INT;
  v_before_tata    INT;
  v_before_deemac  INT;
  v_migrated       INT;
BEGIN
  SELECT COUNT(*) INTO v_before_apollo  FROM eq_structure_components WHERE rate_appolo IS NOT NULL AND rate_appolo > 0;
  SELECT COUNT(*) INTO v_before_tata    FROM eq_structure_components WHERE rate_tata IS NOT NULL AND rate_tata > 0;
  SELECT COUNT(*) INTO v_before_deemac  FROM eq_structure_components WHERE rate_deemac IS NOT NULL AND rate_deemac > 0;
  SELECT COUNT(*) INTO v_migrated       FROM structure_component_vendor_rates;

  RAISE NOTICE 'Source rows: Apollo=%, Tata=%, Deemac=%', v_before_apollo, v_before_tata, v_before_deemac;
  RAISE NOTICE 'Migrated rows in structure_component_vendor_rates: %', v_migrated;
  
  -- Validate at least as many rows migrated as max source
  IF v_migrated < GREATEST(v_before_apollo, v_before_tata, v_before_deemac) THEN
    RAISE EXCEPTION 'Migration count mismatch. Expected >= %, got %', 
      GREATEST(v_before_apollo, v_before_tata, v_before_deemac), v_migrated;
  END IF;
  
  RAISE NOTICE '✅ Vendor rate migration validated.';
END $$;

-- Step 5.6: Drop the vendor-specific price columns
ALTER TABLE eq_structure_components DROP COLUMN IF EXISTS rate_appolo;
ALTER TABLE eq_structure_components DROP COLUMN IF EXISTS rate_tata;
ALTER TABLE eq_structure_components DROP COLUMN IF EXISTS rate_deemac;

-- Also update selling_price to be NULL-able if it was populated from vendor rates
-- (selling_price should now come from structure_component_vendor_rates at query time)

COMMIT;

-- ── Convenience View ──────────────────────────────────────────────────────────
-- Create a view to make querying components with their vendor rates easy
CREATE OR REPLACE VIEW v_structure_components_with_rates AS
SELECT 
  sc.id,
  sc.org_id,
  sc.structure_id,
  sc.category,
  sc.name,
  sc.description,
  sc.unit,
  sc.selling_price,
  sc.buy_price,
  sc.gst_pct,
  sc.is_active,
  v.name AS vendor_name,
  v.id   AS vendor_id,
  scvr.rate_per_unit AS vendor_rate_per_unit
FROM eq_structure_components sc
LEFT JOIN structure_component_vendor_rates scvr ON scvr.component_id = sc.id
LEFT JOIN vendors v ON v.id = scvr.vendor_id
WHERE sc.is_active = TRUE;
