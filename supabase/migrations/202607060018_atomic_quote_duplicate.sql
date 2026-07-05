-- Clone a quote and its dependent rows in a single transaction.
BEGIN;

CREATE OR REPLACE FUNCTION public.duplicate_quote_atomic(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.quotes%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_copy_number text;
BEGIN
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Quote id is required';
  END IF;

  SELECT * INTO v_source
  FROM public.quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found: %', p_quote_id;
  END IF;

  IF NOT (
    public.is_service_role()
    OR public.is_superadmin()
    OR public.is_org_member(v_source.org_id)
  ) THEN
    RAISE EXCEPTION 'Forbidden: you cannot duplicate this quote';
  END IF;

  v_copy_number := v_source.quote_number
    || '-COPY-'
    || to_char(v_now, 'YYYYMMDDHH24MISSMS')
    || '-'
    || substring(v_new_id::text from 1 for 6);

  INSERT INTO public.quotes
  SELECT (jsonb_populate_record(
    NULL::public.quotes,
    to_jsonb(v_source)
    || jsonb_build_object(
      'id', v_new_id,
      'quote_number', v_copy_number,
      'status', 'draft',
      'version', 1,
      'parent_quote_id', NULL,
      'version_reason', NULL,
      'created_at', v_now,
      'updated_at', v_now
    )
  )).*;

  INSERT INTO public.quote_items
  SELECT (jsonb_populate_record(
    NULL::public.quote_items,
    to_jsonb(item_row)
    || jsonb_build_object(
      'id', gen_random_uuid(),
      'quote_id', v_new_id,
      'created_at', v_now,
      'updated_at', v_now
    )
  )).*
  FROM public.quote_items AS item_row
  WHERE item_row.quote_id = p_quote_id;

  INSERT INTO public.quote_additional_costs
  SELECT (jsonb_populate_record(
    NULL::public.quote_additional_costs,
    to_jsonb(cost_row)
    || jsonb_build_object(
      'id', gen_random_uuid(),
      'quote_id', v_new_id,
      'created_at', v_now
    )
  )).*
  FROM public.quote_additional_costs AS cost_row
  WHERE cost_row.quote_id = p_quote_id;

  INSERT INTO public.quote_variants
  SELECT (jsonb_populate_record(
    NULL::public.quote_variants,
    to_jsonb(variant_row)
    || jsonb_build_object(
      'id', gen_random_uuid(),
      'quote_id', v_new_id,
      'created_at', v_now,
      'updated_at', v_now
    )
  )).*
  FROM public.quote_variants AS variant_row
  WHERE variant_row.quote_id = p_quote_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_quote_atomic(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.duplicate_quote_atomic(uuid) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
