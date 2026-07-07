-- Fix remaining database function contract errors reported by Supabase lint.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.proc_grn_items'::regclass
      AND conname = 'proc_grn_items_grn_catalog_unique'
  ) THEN
    ALTER TABLE public.proc_grn_items
      ADD CONSTRAINT proc_grn_items_grn_catalog_unique UNIQUE (grn_id, catalog_item_id);
  END IF;
END $$;

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
  v_catalog_item_id uuid;
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
      v_catalog_item_id := NULLIF(v_item->>'catalog_item_id', '')::uuid;

      IF v_catalog_item_id IS NULL THEN
        INSERT INTO public.proc_grn_items (
          grn_id, catalog_item_id, item_description, qty_received, unit, serials
        )
        VALUES (
          v_grn_id,
          NULL,
          v_item->>'item_description',
          (v_item->>'qty_received')::numeric,
          COALESCE(v_item->>'unit', 'Nos'),
          ARRAY[]::text[]
        );
      ELSE
        INSERT INTO public.proc_grn_items (
          grn_id, catalog_item_id, item_description, qty_received, unit, serials
        )
        VALUES (
          v_grn_id,
          v_catalog_item_id,
          v_item->>'item_description',
          (v_item->>'qty_received')::numeric,
          COALESCE(v_item->>'unit', 'Nos'),
          ARRAY[]::text[]
        )
        ON CONFLICT (grn_id, catalog_item_id) DO NOTHING;

        SELECT qty_received, qty_ordered
        INTO v_po_item
        FROM public.proc_po_items
        WHERE po_id = p_po_id
          AND catalog_item_id = v_catalog_item_id
        FOR UPDATE;

        IF FOUND THEN
          UPDATE public.proc_po_items
          SET qty_received = LEAST(v_po_item.qty_ordered, v_po_item.qty_received + (v_item->>'qty_received')::numeric)
          WHERE po_id = p_po_id
            AND catalog_item_id = v_catalog_item_id;
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

CREATE OR REPLACE FUNCTION public.automate_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sub record;
  grace_days integer := 3;
  period_end timestamptz;
  grace_end timestamptz;
  new_status text;
BEGIN
  FOR sub IN
    SELECT s.id, s.org_id, s.status, s.current_period_end
    FROM public.org_subscriptions s
    WHERE s.status IN ('active', 'trialing')
      AND s.current_period_end < now()
  LOOP
    period_end := sub.current_period_end;
    grace_end := period_end + (grace_days * interval '1 day');

    IF now() > grace_end THEN
      new_status := 'expired';
    ELSE
      new_status := 'past_due';
    END IF;

    UPDATE public.org_subscriptions
    SET status = new_status, updated_at = now()
    WHERE id = sub.id;

    INSERT INTO public.license_events (org_id, entity_type, entity_id, event_type, event_data)
    VALUES (
      sub.org_id,
      'org_subscription',
      sub.id,
      CASE
        WHEN new_status = 'expired' THEN 'subscription_expired'::public.license_event_type
        ELSE 'subscription_updated'::public.license_event_type
      END,
      jsonb_build_object(
        'action', 'automated_expiry',
        'previousStatus', sub.status,
        'newStatus', new_status,
        'graceDays', grace_days
      )
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_grn_atomic(uuid, uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_grn_atomic(uuid, uuid, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.automate_subscription_expiry() FROM anon;
GRANT EXECUTE ON FUNCTION public.automate_subscription_expiry() TO service_role;

COMMIT;
