-- Migration: State-driven quotation pipeline
-- Makes the selected state the single source of truth for subsidy, presets, and T&C.
--
-- This migration is intentionally ADDITIVE and NON-DESTRUCTIVE:
--   * No existing subsidy amount changes (calculate_state_subsidy returns the same
--     value as today's PM Surya Ghar calculation for any state WITHOUT an override).
--   * The system_state_availability junction ships EMPTY — a system with no rows is
--     treated as global (visible for every state), so existing presets are unchanged.
--   * T&C master templates replace hardcoded fallbacks; existing quotes keep their
--     own quotes.terms_json snapshot untouched.
--
-- Idempotent: safe to re-run. No generated IDs are hardcoded; data is keyed by code.

BEGIN;

-- ============================================================
-- 1. state_rules: DISCOM name (replaces hardcoded DISCOM in buildViewModel.ts)
-- ============================================================
ALTER TABLE public.state_rules ADD COLUMN IF NOT EXISTS discom_name TEXT;

-- Backfill representative DISCOM names only where not already set.
UPDATE public.state_rules SET discom_name = v.discom
FROM (VALUES
  ('GJ', 'Gujarat Urja Vikas Nigam (GUVNL)'),
  ('RJ', 'Rajasthan DISCOMs (JVVNL / AVVNL / JdVVNL)'),
  ('MP', 'MP Power Management Company (MPPKVVCL)'),
  ('UP', 'Uttar Pradesh Power Corporation (UPPCL)'),
  ('HR', 'Haryana DISCOMs (UHBVN / DHBVN)'),
  ('PB', 'Punjab State Power Corporation (PSPCL)'),
  ('MH', 'Maharashtra State Electricity Distribution Co. (MSEDCL)'),
  ('KA', 'Karnataka DISCOMs (BESCOM / HESCOM)'),
  ('AP', 'Andhra Pradesh DISCOMs (APSPDCL / APEPDCL)'),
  ('TS', 'Telangana DISCOMs (TGSPDCL / TGNPDCL)'),
  ('TN', 'Tamil Nadu Generation & Distribution Corp. (TANGEDCO)'),
  ('KL', 'Kerala State Electricity Board (KSEB)')
) AS v(state_code, discom)
WHERE public.state_rules.state_code = v.state_code
  AND public.state_rules.discom_name IS NULL;

-- ============================================================
-- 2. State-scoped presets — many-to-many junction
--    Backward-compat rule (enforced in application code): a system with NO rows
--    here is GLOBAL (shown for all states). Ships empty.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_state_availability (
  system_id  UUID NOT NULL REFERENCES public.systems(id)     ON DELETE CASCADE,
  state_id   UUID NOT NULL REFERENCES public.state_rules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (system_id, state_id)
);

CREATE INDEX IF NOT EXISTS idx_system_state_avail_state  ON public.system_state_availability(state_id);
CREATE INDEX IF NOT EXISTS idx_system_state_avail_system ON public.system_state_availability(system_id);

-- ============================================================
-- 3. State-specific Terms & Conditions master templates
--    clauses JSONB = array of strings, identical shape to quotes.terms_json.
--    Exactly one active row per state; the row with state_id IS NULL is the
--    GLOBAL DEFAULT used when a state has no template of its own.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.state_terms_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id   UUID REFERENCES public.state_rules(id) ON DELETE CASCADE,  -- NULL = global default
  clauses    JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active template per state (and one for the NULL/global default).
CREATE UNIQUE INDEX IF NOT EXISTS uq_state_terms_active_state
  ON public.state_terms_templates(state_id)
  WHERE is_active = TRUE AND state_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_state_terms_active_global
  ON public.state_terms_templates((state_id IS NULL))
  WHERE is_active = TRUE AND state_id IS NULL;

-- Ensure the per-quote T&C snapshot column exists (read/written by the app but
-- absent from tracked schema.sql on some environments).
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS terms_json JSONB;

-- ============================================================
-- 4. RPC: calculate_state_subsidy(state_code, capacity_kw, project_type)
--    Auto-resolves the applicable scheme from project_type (no scheme code passed
--    by the client) and folds in any per-state additional subsidy + cap override.
--    Returns the SAME amount as the legacy calculate_subsidy() for residential
--    states that have no override, preserving all existing calculations.
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_state_subsidy(
  p_state_code   TEXT,
  p_capacity_kw  NUMERIC,
  p_project_type project_type DEFAULT 'residential'
)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_scheme         RECORD;
  v_override       RECORD;
  v_slab           RECORD;
  v_base           NUMERIC := 0;
  v_applicable_kw  NUMERIC;
  v_effective_max  NUMERIC;
  v_additional     NUMERIC := 0;
BEGIN
  -- Resolve the active scheme for this project type (most recently effective wins).
  SELECT id, max_capacity_kw, max_absolute_subsidy
  INTO v_scheme
  FROM public.calculation_schemes
  WHERE is_active = TRUE
    AND applies_to = p_project_type
  ORDER BY effective_from DESC NULLS LAST
  LIMIT 1;

  -- No scheme for this project type (e.g. commercial) → no subsidy.
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Systems above the scheme cap receive no subsidy.
  IF p_capacity_kw > v_scheme.max_capacity_kw THEN RETURN 0; END IF;

  v_effective_max := v_scheme.max_absolute_subsidy;

  -- Per-state override: optional higher cap and/or an additional state subsidy.
  IF p_state_code IS NOT NULL THEN
    SELECT sso.max_absolute_override, sso.additional_state_subsidy
    INTO v_override
    FROM public.state_scheme_overrides sso
    JOIN public.state_rules sr ON sso.state_id = sr.id
    WHERE sr.state_code = p_state_code
      AND sso.scheme_id = v_scheme.id
      AND sso.is_active = TRUE
    LIMIT 1;

    IF FOUND THEN
      IF v_override.max_absolute_override IS NOT NULL THEN
        v_effective_max := v_override.max_absolute_override;
      END IF;
      v_additional := COALESCE(v_override.additional_state_subsidy, 0);
    END IF;
  END IF;

  -- Accumulate marginal subsidy across slabs (same logic as calculate_subsidy).
  FOR v_slab IN
    SELECT start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount
    FROM public.scheme_slabs
    WHERE scheme_id = v_scheme.id
    ORDER BY slab_index ASC
  LOOP
    IF p_capacity_kw <= v_slab.start_kw THEN
      EXIT;
    END IF;

    IF v_slab.is_fixed_amount THEN
      v_base := v_base + COALESCE(v_slab.fixed_amount, 0);
    ELSE
      v_applicable_kw := LEAST(p_capacity_kw, COALESCE(v_slab.end_kw, p_capacity_kw)) - v_slab.start_kw;
      v_base := v_base + (v_applicable_kw * v_slab.rate_per_kw);
    END IF;
  END LOOP;

  -- Cap the central subsidy, then add the state top-up on top.
  RETURN LEAST(v_base, v_effective_max) + v_additional;
END;
$$;

-- ============================================================
-- 5. Seed: T&C master templates (non-breaking — replaces hardcoded fallbacks)
-- ============================================================

-- 5a. Global default (state_id IS NULL) — professional, state-agnostic.
INSERT INTO public.state_terms_templates (state_id, clauses, is_active, version)
SELECT NULL, $json$[
  "This proposal is valid for the period stated herein. Upon expiry, all quoted prices are subject to revision at the Company's sole discretion.",
  "Payment schedule: 50% advance against a confirmed purchase order, 40% prior to dispatch of material, and the balance 10% upon successful grid commissioning.",
  "Installation shall be completed within 15 working days of receipt of the advance payment. Final commissioning remains subject to DISCOM inspection and approval, which typically requires 30 to 45 days.",
  "Solar PV modules are covered by a 12-year manufacturer product warranty and a 30-year linear performance warranty.",
  "The grid-tie inverter carries a 10-year manufacturer warranty from the date of commissioning.",
  "The mounting structure is warranted for 5 years against structural integrity and galvanisation defects.",
  "The scope of supply includes one (1) year of complimentary maintenance support, comprising four (4) scheduled preventive maintenance visits from the date of commissioning.",
  "The Company shall provide liaison assistance for feasibility approval and net-metering registration. All statutory timelines remain subject to clearances from the concerned DISCOM and electrical authorities.",
  "Disbursement of the PM Surya Ghar Central Financial Assistance is administered through the National Portal and is typically credited within 60 to 90 days of net-meter commissioning.",
  "Applicable Goods and Services Tax is levied in accordance with prevailing Government of India notifications and is included in the quoted value.",
  "Any civil, electrical, or structural work beyond the agreed scope of supply shall be treated as a separately chargeable additional item."
]$json$::jsonb, TRUE, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.state_terms_templates WHERE state_id IS NULL AND is_active = TRUE
);

-- 5b. Per-state templates (global default + one state-specific compliance clause).
--     Keyed by state_code so no generated IDs are referenced.
INSERT INTO public.state_terms_templates (state_id, clauses, is_active, version)
SELECT sr.id, (g.clauses || to_jsonb(v.extra_clause)), TRUE, 1
FROM (VALUES
  ('KL', 'Kerala: The installation conforms to the KSEB Net Metering Regulations 2014 and ANERT/KSEBL empanelment guidelines, and is subject to approval by the Electrical Inspectorate.'),
  ('GJ', 'Gujarat: The installation conforms to the GERC Net Metering Regulations and GEDA guidelines, and is subject to approval by the concerned DISCOM (GUVNL) and the Chief Electrical Inspector.')
) AS v(state_code, extra_clause)
JOIN public.state_rules sr ON sr.state_code = v.state_code
CROSS JOIN LATERAL (
  SELECT clauses FROM public.state_terms_templates WHERE state_id IS NULL AND is_active = TRUE LIMIT 1
) g
WHERE NOT EXISTS (
  SELECT 1 FROM public.state_terms_templates t WHERE t.state_id = sr.id AND t.is_active = TRUE
);

COMMIT;
