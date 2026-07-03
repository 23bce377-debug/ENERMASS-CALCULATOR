BEGIN;

ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.state_rules(id) ON DELETE SET NULL;

ALTER TABLE public.custom_presets
  ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.state_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_systems_state_id
  ON public.systems(state_id);

CREATE INDEX IF NOT EXISTS idx_custom_presets_state_id
  ON public.custom_presets(state_id);

UPDATE public.custom_presets cp
SET state_id = sr.id,
    config_json = jsonb_set(
      COALESCE(cp.config_json, '{}'::jsonb),
      '{stateId}',
      to_jsonb(sr.id::text),
      true
    )
FROM public.state_rules sr
WHERE cp.state_id IS NULL
  AND (
    cp.config_json->>'stateId' = sr.id::text
    OR lower(cp.config_json->>'selectedState') = lower(sr.state_name)
    OR lower(cp.config_json->>'state') = lower(sr.state_name)
    OR lower(cp.config_json->>'stateCode') = lower(sr.state_code)
  );

UPDATE public.custom_presets cp
SET config_json = jsonb_set(
  jsonb_set(
    COALESCE(cp.config_json, '{}'::jsonb),
    '{stateId}',
    to_jsonb(sr.id::text),
    true
  ),
  '{selectedState}',
  to_jsonb(sr.state_name),
  true
)
FROM public.state_rules sr
WHERE cp.state_id = sr.id;

INSERT INTO public.system_state_availability (system_id, state_id)
SELECT s.id, s.state_id
FROM public.systems s
WHERE s.state_id IS NOT NULL
ON CONFLICT (system_id, state_id) DO NOTHING;

DELETE FROM public.system_state_availability ssa
USING public.systems s
WHERE ssa.system_id = s.id
  AND s.state_id IS NOT NULL
  AND ssa.state_id <> s.state_id;

NOTIFY pgrst, 'reload schema';

COMMIT;
