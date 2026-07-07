-- Correct existing procurement and reporting contracts without adding new app features.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_purchase_request(
  p_org_id uuid,
  p_vendor_id uuid,
  p_project_id uuid,
  p_requested_by uuid,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pr_id uuid;
  v_pr_number text;
  v_item jsonb;
  v_total_taxable numeric := 0;
BEGIN
  IF public.auth_org_id() IS NULL OR public.auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    v_total_taxable := v_total_taxable
      + COALESCE((v_item->>'qty')::numeric, 0)
      * COALESCE((v_item->>'estimated_rate')::numeric, 0);
  END LOOP;

  v_pr_number := public.fn_generate_po_number(p_org_id);
  IF v_pr_number NOT LIKE 'PR-%' THEN
    v_pr_number := 'PR-' || to_char(now(), 'YYYYMMDD') || '-' || floor(1000 + random() * 9000)::int;
  END IF;

  INSERT INTO public.proc_purchase_orders (
    org_id, vendor_id, po_number, project_id, requested_by, notes,
    pr_status, status, total_taxable, cgst_amount, sgst_amount,
    igst_amount, total_amount, items_count, version
  )
  VALUES (
    p_org_id, p_vendor_id, v_pr_number, p_project_id, p_requested_by, p_notes,
    'pending', 'draft', v_total_taxable, 0, 0,
    0, v_total_taxable, jsonb_array_length(COALESCE(p_items, '[]'::jsonb)), 1
  )
  RETURNING id INTO v_pr_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.proc_po_items (
      po_id, item_description, category, qty_ordered, qty_received,
      unit, estimated_rate, unit_price, gst_pct, catalog_item_id, is_pr_item
    )
    VALUES (
      v_pr_id,
      v_item->>'item_description',
      NULLIF(v_item->>'category', ''),
      COALESCE((v_item->>'qty')::numeric, 0),
      0,
      COALESCE(NULLIF(v_item->>'unit', ''), 'Nos'),
      COALESCE((v_item->>'estimated_rate')::numeric, 0),
      COALESCE((v_item->>'estimated_rate')::numeric, 0),
      18,
      NULLIF(v_item->>'catalog_item_id', '')::uuid,
      true
    );
  END LOOP;

  RETURN v_pr_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_pr_to_po(
  p_po_id uuid,
  p_vendor_id uuid,
  p_delivery_date date,
  p_items jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_item jsonb;
  v_total_taxable numeric := 0;
  v_total_gst numeric := 0;
  v_po_number text;
  v_gst_pct numeric;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.proc_purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order/request not found';
  END IF;

  IF public.auth_org_id() IS NULL OR public.auth_org_id() != v_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    v_gst_pct := COALESCE((v_item->>'gst_pct')::numeric, 18);
    IF v_gst_pct <= 1 THEN
      v_gst_pct := v_gst_pct * 100;
    END IF;

    UPDATE public.proc_po_items
    SET unit_price = COALESCE((v_item->>'unit_price')::numeric, 0),
        gst_pct = v_gst_pct
    WHERE id = (v_item->>'id')::uuid
      AND po_id = p_po_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order item % not found for PO %', v_item->>'id', p_po_id;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(qty_ordered * unit_price), 0),
         COALESCE(SUM(qty_ordered * unit_price * (CASE WHEN gst_pct <= 1 THEN gst_pct ELSE gst_pct / 100 END)), 0)
  INTO v_total_taxable, v_total_gst
  FROM public.proc_po_items
  WHERE po_id = p_po_id;

  v_po_number := public.fn_generate_po_number(v_org_id);

  UPDATE public.proc_purchase_orders
  SET vendor_id = p_vendor_id,
      po_number = v_po_number,
      pr_status = 'po_generated',
      status = 'sent',
      delivery_date = p_delivery_date,
      total_taxable = v_total_taxable,
      cgst_amount = v_total_gst / 2,
      sgst_amount = v_total_gst / 2,
      igst_amount = 0,
      total_amount = v_total_taxable + v_total_gst,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_grn_receipt(p_grn_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grn record;
  v_item record;
  v_current_qty numeric;
  v_current_wac numeric;
  v_new_qty numeric;
  v_new_wac numeric;
  v_entry_id uuid;
  v_total_taxable numeric := 0;
  v_total_gst numeric := 0;
  v_line_taxable numeric;
  v_line_gst numeric;
  v_rate numeric;
  v_gst_pct numeric;
BEGIN
  IF public.auth_org_id() IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Session organization not found');
  END IF;

  SELECT *
  INTO v_grn
  FROM public.proc_goods_receipt_notes
  WHERE id = p_grn_id
    AND org_id = public.auth_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Goods Receipt Note not found');
  END IF;

  IF v_grn.status = 'processed' THEN
    RETURN jsonb_build_object('error', 'Goods Receipt Note already processed');
  END IF;

  FOR v_item IN (
    SELECT catalog_item_id, qty_received
    FROM public.proc_grn_items
    WHERE grn_id = p_grn_id
      AND catalog_item_id IS NOT NULL
    ORDER BY catalog_item_id ASC
  )
  LOOP
    IF v_item.qty_received <= 0 THEN
      RAISE EXCEPTION 'Received quantity must be positive. Found: %', v_item.qty_received;
    END IF;

    SELECT qty_on_hand, wac_price
    INTO v_current_qty, v_current_wac
    FROM public.inv_stock_balances
    WHERE warehouse_id = v_grn.warehouse_id
      AND catalog_item_id = v_item.catalog_item_id
    FOR UPDATE;

    SELECT unit_price, gst_pct
    INTO v_rate, v_gst_pct
    FROM public.proc_po_items
    WHERE po_id = v_grn.po_id
      AND catalog_item_id = v_item.catalog_item_id
    LIMIT 1;

    v_rate := COALESCE(v_rate, 0);
    v_gst_pct := COALESCE(v_gst_pct, 18);
    IF v_gst_pct > 1 THEN
      v_gst_pct := v_gst_pct / 100;
    END IF;

    IF v_rate < 0 THEN
      RAISE EXCEPTION 'Purchase order rate cannot be negative';
    END IF;

    IF v_current_qty IS NULL THEN
      INSERT INTO public.inv_stock_balances (warehouse_id, catalog_item_id, qty_on_hand, wac_price)
      VALUES (v_grn.warehouse_id, v_item.catalog_item_id, v_item.qty_received, v_rate);
    ELSE
      v_new_qty := v_current_qty + v_item.qty_received;
      IF v_current_qty <= 0 THEN
        v_new_wac := v_rate;
      ELSIF v_new_qty > 0 THEN
        v_new_wac := ((v_current_qty * v_current_wac) + (v_item.qty_received * v_rate)) / v_new_qty;
      ELSE
        v_new_wac := v_current_wac;
      END IF;

      UPDATE public.inv_stock_balances
      SET qty_on_hand = v_new_qty,
          wac_price = v_new_wac,
          updated_at = now()
      WHERE warehouse_id = v_grn.warehouse_id
        AND catalog_item_id = v_item.catalog_item_id;
    END IF;

    v_line_taxable := v_item.qty_received * v_rate;
    v_line_gst := v_line_taxable * v_gst_pct;
    v_total_taxable := v_total_taxable + v_line_taxable;
    v_total_gst := v_total_gst + v_line_gst;

    INSERT INTO public.inv_stock_transactions (
      org_id, warehouse_id, catalog_item_id, transaction_type, qty, unit_cost_wac, reference_id
    )
    VALUES (
      public.auth_org_id(), v_grn.warehouse_id, v_item.catalog_item_id, 'receipt',
      v_item.qty_received, v_rate, p_grn_id
    );
  END LOOP;

  IF v_total_taxable > 0 THEN
    INSERT INTO public.acc_journal_entries (org_id, reference_no, description)
    VALUES (
      public.auth_org_id(),
      v_grn.grn_number,
      'Goods Receipt Note posting for PO ' || (
        SELECT po_number FROM public.proc_purchase_orders WHERE id = v_grn.po_id
      )
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (
      v_entry_id,
      public.get_or_create_account(public.auth_org_id(), '1300', 'Inventory Asset', 'asset'),
      v_total_taxable,
      0,
      public.auth_org_id()
    );

    IF v_total_gst > 0 THEN
      INSERT INTO public.acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (
        v_entry_id,
        public.get_or_create_account(public.auth_org_id(), '1400', 'GST Input Receivable', 'asset'),
        v_total_gst,
        0,
        public.auth_org_id()
      );
    END IF;

    INSERT INTO public.acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (
      v_entry_id,
      public.get_or_create_account(public.auth_org_id(), '2000', 'Accounts Payable', 'liability'),
      0,
      v_total_taxable + v_total_gst,
      public.auth_org_id()
    );
  END IF;

  UPDATE public.proc_goods_receipt_notes
  SET status = 'processed',
      is_processed = true,
      processed_at = COALESCE(processed_at, now())
  WHERE id = p_grn_id;

  RETURN jsonb_build_object('success', true);
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
  v_item jsonb;
  v_po_item record;
  v_po_item_id uuid;
  v_catalog_item_id uuid;
  v_qty_received numeric;
  v_all_received boolean := true;
  v_any_received boolean := false;
  v_status_result jsonb;
BEGIN
  IF public.auth_org_id() IS NULL OR public.auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  PERFORM 1
  FROM public.proc_purchase_orders
  WHERE id = p_po_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found for organization';
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
  v_grn_number := 'GRN-' || to_char(now(), 'YYYYMMDD') || '-' || floor(1000 + random() * 9000)::int;

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
    v_qty_received := COALESCE((v_item->>'qty_received')::numeric, 0);
    IF v_qty_received <= 0 THEN
      CONTINUE;
    END IF;

    v_po_item_id := NULLIF(v_item->>'po_item_id', '')::uuid;
    v_catalog_item_id := NULLIF(v_item->>'catalog_item_id', '')::uuid;

    IF v_po_item_id IS NOT NULL THEN
      SELECT id, catalog_item_id, qty_received, qty_ordered
      INTO v_po_item
      FROM public.proc_po_items
      WHERE id = v_po_item_id
        AND po_id = p_po_id
      FOR UPDATE;
    ELSIF v_catalog_item_id IS NOT NULL THEN
      SELECT id, catalog_item_id, qty_received, qty_ordered
      INTO v_po_item
      FROM public.proc_po_items
      WHERE po_id = p_po_id
        AND catalog_item_id = v_catalog_item_id
      FOR UPDATE;
    ELSE
      RAISE EXCEPTION 'GRN item must include po_item_id when catalog_item_id is missing';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase order item not found for GRN line';
    END IF;

    v_catalog_item_id := COALESCE(v_catalog_item_id, v_po_item.catalog_item_id);

    INSERT INTO public.proc_grn_items (
      grn_id, catalog_item_id, item_description, qty_received, unit, serials
    )
    VALUES (
      v_grn_id,
      v_catalog_item_id,
      v_item->>'item_description',
      v_qty_received,
      COALESCE(NULLIF(v_item->>'unit', ''), 'Nos'),
      ARRAY[]::text[]
    )
    ON CONFLICT (grn_id, catalog_item_id) DO NOTHING;

    UPDATE public.proc_po_items
    SET qty_received = LEAST(v_po_item.qty_ordered, v_po_item.qty_received + v_qty_received)
    WHERE id = v_po_item.id;
  END LOOP;

  v_status_result := public.process_grn_receipt(v_grn_id);
  IF (v_status_result->>'success') IS NULL THEN
    RAISE EXCEPTION 'Failed processing inventory for GRN: %', v_status_result->>'error';
  END IF;

  FOR v_po_item IN
    SELECT qty_ordered, qty_received
    FROM public.proc_po_items
    WHERE po_id = p_po_id
  LOOP
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

CREATE OR REPLACE VIEW public.v_gstr3b_export
WITH (security_invoker = true)
AS
WITH ledger AS (
  SELECT
    e.org_id,
    e.entry_date,
    a.code,
    COALESCE(l.debit, 0) AS debit,
    COALESCE(l.credit, 0) AS credit
  FROM public.acc_journal_entries e
  JOIN public.acc_journal_lines l ON l.entry_id = e.id
  JOIN public.acc_accounts a ON a.id = l.account_id
)
SELECT
  org_id,
  'Outward taxable supplies'::text AS nature_of_supplies,
  COALESCE(SUM(CASE WHEN code LIKE '4%' THEN credit - debit ELSE 0 END), 0)::numeric AS total_taxable_value,
  COALESCE(SUM(CASE WHEN code = '2100' THEN credit - debit ELSE 0 END), 0)::numeric AS total_tax_liability,
  COALESCE(SUM(CASE WHEN code = '1400' THEN debit - credit ELSE 0 END), 0)::numeric AS total_itc
FROM ledger
GROUP BY org_id;

CREATE OR REPLACE FUNCTION public.get_gstr3b_summary(
  p_org_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  nature_of_supplies text,
  total_taxable_value numeric,
  total_tax_liability numeric,
  total_itc numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH ledger AS (
    SELECT
      a.code,
      COALESCE(l.debit, 0) AS debit,
      COALESCE(l.credit, 0) AS credit
    FROM public.acc_journal_entries e
    JOIN public.acc_journal_lines l ON l.entry_id = e.id
    JOIN public.acc_accounts a ON a.id = l.account_id
    WHERE e.org_id = p_org_id
      AND e.entry_date >= p_period_start
      AND e.entry_date <= p_period_end
      AND (
        public.is_service_role()
        OR public.is_superadmin()
        OR public.is_org_member(p_org_id)
      )
  )
  SELECT
    'Outward taxable supplies'::text,
    COALESCE(SUM(CASE WHEN code LIKE '4%' THEN credit - debit ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN code = '2100' THEN credit - debit ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN code = '1400' THEN debit - credit ELSE 0 END), 0)::numeric
  FROM ledger;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_request(uuid, uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_pr_to_po(uuid, uuid, date, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_grn_atomic(uuid, uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_grn_receipt(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_gstr3b_summary(uuid, date, date) TO authenticated, service_role;
GRANT SELECT ON public.v_gstr3b_export TO authenticated, service_role;

COMMIT;
