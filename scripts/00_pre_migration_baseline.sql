-- ============================================================
-- ENERMASS ERP — Pre-Migration Baseline Validation
-- Run BEFORE any schema changes.
-- Save output for post-migration comparison.
-- ============================================================

-- 1. Equipment catalog counts
SELECT 'eq_panels'                AS table_name, COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM eq_panels
UNION ALL SELECT 'eq_inverters',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_inverters
UNION ALL SELECT 'eq_batteries',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_batteries
UNION ALL SELECT 'eq_meters',      COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_meters
UNION ALL SELECT 'eq_lightning_arresters', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_lightning_arresters
UNION ALL SELECT 'eq_bom_items',   COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_bom_items
UNION ALL SELECT 'eq_communication_devices', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_communication_devices
UNION ALL SELECT 'eq_mounting_structures', COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM eq_mounting_structures
ORDER BY 1;

-- 2. Structure domain counts
SELECT 'structure_vendors'          AS table_name, COUNT(*) AS total FROM structure_vendors
UNION ALL SELECT 'structure_material_rates', COUNT(*) FROM structure_material_rates
UNION ALL SELECT 'structure_templates', COUNT(*) FROM structure_templates
UNION ALL SELECT 'structure_template_items', COUNT(*) FROM structure_template_items
UNION ALL SELECT 'structure_component_master', COUNT(*) FROM structure_component_master
UNION ALL SELECT 'eq_structure_components', COUNT(*) FROM eq_structure_components
UNION ALL SELECT 'eq_structure_bom', COUNT(*) FROM eq_structure_bom
UNION ALL SELECT 'eq_structure_addons', COUNT(*) FROM eq_structure_addons
UNION ALL SELECT 'structure_weight_lookup', COUNT(*) FROM structure_weight_lookup
UNION ALL SELECT 'walkway_templates', COUNT(*) FROM walkway_templates
UNION ALL SELECT 'ladder_templates', COUNT(*) FROM ladder_templates
ORDER BY 1;

-- 3. BOM + systems counts
SELECT 'systems'            AS table_name, COUNT(*) AS total FROM systems
UNION ALL SELECT 'system_items',   COUNT(*) FROM system_items
UNION ALL SELECT 'custom_presets', COUNT(*) FROM custom_presets
UNION ALL SELECT 'bundle_presets', COUNT(*) FROM bundle_presets
UNION ALL SELECT 'bundle_preset_items', COUNT(*) FROM bundle_preset_items
ORDER BY 1;

-- 4. Quote pipeline counts
SELECT 'quotes'             AS table_name, COUNT(*) AS total FROM quotes
UNION ALL SELECT 'quote_items', COUNT(*) FROM quote_items
UNION ALL SELECT 'quote_history', COUNT(*) FROM quote_history
UNION ALL SELECT 'quote_variants', COUNT(*) FROM quote_variants
UNION ALL SELECT 'quote_additional_costs', COUNT(*) FROM quote_additional_costs
ORDER BY 1;

-- 5. Inventory counts
SELECT 'inventory_summary'          AS table_name, COUNT(*) AS total FROM inventory_summary
UNION ALL SELECT 'inventory_ledger', COUNT(*) FROM inventory_ledger
UNION ALL SELECT 'inv_stock_balances', COUNT(*) FROM inv_stock_balances
UNION ALL SELECT 'inv_stock_transactions', COUNT(*) FROM inv_stock_transactions
UNION ALL SELECT 'catalog_items', COUNT(*) FROM catalog_items
ORDER BY 1;

-- 6. Vendor counts
SELECT 'vendors'            AS table_name, COUNT(*) AS total FROM vendors
UNION ALL SELECT 'structure_vendors', COUNT(*) FROM structure_vendors
ORDER BY 1;

-- 7. Junk table counts
SELECT 'gst_master'                   AS table_name, COUNT(*) AS total FROM gst_master
UNION ALL SELECT 'pricing_reference', COUNT(*) FROM pricing_reference
UNION ALL SELECT 'engineering_rules_metadata', COUNT(*) FROM engineering_rules_metadata
ORDER BY 1;

-- 8. Vendor-specific price columns in eq_structure_components (will become 0 after migration)
SELECT 
  COUNT(*) AS total_components,
  COUNT(rate_appolo) AS has_appolo_rate,
  COUNT(rate_tata) AS has_tata_rate,
  COUNT(rate_deemac) AS has_deemac_rate
FROM eq_structure_components;

-- 9. Inventory items NOT yet linked to catalog_items
SELECT COUNT(*) AS inventory_summary_unmapped_to_catalog
FROM inventory_summary
WHERE catalog_item_id IS NULL;

-- 10. structure_template_items with no vendor (should link to accessory rates)
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE vendor_id IS NULL AND weight IS NULL) AS pure_accessories,
  COUNT(*) FILTER (WHERE vendor_id IS NOT NULL OR weight IS NOT NULL) AS vendor_or_weight_items
FROM structure_template_items;

-- 11. Vendor name typo check
SELECT id, name FROM structure_vendors ORDER BY name;
SELECT id, name FROM vendors WHERE UPPER(name) IN ('APPOLO', 'APPOLLO', 'TATA', 'DEEMAC', 'APOLLO') ORDER BY name;
