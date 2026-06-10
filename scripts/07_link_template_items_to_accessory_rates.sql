-- ============================================================
-- MIGRATION 07: Link structure_template_items to accessory rates
-- ============================================================
-- structure_template_items currently stores items as plain text
-- with no pricing FK. This adds a soft FK to structure_accessory_rates
-- for items that are pure accessories (no weight, no vendor).
-- ============================================================

BEGIN;

-- Add the FK column (nullable — not all items are accessories)
ALTER TABLE structure_template_items 
  ADD COLUMN IF NOT EXISTS accessory_rate_id UUID REFERENCES structure_accessory_rates(id);

-- Backfill: match template item names to accessory rate canonical names
-- Using both canonical name and aliases
UPDATE structure_template_items sti
SET accessory_rate_id = sar.id
FROM structure_accessory_rates sar
WHERE sti.vendor_id IS NULL  -- accessories have no vendor
  AND sti.weight IS NULL     -- primary members have weight
  AND sti.accessory_rate_id IS NULL  -- not yet linked
  AND (
    LOWER(TRIM(sti.item)) = LOWER(TRIM(sar.item_name))
    OR LOWER(TRIM(sti.item)) = ANY(
      SELECT LOWER(alias) FROM unnest(sar.item_aliases) AS alias
    )
  );

-- Report on linking results
DO $$
DECLARE
  v_total      INT;
  v_linked     INT;
  v_unlinked   INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM structure_template_items
  WHERE vendor_id IS NULL AND weight IS NULL;
  
  SELECT COUNT(*) INTO v_linked
  FROM structure_template_items
  WHERE vendor_id IS NULL AND weight IS NULL AND accessory_rate_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_unlinked
  FROM structure_template_items
  WHERE vendor_id IS NULL AND weight IS NULL AND accessory_rate_id IS NULL;
  
  RAISE NOTICE '✅ structure_template_items accessory linking complete:';
  RAISE NOTICE '   Total pure-accessory items: %', v_total;
  RAISE NOTICE '   Successfully linked: %', v_linked;
  RAISE NOTICE '   Still unlinked: %', v_unlinked;
  
  IF v_unlinked > 0 THEN
    RAISE NOTICE '⚠️  Unlinked items (review and add to structure_accessory_rates if needed):';
    RAISE NOTICE '%', (
      SELECT string_agg(DISTINCT LOWER(TRIM(item)), ', ' ORDER BY LOWER(TRIM(item)))
      FROM structure_template_items
      WHERE vendor_id IS NULL AND weight IS NULL AND accessory_rate_id IS NULL
    );
  END IF;
END $$;

COMMIT;
