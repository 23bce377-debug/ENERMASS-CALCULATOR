-- ==============================================================================
-- PHASE 4: INVENTORY VALUATION & COSTING
-- Migration Date: 2026-06-16
-- Description: Adds FIFO layers, valuation methods, and negative stock protection
-- ==============================================================================

-- 1. Create Cost Layers for FIFO Valuation
CREATE TABLE inv_cost_layers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    warehouse_id uuid NOT NULL REFERENCES inv_warehouses(id),
    catalog_item_id uuid NOT NULL,
    received_date timestamptz NOT NULL DEFAULT now(),
    original_qty numeric NOT NULL CHECK (original_qty > 0),
    remaining_qty numeric NOT NULL CHECK (remaining_qty >= 0),
    unit_cost numeric NOT NULL,
    grn_id uuid, -- Reference to the GRN that created this layer
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE inv_cost_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_inv_cost_layers" ON inv_cost_layers
    FOR ALL USING (org_id = auth_org_id());

-- 2. Modify stock transactions to link to layers
ALTER TABLE inv_stock_transactions ADD COLUMN cost_layer_id uuid REFERENCES inv_cost_layers(id);
ALTER TABLE inv_stock_transactions ADD COLUMN valuation_method text DEFAULT 'WAC' CHECK (valuation_method IN ('WAC', 'FIFO', 'SPECIFIC'));

-- 3. Negative Stock Protection Trigger
CREATE OR REPLACE FUNCTION prevent_negative_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_qty_on_hand numeric;
BEGIN
    SELECT qty_on_hand INTO v_qty_on_hand
    FROM inv_stock_balances
    WHERE warehouse_id = NEW.warehouse_id
    AND catalog_item_id = NEW.catalog_item_id
    FOR UPDATE;

    IF v_qty_on_hand < 0 THEN
        RAISE EXCEPTION 'Negative stock not allowed. Attempted to drive balance to % for item %', v_qty_on_hand, NEW.catalog_item_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock ON inv_stock_balances;
CREATE TRIGGER trg_prevent_negative_stock
    AFTER UPDATE OF qty_on_hand ON inv_stock_balances
    FOR EACH ROW
    WHEN (NEW.qty_on_hand < 0)
    EXECUTE FUNCTION prevent_negative_stock();

-- Ensure that even inserts with negative balances are caught
CREATE OR REPLACE FUNCTION prevent_negative_stock_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.qty_on_hand < 0 THEN
        RAISE EXCEPTION 'Negative stock not allowed on insert. Balance % for item %', NEW.qty_on_hand, NEW.catalog_item_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock_insert ON inv_stock_balances;
CREATE TRIGGER trg_prevent_negative_stock_insert
    BEFORE INSERT ON inv_stock_balances
    FOR EACH ROW
    WHEN (NEW.qty_on_hand < 0)
    EXECUTE FUNCTION prevent_negative_stock_insert();
