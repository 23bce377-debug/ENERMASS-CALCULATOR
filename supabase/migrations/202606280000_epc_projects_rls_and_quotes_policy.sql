-- 202606280000_epc_projects_rls_and_quotes_policy.sql
-- Fix: epc_projects table had NO RLS at all (indexes existed but ENABLE ROW LEVEL SECURITY
-- was never called). This caused all INSERT/UPDATE operations to fail silently for org users
-- because the table fell back to the restrictive default-deny posture of RLS-less Postgres.
-- Also ensures quotes table has a permissive INSERT policy for all org members.

BEGIN;

-- ── 1. epc_projects ──────────────────────────────────────────────────────────

ALTER TABLE public.epc_projects ENABLE ROW LEVEL SECURITY;

-- SELECT: any active org member can read their org's projects
DROP POLICY IF EXISTS "epc_projects_org_select" ON public.epc_projects;
CREATE POLICY "epc_projects_org_select"
  ON public.epc_projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR org_id = public.auth_org_id()
  );

-- INSERT: any org member (owner/admin/manager/staff) can create projects
DROP POLICY IF EXISTS "epc_projects_org_insert" ON public.epc_projects;
CREATE POLICY "epc_projects_org_insert"
  ON public.epc_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR org_id = public.auth_org_id()
  );

-- UPDATE: org members can update their org's projects (status, notes, PM assignment)
DROP POLICY IF EXISTS "epc_projects_org_update" ON public.epc_projects;
CREATE POLICY "epc_projects_org_update"
  ON public.epc_projects
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR org_id = public.auth_org_id()
  )
  WITH CHECK (
    public.is_superadmin()
    OR org_id = public.auth_org_id()
  );

-- DELETE: only admins/owners or superadmin can delete projects
DROP POLICY IF EXISTS "epc_projects_admin_delete" ON public.epc_projects;
CREATE POLICY "epc_projects_admin_delete"
  ON public.epc_projects
  FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_org_admin(org_id)
  );

-- Service role bypass (used by cron jobs / server-side operations)
DROP POLICY IF EXISTS "epc_projects_service_manage" ON public.epc_projects;
CREATE POLICY "epc_projects_service_manage"
  ON public.epc_projects
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- ── 2. quotes – ensure org members can insert (fixes manual project creation) ─

-- The existing quotes_org_insert policy uses current_org_id().
-- Re-create it defensively to use auth_org_id() which is the canonical helper.
DROP POLICY IF EXISTS "quotes_org_insert" ON public.quotes;
CREATE POLICY "quotes_org_insert"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR org_id = public.auth_org_id()
  );

COMMIT;
