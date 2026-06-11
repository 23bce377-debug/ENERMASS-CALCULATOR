-- ============================================================
-- MIGRATION 13: P0 SECURITY & RELIABILITY REMEDIATION
-- Resolves: 
--   1. Global Master Data Tampering (P0-1)
--   2. Cross-Tenant Inventory Manipulation (P0-2)
--   3. Cross-Tenant Acquisition Hijacking (P0-3)
--   4. Infinite Stock Inflation via Idempotency Failure (P0-4)
--   5. Negative Quantity Math Vulnerability (P0-5)
--   6. Acquisition Ledger Duplication Race Condition (P0-6)
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- P0-4: Add status column to proc_goods_receipt_notes
-- ──────────────────────────────────────────────────────────────
ALTER TABLE proc_goods_receipt_notes 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE proc_goods_receipt_notes 
  DROP CONSTRAINT IF EXISTS ck_proc_goods_receipt_notes_status;

ALTER TABLE proc_goods_receipt_notes 
  ADD CONSTRAINT ck_proc_goods_receipt_notes_status 
  CHECK (status IN ('pending', 'processed'));


-- ──────────────────────────────────────────────────────────────
-- P0-1: Restrict write DML on pricing and material rates
-- ──────────────────────────────────────────────────────────────
-- Drop write policies for public authenticated users, leaving only SELECT.
-- Writes are now prohibited for normal users and allowed only via service_role.
DROP POLICY IF EXISTS struct_comp_vendor_rates_write ON structure_component_vendor_rates;
DROP POLICY IF EXISTS struct_mat_rates_write ON structure_material_rates;


-- ──────────────────────────────────────────────────────────────
-- P0-2 & P0-5: Secure inventory stock management functions
-- ──────────────────────────────────────────────────────────────

-- 1. reserve_stock
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_org_id uuid, 
  p_warehouse_id uuid, 
  p_catalog_item_id uuid, 
  p_qty numeric
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_balance_id UUID;
  v_qty_on_hand NUMERIC;
  v_qty_reserved NUMERIC;
  v_warehouse_org_id UUID;
BEGIN
  -- Validate positive quantity (P0-5)
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive. Requested: %', p_qty;
  END IF;

  -- Ensure auth_org_id context is set
  IF auth_org_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Session organization not found';
  END IF;

  -- Verify warehouse belongs to the authenticated user's organization (P0-2)
  SELECT org_id INTO v_warehouse_org_id FROM inv_warehouses WHERE id = p_warehouse_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse not found: %', p_warehouse_id;
  END IF;

  IF v_warehouse_org_id != auth_org_id() THEN
    RAISE EXCEPTION 'Unauthorized: Warehouse does not belong to your organization';
  END IF;

  -- Strict row locking prevents concurrent double-allocations
  SELECT id, qty_on_hand, qty_reserved INTO v_balance_id, v_qty_on_hand, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist for warehouse % and item %.', p_warehouse_id, p_catalog_item_id;
  END IF;

  -- Insufficient stock validation
  IF (v_qty_on_hand - v_qty_reserved) < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock to reserve. On Hand: %, Reserved: %, Requested: %', v_qty_on_hand, v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_reserved = qty_reserved + p_qty, updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$function$;


-- 2. dispatch_reserved_stock
CREATE OR REPLACE FUNCTION public.dispatch_reserved_stock(
  p_org_id uuid, 
  p_warehouse_id uuid, 
  p_catalog_item_id uuid, 
  p_qty numeric
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_balance_id UUID;
  v_qty_on_hand NUMERIC;
  v_qty_reserved NUMERIC;
  v_warehouse_org_id UUID;
BEGIN
  -- Validate positive quantity (P0-5)
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive. Requested: %', p_qty;
  END IF;

  -- Ensure auth_org_id context is set
  IF auth_org_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Session organization not found';
  END IF;

  -- Verify warehouse belongs to the authenticated user's organization (P0-2)
  SELECT org_id INTO v_warehouse_org_id FROM inv_warehouses WHERE id = p_warehouse_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse not found: %', p_warehouse_id;
  END IF;

  IF v_warehouse_org_id != auth_org_id() THEN
    RAISE EXCEPTION 'Unauthorized: Warehouse does not belong to your organization';
  END IF;

  SELECT id, qty_on_hand, qty_reserved INTO v_balance_id, v_qty_on_hand, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist.';
  END IF;

  IF v_qty_reserved < p_qty THEN
    RAISE EXCEPTION 'Cannot dispatch more than reserved quantity. Reserved: %, Requested: %', v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_on_hand = qty_on_hand - p_qty,
      qty_reserved = qty_reserved - p_qty,
      updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$function$;


-- 3. release_stock_reservation
CREATE OR REPLACE FUNCTION public.release_stock_reservation(
  p_org_id uuid, 
  p_warehouse_id uuid, 
  p_catalog_item_id uuid, 
  p_qty numeric
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_balance_id UUID;
  v_qty_reserved NUMERIC;
  v_warehouse_org_id UUID;
BEGIN
  -- Validate positive quantity (P0-5)
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive. Requested: %', p_qty;
  END IF;

  -- Ensure auth_org_id context is set
  IF auth_org_id() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Session organization not found';
  END IF;

  -- Verify warehouse belongs to the authenticated user's organization (P0-2)
  SELECT org_id INTO v_warehouse_org_id FROM inv_warehouses WHERE id = p_warehouse_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse not found: %', p_warehouse_id;
  END IF;

  IF v_warehouse_org_id != auth_org_id() THEN
    RAISE EXCEPTION 'Unauthorized: Warehouse does not belong to your organization';
  END IF;

  SELECT id, qty_reserved INTO v_balance_id, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist.';
  END IF;

  IF v_qty_reserved < p_qty THEN
    RAISE EXCEPTION 'Cannot release more than reserved quantity. Reserved: %, Requested: %', v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_reserved = qty_reserved - p_qty, updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$function$;


-- ──────────────────────────────────────────────────────────────
-- P0-3 & P0-6: Secure mark_acquisition_as_received
-- ──────────────────────────────────────────────────────────────
-- Drop old function accepting p_org_id
DROP FUNCTION IF EXISTS public.mark_acquisition_as_received(uuid, uuid);

CREATE OR REPLACE FUNCTION public.mark_acquisition_as_received(p_acquisition_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_status acquisition_status;
    v_item RECORD;
    v_org_id UUID;
BEGIN
    -- Ensure auth_org_id context is set
    IF auth_org_id() IS NULL THEN
      RETURN jsonb_build_object('error', 'Unauthorized: Session organization not found');
    END IF;

    -- 1. Row-lock acquisition FOR UPDATE to prevent race conditions
    SELECT status, org_id INTO v_status, v_org_id 
    FROM acquisitions 
    WHERE id = p_acquisition_id 
    FOR UPDATE;

    IF NOT FOUND THEN 
        RETURN jsonb_build_object('error', 'Unauthorized'); 
    END IF;

    -- Validate session context org matches acquisition org (P0-3)
    IF v_org_id != auth_org_id() THEN
        RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;

    -- Idempotency check (P0-6)
    IF v_status = 'received' THEN 
        RETURN jsonb_build_object('error', 'Already processed'); 
    END IF;

    -- 2. Validate positive quantities (P0-5)
    FOR v_item IN (SELECT qty FROM acquisition_items WHERE acquisition_id = p_acquisition_id)
    LOOP
        IF v_item.qty <= 0 THEN
            RAISE EXCEPTION 'Acquisition item quantity must be positive. Found: %', v_item.qty;
        END IF;
    END LOOP;

    -- 3. Update state
    UPDATE acquisitions SET status = 'received', updated_at = NOW() WHERE id = p_acquisition_id;

    -- 4. Update stock ledger (triggers inventory_summary update)
    FOR v_item IN (
        SELECT item_description, category, qty, rate_per_unit, catalog_item_id 
        FROM acquisition_items 
        WHERE acquisition_id = p_acquisition_id
        ORDER BY item_description ASC -- Deterministic sorting to prevent deadlocks (P1)
    )
    LOOP
        INSERT INTO inventory_ledger (org_id, item_description, category, change_qty, transaction_type, reference_id, rate_at_time, catalog_item_id)
        VALUES (v_org_id, v_item.item_description, v_item.category, v_item.qty, 'purchase', p_acquisition_id, v_item.rate_per_unit, v_item.catalog_item_id);
    END LOOP;
    
    RETURN jsonb_build_object('success', true);
END;
$function$;


-- ──────────────────────────────────────────────────────────────
-- P0-4 & P0-5: Secure process_grn_receipt
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_grn_receipt(p_grn_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_grn RECORD;
    v_item RECORD;
    v_current_qty NUMERIC;
    v_current_wac NUMERIC;
    v_new_qty NUMERIC;
    v_new_wac NUMERIC;
    v_entry_id UUID;
    v_total_taxable NUMERIC := 0.00;
    v_total_gst NUMERIC := 0.00;
    v_line_taxable NUMERIC;
    v_line_gst NUMERIC;
BEGIN
    -- Ensure auth_org_id context is set
    IF auth_org_id() IS NULL THEN
      RETURN jsonb_build_object('error', 'Unauthorized: Session organization not found');
    END IF;

    -- 1. Row-lock the GRN record FOR UPDATE to prevent concurrency duplicates (P0-4)
    SELECT * INTO v_grn 
    FROM proc_goods_receipt_notes 
    WHERE id = p_grn_id AND org_id = auth_org_id()
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Goods Receipt Note not found');
    END IF;

    -- Verify idempotency
    IF v_grn.status = 'processed' THEN
        RETURN jsonb_build_object('error', 'Goods Receipt Note already processed');
    END IF;

    -- 2. Process items
    FOR v_item IN (
        SELECT catalog_item_id, qty_received 
        FROM proc_grn_items 
        WHERE grn_id = p_grn_id
        ORDER BY catalog_item_id ASC -- Deterministic sorting to prevent deadlocks (P1)
    )
    LOOP
        -- Enforce positive quantity received (P0-5)
        IF v_item.qty_received <= 0 THEN
            RAISE EXCEPTION 'Received quantity must be positive. Found: %', v_item.qty_received;
        END IF;

        -- Row lock current stock balance to prevent concurrency skews
        SELECT qty_on_hand, wac_price INTO v_current_qty, v_current_wac
        FROM inv_stock_balances
        WHERE warehouse_id = v_grn.warehouse_id AND catalog_item_id = v_item.catalog_item_id
        FOR UPDATE;

        -- Fetch rate and GST from corresponding PO item
        DECLARE
            v_rate NUMERIC;
            v_gst_pct NUMERIC;
        BEGIN
            SELECT unit_price, gst_pct INTO v_rate, v_gst_pct
            FROM proc_po_items 
            WHERE po_id = v_grn.po_id AND catalog_item_id = v_item.catalog_item_id
            LIMIT 1;

            v_rate := COALESCE(v_rate, 0);
            v_gst_pct := COALESCE(v_gst_pct, 18.00);

            -- Validate rate is not negative
            IF v_rate < 0 THEN
                RAISE EXCEPTION 'Purchase order rate cannot be negative';
            END IF;

            IF v_current_qty IS NULL THEN
                -- Insert new stock entry
                INSERT INTO inv_stock_balances (warehouse_id, catalog_item_id, qty_on_hand, wac_price)
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

                UPDATE inv_stock_balances
                SET qty_on_hand = v_new_qty, wac_price = v_new_wac, updated_at = NOW()
                WHERE warehouse_id = v_grn.warehouse_id AND catalog_item_id = v_item.catalog_item_id;
            END IF;

            v_line_taxable := v_item.qty_received * v_rate;
            v_line_gst := v_line_taxable * (v_gst_pct / 100);
            v_total_taxable := v_total_taxable + v_line_taxable;
            v_total_gst := v_total_gst + v_line_gst;

            -- Log transaction ledger
            INSERT INTO inv_stock_transactions (org_id, warehouse_id, catalog_item_id, transaction_type, qty, unit_cost_wac, reference_id)
            VALUES (auth_org_id(), v_grn.warehouse_id, v_item.catalog_item_id, 'receipt', v_item.qty_received, v_rate, p_grn_id);
        END;
    END LOOP;

    -- 3. Post GL entries atomically
    IF v_total_taxable > 0 THEN
      INSERT INTO acc_journal_entries (org_id, reference_no, description)
      VALUES (auth_org_id(), v_grn.grn_number, 'Goods Receipt Note posting for PO ' || (SELECT po_number FROM proc_purchase_orders WHERE id = v_grn.po_id))
      RETURNING id INTO v_entry_id;

      -- Debit Inventory Asset ('1300')
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, get_or_create_account(auth_org_id(), '1300', 'Inventory Asset', 'asset'), v_total_taxable, 0.00, auth_org_id());

      -- Debit GST Input Receivable ('1400')
      IF v_total_gst > 0 THEN
        INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
        VALUES (v_entry_id, get_or_create_account(auth_org_id(), '1400', 'GST Input Receivable', 'asset'), v_total_gst, 0.00, auth_org_id());
      END IF;

      -- Credit Accounts Payable ('2000')
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, get_or_create_account(auth_org_id(), '2000', 'Accounts Payable', 'liability'), 0.00, v_total_taxable + v_total_gst, auth_org_id());
    END IF;

    -- 4. Mark GRN as processed
    UPDATE proc_goods_receipt_notes 
    SET status = 'processed'
    WHERE id = p_grn_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

-- ──────────────────────────────────────────────────────────────
-- P0-6: Rewrite update_inventory_summary trigger function
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_inventory_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_name TEXT;
  v_category bom_section;
BEGIN
  -- Look up name and category from catalog_items (bridged through parent tables if needed)
  SELECT name, category::text::bom_section INTO v_name, v_category
  FROM catalog_items
  WHERE id = NEW.catalog_item_id;

  -- Fallback if not found
  v_name := COALESCE(v_name, NEW.item_description, 'Unknown Item');

  INSERT INTO inventory_summary (org_id, catalog_item_id, item_description, category, current_qty, weighted_avg_cost, last_updated)
  VALUES (NEW.org_id, NEW.catalog_item_id, v_name, v_category, NEW.change_qty, COALESCE(NEW.rate_at_time, 0), NOW())
  ON CONFLICT (org_id, catalog_item_id) DO UPDATE SET
      weighted_avg_cost = CASE 
          -- Reset WAC if current stock is negative or zero to prevent skew
          WHEN inventory_summary.current_qty <= 0 THEN NEW.rate_at_time
          WHEN NEW.change_qty > 0 AND (inventory_summary.current_qty + NEW.change_qty) > 0 THEN
              ((inventory_summary.current_qty * inventory_summary.weighted_avg_cost) + (NEW.change_qty * NEW.rate_at_time)) / (inventory_summary.current_qty + NEW.change_qty)
          ELSE inventory_summary.weighted_avg_cost
      END,
      current_qty = inventory_summary.current_qty + NEW.change_qty,
      last_updated = NOW();
  RETURN NEW;
END;
$function$;

COMMIT;
