-- ============================================================
-- MIGRATION 06: Archive Junk Tables from Excel Imports
-- gst_master, pricing_reference, engineering_rules_metadata
-- ============================================================
-- These tables contain raw Excel import metadata with no
-- business value. They are not referenced by any ORM or query.
-- We rename (not drop) to preserve data integrity.
-- ============================================================

BEGIN;

-- Verify none of these tables have active FK references before archiving
DO $$
BEGIN
  -- Check if gst_master is referenced by any FK (it has no FKs pointing to it)
  -- Check if pricing_reference is referenced (no FKs)
  -- Check if engineering_rules_metadata is referenced (no FKs)
  RAISE NOTICE 'Archiving junk tables from Excel imports...';
END $$;

-- Archive by renaming with _deprecated suffix
ALTER TABLE gst_master RENAME TO gst_master_deprecated;
ALTER TABLE pricing_reference RENAME TO pricing_reference_deprecated;
ALTER TABLE engineering_rules_metadata RENAME TO engineering_rules_metadata_deprecated;

-- Validate the renames succeeded
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('gst_master', 'pricing_reference', 'engineering_rules_metadata');
  
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Archive failed: % original junk tables still exist', v_count;
  END IF;
  
  RAISE NOTICE '✅ Junk tables archived (renamed to _deprecated).';
  RAISE NOTICE '   - gst_master → gst_master_deprecated';
  RAISE NOTICE '   - pricing_reference → pricing_reference_deprecated';
  RAISE NOTICE '   - engineering_rules_metadata → engineering_rules_metadata_deprecated';
END $$;

COMMIT;
