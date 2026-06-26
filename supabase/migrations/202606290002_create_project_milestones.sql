-- Migration: Create epc_project_milestones table
-- Description: Creates the missing epc_project_milestones table referenced by the seed trigger.

BEGIN;

CREATE TABLE IF NOT EXISTS public.epc_project_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.epc_projects(id) ON DELETE CASCADE,
  milestone    public.milestone_type NOT NULL,
  target_date  DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_milestone UNIQUE (project_id, milestone)
);

-- Enable RLS
ALTER TABLE public.epc_project_milestones ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DROP POLICY IF EXISTS "epc_project_milestones_org_select" ON public.epc_project_milestones;
CREATE POLICY "epc_project_milestones_org_select" ON public.epc_project_milestones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.epc_projects p 
    WHERE p.id = project_id AND p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "epc_project_milestones_org_insert" ON public.epc_project_milestones;
CREATE POLICY "epc_project_milestones_org_insert" ON public.epc_project_milestones
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.epc_projects p 
    WHERE p.id = project_id AND p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "epc_project_milestones_org_update" ON public.epc_project_milestones;
CREATE POLICY "epc_project_milestones_org_update" ON public.epc_project_milestones
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.epc_projects p 
    WHERE p.id = project_id AND p.org_id = auth_org_id()
  ));

DROP POLICY IF EXISTS "epc_project_milestones_org_delete" ON public.epc_project_milestones;
CREATE POLICY "epc_project_milestones_org_delete" ON public.epc_project_milestones
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.epc_projects p 
    WHERE p.id = project_id AND p.org_id = auth_org_id()
  ));

COMMIT;
