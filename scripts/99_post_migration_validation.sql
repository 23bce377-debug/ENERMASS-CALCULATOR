-- ============================================================
-- POST-MIGRATION VALIDATION
-- Run AFTER all migrations complete.
-- Compare against 00_pre_migration_baseline.sql output.
-- ============================================================

-- 1. Equipment catalog counts (should be identical to baseline)
SELECT 'eq_panels'                AS table_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM eq_panels
UNION ALL SELECT 'eq_inverters',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_inverters
UNION ALL SELECT 'eq_batteries',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_batteries
UNION ALL SELECT 'eq_meters',      COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_meters
UNION ALL SELECT 'eq_lightning_arresters', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_lightning_arresters
UNION ALL SELECT 'eq_bom_items',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_bom_items
UNION ALL SELECT 'eq_communication_devices', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_communication_devices
UNION ALL SELECT 'eq_mounting_structures', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_mounting_structures
ORDER BY 1;

-- 2. New tables created (all must have > 0 rows where expected)
SELECT 'structure_accessory_rates'       AS new_table, COUNT(*) AS rows FROM structure_accessory_rates
UNION ALL SELECT 'structure_component_vendor_rates', COUNT(*) FROM structure_component_vendor_rates
ORDER BY 1;

-- 3. Vendor merge validation
SELECT 
  COUNT(*) AS total_vendors,
  COUNT(*) FILTER (WHERE is_structure_vendor) AS structure_vendors,
  COUNT(*) FILTER (WHERE is_structure_vendor AND UPPER(name) = 'APOLLO') AS apollo_correct
FROM vendors;

-- 4. structure_vendors_deprecated still exists (data preserved)
SELECT COUNT(*) AS deprecated_structure_vendors_preserved FROM structure_vendors_deprecated;

-- 5. eq_structure_components: vendor-specific columns GONE
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'eq_structure_components'
  AND column_name IN ('rate_appolo', 'rate_tata', 'rate_deemac');
-- ✅ Should return 0 rows

-- 6. Junk tables: original names GONE
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('gst_master', 'pricing_reference', 'engineering_rules_metadata');
-- ✅ Should return 0 rows

-- Junk tables: _deprecated versions EXIST
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('gst_master_deprecated', 'pricing_reference_deprecated', 'engineering_rules_metadata_deprecated');
-- ✅ Should return 3 rows

-- 7. Inventory catalog linkage
SELECT 
  'inventory_summary' AS table_name,
  COUNT(*) AS total,
  COUNT(catalog_item_id) AS linked,
  COUNT(*) FILTER (WHERE catalog_item_id IS NULL) AS unlinked
FROM inventory_summary
UNION ALL
SELECT 
  'inventory_ledger',
  COUNT(*),
  COUNT(catalog_item_id),
  COUNT(*) FILTER (WHERE catalog_item_id IS NULL)
FROM inventory_ledger;

-- 8. structure_template_items accessory linking
SELECT 
  COUNT(*) AS total_items,
  COUNT(accessory_rate_id) AS linked_to_accessory_rates,
  COUNT(*) FILTER (WHERE vendor_id IS NULL AND weight IS NULL AND accessory_rate_id IS NULL) AS pure_accessories_unlinked
FROM structure_template_items;

-- 9. Quote + BOM integrity (must be unchanged)
SELECT 'quotes' AS table_name, COUNT(*) FROM quotes
UNION ALL SELECT 'quote_items', COUNT(*) FROM quote_items
UNION ALL SELECT 'systems', COUNT(*) FROM systems
UNION ALL SELECT 'system_items', COUNT(*) FROM system_items
ORDER BY 1;

-- 10. Unit standardization check — how many non-canonical units remain?
SELECT TRIM(unit) AS unit, COUNT(*) AS count
FROM eq_bom_items
GROUP BY TRIM(unit)
ORDER BY count DESC;

-- 11. Final: no orphan FKs anywhere critical
SELECT 
  'quote_items with valid quote_id' AS check,
  COUNT(*) FROM quote_items qi WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.id = qi.quote_id)
UNION ALL SELECT 
  'system_items with valid system_id',
  COUNT(*) FROM system_items si WHERE EXISTS (SELECT 1 FROM systems s WHERE s.id = si.system_id)
UNION ALL SELECT
  'structure_material_rates with valid vendor_id (now in vendors)',
  COUNT(*) FROM structure_material_rates smr WHERE EXISTS (SELECT 1 FROM vendors v WHERE v.id = smr.vendor_id);
