-- ============================================================
-- MIGRATION 20: Negative Stock Guard
-- Prevents negative inventory dispatches (ghost stock P0-3)
-- ============================================================

BEGIN;

-- Function: prevents inventory from going negative via dispatch
CREATE OR REPLACE FUNCTION fn_prevent_negative_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_qty NUMERIC;
BEGIN
  -- Only enforce on negative (outbound) qty_change
  IF NEW.qty_change >= 0 THEN
    RETURN NEW;
  END IF;

  -- Look up current quantity for this item
  SELECT COALESCE(SUM(qty_change), 0) INTO current_qty
  FROM inventory_ledger
  WHERE org_id = NEW.org_id 
    AND item_description = NEW.item_description;

  IF current_qty + NEW.qty_change < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: % has only % units. Cannot dispatch %.', 
      NEW.item_description, current_qty, ABS(NEW.qty_change);
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger before every insert to ledger
DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON inventory_ledger;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE INSERT ON inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_negative_stock();

-- Add reorder_level to inventory_summary so alerts can be shown
ALTER TABLE inventory_summary 
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(10,3) NOT NULL DEFAULT 0;

COMMIT;
