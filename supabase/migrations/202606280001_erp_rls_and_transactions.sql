-- 202606280001_erp_rls_and_transactions.sql
-- Enables RLS on all missing procurement & inventory tables,
-- defines multi-table transactional RPCs,
-- and adds project status date triggers.

BEGIN;

-- Fresh replays need these tables before RLS policies and RPCs below run.
-- Later remediation migrations add/repair additional columns idempotently.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
    CREATE TYPE public.po_status AS ENUM (
      'draft',
      'submitted_for_approval',
      'approved',
      'sent',
      'partially_received',
      'received',
      'closed',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventory_summary (
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  category text,
  current_qty numeric NOT NULL DEFAULT 0,
  weighted_avg_cost numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'Nos',
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, item_description)
);

CREATE TABLE IF NOT EXISTS public.proc_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.epc_projects(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  status po_status NOT NULL DEFAULT 'draft',
  pr_status text NOT NULL DEFAULT 'draft',
  total_taxable numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  delivery_date date,
  notes text,
  items_count integer NOT NULL DEFAULT 0,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proc_purchase_orders_org_number_unique UNIQUE (org_id, po_number)
);

CREATE TABLE IF NOT EXISTS public.proc_po_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.proc_purchase_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_id uuid,
  item_type text,
  item_description text,
  category text,
  unit text NOT NULL DEFAULT 'Nos',
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  estimated_rate numeric,
  gst_pct numeric NOT NULL DEFAULT 0.18,
  is_pr_item boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.proc_goods_receipt_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES public.proc_purchase_orders(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.inv_warehouses(id) ON DELETE RESTRICT,
  grn_number text NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  is_processed boolean NOT NULL DEFAULT false,
  idempotency_key text UNIQUE,
  processed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proc_grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.proc_goods_receipt_notes(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_id uuid,
  item_type text,
  item_description text,
  qty_received numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Nos',
  serials text[] DEFAULT '{}'::text[],
  CONSTRAINT proc_grn_items_grn_catalog_unique UNIQUE (grn_id, catalog_item_id)
);

-- ============================================================
-- 1. Enable RLS and define policies for inventory & procurement
-- ============================================================

-- inventory_summary
ALTER TABLE public.inventory_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_summary_org_select ON public.inventory_summary;
CREATE POLICY inventory_summary_org_select ON public.inventory_summary
  FOR SELECT TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS inventory_summary_org_insert ON public.inventory_summary;
CREATE POLICY inventory_summary_org_insert ON public.inventory_summary
  FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS inventory_summary_org_update ON public.inventory_summary;
CREATE POLICY inventory_summary_org_update ON public.inventory_summary
  FOR UPDATE TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin()) 
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS inventory_summary_org_delete ON public.inventory_summary;
CREATE POLICY inventory_summary_org_delete ON public.inventory_summary
  FOR DELETE TO authenticated USING (public.is_superadmin() OR public.is_org_admin(org_id));

DROP POLICY IF EXISTS inventory_summary_service ON public.inventory_summary;
CREATE POLICY inventory_summary_service ON public.inventory_summary
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- proc_purchase_orders
ALTER TABLE public.proc_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proc_po_org_select ON public.proc_purchase_orders;
CREATE POLICY proc_po_org_select ON public.proc_purchase_orders
  FOR SELECT TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_po_org_insert ON public.proc_purchase_orders;
CREATE POLICY proc_po_org_insert ON public.proc_purchase_orders
  FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_po_org_update ON public.proc_purchase_orders;
CREATE POLICY proc_po_org_update ON public.proc_purchase_orders
  FOR UPDATE TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin()) 
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_po_org_delete ON public.proc_purchase_orders;
CREATE POLICY proc_po_org_delete ON public.proc_purchase_orders
  FOR DELETE TO authenticated USING (public.is_superadmin() OR public.is_org_admin(org_id));

DROP POLICY IF EXISTS proc_po_service ON public.proc_purchase_orders;
CREATE POLICY proc_po_service ON public.proc_purchase_orders
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- proc_po_items
ALTER TABLE public.proc_po_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS po_items_org_select ON public.proc_po_items;
CREATE POLICY po_items_org_select ON public.proc_po_items
  FOR SELECT TO authenticated USING (po_id IN (SELECT id FROM public.proc_purchase_orders WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS po_items_org_insert ON public.proc_po_items;
CREATE POLICY po_items_org_insert ON public.proc_po_items
  FOR INSERT TO authenticated WITH CHECK (po_id IN (SELECT id FROM public.proc_purchase_orders WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS po_items_org_update ON public.proc_po_items;
CREATE POLICY po_items_org_update ON public.proc_po_items
  FOR UPDATE TO authenticated USING (po_id IN (SELECT id FROM public.proc_purchase_orders WHERE org_id = public.auth_org_id()) OR public.is_superadmin()) 
  WITH CHECK (po_id IN (SELECT id FROM public.proc_purchase_orders WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS po_items_org_delete ON public.proc_po_items;
CREATE POLICY po_items_org_delete ON public.proc_po_items
  FOR DELETE TO authenticated USING (po_id IN (SELECT id FROM public.proc_purchase_orders WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS po_items_service ON public.proc_po_items;
CREATE POLICY po_items_service ON public.proc_po_items
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- proc_goods_receipt_notes
ALTER TABLE public.proc_goods_receipt_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proc_grn_org_select ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_org_select ON public.proc_goods_receipt_notes
  FOR SELECT TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_grn_org_insert ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_org_insert ON public.proc_goods_receipt_notes
  FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_grn_org_update ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_org_update ON public.proc_goods_receipt_notes
  FOR UPDATE TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin()) 
  WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS proc_grn_org_delete ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_org_delete ON public.proc_goods_receipt_notes
  FOR DELETE TO authenticated USING (public.is_superadmin() OR public.is_org_admin(org_id));

DROP POLICY IF EXISTS proc_grn_service ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_service ON public.proc_goods_receipt_notes
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- proc_grn_items
ALTER TABLE public.proc_grn_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grn_items_org_select ON public.proc_grn_items;
CREATE POLICY grn_items_org_select ON public.proc_grn_items
  FOR SELECT TO authenticated USING (grn_id IN (SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS grn_items_org_insert ON public.proc_grn_items;
CREATE POLICY grn_items_org_insert ON public.proc_grn_items
  FOR INSERT TO authenticated WITH CHECK (grn_id IN (SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS grn_items_org_update ON public.proc_grn_items;
CREATE POLICY grn_items_org_update ON public.proc_grn_items
  FOR UPDATE TO authenticated USING (grn_id IN (SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = public.auth_org_id()) OR public.is_superadmin()) 
  WITH CHECK (grn_id IN (SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS grn_items_org_delete ON public.proc_grn_items;
CREATE POLICY grn_items_org_delete ON public.proc_grn_items
  FOR DELETE TO authenticated USING (grn_id IN (SELECT id FROM public.proc_goods_receipt_notes WHERE org_id = public.auth_org_id()) OR public.is_superadmin());

DROP POLICY IF EXISTS grn_items_service ON public.proc_grn_items;
CREATE POLICY grn_items_service ON public.proc_grn_items
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- inventory_movements policies hardening
DROP POLICY IF EXISTS "org_inventory_access" ON public.inventory_movements;
DROP POLICY IF EXISTS "inventory_movements_org_select" ON public.inventory_movements;
CREATE POLICY "inventory_movements_org_select" ON public.inventory_movements
  FOR SELECT TO authenticated USING (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "inventory_movements_org_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_org_insert" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (org_id = public.auth_org_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "inventory_movements_service" ON public.inventory_movements;
CREATE POLICY "inventory_movements_service" ON public.inventory_movements
  FOR ALL TO service_role USING (public.is_service_role()) WITH CHECK (public.is_service_role());


-- ============================================================
-- 2. Define Transactional RPC Functions
-- ============================================================

-- RPC 1: create_purchase_request
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
SET search_path = public
AS $$
DECLARE
  v_pr_id uuid;
  v_pr_number text;
  v_date_str text;
  v_rand int;
  v_item jsonb;
  v_total_taxable numeric := 0;
BEGIN
  -- Verify auth context matches org
  IF auth_org_id() IS NULL OR auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  -- Generate unique PR number: PR-YYYYMMDD-RAND
  v_date_str := to_char(now(), 'YYYYMMDD');
  v_rand := floor(1000 + random() * 9000)::int;
  v_pr_number := 'PR-' || v_date_str || '-' || v_rand;

  -- Calculate total taxable
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_taxable := v_total_taxable + (v_item->>'qty')::numeric * (v_item->>'estimated_rate')::numeric;
  END LOOP;

  -- Insert PR header
  INSERT INTO public.proc_purchase_orders (
    org_id,
    vendor_id,
    po_number,
    project_id,
    requested_by,
    notes,
    pr_status,
    status,
    total_taxable,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    items_count,
    version
  ) VALUES (
    p_org_id,
    p_vendor_id,
    v_pr_number,
    p_project_id,
    p_requested_by,
    p_notes,
    'pending',
    'draft',
    v_total_taxable,
    0,
    0,
    0,
    v_total_taxable,
    jsonb_array_length(p_items),
    1
  ) RETURNING id INTO v_pr_id;

  -- Insert PR items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.proc_po_items (
      po_id,
      item_description,
      category,
      qty_ordered,
      qty_received,
      unit,
      estimated_rate,
      unit_price,
      gst_pct,
      catalog_item_id,
      is_pr_item
    ) VALUES (
      v_pr_id,
      v_item->>'item_description',
      v_item->>'category',
      (v_item->>'qty')::numeric,
      0,
      COALESCE(v_item->>'unit', 'Nos'),
      (v_item->>'estimated_rate')::numeric,
      (v_item->>'estimated_rate')::numeric,
      0.18,
      NULLIF(v_item->>'catalog_item_id', '')::uuid,
      true
    );
  END LOOP;

  RETURN v_pr_id;
END;
$$;


-- RPC 2: convert_pr_to_po
CREATE OR REPLACE FUNCTION public.convert_pr_to_po(
  p_po_id uuid,
  p_vendor_id uuid,
  p_delivery_date date,
  p_items jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_item jsonb;
  v_total_taxable numeric := 0;
  v_total_gst numeric := 0;
  v_po_number text;
  v_date_str text;
  v_rand int;
BEGIN
  -- Lock PO and check ownership
  SELECT org_id INTO v_org_id FROM public.proc_purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order/Request not found';
  END IF;

  IF auth_org_id() IS NULL OR auth_org_id() != v_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  -- Update items with final unit price and GST %
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE public.proc_po_items
    SET unit_price = (v_item->>'unit_price')::numeric,
        gst_pct = COALESCE((v_item->>'gst_pct')::numeric, 0.18)
    WHERE id = (v_item->>'id')::uuid AND po_id = p_po_id;
  END LOOP;

  -- Recalculate totals from items in database
  SELECT COALESCE(SUM(qty_ordered * unit_price), 0),
         COALESCE(SUM(qty_ordered * unit_price * gst_pct), 0)
  INTO v_total_taxable, v_total_gst
  FROM public.proc_po_items
  WHERE po_id = p_po_id;

  -- Generate PO number: PO-YYYYMMDD-RAND
  v_date_str := to_char(now(), 'YYYYMMDD');
  v_rand := floor(1000 + random() * 9000)::int;
  v_po_number := 'PO-' || v_date_str || '-' || v_rand;

  -- Update PO header
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


-- RPC 3: create_grn_atomic
CREATE OR REPLACE FUNCTION public.create_grn_atomic(
  p_org_id uuid,
  p_po_id uuid,
  p_items jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warehouse_id uuid;
  v_grn_id uuid;
  v_grn_number text;
  v_date_str text;
  v_rand int;
  v_item jsonb;
  v_po_item RECORD;
  v_all_received boolean := true;
  v_any_received boolean := false;
  v_status_result jsonb;
BEGIN
  -- Verify auth context matches org
  IF auth_org_id() IS NULL OR auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_grn_id FROM public.proc_goods_receipt_notes WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'duplicate', true);
    END IF;
  END IF;

  -- Get or create default warehouse
  SELECT id INTO v_warehouse_id FROM public.inv_warehouses WHERE org_id = p_org_id AND is_default = true LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.inv_warehouses (org_id, name, location, is_default)
    VALUES (p_org_id, 'Main Warehouse', 'Default', true)
    RETURNING id INTO v_warehouse_id;
  END IF;

  -- Generate GRN number: GRN-YYYYMMDD-RAND
  v_date_str := to_char(now(), 'YYYYMMDD');
  v_rand := floor(1000 + random() * 9000)::int;
  v_grn_number := 'GRN-' || v_date_str || '-' || v_rand;

  -- Insert GRN header (pending status first)
  INSERT INTO public.proc_goods_receipt_notes (
    org_id,
    po_id,
    warehouse_id,
    grn_number,
    receipt_date,
    status,
    is_processed,
    idempotency_key,
    created_by
  ) VALUES (
    p_org_id,
    p_po_id,
    v_warehouse_id,
    v_grn_number,
    CURRENT_DATE,
    'pending',
    false,
    p_idempotency_key,
    auth.uid()
  ) RETURNING id INTO v_grn_id;

  -- Insert GRN items and update PO items received quantities
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'qty_received')::numeric > 0 THEN
      -- Insert GRN Item
      INSERT INTO public.proc_grn_items (
        grn_id,
        catalog_item_id,
        item_description,
        qty_received,
        unit,
        serials
      ) VALUES (
        v_grn_id,
        (v_item->>'catalog_item_id')::uuid,
        v_item->>'item_description',
        (v_item->>'qty_received')::numeric,
        COALESCE(v_item->>'unit', 'Nos'),
        ARRAY[]::text[]
      ) ON CONFLICT (grn_id, catalog_item_id) DO NOTHING;

      -- Update PO Item
      SELECT qty_received, qty_ordered INTO v_po_item
      FROM public.proc_po_items
      WHERE po_id = p_po_id AND catalog_item_id = (v_item->>'catalog_item_id')::uuid FOR UPDATE;

      IF FOUND THEN
        UPDATE public.proc_po_items
        SET qty_received = LEAST(v_po_item.qty_ordered, v_po_item.qty_received + (v_item->>'qty_received')::numeric)
        WHERE po_id = p_po_id AND catalog_item_id = (v_item->>'catalog_item_id')::uuid;
      END IF;
    END IF;
  END LOOP;

  -- Trigger inventory updates, WAC updates, journal postings via process_grn_receipt
  v_status_result := public.process_grn_receipt(v_grn_id);
  IF (v_status_result->>'success') IS NULL THEN
    RAISE EXCEPTION 'Failed processing inventory for GRN: %', v_status_result->>'error';
  END IF;

  -- Check if PO is fully or partially received and update PO status
  FOR v_po_item IN SELECT qty_ordered, qty_received FROM public.proc_po_items WHERE po_id = p_po_id LOOP
    IF v_po_item.qty_received < v_po_item.qty_ordered THEN
      v_all_received := false;
    END IF;
    IF v_po_item.qty_received > 0 THEN
      v_any_received := true;
    END IF;
  END LOOP;

  UPDATE public.proc_purchase_orders
  SET status = CASE WHEN v_all_received THEN 'received'::po_status WHEN v_any_received THEN 'partially_received'::po_status ELSE 'sent'::po_status END,
      updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'duplicate', false);
END;
$$;


-- RPC 4: create_project_with_quote
CREATE OR REPLACE FUNCTION public.create_project_with_quote(
  p_org_id uuid,
  p_user_id uuid,
  p_project_number text,
  p_planned_start date,
  p_planned_end date,
  p_assigned_pm_id uuid,
  p_quote_id uuid, -- if null, create quote manual
  p_customer_name text,
  p_customer_phone text,
  p_project_type text,
  p_capacity_kw numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid := p_quote_id;
  v_quote_number text;
  v_project_id uuid;
BEGIN
  -- Verify auth context matches org
  IF auth_org_id() IS NULL OR auth_org_id() != p_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Invalid organization context';
  END IF;

  -- 1. Create quote if p_quote_id is null
  IF v_quote_id IS NULL THEN
    -- Generate quote number using collision-safe generator fn_generate_quote_number
    v_quote_number := public.fn_generate_quote_number(p_org_id);
    
    INSERT INTO public.quotes (
      org_id,
      quote_number,
      customer_name,
      customer_phone,
      project_type,
      system_capacity_kw,
      status,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      p_org_id,
      v_quote_number,
      p_customer_name,
      COALESCE(p_customer_phone, '—'),
      COALESCE(p_project_type, 'residential')::project_type,
      COALESCE(p_capacity_kw, 5),
      'won',
      p_user_id,
      now(),
      now()
    ) RETURNING id INTO v_quote_id;
  ELSE
    -- Update existing quote status to won
    UPDATE public.quotes
    SET status = 'won',
        updated_at = now()
    WHERE id = v_quote_id AND org_id = p_org_id;
  END IF;

  -- 2. Create project
  INSERT INTO public.epc_projects (
    org_id,
    quote_id,
    project_number,
    status,
    assigned_pm_id,
    planned_start,
    planned_end,
    version,
    created_at,
    updated_at
  ) VALUES (
    p_org_id,
    v_quote_id,
    p_project_number,
    'in_progress',
    p_assigned_pm_id,
    p_planned_start,
    p_planned_end,
    1,
    now(),
    now()
  ) RETURNING id INTO v_project_id;

  RETURN v_project_id;
END;
$$;

-- ============================================================
-- 3. Project Status Dates Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_handle_project_status_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.actual_start := COALESCE(OLD.actual_start, CURRENT_DATE);
  ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.actual_end := COALESCE(OLD.actual_end, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_status_dates ON public.epc_projects;
CREATE TRIGGER trg_project_status_dates
  BEFORE UPDATE OF status ON public.epc_projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_project_status_dates();

COMMIT;
