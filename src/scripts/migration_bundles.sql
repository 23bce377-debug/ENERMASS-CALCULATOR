-- ============================================================
-- ENERMASS SOLAR CALCULATOR — PROCUREMENT BUNDLE PRESETS SCHEMA
-- ============================================================

-- ─── BUNDLE PRESETS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_presets (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    vendor_id              UUID REFERENCES vendors(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    effective_bundle_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    allocation_strategy    TEXT NOT NULL DEFAULT 'proportional_cost', -- 'proportional_cost', 'proportional_qty', 'manual'
    notes                  TEXT,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    gst_pct                NUMERIC(5, 4) DEFAULT 0.18,
    created_by             UUID REFERENCES profiles(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_bundle_presets_org ON bundle_presets(org_id);
CREATE INDEX IF NOT EXISTS idx_bundle_presets_vendor ON bundle_presets(vendor_id);

-- ─── BUNDLE PRESET ITEMS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_preset_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_preset_id        UUID NOT NULL REFERENCES bundle_presets(id) ON DELETE CASCADE,
    item_description        TEXT NOT NULL,
    category                bom_section NOT NULL,
    qty                     NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit                    TEXT NOT NULL DEFAULT 'Nos',
    base_cost               NUMERIC(15, 2) NOT NULL DEFAULT 0,
    allocated_cost_override NUMERIC(15, 2),
    gst_pct                 NUMERIC(5, 4) DEFAULT 0.18,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundle_preset_items_parent ON bundle_preset_items(bundle_preset_id);

-- ─── ACQUISITION BUNDLE INSTANCES ───────────────────────────
CREATE TABLE IF NOT EXISTS acquisition_bundles (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acquisition_id         UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
    bundle_preset_id       UUID REFERENCES bundle_presets(id) ON DELETE SET NULL,
    name                   TEXT NOT NULL,
    qty                    NUMERIC(12, 2) NOT NULL DEFAULT 1,
    effective_bundle_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    allocation_strategy    TEXT NOT NULL DEFAULT 'proportional_cost',
    gst_pct                NUMERIC(5, 4) DEFAULT 0.18,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acq_bundles_parent ON acquisition_bundles(acquisition_id);

-- ─── ACQUISITION ITEMS LINKAGE ──────────────────────────────
ALTER TABLE acquisition_items ADD COLUMN IF NOT EXISTS acquisition_bundle_id UUID REFERENCES acquisition_bundles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_acq_items_bundle ON acquisition_items(acquisition_bundle_id);

-- ─── TRIGGERS FOR VERSIONING ────────────────────────────────
DROP TRIGGER IF EXISTS trg_bundle_presets_updated_at ON bundle_presets;
CREATE TRIGGER trg_bundle_presets_updated_at
  BEFORE UPDATE ON bundle_presets FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_bundle_presets_version ON bundle_presets;
CREATE TRIGGER trg_bundle_presets_version
  BEFORE UPDATE ON bundle_presets FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

-- ─── SECURITY: ENABLE ROW LEVEL SECURITY ────────────────────
ALTER TABLE bundle_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_preset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_bundles ENABLE ROW LEVEL SECURITY;

-- ─── SECURITY: DEFINE RLS POLICIES ─────────────────────────
DROP POLICY IF EXISTS "bundle_presets_org_isolation" ON bundle_presets;
CREATE POLICY "bundle_presets_org_isolation" ON bundle_presets
  FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "bundle_preset_items_org_isolation" ON bundle_preset_items;
CREATE POLICY "bundle_preset_items_org_isolation" ON bundle_preset_items
  FOR ALL USING (bundle_preset_id IN (SELECT id FROM bundle_presets WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "acquisition_bundles_org_isolation" ON acquisition_bundles;
CREATE POLICY "acquisition_bundles_org_isolation" ON acquisition_bundles
  FOR ALL USING (acquisition_id IN (SELECT id FROM acquisitions WHERE org_id = auth_org_id()));
