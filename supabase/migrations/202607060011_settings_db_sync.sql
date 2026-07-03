-- Make org-level settings deterministic for DB-backed calculator reads.
BEGIN;

-- Older environments could accumulate duplicate margin rows because the app
-- edited margins locally. Keep the newest row before enforcing uniqueness.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY org_id, category
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.category_margins
)
DELETE FROM public.category_margins cm
USING ranked r
WHERE cm.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'category_margins_org_category_key'
      AND conrelid = 'public.category_margins'::regclass
  ) THEN
    ALTER TABLE public.category_margins
      ADD CONSTRAINT category_margins_org_category_key UNIQUE (org_id, category);
  END IF;
END $$;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_margins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_org_access ON public.app_settings;
CREATE POLICY app_settings_org_access
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

DROP POLICY IF EXISTS category_margins_org_access ON public.category_margins;
CREATE POLICY category_margins_org_access
  ON public.category_margins
  FOR ALL
  TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

COMMIT;
