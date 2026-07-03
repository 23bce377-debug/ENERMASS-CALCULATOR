-- Correct equipment GST rates from current CBIC schedules/clarifications.
-- Panels / solar PV modules: 12% as renewable energy devices/parts.
-- Inverters: 18% under HSN 8504.
-- Batteries: 18% for lithium-ion / LFP / NMC; 28% for other electric accumulators.

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
