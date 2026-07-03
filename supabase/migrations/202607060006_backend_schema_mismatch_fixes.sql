-- Repair backend/schema drifts found by live column audit.
-- Idempotent so it can be applied safely to partially migrated deployments.

BEGIN;

ALTER TABLE public.eq_meters
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.eq_lightning_arresters
  ADD COLUMN IF NOT EXISTS specification_details text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

ALTER TABLE public.inventory_summary
  ADD COLUMN IF NOT EXISTS unit text;

UPDATE public.inventory_summary inv
SET unit = b.unit
FROM public.bom_template_items b
WHERE inv.catalog_item_id = b.id
  AND (inv.unit IS NULL OR inv.unit = '');

UPDATE public.inventory_summary
SET unit = 'Nos'
WHERE unit IS NULL OR unit = '';

NOTIFY pgrst, 'reload schema';

COMMIT;
