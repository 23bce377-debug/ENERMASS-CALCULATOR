-- Make multi-table settings and subsidy saves atomic.
BEGIN;

DROP POLICY IF EXISTS calculation_schemes_write ON public.calculation_schemes;
CREATE POLICY calculation_schemes_write
  ON public.calculation_schemes
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR org_id IS NULL
    OR public.is_org_member(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR org_id IS NULL
    OR public.is_org_member(org_id)
  );

DROP POLICY IF EXISTS scheme_slabs_write ON public.scheme_slabs;
CREATE POLICY scheme_slabs_write
  ON public.scheme_slabs
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.calculation_schemes cs
      WHERE cs.id = scheme_slabs.scheme_id
        AND (cs.org_id IS NULL OR public.is_org_member(cs.org_id))
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.calculation_schemes cs
      WHERE cs.id = scheme_slabs.scheme_id
        AND (cs.org_id IS NULL OR public.is_org_member(cs.org_id))
    )
  );

DROP POLICY IF EXISTS state_scheme_overrides_write ON public.state_scheme_overrides;
CREATE POLICY state_scheme_overrides_write
  ON public.state_scheme_overrides
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.calculation_schemes cs
      WHERE cs.id = state_scheme_overrides.scheme_id
        AND (cs.org_id IS NULL OR public.is_org_member(cs.org_id))
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.calculation_schemes cs
      WHERE cs.id = state_scheme_overrides.scheme_id
        AND (cs.org_id IS NULL OR public.is_org_member(cs.org_id))
    )
  );

CREATE OR REPLACE FUNCTION public.create_subsidy_scheme_atomic(
  p_org_id uuid,
  p_updates jsonb,
  p_slabs jsonb DEFAULT '[]'::jsonb,
  p_state_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheme_id uuid;
  v_result jsonb;
BEGIN
  IF NOT (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(p_org_id)) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ORG_PERMISSION';
  END IF;

  INSERT INTO public.calculation_schemes (
    org_id,
    code,
    name,
    description,
    applies_to,
    max_capacity_kw,
    max_absolute_subsidy,
    effective_from,
    effective_to,
    is_active,
    updated_at
  )
  VALUES (
    p_org_id,
    NULLIF(p_updates->>'code', ''),
    NULLIF(p_updates->>'name', ''),
    NULLIF(p_updates->>'description', ''),
    COALESCE(NULLIF(p_updates->>'applies_to', '')::public.project_type, 'residential'::public.project_type),
    COALESCE(NULLIF(p_updates->>'max_capacity_kw', '')::numeric, 0),
    COALESCE(NULLIF(p_updates->>'max_absolute_subsidy', '')::numeric, 0),
    NULLIF(p_updates->>'effective_from', '')::date,
    NULLIF(p_updates->>'effective_to', '')::date,
    COALESCE((p_updates->>'is_active')::boolean, true),
    now()
  )
  RETURNING id INTO v_scheme_id;

  INSERT INTO public.scheme_slabs (
    scheme_id,
    slab_index,
    start_kw,
    end_kw,
    rate_per_kw,
    is_fixed_amount,
    fixed_amount,
    formula,
    updated_at
  )
  SELECT
    v_scheme_id,
    row_number() OVER ()::int,
    COALESCE(NULLIF(s.value->>'startKW', '')::numeric, NULLIF(s.value->>'start_kw', '')::numeric, 0),
    COALESCE(NULLIF(s.value->>'endKW', '')::numeric, NULLIF(s.value->>'end_kw', '')::numeric),
    COALESCE(NULLIF(s.value->>'ratePerKW', '')::numeric, NULLIF(s.value->>'rate_per_kw', '')::numeric, 0),
    COALESCE((COALESCE(s.value->>'isFixedAmount', s.value->>'is_fixed_amount'))::boolean, false),
    COALESCE(NULLIF(s.value->>'fixedAmount', '')::numeric, NULLIF(s.value->>'fixed_amount', '')::numeric),
    NULLIF(s.value->>'formula', ''),
    now()
  FROM jsonb_array_elements(COALESCE(p_slabs, '[]'::jsonb)) AS s(value);

  INSERT INTO public.state_scheme_overrides (
    scheme_id,
    state_id,
    max_absolute_override,
    additional_state_subsidy,
    is_active,
    updated_at
  )
  SELECT
    v_scheme_id,
    NULLIF(o.value->>'state_id', '')::uuid,
    NULLIF(o.value->>'max_absolute_override', '')::numeric,
    COALESCE(NULLIF(o.value->>'additional_state_subsidy', '')::numeric, 0),
    true,
    now()
  FROM jsonb_array_elements(COALESCE(p_state_overrides, '[]'::jsonb)) AS o(value)
  WHERE NULLIF(o.value->>'state_id', '') IS NOT NULL;

  SELECT to_jsonb(cs.*)
    || jsonb_build_object(
      'scheme_slabs', COALESCE((SELECT jsonb_agg(to_jsonb(ss.*) ORDER BY ss.slab_index) FROM public.scheme_slabs ss WHERE ss.scheme_id = v_scheme_id), '[]'::jsonb),
      'state_scheme_overrides', COALESCE((SELECT jsonb_agg(to_jsonb(sso.*)) FROM public.state_scheme_overrides sso WHERE sso.scheme_id = v_scheme_id), '[]'::jsonb)
    )
  INTO v_result
  FROM public.calculation_schemes cs
  WHERE cs.id = v_scheme_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_subsidy_scheme_atomic(
  p_scheme_id uuid,
  p_updates jsonb,
  p_slabs jsonb DEFAULT '[]'::jsonb,
  p_state_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_effective_org_id uuid;
  v_result jsonb;
BEGIN
  SELECT cs.org_id INTO v_org_id
  FROM public.calculation_schemes cs
  WHERE cs.id = p_scheme_id;

  IF p_scheme_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'SUBSIDY_SCHEME_NOT_FOUND';
  END IF;

  v_effective_org_id := COALESCE(v_org_id, public.auth_org_id());

  IF NOT (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(v_effective_org_id)) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ORG_PERMISSION';
  END IF;

  UPDATE public.calculation_schemes
  SET
    org_id = COALESCE(org_id, v_effective_org_id),
    code = COALESCE(NULLIF(p_updates->>'code', ''), code),
    name = COALESCE(NULLIF(p_updates->>'name', ''), name),
    description = CASE WHEN p_updates ? 'description' THEN NULLIF(p_updates->>'description', '') ELSE description END,
    applies_to = COALESCE(NULLIF(p_updates->>'applies_to', '')::public.project_type, applies_to),
    max_capacity_kw = COALESCE(NULLIF(p_updates->>'max_capacity_kw', '')::numeric, max_capacity_kw),
    max_absolute_subsidy = COALESCE(NULLIF(p_updates->>'max_absolute_subsidy', '')::numeric, max_absolute_subsidy),
    effective_from = CASE WHEN p_updates ? 'effective_from' THEN NULLIF(p_updates->>'effective_from', '')::date ELSE effective_from END,
    effective_to = CASE WHEN p_updates ? 'effective_to' THEN NULLIF(p_updates->>'effective_to', '')::date ELSE effective_to END,
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    updated_at = now()
  WHERE id = p_scheme_id;

  DELETE FROM public.state_scheme_overrides WHERE scheme_id = p_scheme_id;
  DELETE FROM public.scheme_slabs WHERE scheme_id = p_scheme_id;

  INSERT INTO public.scheme_slabs (
    scheme_id,
    slab_index,
    start_kw,
    end_kw,
    rate_per_kw,
    is_fixed_amount,
    fixed_amount,
    formula,
    updated_at
  )
  SELECT
    p_scheme_id,
    row_number() OVER ()::int,
    COALESCE(NULLIF(s.value->>'startKW', '')::numeric, NULLIF(s.value->>'start_kw', '')::numeric, 0),
    COALESCE(NULLIF(s.value->>'endKW', '')::numeric, NULLIF(s.value->>'end_kw', '')::numeric),
    COALESCE(NULLIF(s.value->>'ratePerKW', '')::numeric, NULLIF(s.value->>'rate_per_kw', '')::numeric, 0),
    COALESCE((COALESCE(s.value->>'isFixedAmount', s.value->>'is_fixed_amount'))::boolean, false),
    COALESCE(NULLIF(s.value->>'fixedAmount', '')::numeric, NULLIF(s.value->>'fixed_amount', '')::numeric),
    NULLIF(s.value->>'formula', ''),
    now()
  FROM jsonb_array_elements(COALESCE(p_slabs, '[]'::jsonb)) AS s(value);

  INSERT INTO public.state_scheme_overrides (
    scheme_id,
    state_id,
    max_absolute_override,
    additional_state_subsidy,
    is_active,
    updated_at
  )
  SELECT
    p_scheme_id,
    NULLIF(o.value->>'state_id', '')::uuid,
    NULLIF(o.value->>'max_absolute_override', '')::numeric,
    COALESCE(NULLIF(o.value->>'additional_state_subsidy', '')::numeric, 0),
    true,
    now()
  FROM jsonb_array_elements(COALESCE(p_state_overrides, '[]'::jsonb)) AS o(value)
  WHERE NULLIF(o.value->>'state_id', '') IS NOT NULL;

  SELECT to_jsonb(cs.*)
    || jsonb_build_object(
      'scheme_slabs', COALESCE((SELECT jsonb_agg(to_jsonb(ss.*) ORDER BY ss.slab_index) FROM public.scheme_slabs ss WHERE ss.scheme_id = p_scheme_id), '[]'::jsonb),
      'state_scheme_overrides', COALESCE((SELECT jsonb_agg(to_jsonb(sso.*)) FROM public.state_scheme_overrides sso WHERE sso.scheme_id = p_scheme_id), '[]'::jsonb)
    )
  INTO v_result
  FROM public.calculation_schemes cs
  WHERE cs.id = p_scheme_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_org_settings_atomic(
  p_org_id uuid,
  p_company jsonb,
  p_app_settings jsonb,
  p_category_margins jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(p_org_id)) THEN
    RAISE EXCEPTION 'INSUFFICIENT_ORG_PERMISSION';
  END IF;

  UPDATE public.organisations
  SET
    name = COALESCE(NULLIF(p_company->>'name', ''), name),
    address = NULLIF(p_company->>'address', ''),
    logo_url = NULLIF(p_company->>'logoUrl', ''),
    updated_at = now()
  WHERE id = p_org_id;

  INSERT INTO public.app_settings (
    org_id,
    default_grid_tariff_inr,
    updated_by,
    updated_at
  )
  VALUES (
    p_org_id,
    COALESCE(NULLIF(p_app_settings->>'defaultGridTariff', '')::numeric, 8),
    p_user_id,
    now()
  )
  ON CONFLICT (org_id)
  DO UPDATE SET
    default_grid_tariff_inr = EXCLUDED.default_grid_tariff_inr,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.category_margins (
    org_id,
    category,
    default_margin_pct,
    updated_by,
    updated_at
  )
  SELECT
    p_org_id,
    m.key::public.system_category,
    COALESCE(NULLIF(m.value, '')::numeric, 0),
    p_user_id,
    now()
  FROM jsonb_each_text(COALESCE(p_category_margins, '{}'::jsonb)) AS m(key, value)
  ON CONFLICT (org_id, category)
  DO UPDATE SET
    default_margin_pct = EXCLUDED.default_margin_pct,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  SELECT jsonb_build_object(
    'organisation', to_jsonb(o.*),
    'app_settings', (SELECT to_jsonb(a.*) FROM public.app_settings a WHERE a.org_id = p_org_id),
    'category_margins', COALESCE((SELECT jsonb_agg(to_jsonb(cm.*) ORDER BY cm.category) FROM public.category_margins cm WHERE cm.org_id = p_org_id), '[]'::jsonb)
  )
  INTO v_result
  FROM public.organisations o
  WHERE o.id = p_org_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_subsidy_scheme_atomic(uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_subsidy_scheme_atomic(uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_org_settings_atomic(uuid, jsonb, jsonb, jsonb, uuid) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
