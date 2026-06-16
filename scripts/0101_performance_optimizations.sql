-- ============================================================
-- MIGRATION 0101: PERFORMANCE OPTIMIZATIONS
-- Creates Merged Views for global & tenant-specific data
-- Creates save_bom bulk RPC
-- ============================================================

BEGIN;

-- ─── 1. Merged Views for Master Data ───
-- These views automatically union global records (org_id IS NULL) 
-- with tenant-specific records (org_id = auth_org_id())
-- This pushes the computation to the database layer rather than Node.js

CREATE OR REPLACE VIEW vw_merged_panels AS
SELECT * FROM eq_panels WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_panels WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_inverters AS
SELECT * FROM eq_inverters WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_inverters WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_batteries AS
SELECT * FROM eq_batteries WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_batteries WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_meters AS
SELECT * FROM eq_meters WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_meters WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_lightning_arresters AS
SELECT * FROM eq_lightning_arresters WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_lightning_arresters WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_mounting_structures AS
SELECT * FROM eq_mounting_structures WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_mounting_structures WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_bom_items AS
SELECT * FROM eq_bom_items WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_bom_items WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_communication_devices AS
SELECT * FROM eq_communication_devices WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_communication_devices WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_structure_components AS
SELECT * FROM eq_structure_components WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_structure_components WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_structure_addons AS
SELECT * FROM eq_structure_addons WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM eq_structure_addons WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_structure_accessory_rates AS
SELECT * FROM structure_accessory_rates WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM structure_accessory_rates WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_structure_component_master AS
SELECT * FROM structure_component_master WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM structure_component_master WHERE org_id IS NULL;

CREATE OR REPLACE VIEW vw_merged_systems AS
SELECT * FROM systems WHERE org_id = auth_org_id()
UNION ALL
SELECT * FROM systems WHERE org_id IS NULL;

-- ─── 2. Bulk Insert RPC for BOM ───
-- This RPC accepts a JSON array of items and a project/quote ID,
-- avoiding the N+1 problem by processing the entire payload inside a single transaction.

CREATE OR REPLACE FUNCTION save_bom(
  p_project_id UUID, 
  p_org_id UUID,
  p_warehouse_id UUID,
  p_bom_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  catalog_item_id UUID;
  item_qty NUMERIC;
BEGIN
  -- Validate payload is array
  IF jsonb_typeof(p_bom_items) != 'array' THEN
    RAISE EXCEPTION 'p_bom_items must be a JSON array';
  END IF;

  -- Ensure consistent ordering to avoid lock contention (Deadlocks)
  FOR item IN SELECT * FROM jsonb_array_elements(p_bom_items) ORDER BY (value->>'catalog_item_id')::UUID LOOP
    catalog_item_id := (item->>'catalog_item_id')::UUID;
    item_qty := (item->>'qty')::NUMERIC;
    
    -- Reserve stock
    IF catalog_item_id IS NOT NULL THEN
      PERFORM public.reserve_stock(p_org_id, p_warehouse_id, catalog_item_id, item_qty);
    END IF;
    
    -- Optionally, insert into a project BOM table here if necessary
    -- INSERT INTO project_bom_items (project_id, catalog_item_id, qty) VALUES (p_project_id, catalog_item_id, item_qty);
  END LOOP;

END;
$$;

COMMIT;
