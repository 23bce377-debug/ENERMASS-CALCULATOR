-- Harden master imports against export/re-import duplication.
-- Most equipment tables already have natural-key and source override guards.
-- Structures were missing the natural-key guard, so an import without stable IDs
-- could create duplicate org-scoped structure rows.

BEGIN;

ALTER TABLE public.eq_panels
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.eq_panels(id) ON DELETE SET NULL;

ALTER TABLE public.eq_mounting_structures
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.eq_mounting_structures(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_eq_structures_org_natural_key
  ON public.eq_mounting_structures (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name,
    material,
    roof_mount_type
  )
  WHERE source_global_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_eq_structures_org_source_override
  ON public.eq_mounting_structures (org_id, source_global_id)
  WHERE org_id IS NOT NULL AND source_global_id IS NOT NULL;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
