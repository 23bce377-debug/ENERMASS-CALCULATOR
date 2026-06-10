-- ============================================================
-- MIGRATION 09: Fix inventory_summary Text Key
-- Add catalog_item_id FK to inventory_summary and inventory_ledger
-- ============================================================

BEGIN;

-- Step 9.1: Add catalog_item_id to inventory_summary (if not exists)
ALTER TABLE inventory_summary ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id);

-- Step 9.2: Add catalog_item_id to inventory_ledger (if not exists)
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id);

-- Step 9.3: Backfill inventory_summary from catalog_items by name match
UPDATE inventory_summary is_
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE UPPER(TRIM(is_.item_description)) = UPPER(TRIM(ci.name))
  AND is_.catalog_item_id IS NULL;

-- Step 9.4: Backfill inventory_ledger from catalog_items by name match
UPDATE inventory_ledger il
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE UPPER(TRIM(il.item_description)) = UPPER(TRIM(ci.name))
  AND il.catalog_item_id IS NULL;

-- Step 9.5: Report
DO $$
DECLARE
  v_is_total    INT;
  v_is_linked   INT;
  v_is_unlinked INT;
  v_il_total    INT;
  v_il_linked   INT;
  v_il_unlinked INT;
BEGIN
  SELECT COUNT(*), COUNT(catalog_item_id), COUNT(*) FILTER (WHERE catalog_item_id IS NULL)
  INTO v_is_total, v_is_linked, v_is_unlinked
  FROM inventory_summary;
  
  SELECT COUNT(*), COUNT(catalog_item_id), COUNT(*) FILTER (WHERE catalog_item_id IS NULL)
  INTO v_il_total, v_il_linked, v_il_unlinked
  FROM inventory_ledger;
  
  RAISE NOTICE '✅ inventory_summary: total=%, linked=%, unlinked=%', v_is_total, v_is_linked, v_is_unlinked;
  RAISE NOTICE '✅ inventory_ledger:  total=%, linked=%, unlinked=%', v_il_total, v_il_linked, v_il_unlinked;
  
  IF v_is_unlinked > 0 THEN
    RAISE NOTICE '⚠️  Unlinked inventory_summary items: %', (
      SELECT string_agg(DISTINCT UPPER(TRIM(item_description)), ', ')
      FROM inventory_summary WHERE catalog_item_id IS NULL
    );
  END IF;
END $$;

COMMIT;
