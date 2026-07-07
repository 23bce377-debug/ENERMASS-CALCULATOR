-- Correct equipment GST rates from current CBIC schedules/clarifications.
-- Panels / solar PV modules: 12% as renewable energy devices/parts.
-- Inverters: 18% under HSN 8504.
-- Batteries: 18% for lithium-ion / LFP / NMC; 28% for other electric accumulators.

CREATE TABLE IF NOT EXISTS public.tax_hsn_sac (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'HSN' CHECK (type IN ('HSN', 'SAC')),
  gst_rate numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tax_hsn_sac
  ALTER COLUMN org_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS tax_hsn_sac_org_code_idx
  ON public.tax_hsn_sac (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

ALTER TABLE public.tax_hsn_sac ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_access_tax_hsn_sac ON public.tax_hsn_sac;
DROP POLICY IF EXISTS "org_access_tax_hsn_sac" ON public.tax_hsn_sac;
CREATE POLICY org_access_tax_hsn_sac ON public.tax_hsn_sac
  FOR ALL TO authenticated
  USING (org_id IS NULL OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (org_id IS NULL OR public.is_superadmin() OR public.is_org_member(org_id));

INSERT INTO public.tax_hsn_sac (org_id, code, description, type, gst_rate, is_active)
SELECT NULL, code, description, 'HSN', gst_rate, true
FROM (
  VALUES
    ('8541', 'Solar power based devices / solar PV modules', 0.12000::numeric),
    ('854143', 'Solar PV cells assembled in modules or panels', 0.12000::numeric),
    ('854140', 'Solar photovoltaic devices', 0.12000::numeric),
    ('SOLAR_PANEL', 'Solar panel', 0.12000::numeric),
    ('PANEL', 'Solar panel', 0.12000::numeric),
    ('8504', 'Electrical transformers, static converters and inductors', 0.18000::numeric),
    ('INVERTER', 'Solar inverter', 0.18000::numeric),
    ('85076000', 'Lithium-ion batteries', 0.18000::numeric),
    ('8507_LITHIUM', 'Lithium-ion batteries', 0.18000::numeric),
    ('BATTERY_LITHIUM', 'Lithium-ion batteries', 0.18000::numeric),
    ('8507', 'Electric accumulators other than lithium-ion batteries', 0.28000::numeric),
    ('BATTERY', 'Battery', 0.28000::numeric)
) AS seed(code, description, gst_rate)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tax_hsn_sac existing
  WHERE existing.org_id IS NULL
    AND existing.code = seed.code
);

UPDATE public.eq_panels
SET gst_pct = 0.12000
WHERE gst_pct IS DISTINCT FROM 0.12000;

UPDATE public.eq_inverters
SET gst_pct = 0.18000
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.eq_batteries
SET gst_pct = CASE
  WHEN lower(concat_ws(' ', chemistry, brand, model, description, specification_details)) ~
       '(li[[:space:]-]?ion|lithium|lfp|life[[:space:]]?po4|lifepo4|nmc)'
    THEN 0.18000
  ELSE 0.28000
END;

UPDATE public.tax_hsn_sac
SET gst_rate = 0.12000,
    description = COALESCE(NULLIF(description, ''), 'Solar power based devices / solar PV modules')
WHERE code IN ('8541', '854143', '854140', 'SOLAR_PANEL', 'PANEL');

UPDATE public.tax_hsn_sac
SET gst_rate = 0.18000,
    description = COALESCE(NULLIF(description, ''), 'Electrical transformers, static converters and inductors')
WHERE code IN ('8504', 'INVERTER');

UPDATE public.tax_hsn_sac
SET gst_rate = 0.18000,
    description = COALESCE(NULLIF(description, ''), 'Lithium-ion batteries')
WHERE code IN ('85076000', '8507_LITHIUM', 'BATTERY_LITHIUM');

UPDATE public.tax_hsn_sac
SET gst_rate = 0.28000,
    description = COALESCE(NULLIF(description, ''), 'Electric accumulators other than lithium-ion batteries')
WHERE code IN ('8507', 'BATTERY');
