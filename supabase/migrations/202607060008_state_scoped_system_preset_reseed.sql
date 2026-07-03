BEGIN;

ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.state_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_systems_state_id
  ON public.systems(state_id);

ALTER TABLE public.systems
  DROP CONSTRAINT IF EXISTS systems_active_requires_state;

CREATE TEMP TABLE _state_preset_reseed_retired ON COMMIT DROP AS
SELECT s.id
FROM public.systems s
WHERE s.is_active = TRUE
  AND s.state_id IS NULL;

CREATE TEMP TABLE _state_preset_reseed_sources ON COMMIT DROP AS
WITH active_global AS (
  SELECT
    s.*,
    (SELECT COUNT(*) FROM public.system_items si WHERE si.system_id = s.id) AS item_count,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(s.name)), s.category, round(s.capacity_kw, 3)
      ORDER BY
        CASE WHEN s.org_id IS NULL THEN 0 ELSE 1 END,
        (SELECT COUNT(*) FROM public.system_items si WHERE si.system_id = s.id) DESC,
        s.updated_at DESC
    ) AS template_rank
  FROM public.systems s
  WHERE s.is_active = TRUE
    AND s.state_id IS NULL
)
SELECT *
FROM active_global
WHERE item_count > 0
  AND template_rank = 1;

CREATE TEMP TABLE _state_preset_reseed_plan ON COMMIT DROP AS
WITH source_matches AS (
  SELECT
    src.id AS old_id,
    ARRAY_AGG(sr.id ORDER BY sr.state_name) FILTER (
      WHERE lower(src.name) LIKE '%' || lower(sr.state_name) || '%'
    ) AS matched_state_ids
  FROM _state_preset_reseed_sources src
  CROSS JOIN public.state_rules sr
  WHERE sr.is_active = TRUE
  GROUP BY src.id
)
SELECT
  gen_random_uuid() AS new_id,
  src.id AS old_id,
  sr.id AS state_id,
  src.org_id,
  src.name,
  src.category,
  src.capacity_kw,
  src.panel_wattage_w,
  src.panel_qty,
  src.target_margin_pct,
  src.is_custom,
  src.version
FROM _state_preset_reseed_sources src
JOIN source_matches sm ON sm.old_id = src.id
JOIN public.state_rules sr
  ON sr.is_active = TRUE
 AND (
   sm.matched_state_ids IS NULL
   OR cardinality(sm.matched_state_ids) = 0
   OR sr.id = ANY(sm.matched_state_ids)
 );

INSERT INTO public.systems (
  id,
  org_id,
  name,
  category,
  capacity_kw,
  panel_wattage_w,
  panel_qty,
  target_margin_pct,
  is_active,
  is_custom,
  version,
  state_id,
  created_at,
  updated_at
)
SELECT
  plan.new_id,
  plan.org_id,
  plan.name,
  plan.category,
  plan.capacity_kw,
  plan.panel_wattage_w,
  plan.panel_qty,
  plan.target_margin_pct,
  TRUE,
  plan.is_custom,
  GREATEST(COALESCE(plan.version, 1), 1),
  plan.state_id,
  now(),
  now()
FROM _state_preset_reseed_plan plan;

INSERT INTO public.system_items (
  system_id,
  panel_id,
  inverter_id,
  battery_id,
  solar_meter_id,
  net_meter_id,
  la_id,
  structure_id,
  bom_item_id,
  comm_device_id,
  section,
  description,
  remarks,
  unit,
  default_qty,
  is_mandatory,
  is_included_by_default,
  sort_order,
  structure_component_id
)
SELECT
  plan.new_id,
  item.panel_id,
  item.inverter_id,
  item.battery_id,
  item.solar_meter_id,
  item.net_meter_id,
  item.la_id,
  item.structure_id,
  item.bom_item_id,
  item.comm_device_id,
  item.section,
  item.description,
  item.remarks,
  item.unit,
  item.default_qty,
  item.is_mandatory,
  item.is_included_by_default,
  item.sort_order,
  item.structure_component_id
FROM _state_preset_reseed_plan plan
JOIN public.system_items item
  ON item.system_id = plan.old_id;

UPDATE public.systems s
SET is_active = FALSE,
    updated_at = now()
WHERE s.id IN (SELECT id FROM _state_preset_reseed_retired);

DELETE FROM public.systems s
WHERE s.id IN (SELECT id FROM _state_preset_reseed_retired)
  AND NOT EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.system_id = s.id
  );

DELETE FROM public.system_state_availability ssa
WHERE NOT EXISTS (
  SELECT 1
  FROM public.systems s
  WHERE s.id = ssa.system_id
    AND s.is_active = TRUE
);

INSERT INTO public.system_state_availability (system_id, state_id)
SELECT s.id, s.state_id
FROM public.systems s
WHERE s.is_active = TRUE
  AND s.state_id IS NOT NULL
ON CONFLICT (system_id, state_id) DO NOTHING;

-- Active system presets must be state-scoped. Inactive historical rows may stay
-- without a state because old quotes can still reference them.
ALTER TABLE public.systems
  ADD CONSTRAINT systems_active_requires_state
  CHECK (is_active = FALSE OR state_id IS NOT NULL);

NOTIFY pgrst, 'reload schema';

SELECT
  (SELECT COUNT(*) FROM _state_preset_reseed_sources) AS source_templates,
  (SELECT COUNT(*) FROM _state_preset_reseed_plan) AS created_state_scoped_presets,
  (SELECT COUNT(*) FROM public.systems WHERE is_active = TRUE) AS active_presets,
  (SELECT COUNT(*) FROM public.systems WHERE is_active = TRUE AND state_id IS NULL) AS active_global_presets;

COMMIT;
