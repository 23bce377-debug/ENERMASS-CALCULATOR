-- ============================================================
-- MIGRATION 10: Unit Standardization + BOM Dedup Report
-- ============================================================

BEGIN;

-- Step 10.1: Unit standardization in eq_bom_items
UPDATE eq_bom_items SET unit = 'Nos'  WHERE LOWER(TRIM(unit)) IN ('nos', 'no', 'number', 'numbers', 'pcs', 'pieces', 'piece', 'no.', 'nos.');
UPDATE eq_bom_items SET unit = 'Mtr'  WHERE LOWER(TRIM(unit)) IN ('mtr', 'meter', 'meters', 'm', 'mts', 'mtrs', 'mt');
UPDATE eq_bom_items SET unit = 'kg'   WHERE LOWER(TRIM(unit)) IN ('kg', 'kgs', 'kilogram', 'kilograms', 'k.g.');
UPDATE eq_bom_items SET unit = 'Set'  WHERE LOWER(TRIM(unit)) IN ('set', 'sets');
UPDATE eq_bom_items SET unit = 'Lump' WHERE LOWER(TRIM(unit)) IN ('lump', 'lumpsum', 'lump sum', 'ls', 'l.s.');
UPDATE eq_bom_items SET unit = 'L'    WHERE LOWER(TRIM(unit)) IN ('l', 'ltr', 'liter', 'litre', 'liters', 'litres');
UPDATE eq_bom_items SET unit = 'Pair' WHERE LOWER(TRIM(unit)) IN ('pair', 'pairs', 'pr');
UPDATE eq_bom_items SET unit = 'Roll' WHERE LOWER(TRIM(unit)) IN ('roll', 'rolls', 'rll');

-- Step 10.2: Unit standardization in system_items
UPDATE system_items SET unit = 'Nos'  WHERE LOWER(TRIM(unit)) IN ('nos', 'no', 'number', 'numbers', 'pcs', 'pieces', 'piece', 'no.', 'nos.');
UPDATE system_items SET unit = 'Mtr'  WHERE LOWER(TRIM(unit)) IN ('mtr', 'meter', 'meters', 'm', 'mts', 'mtrs', 'mt');
UPDATE system_items SET unit = 'kg'   WHERE LOWER(TRIM(unit)) IN ('kg', 'kgs', 'kilogram', 'kilograms', 'k.g.');
UPDATE system_items SET unit = 'Set'  WHERE LOWER(TRIM(unit)) IN ('set', 'sets');
UPDATE system_items SET unit = 'Lump' WHERE LOWER(TRIM(unit)) IN ('lump', 'lumpsum', 'lump sum', 'ls', 'l.s.');

-- Report on any remaining non-canonical units
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(DISTINCT TRIM(unit)) INTO v_count
  FROM eq_bom_items
  WHERE TRIM(unit) NOT IN ('Nos', 'Mtr', 'kg', 'Set', 'Lump', 'L', 'Pair', 'Roll', 'Sqft', 'Sqm', 'Watt', 'kW', 'kWh', 'kVA', 'kVAr', 'A', 'V', 'W');
  RAISE NOTICE 'Non-canonical unit types remaining in eq_bom_items: %', v_count;
END $$;

COMMIT;

-- Step 10.3: BOM Item deduplication report (SELECT only — no data changes)
SELECT 
  section,
  UPPER(TRIM(description)) AS normalized_desc,
  COUNT(*) AS duplicate_count,
  array_agg(id::text ORDER BY created_at) AS ids
FROM eq_bom_items
WHERE is_active = TRUE
GROUP BY section, UPPER(TRIM(description))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, section, normalized_desc;

-- Step 10.4: Non-canonical units remaining
SELECT DISTINCT TRIM(unit) AS unit_value, COUNT(*) AS usage_count
FROM eq_bom_items
WHERE TRIM(unit) NOT IN ('Nos', 'Mtr', 'kg', 'Set', 'Lump', 'L', 'Pair', 'Roll', 'Sqft', 'Sqm', 'Watt', 'kW', 'kWh', 'kVA', 'kVAr', 'A', 'V', 'W')
GROUP BY TRIM(unit)
ORDER BY usage_count DESC;
