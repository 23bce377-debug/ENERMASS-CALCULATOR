-- ============================================================
-- MIGRATION 0102: Comprehensive RLS & Tenant Security Hardening
-- ============================================================
-- 1. Harden auth_org_id() and current_org_id() with fallback resolution.
-- 2. Grant table and schema privileges so RLS handles row filtering without SQL permission errors.
-- 3. Define explicit RLS policies for locked-out tables (permissions, org_role_permissions, rate_master_audit_logs, system_state_availability, user_roles).
-- 4. Harmonize and reinforce RLS policies across all tables.
-- ============================================================

BEGIN;

-- 1. Resilient Tenant Context Functions
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'org_id', '')::uuid,
    NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'org_id', '')::uuid,
    (SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND status = 'active' ORDER BY created_at ASC LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'user_role', ''),
    NULLIF(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    'authenticated'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.auth_org_id();
$$;

-- 2. Grant Schema & Table Privileges
-- Gives anon and authenticated permission to interact with the tables,
-- allowing PostgreSQL Row Level Security (RLS) to enforce row-level boundaries.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- Ensure all tables in public schema have RLS enabled
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- 3. Policies for the 5 Previously Locked-Out Tables

-- A. permissions (Global Catalog)
DROP POLICY IF EXISTS permissions_select ON public.permissions;
DROP POLICY IF EXISTS permissions_admin ON public.permissions;
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated, anon
  USING (true);
CREATE POLICY permissions_admin ON public.permissions
  FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- B. org_role_permissions (Org Scoped via org_roles)
DROP POLICY IF EXISTS org_role_permissions_select ON public.org_role_permissions;
DROP POLICY IF EXISTS org_role_permissions_admin ON public.org_role_permissions;
CREATE POLICY org_role_permissions_select ON public.org_role_permissions
  FOR SELECT TO authenticated
  USING (
    is_superadmin() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE organization_id = current_org_id()
    )
  );
CREATE POLICY org_role_permissions_admin ON public.org_role_permissions
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE is_org_admin(organization_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE is_org_admin(organization_id)
    )
  );

-- C. rate_master_audit_logs (Tenant Scoped by org_id)
DROP POLICY IF EXISTS rate_master_audit_logs_select ON public.rate_master_audit_logs;
DROP POLICY IF EXISTS rate_master_audit_logs_insert ON public.rate_master_audit_logs;
CREATE POLICY rate_master_audit_logs_select ON public.rate_master_audit_logs
  FOR SELECT TO authenticated
  USING (is_superadmin() OR org_id = auth_org_id());
CREATE POLICY rate_master_audit_logs_insert ON public.rate_master_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR org_id = auth_org_id());

-- D. system_state_availability (Child table of systems)
DROP POLICY IF EXISTS system_state_availability_select ON public.system_state_availability;
DROP POLICY IF EXISTS system_state_availability_write ON public.system_state_availability;
CREATE POLICY system_state_availability_select ON public.system_state_availability
  FOR SELECT TO authenticated, anon
  USING (
    system_id IN (
      SELECT id FROM public.systems WHERE org_id IS NULL OR org_id = auth_org_id()
    )
  );
CREATE POLICY system_state_availability_write ON public.system_state_availability
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    system_id IN (
      SELECT id FROM public.systems WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    system_id IN (
      SELECT id FROM public.systems WHERE org_id = auth_org_id()
    )
  );

-- E. user_roles (User & Org Role Mapping)
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    is_superadmin() OR
    user_id = auth.uid() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE organization_id = current_org_id()
    )
  );
CREATE POLICY user_roles_admin ON public.user_roles
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE is_org_admin(organization_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR
    org_role_id IN (
      SELECT id FROM public.org_roles WHERE is_org_admin(organization_id)
    )
  );

-- 4. User Personal Tables
-- preset_favorites
DROP POLICY IF EXISTS preset_favorites_all ON public.preset_favorites;
CREATE POLICY preset_favorites_all ON public.preset_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- preset_usage_history
DROP POLICY IF EXISTS preset_usage_history_all ON public.preset_usage_history;
CREATE POLICY preset_usage_history_all ON public.preset_usage_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Child and FK-dependent tables
-- net_metering_applications
DROP POLICY IF EXISTS net_metering_applications_via_project ON public.net_metering_applications;
CREATE POLICY net_metering_applications_via_project ON public.net_metering_applications
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  );

-- epc_project_milestones
DROP POLICY IF EXISTS epc_project_milestones_via_project ON public.epc_project_milestones;
CREATE POLICY epc_project_milestones_via_project ON public.epc_project_milestones
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  );

-- epc_work_orders
DROP POLICY IF EXISTS epc_work_orders_via_project ON public.epc_work_orders;
CREATE POLICY epc_work_orders_via_project ON public.epc_work_orders
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    project_id IN (
      SELECT id FROM public.epc_projects WHERE org_id = auth_org_id()
    )
  );

-- proc_po_items
DROP POLICY IF EXISTS proc_po_items_via_po ON public.proc_po_items;
CREATE POLICY proc_po_items_via_po ON public.proc_po_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    po_id IN (
      SELECT id FROM public.proc_purchase_orders WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    po_id IN (
      SELECT id FROM public.proc_purchase_orders WHERE org_id = auth_org_id()
    )
  );

-- proc_grn_items
DROP POLICY IF EXISTS proc_grn_items_via_grn ON public.proc_grn_items;
CREATE POLICY proc_grn_items_via_grn ON public.proc_grn_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    grn_id IN (
      SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    grn_id IN (
      SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = auth_org_id()
    )
  );

-- proc_rfq_items
DROP POLICY IF EXISTS proc_rfq_items_via_rfq ON public.proc_rfq_items;
CREATE POLICY proc_rfq_items_via_rfq ON public.proc_rfq_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    rfq_id IN (
      SELECT id FROM public.proc_rfqs WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    rfq_id IN (
      SELECT id FROM public.proc_rfqs WHERE org_id = auth_org_id()
    )
  );

-- proc_vendor_bids
DROP POLICY IF EXISTS proc_vendor_bids_via_rfq ON public.proc_vendor_bids;
CREATE POLICY proc_vendor_bids_via_rfq ON public.proc_vendor_bids
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    rfq_id IN (
      SELECT id FROM public.proc_rfqs WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    rfq_id IN (
      SELECT id FROM public.proc_rfqs WHERE org_id = auth_org_id()
    )
  );

-- acquisition_items
DROP POLICY IF EXISTS acquisition_items_via_acq ON public.acquisition_items;
CREATE POLICY acquisition_items_via_acq ON public.acquisition_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    acquisition_id IN (
      SELECT id FROM public.acquisitions WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    acquisition_id IN (
      SELECT id FROM public.acquisitions WHERE org_id = auth_org_id()
    )
  );

-- acquisition_bundles
DROP POLICY IF EXISTS acquisition_bundles_via_acq ON public.acquisition_bundles;
CREATE POLICY acquisition_bundles_via_acq ON public.acquisition_bundles
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    acquisition_id IN (
      SELECT id FROM public.acquisitions WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    acquisition_id IN (
      SELECT id FROM public.acquisitions WHERE org_id = auth_org_id()
    )
  );

-- bundle_preset_items
DROP POLICY IF EXISTS bundle_preset_items_via_preset ON public.bundle_preset_items;
CREATE POLICY bundle_preset_items_via_preset ON public.bundle_preset_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    bundle_preset_id IN (
      SELECT id FROM public.bundle_presets WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    bundle_preset_id IN (
      SELECT id FROM public.bundle_presets WHERE org_id = auth_org_id()
    )
  );

-- bom_preset_items
DROP POLICY IF EXISTS bom_preset_items_via_preset ON public.bom_preset_items;
CREATE POLICY bom_preset_items_via_preset ON public.bom_preset_items
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR
    bom_preset_id IN (
      SELECT id FROM public.bom_presets WHERE org_id = auth_org_id()
    )
  )
  WITH CHECK (
    is_superadmin() OR
    bom_preset_id IN (
      SELECT id FROM public.bom_presets WHERE org_id = auth_org_id()
    )
  );

-- 6. Public Reference / Master Data Tables
DROP POLICY IF EXISTS state_rules_public_read ON public.state_rules;
CREATE POLICY state_rules_public_read ON public.state_rules FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS scheme_slabs_public_read ON public.scheme_slabs;
CREATE POLICY scheme_slabs_public_read ON public.scheme_slabs FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS state_scheme_overrides_public_read ON public.state_scheme_overrides;
CREATE POLICY state_scheme_overrides_public_read ON public.state_scheme_overrides FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS state_terms_templates_public_read ON public.state_terms_templates;
CREATE POLICY state_terms_templates_public_read ON public.state_terms_templates FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
CREATE POLICY subscription_plans_public_read ON public.subscription_plans FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS tax_gst_rates_public_read ON public.tax_gst_rates;
CREATE POLICY tax_gst_rates_public_read ON public.tax_gst_rates FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS preset_tags_public_read ON public.preset_tags;
CREATE POLICY preset_tags_public_read ON public.preset_tags FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS preset_tag_mappings_public_read ON public.preset_tag_mappings;
CREATE POLICY preset_tag_mappings_public_read ON public.preset_tag_mappings FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS structure_weight_lookup_public_read ON public.structure_weight_lookup;
CREATE POLICY structure_weight_lookup_public_read ON public.structure_weight_lookup FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS structure_templates_public_read ON public.structure_templates;
CREATE POLICY structure_templates_public_read ON public.structure_templates FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS structure_template_items_public_read ON public.structure_template_items;
CREATE POLICY structure_template_items_public_read ON public.structure_template_items FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS walkway_templates_public_read ON public.walkway_templates;
CREATE POLICY walkway_templates_public_read ON public.walkway_templates FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS ladder_templates_public_read ON public.ladder_templates;
CREATE POLICY ladder_templates_public_read ON public.ladder_templates FOR SELECT TO authenticated, anon USING (true);

-- 7. Shared Catalog / Masters with Org Overrides
-- structure_accessory_rates
DROP POLICY IF EXISTS struct_accessory_rates_select_clean ON public.structure_accessory_rates;
DROP POLICY IF EXISTS struct_accessory_rates_write_clean ON public.structure_accessory_rates;
CREATE POLICY struct_accessory_rates_select_clean ON public.structure_accessory_rates
  FOR SELECT TO authenticated, anon
  USING (is_superadmin() OR org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY struct_accessory_rates_write_clean ON public.structure_accessory_rates
  FOR ALL TO authenticated
  USING (is_superadmin() OR org_id = auth_org_id())
  WITH CHECK (is_superadmin() OR org_id = auth_org_id());

-- calculation_schemes
DROP POLICY IF EXISTS calculation_schemes_select_clean ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_write_clean ON public.calculation_schemes;
CREATE POLICY calculation_schemes_select_clean ON public.calculation_schemes
  FOR SELECT TO authenticated, anon
  USING (is_superadmin() OR org_id IS NULL OR org_id = auth_org_id());
CREATE POLICY calculation_schemes_write_clean ON public.calculation_schemes
  FOR ALL TO authenticated
  USING (is_superadmin() OR org_id = auth_org_id())
  WITH CHECK (is_superadmin() OR org_id = auth_org_id());

COMMIT;
