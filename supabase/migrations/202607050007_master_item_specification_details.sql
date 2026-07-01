-- Dedicated quote-facing specification/details text for every master item type.
-- Existing description/notes columns remain as fallbacks for older data.

ALTER TABLE public.eq_panels
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_inverters
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_batteries
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_meters
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_lightning_arresters
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_mounting_structures
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.bom_template_items
  ADD COLUMN IF NOT EXISTS specification_details text;

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
