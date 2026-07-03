-- Fix master-data create/import workflows that rely on newer org-scoped columns.
-- This migration is intentionally idempotent so it can repair partially migrated
-- deployments without disturbing existing data.

BEGIN;

ALTER TABLE public.calculation_schemes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.eq_panels
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_inverters
  ADD COLUMN IF NOT EXISTS specification_details text,
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.eq_inverters(id) ON DELETE SET NULL;

ALTER TABLE public.eq_batteries
  ADD COLUMN IF NOT EXISTS specification_details text,
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.eq_batteries(id) ON DELETE SET NULL;

ALTER TABLE public.eq_mounting_structures
  ADD COLUMN IF NOT EXISTS specification_details text,
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.eq_mounting_structures(id) ON DELETE SET NULL;

ALTER TABLE public.bom_categories
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.bom_template_items
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_global_id uuid REFERENCES public.bom_template_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specification_details text,
  ADD COLUMN IF NOT EXISTS gst_pct numeric(6,5) NOT NULL DEFAULT 0.18000,
  ADD COLUMN IF NOT EXISTS is_survey_dependent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS civil_required_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.structure_component_master
  ADD COLUMN IF NOT EXISTS specification_details text;

DO $$
BEGIN
  IF to_regclass('public.eq_communication_devices') IS NOT NULL THEN
    ALTER TABLE public.eq_communication_devices
      ADD COLUMN IF NOT EXISTS specification_details text;
  END IF;

  IF to_regclass('public.eq_structure_components') IS NOT NULL THEN
    ALTER TABLE public.eq_structure_components
      ADD COLUMN IF NOT EXISTS specification_details text;
  END IF;

  IF to_regclass('public.eq_structure_addons') IS NOT NULL THEN
    ALTER TABLE public.eq_structure_addons
      ADD COLUMN IF NOT EXISTS specification_details text;
  END IF;
END $$;

ALTER TABLE public.bom_template_items DROP CONSTRAINT IF EXISTS bom_template_items_sku_code_key;
DROP INDEX IF EXISTS public.bom_template_items_sku_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_template_items_org_sku_source
  ON public.bom_template_items (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(sku_code)
  )
  WHERE source_global_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_template_items_org_source_override
  ON public.bom_template_items (org_id, source_global_id)
  WHERE org_id IS NOT NULL AND source_global_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_calculation_schemes_org_code
  ON public.calculation_schemes (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(code)
  );

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
