-- Align live database contracts with backend ORM/API wiring.

BEGIN;

-- Procurement ORM and existing RPCs expect these compatibility columns.
ALTER TABLE public.inv_warehouses
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.inv_warehouses
  ALTER COLUMN code SET DEFAULT 'MAIN';

UPDATE public.inv_warehouses
SET location = COALESCE(location, address, 'Default')
WHERE location IS NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS rn
  FROM public.inv_warehouses
)
UPDATE public.inv_warehouses w
SET is_default = true
FROM ranked r
WHERE r.id = w.id
  AND r.rn = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.inv_warehouses existing
    WHERE existing.org_id = w.org_id
      AND existing.is_default
  );

CREATE UNIQUE INDEX IF NOT EXISTS inv_warehouses_one_default_per_org
  ON public.inv_warehouses (org_id)
  WHERE is_default;

-- UI/RPC paths can create descriptive line items before a catalog item exists.
ALTER TABLE public.acquisition_items
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE public.bundle_preset_items
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE public.proc_grn_items
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE public.acquisition_items
  DROP CONSTRAINT IF EXISTS acquisition_items_catalog_item_id_fkey,
  ADD CONSTRAINT acquisition_items_catalog_item_id_fkey
    FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE SET NULL;

ALTER TABLE public.bundle_preset_items
  DROP CONSTRAINT IF EXISTS bundle_preset_items_catalog_item_id_fkey,
  ADD CONSTRAINT bundle_preset_items_catalog_item_id_fkey
    FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE SET NULL;

ALTER TABLE public.proc_grn_items
  DROP CONSTRAINT IF EXISTS proc_grn_items_catalog_item_id_fkey,
  ADD CONSTRAINT proc_grn_items_catalog_item_id_fkey
    FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.fn_ensure_default_warehouse(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id
  INTO v_id
  FROM public.inv_warehouses
  WHERE org_id = p_org_id
    AND is_default = true
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.inv_warehouses (org_id, name, code, address, location, is_default)
    VALUES (p_org_id, 'Main Warehouse', 'MAIN', 'Default', 'Default', true)
    ON CONFLICT (org_id, code) DO UPDATE
      SET is_default = true,
          location = COALESCE(public.inv_warehouses.location, EXCLUDED.location),
          updated_at = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_grn_atomic(
  p_org_id uuid,
  p_po_id uuid,
  p_items jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_warehouse_id uuid;
  v_grn_id uuid;
  v_grn_number text;
  v_date_str text;
  v_rand int;
  v_item jsonb;
  v_po_item record;
  v_all_received boolean := true;
  v_any_received boolean := false;
  v_status_result jsonb;
BEGIN
  IF auth_org_id() IS NULL OR auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_grn_id
    FROM public.proc_goods_receipt_notes
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'duplicate', true);
    END IF;
  END IF;

  v_warehouse_id := public.fn_ensure_default_warehouse(p_org_id);

  v_date_str := to_char(now(), 'YYYYMMDD');
  v_rand := floor(1000 + random() * 9000)::int;
  v_grn_number := 'GRN-' || v_date_str || '-' || v_rand;

  INSERT INTO public.proc_goods_receipt_notes (
    org_id, po_id, warehouse_id, grn_number, receipt_date,
    status, is_processed, idempotency_key, created_by
  )
  VALUES (
    p_org_id, p_po_id, v_warehouse_id, v_grn_number, CURRENT_DATE,
    'pending', false, p_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_grn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    IF COALESCE((v_item->>'qty_received')::numeric, 0) > 0 THEN
      INSERT INTO public.proc_grn_items (
        grn_id, catalog_item_id, item_description, qty_received, unit, serials
      )
      VALUES (
        v_grn_id,
        NULLIF(v_item->>'catalog_item_id', '')::uuid,
        v_item->>'item_description',
        (v_item->>'qty_received')::numeric,
        COALESCE(v_item->>'unit', 'Nos'),
        ARRAY[]::text[]
      )
      ON CONFLICT (grn_id, catalog_item_id) DO NOTHING;

      IF NULLIF(v_item->>'catalog_item_id', '') IS NOT NULL THEN
        SELECT qty_received, qty_ordered
        INTO v_po_item
        FROM public.proc_po_items
        WHERE po_id = p_po_id
          AND catalog_item_id = (v_item->>'catalog_item_id')::uuid
        FOR UPDATE;

        IF FOUND THEN
          UPDATE public.proc_po_items
          SET qty_received = LEAST(v_po_item.qty_ordered, v_po_item.qty_received + (v_item->>'qty_received')::numeric)
          WHERE po_id = p_po_id
            AND catalog_item_id = (v_item->>'catalog_item_id')::uuid;
        END IF;
      END IF;
    END IF;
  END LOOP;

  v_status_result := public.process_grn_receipt(v_grn_id);
  IF (v_status_result->>'success') IS NULL THEN
    RAISE EXCEPTION 'Failed processing inventory for GRN: %', v_status_result->>'error';
  END IF;

  FOR v_po_item IN SELECT qty_ordered, qty_received FROM public.proc_po_items WHERE po_id = p_po_id LOOP
    IF v_po_item.qty_received < v_po_item.qty_ordered THEN
      v_all_received := false;
    END IF;
    IF v_po_item.qty_received > 0 THEN
      v_any_received := true;
    END IF;
  END LOOP;

  UPDATE public.proc_purchase_orders
  SET status = CASE
        WHEN v_all_received THEN 'received'::po_status
        WHEN v_any_received THEN 'partially_received'::po_status
        ELSE 'sent'::po_status
      END,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_acquisition_atomic(
  p_acquisition jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acquisition_id uuid;
  v_org_id uuid;
  v_result jsonb;
BEGIN
  v_org_id := (p_acquisition->>'org_id')::uuid;
  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized acquisition org %', v_org_id;
  END IF;

  INSERT INTO public.acquisitions (
    org_id, vendor_id, invoice_number, invoice_date,
    total_amount, status, notes
  )
  VALUES (
    v_org_id,
    NULLIF(p_acquisition->>'vendor_id', '')::uuid,
    p_acquisition->>'invoice_number',
    COALESCE((p_acquisition->>'invoice_date')::date, CURRENT_DATE),
    COALESCE((p_acquisition->>'total_amount')::numeric, 0),
    COALESCE(p_acquisition->>'status', 'pending')::acquisition_status,
    p_acquisition->>'notes'
  )
  RETURNING id INTO v_acquisition_id;

  INSERT INTO public.acquisition_items (
    acquisition_id, catalog_item_id, item_description, category, qty, unit, rate_per_unit, gst_pct
  )
  SELECT
    v_acquisition_id,
    item.catalog_item_id,
    item.item_description,
    CASE
      WHEN item.category IN (SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.bom_section'::regtype)
        THEN item.category::bom_section
      ELSE 'services'::bom_section
    END,
    COALESCE(item.qty, 0),
    COALESCE(item.unit, 'Nos'),
    COALESCE(item.rate_per_unit, 0),
    item.gst_pct
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    catalog_item_id uuid,
    item_description text,
    category text,
    qty numeric,
    unit text,
    rate_per_unit numeric,
    gst_pct numeric
  );

  SELECT to_jsonb(a.*) INTO v_result
  FROM public.acquisitions a
  WHERE a.id = v_acquisition_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_bundle_preset_atomic(
  p_preset jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
  v_org_id uuid;
BEGIN
  v_org_id := (p_preset->>'org_id')::uuid;
  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized bundle preset org %', v_org_id;
  END IF;

  INSERT INTO public.bundle_presets (
    org_id, vendor_id, name, notes, effective_bundle_price,
    allocation_strategy, gst_pct, created_by, is_active
  )
  VALUES (
    v_org_id,
    NULLIF(p_preset->>'vendor_id', '')::uuid,
    p_preset->>'name',
    COALESCE(p_preset->>'notes', p_preset->>'description'),
    COALESCE((p_preset->>'effective_bundle_price')::numeric, (p_preset->>'total_price')::numeric, 0),
    COALESCE(p_preset->>'allocation_strategy', 'proportional_cost'),
    COALESCE((p_preset->>'gst_pct')::numeric, 0.18),
    NULLIF(p_preset->>'created_by', '')::uuid,
    COALESCE((p_preset->>'is_active')::boolean, true)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.bundle_preset_items (
    bundle_preset_id, catalog_item_id, item_description, category, qty, unit,
    base_cost, allocated_cost_override, gst_pct
  )
  SELECT
    v_id,
    item.catalog_item_id,
    item.item_description,
    CASE
      WHEN item.category IN (SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.bom_section'::regtype)
        THEN item.category::bom_section
      ELSE 'services'::bom_section
    END,
    COALESCE(item.qty, 1),
    COALESCE(item.unit, 'Nos'),
    COALESCE(item.base_cost, item.rate_per_unit, 0),
    item.allocated_cost_override,
    item.gst_pct
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    catalog_item_id uuid,
    item_description text,
    category text,
    qty numeric,
    unit text,
    base_cost numeric,
    rate_per_unit numeric,
    allocated_cost_override numeric,
    gst_pct numeric
  );

  SELECT to_jsonb(bp.*) INTO v_result
  FROM public.bundle_presets bp
  WHERE bp.id = v_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_bundle_preset_atomic(
  p_preset_id uuid,
  p_updates jsonb,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.bundle_presets
  WHERE id = p_preset_id;

  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized bundle preset %', p_preset_id;
  END IF;

  UPDATE public.bundle_presets
  SET
    name = COALESCE(p_updates->>'name', name),
    notes = COALESCE(p_updates->>'notes', p_updates->>'description', notes),
    vendor_id = CASE WHEN p_updates ? 'vendor_id' THEN NULLIF(p_updates->>'vendor_id', '')::uuid ELSE vendor_id END,
    effective_bundle_price = CASE
      WHEN p_updates ? 'effective_bundle_price' THEN (p_updates->>'effective_bundle_price')::numeric
      WHEN p_updates ? 'total_price' THEN (p_updates->>'total_price')::numeric
      ELSE effective_bundle_price
    END,
    allocation_strategy = COALESCE(p_updates->>'allocation_strategy', allocation_strategy),
    gst_pct = CASE WHEN p_updates ? 'gst_pct' THEN (p_updates->>'gst_pct')::numeric ELSE gst_pct END,
    version = version + 1,
    updated_at = now()
  WHERE id = p_preset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle preset % not found', p_preset_id;
  END IF;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.bundle_preset_items
    WHERE bundle_preset_id = p_preset_id;

    INSERT INTO public.bundle_preset_items (
      bundle_preset_id, catalog_item_id, item_description, category, qty, unit,
      base_cost, allocated_cost_override, gst_pct
    )
    SELECT
      p_preset_id,
      item.catalog_item_id,
      item.item_description,
      CASE
        WHEN item.category IN (SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.bom_section'::regtype)
          THEN item.category::bom_section
        ELSE 'services'::bom_section
      END,
      COALESCE(item.qty, 1),
      COALESCE(item.unit, 'Nos'),
      COALESCE(item.base_cost, item.rate_per_unit, 0),
      item.allocated_cost_override,
      item.gst_pct
    FROM jsonb_to_recordset(p_items) AS item(
      catalog_item_id uuid,
      item_description text,
      category text,
      qty numeric,
      unit text,
      base_cost numeric,
      rate_per_unit numeric,
      allocated_cost_override numeric,
      gst_pct numeric
    );
  END IF;

  SELECT to_jsonb(bp.*) INTO v_result
  FROM public.bundle_presets bp
  WHERE bp.id = p_preset_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ensure_default_warehouse(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ensure_default_warehouse(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_grn_atomic(uuid, uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_grn_atomic(uuid, uuid, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_acquisition_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_acquisition_atomic(jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_bundle_preset_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_bundle_preset_atomic(jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_bundle_preset_atomic(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_bundle_preset_atomic(uuid, jsonb, jsonb) TO authenticated, service_role;

COMMIT;
