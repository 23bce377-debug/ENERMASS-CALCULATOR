-- =============================================================================
-- Migration: 202606200001_canonical_pricing_columns.sql
-- Purpose:   Add GENERATED ALWAYS AS computed columns so legacy SELECT queries
--            using `rate_per_watt` (panels) and `rate` (inverters, batteries)
--            resolve without rewriting every call-site.
--
-- Strategy:  STORED generated columns derived from `selling_price` and
--            `wattage_w`.  Because they are GENERATED ALWAYS the database owns
--            them; application code must never INSERT or UPDATE them directly.
--
-- RLS Note:  These columns inherit the RLS policy of their parent table.
--            No additional policy is required — the computed value is only
--            readable when the Row is already readable by the session.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. eq_panels  →  rate_per_watt  (selling_price / wattage_w)
-- ---------------------------------------------------------------------------
ALTER TABLE eq_panels
  ADD COLUMN IF NOT EXISTS rate_per_watt numeric
    GENERATED ALWAYS AS (selling_price / NULLIF(wattage_w, 0)) STORED;

-- ---------------------------------------------------------------------------
-- 2. eq_inverters  →  rate  (alias for selling_price, keeps legacy callers happy)
-- ---------------------------------------------------------------------------
ALTER TABLE eq_inverters
  ADD COLUMN IF NOT EXISTS rate numeric
    GENERATED ALWAYS AS (selling_price) STORED;

-- ---------------------------------------------------------------------------
-- 3. eq_batteries  →  rate  (alias for selling_price, keeps legacy callers happy)
-- ---------------------------------------------------------------------------
ALTER TABLE eq_batteries
  ADD COLUMN IF NOT EXISTS rate numeric
    GENERATED ALWAYS AS (selling_price) STORED;

-- ---------------------------------------------------------------------------
-- 4. Performance indexes
-- ---------------------------------------------------------------------------

-- Equipment tables — partial index on active records per org (most frequent
-- cache-fill pattern is WHERE org_id = $1 AND is_active = true).
CREATE INDEX IF NOT EXISTS idx_eq_panels_org_active
  ON eq_panels(org_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_eq_inverters_org_active
  ON eq_inverters(org_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_eq_batteries_org_active
  ON eq_batteries(org_id, is_active)
  WHERE is_active = true;

-- BOM tables — foreign key traversal and ordered listing.
CREATE INDEX IF NOT EXISTS idx_bom_template_items_category
  ON bom_template_items(category_id);

CREATE INDEX IF NOT EXISTS idx_bom_categories_display_order
  ON bom_categories(display_order);
