-- ============================================================
-- MIGRATION 11: PRODUCTION READINESS — PHASE 1: SECURITY & RLS
-- Resolves: DB-01, DB-03, DB-04, DB-05, DB-07, DB-10,
--           SC-04, SC-05, SC-06,
--           SEC-02, SEC-03, SEC-05, SEC-06, SEC-08, SEC-09, SEC-10,
--           MD-07
-- Run this FIRST before any other fix migration.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- FIX SEC-02 (ROOT CAUSE OF ALL RLS FAILURES):
-- auth_org_id() must read from profiles table using SECURITY DEFINER.
-- The old version tried to read a JWT claim that Supabase never sets.
-- This bridges auth.uid() → org_id through the profiles table.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- Role helper (same pattern)
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX DB-01 + SEC-03 + SEC-05 + SEC-06:
-- Enable RLS on all tables missing it, then add org-scoped policies.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE eq_meters                ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_lightning_arresters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_bom_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eq_communication_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_schemes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_slabs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_scheme_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_rules              ENABLE ROW LEVEL SECURITY;

-- eq_meters: global rows (org_id IS NULL) visible to all orgs
DROP POLICY IF EXISTS "eq_meters_visibility" ON eq_meters;
DROP POLICY IF EXISTS "eq_meters_write"      ON eq_meters;
CREATE POLICY "eq_meters_visibility" ON eq_meters
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "eq_meters_write" ON eq_meters
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_lightning_arresters
DROP POLICY IF EXISTS "eq_la_visibility" ON eq_lightning_arresters;
DROP POLICY IF EXISTS "eq_la_write"      ON eq_lightning_arresters;
CREATE POLICY "eq_la_visibility" ON eq_lightning_arresters
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "eq_la_write" ON eq_lightning_arresters
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_bom_items
DROP POLICY IF EXISTS "eq_bom_items_visibility" ON eq_bom_items;
DROP POLICY IF EXISTS "eq_bom_items_write"      ON eq_bom_items;
CREATE POLICY "eq_bom_items_visibility" ON eq_bom_items
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "eq_bom_items_write" ON eq_bom_items
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_communication_devices
DROP POLICY IF EXISTS "eq_comm_visibility" ON eq_communication_devices;
DROP POLICY IF EXISTS "eq_comm_write"      ON eq_communication_devices;
CREATE POLICY "eq_comm_visibility" ON eq_communication_devices
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "eq_comm_write" ON eq_communication_devices
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_mounting_structures (SELECT policy existed; add write + fix SELECT)
DROP POLICY IF EXISTS "eq_structures_visibility" ON eq_mounting_structures;
DROP POLICY IF EXISTS "eq_structures_write"      ON eq_mounting_structures;
CREATE POLICY "eq_structures_visibility" ON eq_mounting_structures
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "eq_structures_write" ON eq_mounting_structures
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- structure_weight_lookup: follows parent structure
DROP POLICY IF EXISTS "struct_weight_lookup_visibility" ON structure_weight_lookup;
CREATE POLICY "struct_weight_lookup_visibility" ON structure_weight_lookup
  FOR SELECT USING (
    structure_id IN (
      SELECT id FROM eq_mounting_structures
      WHERE org_id IS NULL OR org_id = auth_org_id()
    )
  );

-- FIX DB-07: structure_accessory_rates (created in migration 02)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'structure_accessory_rates') THEN
    EXECUTE 'ALTER TABLE structure_accessory_rates ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "struct_accessory_rates_visibility" ON structure_accessory_rates';
    EXECUTE 'DROP POLICY IF EXISTS "struct_accessory_rates_write"      ON structure_accessory_rates';
    EXECUTE $pol$
      CREATE POLICY "struct_accessory_rates_visibility" ON structure_accessory_rates
        FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id())
    $pol$;
    EXECUTE $pol$
      CREATE POLICY "struct_accessory_rates_write" ON structure_accessory_rates
        FOR ALL TO authenticated
        USING    (org_id = auth_org_id())
        WITH CHECK (org_id = auth_org_id())
    $pol$;
  END IF;
END;
$$;

-- FIX SEC-05: rate_master (had RLS enabled, no policies)
DROP POLICY IF EXISTS "rate_master_org"       ON rate_master;
DROP POLICY IF EXISTS "rate_master_org_read"  ON rate_master;
DROP POLICY IF EXISTS "rate_master_org_write" ON rate_master;
CREATE POLICY "rate_master_org_read" ON rate_master
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "rate_master_org_write" ON rate_master
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- FIX SEC-06: category_margins
DROP POLICY IF EXISTS "category_margins_org"       ON category_margins;
DROP POLICY IF EXISTS "category_margins_org_read"  ON category_margins;
DROP POLICY IF EXISTS "category_margins_org_write" ON category_margins;
CREATE POLICY "category_margins_org_read" ON category_margins
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "category_margins_org_write" ON category_margins
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- calculation_schemes + scheme_slabs + state_scheme_overrides:
-- Global config — all authenticated users can READ; only service_role writes.
CREATE POLICY "calculation_schemes_read" ON calculation_schemes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "scheme_slabs_read" ON scheme_slabs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "state_scheme_overrides_read" ON state_scheme_overrides
  FOR SELECT TO authenticated USING (true);

-- state_rules: global reference data
CREATE POLICY "state_rules_read" ON state_rules
  FOR SELECT TO authenticated USING (true);

-- FIX SEC-10: systems — global templates visible to all, org templates scoped
DROP POLICY IF EXISTS "systems_visibility" ON systems;
DROP POLICY IF EXISTS "systems_read"  ON systems;
DROP POLICY IF EXISTS "systems_write" ON systems;
CREATE POLICY "systems_read" ON systems
  FOR SELECT USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY "systems_write" ON systems
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- system_items: follow parent system
DROP POLICY IF EXISTS "system_items_visibility" ON system_items;
DROP POLICY IF EXISTS "system_items_read"  ON system_items;
DROP POLICY IF EXISTS "system_items_write" ON system_items;
CREATE POLICY "system_items_read" ON system_items
  FOR SELECT USING (
    system_id IN (
      SELECT id FROM systems WHERE org_id IS NULL OR org_id = auth_org_id()
    )
  );
CREATE POLICY "system_items_write" ON system_items
  FOR ALL TO authenticated
  USING (
    system_id IN (SELECT id FROM systems WHERE org_id = auth_org_id())
  );



-- Reinforce existing quote write policy to cover ALL DML
DROP POLICY IF EXISTS "quotes_org_write" ON quotes;
CREATE POLICY "quotes_org_write" ON quotes
  FOR ALL TO authenticated
  USING    (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- quote_items: follows parent quote
DROP POLICY IF EXISTS "quote_items_org_read"  ON quote_items;
DROP POLICY IF EXISTS "quote_items_org_write" ON quote_items;
CREATE POLICY "quote_items_org_read" ON quote_items
  FOR SELECT USING (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));
CREATE POLICY "quote_items_org_write" ON quote_items
  FOR ALL TO authenticated
  USING    (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()))
  WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id()));

-- ──────────────────────────────────────────────────────────────
-- FIX SEC-09: Validate overrides_json is always a JSON object
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quote_variants
  DROP CONSTRAINT IF EXISTS ck_overrides_json_is_object;
ALTER TABLE quote_variants
  ADD CONSTRAINT ck_overrides_json_is_object
  CHECK (jsonb_typeof(overrides_json) = 'object');

-- ──────────────────────────────────────────────────────────────
-- FIX DB-10: Quote number race condition
-- Replaced bare UPDATE with SELECT ... FOR UPDATE to row-lock
-- the org before incrementing, preventing duplicate numbers
-- under concurrent requests.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_quote_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  TEXT;
  v_counter INTEGER;
  v_year    TEXT;
BEGIN
  -- Lock the org row FOR UPDATE to prevent concurrent duplicates
  SELECT quote_prefix, quote_counter + 1
  INTO   v_prefix, v_counter
  FROM   organisations
  WHERE  id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation not found: %', p_org_id;
  END IF;

  UPDATE organisations
  SET    quote_counter = v_counter
  WHERE  id = p_org_id;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX DB-05: Add missing ON DELETE CASCADE to quote_items.quote_id
-- ──────────────────────────────────────────────────────────────
ALTER TABLE quote_items
  DROP CONSTRAINT IF EXISTS quote_items_quote_id_fkey;
ALTER TABLE quote_items
  ADD CONSTRAINT quote_items_quote_id_fkey
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────
-- FIX DB-03: system_items single-ref enforcement via trigger
-- The CHECK constraint (= 1) already exists in schema but is
-- silent about zero refs. Replace with a descriptive trigger.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_system_item_single_ref_check()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ref_count INTEGER;
BEGIN
  ref_count :=
    (CASE WHEN NEW.panel_id               IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.inverter_id            IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.battery_id             IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.solar_meter_id         IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.net_meter_id           IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.la_id                  IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.structure_id           IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.bom_item_id            IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.comm_device_id         IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.structure_component_id IS NOT NULL THEN 1 ELSE 0 END);

  IF ref_count != 1 THEN
    RAISE EXCEPTION
      'system_items: row must reference EXACTLY ONE catalog item (found %). '
      'Set exactly one FK column to a valid UUID; all others must be NULL.',
      ref_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_item_single_ref ON system_items;
CREATE TRIGGER trg_system_item_single_ref
  BEFORE INSERT OR UPDATE ON system_items
  FOR EACH ROW EXECUTE FUNCTION fn_system_item_single_ref_check();

-- ──────────────────────────────────────────────────────────────
-- FIX SC-04: Missing index on eq_bom_items.org_id
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bom_items_org
  ON eq_bom_items(org_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- FIX SC-05: Covering index for quote BOM filtered reads
-- ──────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_quote_items_quote;
CREATE INDEX idx_quote_items_quote
  ON quote_items(quote_id, sort_order)
  INCLUDE (is_included, section, line_total);

-- ──────────────────────────────────────────────────────────────
-- FIX SC-06: Better index for structure weight range queries
-- ──────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_structure_weight;
CREATE INDEX idx_structure_weight
  ON structure_weight_lookup(structure_id, capacity_kw_min)
  INCLUDE (capacity_kw_max, total_weight_kg);

-- ──────────────────────────────────────────────────────────────
-- FIX DB-04: Proper eq_bom_items unique index for org isolation
-- Old COALESCE approach conflated NULL (global) with org rows.
-- Replace with two partial unique indexes.
-- ──────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS uq_bom_item;
CREATE UNIQUE INDEX uq_bom_item_global
  ON eq_bom_items(section, sub_type)
  WHERE org_id IS NULL;
CREATE UNIQUE INDEX uq_bom_item_org
  ON eq_bom_items(org_id, section, sub_type)
  WHERE org_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- FIX SEC-08: Audit trigger for quote_items.is_included changes
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_quote_item_inclusion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_included IS DISTINCT FROM NEW.is_included THEN
    INSERT INTO quote_status_history (quote_id, old_status, new_status, changed_by, notes)
    SELECT
      NEW.quote_id,
      NULL,
      (SELECT status FROM quotes WHERE id = NEW.quote_id LIMIT 1),
      auth.uid(),
      FORMAT(
        'BOM item "%s" (id: %s): %s → %s',
        NEW.description,
        NEW.id,
        CASE WHEN OLD.is_included THEN 'included' ELSE 'excluded' END,
        CASE WHEN NEW.is_included THEN 'included' ELSE 'excluded' END
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_quote_item_inclusion ON quote_items;
CREATE TRIGGER trg_audit_quote_item_inclusion
  AFTER UPDATE OF is_included ON quote_items
  FOR EACH ROW EXECUTE FUNCTION fn_audit_quote_item_inclusion();

-- ──────────────────────────────────────────────────────────────
-- FIX MD-07: Correct state GST values (Kerala/TN/MH = 13.8%)
-- ──────────────────────────────────────────────────────────────
UPDATE state_rules
SET    gst_on_output = 0.13800
WHERE  state_code IN ('MH', 'TN', 'KL')
  AND  gst_on_output != 0.13800;

COMMIT;
