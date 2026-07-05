-- Harden preset BOM replacement RPC permissions and reject empty item sets.
BEGIN;

CREATE OR REPLACE FUNCTION public.replace_system_items_atomic(
  p_system_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_state_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_system_id IS NULL THEN
    RAISE EXCEPTION 'System id is required';
  END IF;

  SELECT org_id INTO v_org_id
  FROM public.systems
  WHERE id = p_system_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'System preset not found: %', p_system_id;
  END IF;

  IF NOT (
    public.is_service_role()
    OR public.is_superadmin()
    OR (v_org_id IS NOT NULL AND public.is_org_member(v_org_id))
  ) THEN
    RAISE EXCEPTION 'Forbidden: you cannot modify this preset';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Preset must contain at least one BOM item';
  END IF;

  DELETE FROM public.system_items
  WHERE system_id = p_system_id;

  INSERT INTO public.system_items (
    system_id,
    section,
    description,
    unit,
    default_qty,
    sort_order,
    is_included_by_default,
    is_mandatory,
    remarks,
    panel_id,
    inverter_id,
    battery_id,
    structure_id,
    solar_meter_id,
    net_meter_id,
    la_id,
    bom_item_id,
    comm_device_id,
    structure_component_id
  )
  SELECT
    p_system_id,
    item.section::public.bom_section,
    item.description,
    COALESCE(item.unit, 'Nos'),
    COALESCE(item.default_qty, 0),
    COALESCE(item.sort_order, 1),
    COALESCE(item.is_included_by_default, true),
    COALESCE(item.is_mandatory, true),
    item.remarks,
    item.panel_id,
    item.inverter_id,
    item.battery_id,
    item.structure_id,
    item.solar_meter_id,
    item.net_meter_id,
    item.la_id,
    item.bom_item_id,
    item.comm_device_id,
    item.structure_component_id
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    section text,
    description text,
    unit text,
    default_qty numeric,
    sort_order integer,
    is_included_by_default boolean,
    is_mandatory boolean,
    remarks text,
    panel_id uuid,
    inverter_id uuid,
    battery_id uuid,
    structure_id uuid,
    solar_meter_id uuid,
    net_meter_id uuid,
    la_id uuid,
    bom_item_id uuid,
    comm_device_id uuid,
    structure_component_id uuid
  );

  DELETE FROM public.system_state_availability
  WHERE system_id = p_system_id
    AND (p_state_id IS NULL OR state_id IS DISTINCT FROM p_state_id);

  IF p_state_id IS NOT NULL THEN
    INSERT INTO public.system_state_availability (system_id, state_id)
    VALUES (p_system_id, p_state_id)
    ON CONFLICT (system_id, state_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_system_items_atomic(uuid, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_system_items_atomic(uuid, jsonb, uuid) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
