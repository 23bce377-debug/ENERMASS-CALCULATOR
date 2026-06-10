-- ============================================================
-- MIGRATION 03: Fix Vendor Name Typo
-- 'Appolo' → 'Apollo' in structure_vendors (and vendors if present)
-- ============================================================

BEGIN;

-- Fix in structure_vendors
UPDATE structure_vendors 
SET name = 'Apollo'
WHERE UPPER(TRIM(name)) IN ('APPOLO', 'APPOLLO', 'APOLO');

-- Fix in vendors table too (if any were added with wrong name)
UPDATE vendors
SET name = 'Apollo'
WHERE UPPER(TRIM(name)) IN ('APPOLO', 'APPOLLO', 'APOLO');

-- Validate
DO $$
DECLARE v_bad_count INT;
BEGIN
  SELECT COUNT(*) INTO v_bad_count 
  FROM structure_vendors 
  WHERE UPPER(name) IN ('APPOLO', 'APPOLLO', 'APOLO');
  
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'Still found % rows with misspelled vendor name in structure_vendors', v_bad_count;
  END IF;
  RAISE NOTICE '✅ Vendor name typo fixed. structure_vendors names: %', 
    (SELECT array_agg(name ORDER BY name) FROM structure_vendors);
END $$;

COMMIT;
