-- ============================================================
-- MIGRATION 04: Merge structure_vendors into vendors table
-- ============================================================
-- BEFORE running: ensure migration 03 (typo fix) has been applied.
--
-- Strategy:
--   1. Add is_structure_vendor flag to vendors
--   2. Insert structure vendors into canonical vendors table
--   3. Build temp mapping: old structure_vendors.id → new vendors.id
--   4. DROP old FKs (they point to structure_vendors)
--   5. Update FKs data in structure_material_rates + structure_template_items
--   6. ADD new FKs pointing to vendors
--   7. Validate zero orphans
--   8. Rename structure_vendors to _deprecated
-- ============================================================

BEGIN;

-- Step 4.1: Add is_structure_vendor flag to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_structure_vendor BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 4.2: Insert structure vendors into canonical vendors table
INSERT INTO vendors (name, org_id, is_structure_vendor, status, created_at, updated_at)
SELECT 
  sv.name,
  '00000000-0000-0000-0000-000000000001'::uuid,
  TRUE,
  'active'::vendor_status,
  NOW(),
  NOW()
FROM structure_vendors sv
WHERE NOT EXISTS (
  SELECT 1 FROM vendors v WHERE UPPER(TRIM(v.name)) = UPPER(TRIM(sv.name))
);

-- Mark any already-existing matching vendors as structure vendors
UPDATE vendors v
SET is_structure_vendor = TRUE
FROM structure_vendors sv
WHERE UPPER(TRIM(v.name)) = UPPER(TRIM(sv.name));

-- Step 4.3: Build the ID mapping table
CREATE TABLE IF NOT EXISTS _migration_sv_id_map (
  old_id UUID,
  new_id UUID,
  name   TEXT
);
TRUNCATE _migration_sv_id_map;

INSERT INTO _migration_sv_id_map (old_id, new_id, name)
SELECT sv.id, v.id, sv.name
FROM structure_vendors sv
JOIN vendors v ON UPPER(TRIM(v.name)) = UPPER(TRIM(sv.name));

-- Verify all have mappings
DO $$
DECLARE v_unmapped INT;
BEGIN
  SELECT COUNT(*) INTO v_unmapped
  FROM structure_vendors sv
  WHERE NOT EXISTS (SELECT 1 FROM _migration_sv_id_map m WHERE m.old_id = sv.id);
  IF v_unmapped > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: % structure_vendors unmapped', v_unmapped;
  END IF;
  RAISE NOTICE 'All % structure_vendors mapped to vendors table.', (SELECT COUNT(*) FROM _migration_sv_id_map);
END $$;

-- Step 4.4: DROP old FK constraints (they point to structure_vendors)
ALTER TABLE structure_material_rates DROP CONSTRAINT IF EXISTS structure_material_rates_vendor_id_fkey;
ALTER TABLE structure_template_items DROP CONSTRAINT IF EXISTS structure_template_items_vendor_id_fkey;

-- Step 4.5: Update the vendor_id values to point to canonical vendors table
UPDATE structure_material_rates smr
SET vendor_id = m.new_id
FROM _migration_sv_id_map m
WHERE smr.vendor_id = m.old_id;

UPDATE structure_template_items sti
SET vendor_id = m.new_id
FROM _migration_sv_id_map m
WHERE sti.vendor_id = m.old_id;

-- Step 4.6: ADD new FK constraints pointing to vendors
ALTER TABLE structure_material_rates
  ADD CONSTRAINT structure_material_rates_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(id);

ALTER TABLE structure_template_items
  ADD CONSTRAINT structure_template_items_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(id);

-- Step 4.7: Validate — zero orphans
DO $$
DECLARE v_orphan_smr INT;
DECLARE v_orphan_sti INT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_smr
  FROM structure_material_rates
  WHERE vendor_id NOT IN (SELECT id FROM vendors);
  
  SELECT COUNT(*) INTO v_orphan_sti
  FROM structure_template_items
  WHERE vendor_id IS NOT NULL 
    AND vendor_id NOT IN (SELECT id FROM vendors);
  
  IF v_orphan_smr > 0 THEN
    RAISE EXCEPTION 'structure_material_rates has % orphan vendor_id records', v_orphan_smr;
  END IF;
  IF v_orphan_sti > 0 THEN
    RAISE EXCEPTION 'structure_template_items has % orphan vendor_id records', v_orphan_sti;
  END IF;
  
  RAISE NOTICE 'Zero orphans confirmed. structure_material_rates and structure_template_items FKs valid.';
END $$;

-- Step 4.8: Rename old table to deprecated
ALTER TABLE structure_vendors RENAME TO structure_vendors_deprecated;

-- Clean up temp mapping table
DROP TABLE IF EXISTS _migration_sv_id_map;

COMMIT;
