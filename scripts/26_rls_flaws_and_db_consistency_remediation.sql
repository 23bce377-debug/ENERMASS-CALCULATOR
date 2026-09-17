-- ==============================================================================
-- MIGRATION 26: RLS FLAWS, DB CONSISTENCY & FLOW HARDENING REMEDIATION
-- ==============================================================================
-- Comprehensive fixes for:
-- 1. Orphaned rows & missing foreign key cascade constraints
-- 2. Critical cross-tenant RLS leaks (quote_history, sys_approval_*, calculation_schemes)
-- 3. Blocked tenant flows (payment_schedules, vendor_payments)
-- 4. Conflicting policy pollution overriding RBAC delete restrictions (quotes, epc_work_orders)
-- 5. Multi-tenant pollution (site_inventory, tax_hsn_sac)
-- 6. Profile privilege escalation protection (profiles trigger)
-- 7. Supabase Storage bucket hardening (documents and vault-* buckets)
-- ==============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 1: CLEAN UP ORPHANED ROWS & ENFORCE CASCADE CONSTRAINTS
-- ──────────────────────────────────────────────────────────────────────────────

-- 1.1 Delete orphaned rows in net_metering_applications
DELETE FROM public.net_metering_applications 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.epc_projects WHERE id = net_metering_applications.project_id);

-- 1.2 Delete orphaned row in inventory_movements (temporarily bypass immutability trigger for orphan cleanup)
ALTER TABLE public.inventory_movements DISABLE TRIGGER inventory_movements_no_delete;
ALTER TABLE public.inventory_movements DISABLE TRIGGER trg_inventory_immutable;

DELETE FROM public.inventory_movements 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.epc_projects WHERE id = inventory_movements.project_id);

ALTER TABLE public.inventory_movements ENABLE TRIGGER inventory_movements_no_delete;
ALTER TABLE public.inventory_movements ENABLE TRIGGER trg_inventory_immutable;

-- 1.3 Delete orphaned row in acquisition_items (temporarily bypass total validation trigger for orphan cleanup)
ALTER TABLE public.acquisition_items DISABLE TRIGGER trg_validate_acquisition_items_totals;

DELETE FROM public.acquisition_items 
WHERE acquisition_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.acquisitions WHERE id = acquisition_items.acquisition_id);

ALTER TABLE public.acquisition_items ENABLE TRIGGER trg_validate_acquisition_items_totals;

-- 1.4 Enforce ON DELETE CASCADE for net_metering_applications
ALTER TABLE public.net_metering_applications 
  DROP CONSTRAINT IF EXISTS net_metering_applications_project_id_fkey,
  ADD CONSTRAINT net_metering_applications_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES public.epc_projects(id) ON DELETE CASCADE;

-- 1.5 Enforce ON DELETE CASCADE for payment_schedules
ALTER TABLE public.payment_schedules 
  DROP CONSTRAINT IF EXISTS payment_schedules_quote_id_fkey,
  ADD CONSTRAINT payment_schedules_quote_id_fkey 
    FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 2: FIX CRITICAL RLS DATA LEAKS (quote_history, sys_approval_*)
-- ──────────────────────────────────────────────────────────────────────────────

-- 2.1 quote_history: Eliminate wide-open visibility policy
DROP POLICY IF EXISTS quote_history_visibility ON public.quote_history;
DROP POLICY IF EXISTS quote_history_org_read ON public.quote_history;
DROP POLICY IF EXISTS quote_history_org_write ON public.quote_history;

CREATE POLICY quote_history_org_read ON public.quote_history
  FOR SELECT TO authenticated
  USING (
    is_superadmin() OR 
    quote_id IN (
      SELECT id FROM public.quotes WHERE is_org_member(org_id)
    )
  );

CREATE POLICY quote_history_org_write ON public.quote_history
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    quote_id IN (
      SELECT id FROM public.quotes WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    quote_id IN (
      SELECT id FROM public.quotes WHERE is_org_member(org_id)
    )
  );

-- 2.2 sys_approval_history: Eliminate wide-open visibility policy
DROP POLICY IF EXISTS sys_approval_history_visibility ON public.sys_approval_history;
DROP POLICY IF EXISTS sys_approval_history_org_access ON public.sys_approval_history;

CREATE POLICY sys_approval_history_org_access ON public.sys_approval_history
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    request_id IN (
      SELECT id FROM public.sys_approval_requests WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    request_id IN (
      SELECT id FROM public.sys_approval_requests WHERE is_org_member(org_id)
    )
  );

-- 2.3 sys_approval_steps & sys_approval_workflow_rules: Eliminate wide-open visibility
DROP POLICY IF EXISTS sys_approval_steps_visibility ON public.sys_approval_steps;
DROP POLICY IF EXISTS sys_approval_steps_org_access ON public.sys_approval_steps;

CREATE POLICY sys_approval_steps_org_access ON public.sys_approval_steps
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    workflow_id IN (
      SELECT id FROM public.sys_approval_workflows WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    workflow_id IN (
      SELECT id FROM public.sys_approval_workflows WHERE is_org_admin(org_id)
    )
  );

DROP POLICY IF EXISTS sys_approval_workflow_rules_visibility ON public.sys_approval_workflow_rules;
DROP POLICY IF EXISTS sys_approval_workflow_rules_org_access ON public.sys_approval_workflow_rules;

CREATE POLICY sys_approval_workflow_rules_org_access ON public.sys_approval_workflow_rules
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    workflow_id IN (
      SELECT id FROM public.sys_approval_workflows WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    workflow_id IN (
      SELECT id FROM public.sys_approval_workflows WHERE is_org_admin(org_id)
    )
  );

-- 2.4 sys_role_permissions: Eliminate wide-open visibility
DROP POLICY IF EXISTS sys_role_permissions_visibility ON public.sys_role_permissions;
DROP POLICY IF EXISTS sys_role_permissions_org_access ON public.sys_role_permissions;

CREATE POLICY sys_role_permissions_org_access ON public.sys_role_permissions
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    role_id IN (
      SELECT id FROM public.sys_roles WHERE org_id IS NULL OR is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    role_id IN (
      SELECT id FROM public.sys_roles WHERE org_id IS NOT NULL AND is_org_admin(org_id)
    )
  );

-- 2.5 master_data_changes_log & master_data_imports
DROP POLICY IF EXISTS master_data_changes_log_visibility ON public.master_data_changes_log;
DROP POLICY IF EXISTS master_data_changes_log_access ON public.master_data_changes_log;

CREATE POLICY master_data_changes_log_access ON public.master_data_changes_log
  FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_admin(auth_org_id()));

DROP POLICY IF EXISTS master_data_imports_visibility ON public.master_data_imports;
DROP POLICY IF EXISTS master_data_imports_access ON public.master_data_imports;

CREATE POLICY master_data_imports_access ON public.master_data_imports
  FOR ALL TO authenticated
  USING (is_superadmin() OR is_org_admin(auth_org_id()))
  WITH CHECK (is_superadmin() OR is_org_admin(auth_org_id()));


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 3: PATTERN A ENFORCEMENT ON CALCULATION SCHEMES & SLABS
-- ──────────────────────────────────────────────────────────────────────────────
-- Custom tenant schemes must NOT be visible to other tenants!

-- 3.1 calculation_schemes
DROP POLICY IF EXISTS calc_schemes_select ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_read ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_select ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_visibility ON public.calculation_schemes;
DROP POLICY IF EXISTS calc_schemes_write ON public.calculation_schemes;
DROP POLICY IF EXISTS calculation_schemes_write ON public.calculation_schemes;

CREATE POLICY calculation_schemes_select ON public.calculation_schemes
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR is_org_member(org_id));

CREATE POLICY calculation_schemes_write ON public.calculation_schemes
  FOR ALL TO authenticated
  USING (is_superadmin() OR (org_id IS NOT NULL AND is_org_admin(org_id)))
  WITH CHECK (is_superadmin() OR (org_id IS NOT NULL AND is_org_admin(org_id)));

-- 3.2 scheme_slabs
DROP POLICY IF EXISTS scheme_slabs_public_read ON public.scheme_slabs;
DROP POLICY IF EXISTS scheme_slabs_read ON public.scheme_slabs;
DROP POLICY IF EXISTS scheme_slabs_select ON public.scheme_slabs;
DROP POLICY IF EXISTS scheme_slabs_visibility ON public.scheme_slabs;
DROP POLICY IF EXISTS scheme_slabs_write ON public.scheme_slabs;

CREATE POLICY scheme_slabs_select ON public.scheme_slabs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = scheme_slabs.scheme_id
        AND (cs.org_id IS NULL OR is_org_member(cs.org_id))
    )
  );

CREATE POLICY scheme_slabs_write ON public.scheme_slabs
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = scheme_slabs.scheme_id
        AND cs.org_id IS NOT NULL
        AND is_org_admin(cs.org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = scheme_slabs.scheme_id
        AND cs.org_id IS NOT NULL
        AND is_org_admin(cs.org_id)
    )
  );

-- 3.3 state_scheme_overrides
DROP POLICY IF EXISTS state_overrides_select ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_public_read ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_read ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_select ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_visibility ON public.state_scheme_overrides;
DROP POLICY IF EXISTS state_scheme_overrides_write ON public.state_scheme_overrides;

CREATE POLICY state_scheme_overrides_select ON public.state_scheme_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = state_scheme_overrides.scheme_id
        AND (cs.org_id IS NULL OR is_org_member(cs.org_id))
    )
  );

CREATE POLICY state_scheme_overrides_write ON public.state_scheme_overrides
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = state_scheme_overrides.scheme_id
        AND cs.org_id IS NOT NULL
        AND is_org_admin(cs.org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR EXISTS (
      SELECT 1 FROM public.calculation_schemes cs
      WHERE cs.id = state_scheme_overrides.scheme_id
        AND cs.org_id IS NOT NULL
        AND is_org_admin(cs.org_id)
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 4: UNBLOCK TENANT FLOWS (payment_schedules, vendor_payments)
-- ──────────────────────────────────────────────────────────────────────────────

-- 4.1 payment_schedules: Allow tenant users to manage schedules for their own quotes
DROP POLICY IF EXISTS payment_schedules_org_access ON public.payment_schedules;

CREATE POLICY payment_schedules_org_access ON public.payment_schedules
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    quote_id IN (
      SELECT id FROM public.quotes WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    quote_id IN (
      SELECT id FROM public.quotes WHERE is_org_member(org_id)
    )
  );

-- 4.2 vendor_payments: Allow tenant users to manage payments for their own projects
DROP POLICY IF EXISTS vendor_payments_org_access ON public.vendor_payments;

CREATE POLICY vendor_payments_org_access ON public.vendor_payments
  FOR ALL TO authenticated
  USING (
    is_superadmin() OR 
    project_id IN (
      SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
    )
  )
  WITH CHECK (
    is_superadmin() OR 
    project_id IN (
      SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 5: CLEAN UP POLICY POLLUTION (quotes, epc_work_orders)
-- ──────────────────────────────────────────────────────────────────────────────

-- 5.1 quotes: Drop redundant overlapping ALL policies that overrode RBAC delete restrictions
DROP POLICY IF EXISTS quotes_org_delete ON public.quotes;
DROP POLICY IF EXISTS quotes_org_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_org_isolation ON public.quotes;
DROP POLICY IF EXISTS quotes_org_read ON public.quotes;
DROP POLICY IF EXISTS quotes_org_update ON public.quotes;
DROP POLICY IF EXISTS quotes_org_write ON public.quotes;
DROP POLICY IF EXISTS quotes_select ON public.quotes;
DROP POLICY IF EXISTS quotes_write ON public.quotes;

CREATE POLICY quotes_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    is_superadmin() OR 
    (is_org_member(org_id) AND (
      auth_role() IN ('owner', 'admin', 'manager', 'viewer', 'staff') OR 
      exec_id = auth.uid() OR
      created_by = auth.uid()
    ))
  );

CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin() OR 
    (org_id = auth_org_id() AND is_org_member(org_id))
  );

CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    is_superadmin() OR 
    (is_org_member(org_id) AND (
      auth_role() IN ('owner', 'admin', 'manager') OR 
      exec_id = auth.uid() OR
      created_by = auth.uid()
    ))
  )
  WITH CHECK (
    is_superadmin() OR 
    (is_org_member(org_id) AND (
      auth_role() IN ('owner', 'admin', 'manager') OR 
      exec_id = auth.uid() OR
      created_by = auth.uid()
    ))
  );

CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE TO authenticated
  USING (
    is_superadmin() OR 
    (is_org_member(org_id) AND auth_role() IN ('owner', 'admin'))
  );

-- 5.2 epc_work_orders: Drop broad ALL policy that bypassed delete role checks
DROP POLICY IF EXISTS epc_work_orders_via_project ON public.epc_work_orders;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 6: MULTI-TENANT ISOLATION (site_inventory, tax_hsn_sac)
-- ──────────────────────────────────────────────────────────────────────────────

-- 6.1 site_inventory: Remove NULL org_id loophole
DROP POLICY IF EXISTS site_inventory_org_access ON public.site_inventory;

CREATE POLICY site_inventory_org_access ON public.site_inventory
  FOR ALL TO authenticated
  USING (is_superadmin() OR (org_id IS NOT NULL AND is_org_member(org_id)))
  WITH CHECK (is_superadmin() OR (org_id IS NOT NULL AND is_org_member(org_id)));

-- 6.2 tax_hsn_sac: Separate global read from tenant admin write
DROP POLICY IF EXISTS org_access_tax_hsn_sac ON public.tax_hsn_sac;

CREATE POLICY tax_hsn_sac_select ON public.tax_hsn_sac
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR is_org_member(org_id));

CREATE POLICY tax_hsn_sac_write ON public.tax_hsn_sac
  FOR ALL TO authenticated
  USING (is_superadmin() OR (org_id IS NOT NULL AND is_org_admin(org_id)))
  WITH CHECK (is_superadmin() OR (org_id IS NOT NULL AND is_org_admin(org_id)));


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 7: PROFILES PRIVILEGE ESCALATION HARDENING
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If role, is_super_admin, or org_id is being changed
  IF (OLD.role IS DISTINCT FROM NEW.role OR 
      OLD.is_super_admin IS DISTINCT FROM NEW.is_super_admin OR 
      OLD.org_id IS DISTINCT FROM NEW.org_id) THEN
    
    -- Allowed if executor is service_role or superadmin
    IF is_service_role() OR is_superadmin() THEN
      RETURN NEW;
    END IF;

    -- Allowed if executor is org admin/owner within the same organization and NOT elevating to superadmin
    IF is_org_admin(OLD.org_id) AND 
       NEW.role NOT IN ('superadmin', 'super_admin') AND 
       COALESCE(NEW.is_super_admin, false) = false AND 
       OLD.org_id = NEW.org_id THEN
      RETURN NEW;
    END IF;

    -- Otherwise, reject privilege escalation attempt
    RAISE EXCEPTION 'Unauthorized: You do not have permission to modify user role, admin status, or organization assignment.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_profile_escalation();


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 8: SUPABASE STORAGE BUCKET HARDENING
-- ──────────────────────────────────────────────────────────────────────────────

-- 8.1 documents bucket: Fix cross-tenant deletion & overwriting
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- Uploads: Allow if file starts with user's org_id OR project belonging to user's org OR user is superadmin
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND (
      is_superadmin() OR 
      split_part(name, '/', 1) = auth_org_id()::text OR
      (split_part(name, '/', 1) = 'projects' AND split_part(name, '/', 2)::uuid IN (
        SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
      ))
    )
  );

-- Updates: Allow only own org/project files
CREATE POLICY "Authenticated users can update documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents' AND (
      is_superadmin() OR 
      split_part(name, '/', 1) = auth_org_id()::text OR
      (split_part(name, '/', 1) = 'projects' AND split_part(name, '/', 2)::uuid IN (
        SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
      ))
    )
  )
  WITH CHECK (
    bucket_id = 'documents' AND (
      is_superadmin() OR 
      split_part(name, '/', 1) = auth_org_id()::text OR
      (split_part(name, '/', 1) = 'projects' AND split_part(name, '/', 2)::uuid IN (
        SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
      ))
    )
  );

-- Deletions: Allow only own org/project files
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND (
      is_superadmin() OR 
      split_part(name, '/', 1) = auth_org_id()::text OR
      (split_part(name, '/', 1) = 'projects' AND split_part(name, '/', 2)::uuid IN (
        SELECT id FROM public.epc_projects WHERE is_org_member(org_id)
      ))
    )
  );

-- 8.2 Vault buckets (vault-*): Enforce tenant-isolated policies for private storage
DROP POLICY IF EXISTS "Tenant vault read policy" ON storage.objects;
DROP POLICY IF EXISTS "Tenant vault insert policy" ON storage.objects;
DROP POLICY IF EXISTS "Tenant vault update policy" ON storage.objects;
DROP POLICY IF EXISTS "Tenant vault delete policy" ON storage.objects;

CREATE POLICY "Tenant vault read policy" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id LIKE 'vault-%' AND 
    (is_superadmin() OR split_part(name, '/', 1) = auth_org_id()::text)
  );

CREATE POLICY "Tenant vault insert policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id LIKE 'vault-%' AND 
    (is_superadmin() OR split_part(name, '/', 1) = auth_org_id()::text)
  );

CREATE POLICY "Tenant vault update policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id LIKE 'vault-%' AND 
    (is_superadmin() OR split_part(name, '/', 1) = auth_org_id()::text)
  )
  WITH CHECK (
    bucket_id LIKE 'vault-%' AND 
    (is_superadmin() OR split_part(name, '/', 1) = auth_org_id()::text)
  );

CREATE POLICY "Tenant vault delete policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id LIKE 'vault-%' AND 
    (is_superadmin() OR (split_part(name, '/', 1) = auth_org_id()::text AND (auth_role() IN ('owner', 'admin'))))
  );

COMMIT;
