BEGIN;

-- FIX 1: IDEMPOTENCY KEYS ON ALL GRN OPERATIONS
ALTER TABLE proc_goods_receipt_notes ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- FIX 2: DATABASE-LEVEL NEGATIVE QUANTITY CONSTRAINT
-- Protect stock balances from ever going negative
ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS no_negative_stock;
ALTER TABLE inv_stock_balances ADD CONSTRAINT no_negative_stock CHECK (qty_on_hand >= 0);

-- Protect movements/transactions from having negative quantities
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS positive_movement_qty;
ALTER TABLE inventory_movements ADD CONSTRAINT positive_movement_qty CHECK (quantity > 0);

-- FIX 2b: Dispatch function with pre-check and row locking
CREATE OR REPLACE FUNCTION dispatch_inventory(
  p_item_id uuid,
  p_project_id uuid,
  p_quantity numeric,
  p_vehicle_number text DEFAULT NULL,
  p_driver_contact text DEFAULT NULL,
  p_moved_by uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_available numeric;
  v_balance_id uuid;
  v_warehouse_id uuid;
BEGIN
  -- Validate positive quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive. Requested: %', p_quantity;
  END IF;

  -- Lock the row for the item (prioritize warehouse with most stock)
  SELECT id, qty_on_hand, warehouse_id INTO v_balance_id, v_available, v_warehouse_id
  FROM inv_stock_balances
  WHERE catalog_item_id = p_item_id
  ORDER BY qty_on_hand DESC
  LIMIT 1
  FOR UPDATE;

  -- Check availability
  IF NOT FOUND OR v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for item %. Available: %, Requested: %',
      p_item_id, COALESCE(v_available, 0), p_quantity;
  END IF;

  -- Deduct stock
  UPDATE inv_stock_balances
  SET qty_on_hand = qty_on_hand - p_quantity,
      updated_at = now()
  WHERE id = v_balance_id;

  -- Log movement
  INSERT INTO inventory_movements
    (item_id, project_id, from_state, to_state, quantity, vehicle_number, driver_contact, moved_by, moved_at)
  VALUES
    (p_item_id, p_project_id, 'in_warehouse', 'in_transit', p_quantity, p_vehicle_number, p_driver_contact, p_moved_by, now());

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
