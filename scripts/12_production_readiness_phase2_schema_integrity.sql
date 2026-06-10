-- ============================================================
-- MIGRATION 12: PRODUCTION READINESS — PHASE 2: SCHEMA INTEGRITY
-- Resolves: DB-02, DB-06, DB-08, DB-09, MD-01 through MD-06
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- FIX DB-08: Add vendors table (referenced by migration 04)
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_status') THEN
    CREATE TYPE vendor_status AS ENUM ('active', 'inactive', 'blacklisted');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vendors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  contact     TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  gstin       TEXT,
  status      vendor_status NOT NULL DEFAULT 'active',
  notes       TEXT,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vendor_org_name UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(org_id, status);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_org_read"  ON vendors;
DROP POLICY IF EXISTS "vendors_org_write" ON vendors;
CREATE POLICY "vendors_org_read" ON vendors
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "vendors_org_write" ON vendors
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE OR REPLACE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE OR REPLACE TRIGGER trg_vendors_version
  BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- ──────────────────────────────────────────────────────────────
-- FIX DB-06: Add version column to quote_items for optimistic locking
-- This closes the concurrent-update race condition on line_total.
-- QuoteItemORM.update will now pass expectedVersion just like QuoteORM.update.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS trg_quote_items_version ON quote_items;
CREATE TRIGGER trg_quote_items_version
  BEFORE UPDATE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- ──────────────────────────────────────────────────────────────
-- FIX DB-09: catalog_items polymorphic ref validation trigger
-- DB-level FKs cannot span multiple tables. A trigger validates
-- that item_id resolves to at least one equipment table.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_catalog_item_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_exists BOOLEAN := FALSE;
BEGIN
  IF NEW.item_id IS NULL THEN
    RAISE EXCEPTION 'catalog_items.item_id cannot be NULL';
  END IF;
  SELECT EXISTS(SELECT 1 FROM eq_panels WHERE id = NEW.item_id) INTO v_exists;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_inverters WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_batteries WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_meters WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_lightning_arresters WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_mounting_structures WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_bom_items WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    SELECT EXISTS(SELECT 1 FROM eq_communication_devices WHERE id = NEW.item_id) INTO v_exists; END IF;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'catalog_items.item_id % does not reference any equipment table', NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'catalog_items') THEN
    DROP TRIGGER IF EXISTS trg_catalog_item_ref_check ON catalog_items;
    CREATE TRIGGER trg_catalog_item_ref_check
      BEFORE INSERT OR UPDATE ON catalog_items
      FOR EACH ROW EXECUTE FUNCTION fn_validate_catalog_item_ref();
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX MD-01: Deduplicate structure vendor names (trim whitespace)
-- ──────────────────────────────────────────────────────────────
UPDATE structure_vendors SET name = TRIM(name) WHERE name != TRIM(name);

DELETE FROM structure_vendors sv
WHERE sv.id NOT IN (
  SELECT DISTINCT ON (LOWER(TRIM(name))) id
  FROM structure_vendors
  ORDER BY LOWER(TRIM(name)), created_at ASC
);

-- ──────────────────────────────────────────────────────────────
-- FIX MD-02: Enforce canonical units in eq_bom_items
-- ──────────────────────────────────────────────────────────────

-- Normalize non-canonical existing values first
UPDATE eq_bom_items SET unit = 'Mtr' WHERE unit IN ('Meter', 'MTR', 'mtr', 'M', 'm');
UPDATE eq_bom_items SET unit = 'Nos' WHERE unit IN ('NOS', 'nos', 'No', 'no', 'Number');
UPDATE eq_bom_items SET unit = 'kg'  WHERE unit IN ('KG', 'Kg', 'Kgs');
UPDATE eq_bom_items SET unit = 'Set' WHERE unit IN ('SET', 'set');
UPDATE eq_bom_items SET unit = 'Lump' WHERE unit IN ('LS', 'ls', 'Lumpsum', 'Lump Sum');

ALTER TABLE eq_bom_items
  DROP CONSTRAINT IF EXISTS ck_bom_item_unit;
ALTER TABLE eq_bom_items
  ADD CONSTRAINT ck_bom_item_unit
  CHECK (unit IN ('Nos', 'Mtr', 'kg', 'Set', 'Lump', 'L', 'Pair', 'Roll'));

-- ──────────────────────────────────────────────────────────────
-- FIX MD-05: Battery DoD% must be chemistry-appropriate
-- LFP/Li-Ion/NMC: 0.10–1.00; Lead-Acid: max 0.50
-- ──────────────────────────────────────────────────────────────
ALTER TABLE eq_batteries
  DROP CONSTRAINT IF EXISTS ck_battery_dod_range;
ALTER TABLE eq_batteries
  ADD CONSTRAINT ck_battery_dod_range
  CHECK (
    (chemistry = 'Lead-Acid' AND dod_pct <= 0.5001) OR
    (chemistry != 'Lead-Acid' AND dod_pct BETWEEN 0.1 AND 1.0)
  );

-- ──────────────────────────────────────────────────────────────
-- FIX MD-03: Document eq_panels rate_per_watt as single source of truth
-- ──────────────────────────────────────────────────────────────
COMMENT ON COLUMN eq_panels.rate_per_watt IS
  'Source of truth: INR per watt. rate_per_panel (GENERATED) = wattage_w × rate_per_watt.';
COMMENT ON COLUMN eq_panels.rate_per_panel IS
  'GENERATED ALWAYS AS (wattage_w × rate_per_watt). Never set this directly.';

-- ──────────────────────────────────────────────────────────────
-- FIX MD-04: Standardize eq_inverters pricing column
-- ──────────────────────────────────────────────────────────────
COMMENT ON COLUMN eq_inverters.rate IS
  'Selling price per inverter unit in INR. This is the ONLY pricing column for inverters.';

-- ──────────────────────────────────────────────────────────────
-- FIX CALC-10 (partial): Add snapshot_locked to freeze scheme slabs
-- When an admin changes slabs, old quotes must not be recalculated
-- with new rates. snapshot_locked=TRUE freezes the scheme.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE calculation_schemes
  ADD COLUMN IF NOT EXISTS snapshot_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN calculation_schemes.snapshot_locked IS
  'When TRUE, slabs are frozen. New quotes use a cloned scheme. Existing quotes are unaffected.';

-- ──────────────────────────────────────────────────────────────
-- FIX DB-02: Purge orphan rate_master rows (no matching bom_item_id)
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM rate_master rm
  WHERE NOT EXISTS (SELECT 1 FROM eq_bom_items WHERE id = rm.bom_item_id);

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Deleting % orphan rate_master rows with no matching bom_item_id', orphan_count;
    DELETE FROM rate_master
    WHERE bom_item_id NOT IN (SELECT id FROM eq_bom_items);
  END IF;
END;
$$;

COMMIT;
