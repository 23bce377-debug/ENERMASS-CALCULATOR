-- ================================================================
-- ENERMASS — Remediation Migration v1
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xjdqpwmizmfkcdcgcxqv/sql/new
--
-- Covers:
--   1. eq_structure_components  (new BOM table)
--   2. eq_structure_bom         (per-capacity quantity map)
--   3. eq_structure_addons      (walkway, ladder pricing)
--   4. custom_presets           (calculator preset saves)
-- ================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Structure BOM Components
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eq_structure_components (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID,
  structure_id  UUID REFERENCES eq_mounting_structures(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN (
    'steel_section', 'hardware', 'finishing', 'civil', 'fabrication', 'addon'
  )),
  name          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT NOT NULL DEFAULT 'Nos',
  rate_appolo   NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_tata     NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_deemac   NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  buy_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_pct       NUMERIC(5,4)  NOT NULL DEFAULT 0.18,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(structure_id, name)
);

ALTER TABLE eq_structure_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_structure_components" ON eq_structure_components;
CREATE POLICY "read_structure_components" ON eq_structure_components
  FOR SELECT USING (org_id IS NULL OR org_id = auth.uid());
DROP POLICY IF EXISTS "write_structure_components" ON eq_structure_components;
CREATE POLICY "write_structure_components" ON eq_structure_components
  FOR ALL USING (TRUE);

-- ─────────────────────────────────────────────────────────────────
-- 2. Structure BOM — Capacity-based quantity map
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eq_structure_bom (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id    UUID NOT NULL REFERENCES eq_structure_components(id) ON DELETE CASCADE,
  structure_id    UUID NOT NULL REFERENCES eq_mounting_structures(id) ON DELETE CASCADE,
  capacity_kw_min NUMERIC(6,2) NOT NULL,
  capacity_kw_max NUMERIC(6,2) NOT NULL,
  panel_qty       INTEGER,
  qty             NUMERIC(8,3) NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC(8,3),
  notes           TEXT,
  UNIQUE(component_id, capacity_kw_min, capacity_kw_max)
);

ALTER TABLE eq_structure_bom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_structure_bom" ON eq_structure_bom;
CREATE POLICY "read_structure_bom" ON eq_structure_bom FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "write_structure_bom" ON eq_structure_bom;
CREATE POLICY "write_structure_bom" ON eq_structure_bom FOR ALL USING (TRUE);

-- ─────────────────────────────────────────────────────────────────
-- 3. Structure Add-ons (Walkway, Ladder)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eq_structure_addons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID,
  name          TEXT NOT NULL,
  material      TEXT NOT NULL DEFAULT 'GP',
  unit          TEXT NOT NULL DEFAULT 'Meter',
  rate_per_unit NUMERIC(10,2) NOT NULL,
  buy_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_pct       NUMERIC(5,4)  NOT NULL DEFAULT 0.18,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(name, material)
);

ALTER TABLE eq_structure_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_structure_addons" ON eq_structure_addons;
CREATE POLICY "read_structure_addons" ON eq_structure_addons
  FOR SELECT USING (org_id IS NULL OR org_id = auth.uid());
DROP POLICY IF EXISTS "write_structure_addons" ON eq_structure_addons;
CREATE POLICY "write_structure_addons" ON eq_structure_addons FOR ALL USING (TRUE);

-- ─────────────────────────────────────────────────────────────────
-- 4. Custom Presets (Calculator preset saves)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  capacity_kw   NUMERIC(8,3) NOT NULL,
  config_json   JSONB,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE custom_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_custom_presets" ON custom_presets;
CREATE POLICY "read_custom_presets" ON custom_presets
  FOR SELECT USING (org_id IS NULL OR org_id = auth.uid());
DROP POLICY IF EXISTS "write_custom_presets" ON custom_presets;
CREATE POLICY "write_custom_presets" ON custom_presets FOR ALL USING (TRUE);

-- ─────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────
SELECT 'Migration complete: 4 tables created/verified' AS status;
