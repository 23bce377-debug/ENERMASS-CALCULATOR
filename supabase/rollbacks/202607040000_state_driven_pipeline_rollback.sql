-- Rollback: State-driven quotation pipeline (202607040000)
-- Reverses the additive schema changes. quotes.terms_json is left in place
-- because it predates this migration on most environments and holds quote data.

BEGIN;

DROP FUNCTION IF EXISTS public.calculate_state_subsidy(TEXT, NUMERIC, project_type);

DROP TABLE IF EXISTS public.state_terms_templates CASCADE;
DROP TABLE IF EXISTS public.system_state_availability CASCADE;

ALTER TABLE public.state_rules DROP COLUMN IF EXISTS discom_name;

COMMIT;
