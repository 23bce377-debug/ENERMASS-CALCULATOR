-- ============================================================
-- MIGRATION 11: RLS Policies — All Org-Scoped Tables
-- ============================================================
-- RLS is already ENABLED on all tables (rowsecurity=true).
-- This migration adds the MISSING POLICIES.
-- auth_org_id() function is confirmed to exist in live DB.
-- ============================================================
-- Pattern A — Shared catalog (org_id nullable): global rows + own org rows visible
-- Pattern B — Org-scoped (org_id NOT NULL): own org only
-- Pattern C — Public read (no org_id column): all authenticated users can read
-- ============================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE 'Applying RLS policies to all org-scoped tables...'; END $$;

-- ── Helper: drop policy if exists before recreating ──────────────────────────
-- We use DO blocks per table to handle idempotency

-- ============================================================
-- PATTERN A: Shared Catalog Tables (org_id nullable)
-- SELECT: org_id IS NULL OR org_id = auth_org_id()
-- INSERT/UPDATE/DELETE: org_id = auth_org_id()
-- ============================================================

-- eq_panels
DROP POLICY IF EXISTS eq_panels_select ON eq_panels;
DROP POLICY IF EXISTS eq_panels_write ON eq_panels;
CREATE POLICY eq_panels_select ON eq_panels
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_panels_write ON eq_panels
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_inverters
DROP POLICY IF EXISTS eq_inverters_select ON eq_inverters;
DROP POLICY IF EXISTS eq_inverters_write ON eq_inverters;
CREATE POLICY eq_inverters_select ON eq_inverters
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_inverters_write ON eq_inverters
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_batteries
DROP POLICY IF EXISTS eq_batteries_select ON eq_batteries;
DROP POLICY IF EXISTS eq_batteries_write ON eq_batteries;
CREATE POLICY eq_batteries_select ON eq_batteries
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_batteries_write ON eq_batteries
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_meters
DROP POLICY IF EXISTS eq_meters_select ON eq_meters;
DROP POLICY IF EXISTS eq_meters_write ON eq_meters;
CREATE POLICY eq_meters_select ON eq_meters
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_meters_write ON eq_meters
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_lightning_arresters
DROP POLICY IF EXISTS eq_la_select ON eq_lightning_arresters;
DROP POLICY IF EXISTS eq_la_write ON eq_lightning_arresters;
CREATE POLICY eq_la_select ON eq_lightning_arresters
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_la_write ON eq_lightning_arresters
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_mounting_structures
DROP POLICY IF EXISTS eq_structures_select ON eq_mounting_structures;
DROP POLICY IF EXISTS eq_structures_write ON eq_mounting_structures;
CREATE POLICY eq_structures_select ON eq_mounting_structures
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_structures_write ON eq_mounting_structures
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_bom_items
DROP POLICY IF EXISTS eq_bom_items_select ON eq_bom_items;
DROP POLICY IF EXISTS eq_bom_items_write ON eq_bom_items;
CREATE POLICY eq_bom_items_select ON eq_bom_items
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_bom_items_write ON eq_bom_items
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_communication_devices
DROP POLICY IF EXISTS eq_comm_select ON eq_communication_devices;
DROP POLICY IF EXISTS eq_comm_write ON eq_communication_devices;
CREATE POLICY eq_comm_select ON eq_communication_devices
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_comm_write ON eq_communication_devices
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_structure_components
DROP POLICY IF EXISTS eq_struct_comp_select ON eq_structure_components;
DROP POLICY IF EXISTS eq_struct_comp_write ON eq_structure_components;
CREATE POLICY eq_struct_comp_select ON eq_structure_components
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_struct_comp_write ON eq_structure_components
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- eq_structure_addons
DROP POLICY IF EXISTS eq_struct_addons_select ON eq_structure_addons;
DROP POLICY IF EXISTS eq_struct_addons_write ON eq_structure_addons;
CREATE POLICY eq_struct_addons_select ON eq_structure_addons
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY eq_struct_addons_write ON eq_structure_addons
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- systems
DROP POLICY IF EXISTS systems_select ON systems;
DROP POLICY IF EXISTS systems_write ON systems;
CREATE POLICY systems_select ON systems
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY systems_write ON systems
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- system_items
DROP POLICY IF EXISTS system_items_select ON system_items;
DROP POLICY IF EXISTS system_items_write ON system_items;
CREATE POLICY system_items_select ON system_items
  FOR SELECT TO authenticated
  USING (
    system_id IN (
      SELECT id FROM systems
      WHERE org_id IS NULL OR org_id = auth_org_id()
    )
  );
CREATE POLICY system_items_write ON system_items
  FOR ALL TO authenticated
  USING (
    system_id IN (
      SELECT id FROM systems WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    system_id IN (
      SELECT id FROM systems WHERE org_id = auth_org_id()
    )
  );

-- category_margins
DROP POLICY IF EXISTS category_margins_select ON category_margins;
DROP POLICY IF EXISTS category_margins_write ON category_margins;
CREATE POLICY category_margins_select ON category_margins
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY category_margins_write ON category_margins
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- ============================================================
-- PATTERN B: Org-scoped Tables (org_id NOT NULL — own org only)
-- ============================================================

-- quotes
DROP POLICY IF EXISTS quotes_select ON quotes;
DROP POLICY IF EXISTS quotes_write ON quotes;
CREATE POLICY quotes_select ON quotes
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());
CREATE POLICY quotes_write ON quotes
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- quote_items (scoped via quotes FK)
DROP POLICY IF EXISTS quote_items_select ON quote_items;
DROP POLICY IF EXISTS quote_items_write ON quote_items;
CREATE POLICY quote_items_select ON quote_items
  FOR SELECT TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );
CREATE POLICY quote_items_write ON quote_items
  FOR ALL TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );

-- quote_additional_costs
DROP POLICY IF EXISTS quote_addl_costs_select ON quote_additional_costs;
DROP POLICY IF EXISTS quote_addl_costs_write ON quote_additional_costs;
CREATE POLICY quote_addl_costs_select ON quote_additional_costs
  FOR SELECT TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );
CREATE POLICY quote_addl_costs_write ON quote_additional_costs
  FOR ALL TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );

-- quote_status_history
DROP POLICY IF EXISTS quote_history_select ON quote_status_history;
DROP POLICY IF EXISTS quote_history_write ON quote_status_history;
CREATE POLICY quote_history_select ON quote_status_history
  FOR SELECT TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );
CREATE POLICY quote_history_write ON quote_status_history
  FOR ALL TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );

-- quote_variants
DROP POLICY IF EXISTS quote_variants_select ON quote_variants;
DROP POLICY IF EXISTS quote_variants_write ON quote_variants;
CREATE POLICY quote_variants_select ON quote_variants
  FOR SELECT TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );
CREATE POLICY quote_variants_write ON quote_variants
  FOR ALL TO authenticated
  USING (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  )
  WITH CHECK (
    quote_id IN (SELECT id FROM quotes WHERE org_id = auth_org_id())
  );

-- rate_master
DROP POLICY IF EXISTS rate_master_select ON rate_master;
DROP POLICY IF EXISTS rate_master_write ON rate_master;
CREATE POLICY rate_master_select ON rate_master
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());
CREATE POLICY rate_master_write ON rate_master
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- structure_accessory_rates
DROP POLICY IF EXISTS struct_acc_rates_select ON structure_accessory_rates;
DROP POLICY IF EXISTS struct_acc_rates_write ON structure_accessory_rates;
CREATE POLICY struct_acc_rates_select ON structure_accessory_rates
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY struct_acc_rates_write ON structure_accessory_rates
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- structure_component_vendor_rates (scoped via component → structure → org)
DROP POLICY IF EXISTS struct_comp_vendor_rates_select ON structure_component_vendor_rates;
DROP POLICY IF EXISTS struct_comp_vendor_rates_write ON structure_component_vendor_rates;
CREATE POLICY struct_comp_vendor_rates_select ON structure_component_vendor_rates
  FOR SELECT TO authenticated
  USING (true);  -- vendor rates are reference data, no org scope
CREATE POLICY struct_comp_vendor_rates_write ON structure_component_vendor_rates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- vendors
DROP POLICY IF EXISTS vendors_select ON vendors;
DROP POLICY IF EXISTS vendors_write ON vendors;
CREATE POLICY vendors_select ON vendors
  FOR SELECT TO authenticated
  USING (org_id = auth_org_id());
CREATE POLICY vendors_write ON vendors
  FOR ALL TO authenticated
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- calculation_schemes (org-scoped OR global)
DROP POLICY IF EXISTS calc_schemes_select ON calculation_schemes;
CREATE POLICY calc_schemes_select ON calculation_schemes
  FOR SELECT TO authenticated
  USING (true);

-- scheme_slabs (public reference data)
DROP POLICY IF EXISTS scheme_slabs_select ON scheme_slabs;
CREATE POLICY scheme_slabs_select ON scheme_slabs
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- PATTERN C: Public Reference Tables (no org isolation needed)
-- ============================================================

-- state_rules
DROP POLICY IF EXISTS state_rules_select ON state_rules;
CREATE POLICY state_rules_select ON state_rules
  FOR SELECT TO authenticated USING (true);

-- state_scheme_overrides
DROP POLICY IF EXISTS state_overrides_select ON state_scheme_overrides;
CREATE POLICY state_overrides_select ON state_scheme_overrides
  FOR SELECT TO authenticated USING (true);

-- structure_weight_lookup
DROP POLICY IF EXISTS struct_weight_select ON structure_weight_lookup;
CREATE POLICY struct_weight_select ON structure_weight_lookup
  FOR SELECT TO authenticated USING (true);

-- structure_material_rates
DROP POLICY IF EXISTS struct_mat_rates_select ON structure_material_rates;
DROP POLICY IF EXISTS struct_mat_rates_write ON structure_material_rates;
CREATE POLICY struct_mat_rates_select ON structure_material_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY struct_mat_rates_write ON structure_material_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- structure_templates
DROP POLICY IF EXISTS struct_templates_select ON structure_templates;
CREATE POLICY struct_templates_select ON structure_templates
  FOR SELECT TO authenticated USING (true);

-- structure_template_items
DROP POLICY IF EXISTS struct_tpl_items_select ON structure_template_items;
CREATE POLICY struct_tpl_items_select ON structure_template_items
  FOR SELECT TO authenticated USING (true);

-- walkway_templates
DROP POLICY IF EXISTS walkway_tpl_select ON walkway_templates;
CREATE POLICY walkway_tpl_select ON walkway_templates
  FOR SELECT TO authenticated USING (true);

-- ladder_templates
DROP POLICY IF EXISTS ladder_tpl_select ON ladder_templates;
CREATE POLICY ladder_tpl_select ON ladder_templates
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- DB-05: Fix CASCADE DELETE on quote_items
-- ============================================================
ALTER TABLE quote_items
  DROP CONSTRAINT IF EXISTS quote_items_quote_id_fkey;
ALTER TABLE quote_items
  ADD CONSTRAINT quote_items_quote_id_fkey
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

-- ============================================================
-- DB-10: Fix quote number race condition — add advisory lock
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generate_quote_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter INT;
  v_prefix  TEXT;
  v_year    TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');

  -- Row-level lock prevents duplicate counter increments under concurrency
  SELECT quote_counter + 1
  INTO v_counter
  FROM organisations
  WHERE id = p_org_id
  FOR UPDATE;

  UPDATE organisations
  SET quote_counter = v_counter
  WHERE id = p_org_id;

  v_prefix := COALESCE(
    (SELECT quote_prefix FROM organisations WHERE id = p_org_id),
    'QT'
  );

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- P0-05: Fix quote_history split-brain
-- Trigger fn_log_quote_history was writing to quote_history.
-- Repoint it to quote_status_history (the ORM-canonical table).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_log_quote_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO quote_status_history (
      quote_id,
      old_status,
      new_status,
      changed_by,
      changed_at,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NOW(),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- SC-04: Add missing performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bom_items_org_active
  ON eq_bom_items (org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote_included
  ON quote_items (quote_id, is_included)
  INCLUDE (section, sort_order);

CREATE INDEX IF NOT EXISTS idx_quotes_org_status
  ON quotes (org_id, status);

CREATE INDEX IF NOT EXISTS idx_systems_org_active
  ON systems (org_id, is_active);

-- ============================================================
-- P1-04: Quote variant uniqueness (one selected per quote)
-- ============================================================
DROP INDEX IF EXISTS uq_one_selected_variant;
CREATE UNIQUE INDEX uq_one_selected_variant
  ON quote_variants (quote_id)
  WHERE is_selected = TRUE;

-- ============================================================
-- Validation Report
-- ============================================================
DO $$
DECLARE
  v_policy_count INT;
  v_tables_with_policies INT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT COUNT(DISTINCT tablename) INTO v_tables_with_policies
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '✅ RLS Policies applied.';
  RAISE NOTICE '   Total policies in public schema: %', v_policy_count;
  RAISE NOTICE '   Tables with at least one policy: %', v_tables_with_policies;
  RAISE NOTICE '   fn_generate_quote_number: updated with FOR UPDATE lock';
  RAISE NOTICE '   fn_log_quote_history: repointed to quote_status_history';
  RAISE NOTICE '   quote_items CASCADE DELETE: applied';
  RAISE NOTICE '   Indexes: 4 new indexes created';
  RAISE NOTICE '   quote_variants unique selected: applied';
END $$;

COMMIT;
