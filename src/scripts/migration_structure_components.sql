-- ============================================================
-- ENERMASS — Structure Components Migration
-- Adds per-component BOM to eq_mounting_structures
-- Each structure type (GI/GP) has itemized materials
-- ============================================================

-- 1. Create the components table
CREATE TABLE IF NOT EXISTS eq_structure_components (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Which structure this component belongs to
  structure_id      UUID REFERENCES eq_mounting_structures(id) ON DELETE CASCADE,

  -- Component categorization
  category          TEXT NOT NULL CHECK (category IN (
    'steel_section',   -- Rafter, Purlin tubes
    'hardware',        -- MS plates, anchor bolts, end caps
    'finishing',       -- Epoxy primer, thinner, roller brush
    'civil',           -- Solid block, nano grout
    'fabrication',     -- Welding rod, cutting wheel
    'addon'            -- Walkway, ladder (per-meter pricing)
  )),

  name              TEXT NOT NULL,
  description       TEXT,
  unit              TEXT NOT NULL DEFAULT 'Nos',   -- Nos, Kg, Liter, Meter

  -- Per-unit rates by supplier brand
  rate_appolo       NUMERIC(10,2) DEFAULT 0,
  rate_tata         NUMERIC(10,2) DEFAULT 0,
  rate_deemac       NUMERIC(10,2) DEFAULT 0,

  -- Active/default rate (set to whichever supplier is primary)
  selling_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  buy_price         NUMERIC(10,2) NOT NULL DEFAULT 0,

  gst_pct           NUMERIC(5,4) NOT NULL DEFAULT 0.18,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the per-system-size BOM quantity table
--    Maps: (structure_id, capacity_kw) → per-component quantity
CREATE TABLE IF NOT EXISTS eq_structure_bom (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id      UUID NOT NULL REFERENCES eq_structure_components(id) ON DELETE CASCADE,
  structure_id      UUID NOT NULL REFERENCES eq_mounting_structures(id) ON DELETE CASCADE,

  capacity_kw_min   NUMERIC(6,2) NOT NULL,
  capacity_kw_max   NUMERIC(6,2) NOT NULL,
  panel_qty         INTEGER,                    -- e.g. 6, 8, 9, 10...

  qty               NUMERIC(8,3) NOT NULL DEFAULT 0,  -- quantity of this component
  total_weight_kg   NUMERIC(8,3),               -- pre-computed weight for steel sections

  notes             TEXT,

  UNIQUE (component_id, capacity_kw_min, capacity_kw_max)
);

-- 3. Create the add-on table (walkway, ladder) — priced per meter
CREATE TABLE IF NOT EXISTS eq_structure_addons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES profiles(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,              -- 'Walkway', 'Ladder'
  material          TEXT NOT NULL DEFAULT 'GP', -- GP / GI
  unit              TEXT NOT NULL DEFAULT 'Meter',
  rate_per_unit     NUMERIC(10,2) NOT NULL,     -- ₹/meter
  buy_price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_pct           NUMERIC(5,4) NOT NULL DEFAULT 0.18,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_str_components_structure ON eq_structure_components(structure_id);
CREATE INDEX IF NOT EXISTS idx_str_bom_structure        ON eq_structure_bom(structure_id);
CREATE INDEX IF NOT EXISTS idx_str_bom_component        ON eq_structure_bom(component_id);
CREATE INDEX IF NOT EXISTS idx_str_addons_name          ON eq_structure_addons(name, material);

-- 5. RLS — match pattern of other eq_ tables
ALTER TABLE eq_structure_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_structure_bom        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_structure_addons     ENABLE ROW LEVEL SECURITY;

-- Components: org can read their own + global (org_id IS NULL)
DROP POLICY IF EXISTS "read_structure_components" ON eq_structure_components;
CREATE POLICY "read_structure_components" ON eq_structure_components
  FOR SELECT USING (org_id IS NULL OR org_id = auth.uid());

DROP POLICY IF EXISTS "read_structure_bom" ON eq_structure_bom;
CREATE POLICY "read_structure_bom" ON eq_structure_bom
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "read_structure_addons" ON eq_structure_addons;
CREATE POLICY "read_structure_addons" ON eq_structure_addons
  FOR SELECT USING (org_id IS NULL OR org_id = auth.uid());

COMMENT ON TABLE eq_structure_components IS
  'Itemized BOM components for each mounting structure type (GI/GP), categorized by steel, hardware, finishing, civil, and fabrication';

COMMENT ON TABLE eq_structure_bom IS
  'Per-system-capacity quantity mapping for structure BOM components';

COMMENT ON TABLE eq_structure_addons IS
  'Per-meter priced add-ons for mounting structures: walkway and ladder';
