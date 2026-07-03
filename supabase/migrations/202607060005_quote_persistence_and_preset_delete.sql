BEGIN;

CREATE TABLE IF NOT EXISTS public.system_hidden_presets (
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, system_id)
);

CREATE INDEX IF NOT EXISTS idx_system_hidden_presets_system
  ON public.system_hidden_presets(system_id);

ALTER TABLE public.system_hidden_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_hidden_presets_org_access ON public.system_hidden_presets;
CREATE POLICY system_hidden_presets_org_access
  ON public.system_hidden_presets
  FOR ALL
  USING (org_id = public.auth_org_id() OR public.is_superadmin())
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

NOTIFY pgrst, 'reload schema';

COMMIT;
