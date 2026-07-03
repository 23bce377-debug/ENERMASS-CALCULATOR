BEGIN;

ALTER TABLE public.quotes
  ALTER COLUMN gst_output_rate SET DEFAULT 0.08900;

ALTER TABLE public.state_rules
  ALTER COLUMN gst_on_output SET DEFAULT 0.08900;

UPDATE public.state_rules
SET gst_on_output = 0.08900,
    updated_at = now()
WHERE gst_on_output IS DISTINCT FROM 0.08900;

UPDATE public.eq_panels
SET gst_pct = 0.05000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.05000;

UPDATE public.eq_inverters
SET gst_pct = 0.05000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.05000;

UPDATE public.eq_batteries
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.bom_template_items
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

ALTER TABLE public.eq_communication_devices DISABLE TRIGGER USER;

UPDATE public.eq_communication_devices
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

ALTER TABLE public.eq_communication_devices ENABLE TRIGGER USER;

UPDATE public.eq_lightning_arresters
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.eq_meters
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.eq_mounting_structures
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.eq_structure_addons
SET gst_pct = 0.18000
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.eq_structure_components
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.structure_accessory_rates
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.structure_component_master
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

ALTER TABLE public.catalog_items DISABLE TRIGGER USER;

UPDATE public.catalog_items
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

ALTER TABLE public.catalog_items ENABLE TRIGGER USER;

UPDATE public.bundle_presets
SET gst_pct = 0.18000,
    updated_at = now()
WHERE gst_pct IS DISTINCT FROM 0.18000;

UPDATE public.bundle_preset_items
SET gst_pct = 0.18000
WHERE gst_pct IS DISTINCT FROM 0.18000;

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT COUNT(*) FROM public.eq_panels WHERE gst_pct IS DISTINCT FROM 0.05000) AS panel_mismatches,
  (SELECT COUNT(*) FROM public.eq_inverters WHERE gst_pct IS DISTINCT FROM 0.05000) AS inverter_mismatches,
  (SELECT COUNT(*) FROM public.eq_batteries WHERE gst_pct IS DISTINCT FROM 0.18000) AS battery_mismatches,
  (SELECT COUNT(*) FROM public.state_rules WHERE gst_on_output IS DISTINCT FROM 0.08900) AS state_output_mismatches;

COMMIT;
