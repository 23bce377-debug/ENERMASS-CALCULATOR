-- ============================================================
-- MIGRATION 08: Create Canonical rate_master table
-- ============================================================
-- rate_master appears in schema.sql but does NOT exist in live DB.
-- This migration creates it fresh with the correct canonical schema:
--   - FK to eq_bom_items for type safety
--   - org_id for multi-org support
--   - item_name fallback for items not in eq_bom_items
--   - override_rate as the single authoritative rate
-- ============================================================

BEGIN;

-- Create rate_master (canonical form)
CREATE TABLE IF NOT EXISTS rate_master (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID          NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bom_item_id   UUID          REFERENCES eq_bom_items(id) ON DELETE SET NULL,
  item_name     TEXT          NOT NULL,     -- fallback key if bom_item_id is null
  override_rate NUMERIC(12,4) NOT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rate_master_item UNIQUE (org_id, item_name)
);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rate_master_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_rate_master_updated_at
      BEFORE UPDATE ON rate_master
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()';
  END IF;
END $$;

-- Index for fast org+item lookup
CREATE INDEX IF NOT EXISTS idx_rate_master_org_item
  ON rate_master (org_id, item_name)
  WHERE is_active = TRUE;

-- Canonical view for easy querying
CREATE OR REPLACE VIEW v_rate_master_canonical AS
SELECT
  rm.id,
  rm.org_id,
  rm.bom_item_id,
  rm.item_name,
  rm.override_rate AS effective_rate,
  rm.is_active,
  bi.section,
  bi.unit,
  bi.gst_pct
FROM rate_master rm
LEFT JOIN eq_bom_items bi ON bi.id = rm.bom_item_id;

DO $$
BEGIN
  RAISE NOTICE 'rate_master table created with canonical schema.';
  RAISE NOTICE 'Use INSERT INTO rate_master (org_id, item_name, override_rate) to add org-level BOM item rate overrides.';
END $$;

COMMIT;
