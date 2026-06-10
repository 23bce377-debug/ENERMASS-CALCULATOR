-- ============================================================
-- MIGRATION 02: Create structure_accessory_rates table
-- and seed from hardcoded ACCESSORY_FALLBACK_RATES in calculator.ts
-- ============================================================
-- PURPOSE: Move hardcoded accessory rates from application code into DB.
-- This allows pricing team to update rates without code deploys.
-- ============================================================

BEGIN;

-- Create table (COALESCE not allowed in CONSTRAINT, use partial indexes instead)
CREATE TABLE IF NOT EXISTS structure_accessory_rates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        REFERENCES organisations(id) ON DELETE CASCADE,
  item_name    TEXT        NOT NULL,
  item_aliases TEXT[]      NOT NULL DEFAULT '{}',
  unit         TEXT        NOT NULL DEFAULT 'Nos',
  rate         NUMERIC(12,4) NOT NULL DEFAULT 0,
  gst_pct      NUMERIC(6,5)  NOT NULL DEFAULT 0.18000,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index: global rates (org_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_accessory_rate_global
  ON structure_accessory_rates (item_name)
  WHERE org_id IS NULL;

-- Unique index: org-specific rates
CREATE UNIQUE INDEX IF NOT EXISTS uq_accessory_rate_org
  ON structure_accessory_rates (item_name, org_id)
  WHERE org_id IS NOT NULL;

-- updated_at trigger (reuse existing function fn_set_updated_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_structure_accessory_rates_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_structure_accessory_rates_updated_at
      BEFORE UPDATE ON structure_accessory_rates
      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()';
  END IF;
END $$;

-- Seed canonical names + known aliases from calculator.ts ACCESSORY_FALLBACK_RATES
INSERT INTO structure_accessory_rates (item_name, item_aliases, unit, rate) VALUES
  ('MS Hole Plate 4x4',   ARRAY['ms hole plate 4x4', 'ms hole plate 4x4 '],  'Nos', 120.00),
  ('Anchor Bolt 8mm',     ARRAY['anchor bolt 8mm', 'angor bolt 8 mm'],        'Nos',  10.00),
  ('PVC End Cap 3x1.5',   ARRAY['pvc end cap 3x1.5', 'pvc end cap 3x1.1/2 -', 'pvc end cap 1.5x1.5', 'pvc end cap 1.1/2 x 1.1/2'], 'Nos', 4.00),
  ('Epoxy Primer',        ARRAY['epoxy primer'],                               'L',  380.00),
  ('Thinner',             ARRAY['thinner'],                                    'L',  140.00),
  ('Roller Brush',        ARRAY['roller brush'],                               'Nos', 100.00),
  ('Solid Block',         ARRAY['solid block'],                                'Nos', 120.00),
  ('Nano Grout',          ARRAY['nano grout', 'chemickal- nano grout'],        'Nos', 350.00),
  ('Welding Rod',         ARRAY['welding rod', 'welding- rad'],                'Nos',   3.00),
  ('Cutting Wheel 4in',   ARRAY['cutting wheel', 'cutting wheel 4"'],         'Nos',  15.00)
ON CONFLICT (item_name) WHERE org_id IS NULL DO UPDATE
  SET rate         = EXCLUDED.rate,
      item_aliases = EXCLUDED.item_aliases,
      updated_at   = NOW();

-- Validate seed
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM structure_accessory_rates;
  IF v_count < 10 THEN
    RAISE EXCEPTION 'structure_accessory_rates seed incomplete: expected >=10 rows, got %', v_count;
  END IF;
  RAISE NOTICE 'structure_accessory_rates created and seeded: % rows', v_count;
END $$;

COMMIT;
