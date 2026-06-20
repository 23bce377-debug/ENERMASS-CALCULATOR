-- =============================================================================
-- Migration Rollbacks: 20260620_rollbacks.sql
-- =============================================================================

-- Rollback for 202606200005_performance_indexes.sql
DROP INDEX IF EXISTS idx_eq_panels_brand_model;
DROP INDEX IF EXISTS idx_eq_inverters_capacity;
DROP INDEX IF EXISTS idx_eq_batteries_chemistry;
DROP INDEX IF EXISTS idx_state_rules_name;
DROP INDEX IF EXISTS idx_state_rules_code;
DROP INDEX IF EXISTS idx_scheme_slabs_scheme;
DROP INDEX IF EXISTS idx_system_items_system;
DROP INDEX IF EXISTS idx_quotes_org_status;
DROP INDEX IF EXISTS idx_quotes_project;
DROP INDEX IF EXISTS idx_inventory_movements_date;
DROP INDEX IF EXISTS idx_bom_template_items_sku;

-- Rollback for 202606200004_structure_engine_indexes.sql
DROP INDEX IF EXISTS idx_structure_weight_lookup_struct;
DROP INDEX IF EXISTS idx_eq_structure_components_struct;
DROP INDEX IF EXISTS idx_structure_template_items_template;
DROP INDEX IF EXISTS idx_structure_material_rates_vendor;
DROP INDEX IF EXISTS idx_structure_accessory_rates_active;

DROP POLICY IF EXISTS eq_mounting_structures_access ON eq_mounting_structures;
ALTER TABLE eq_mounting_structures DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eq_structure_components_access ON eq_structure_components;
ALTER TABLE eq_structure_components DISABLE ROW LEVEL SECURITY;

-- Rollback for 202606200003_inventory_ledger_hardening.sql
DROP TRIGGER IF EXISTS trg_inventory_immutable ON inventory_movements;
DROP FUNCTION IF EXISTS prevent_inventory_movement_mutation();

DROP POLICY IF EXISTS org_inventory_access ON inventory_movements;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;

ALTER TABLE inventory_movements DROP COLUMN IF EXISTS org_id;
DROP INDEX IF EXISTS idx_inventory_movements_item_org;
DROP INDEX IF EXISTS idx_inventory_movements_project;

-- Rollback for 202606200002_multitenancy_hardening.sql
DROP POLICY IF EXISTS bom_categories_access ON bom_categories;
ALTER TABLE bom_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE bom_categories DROP COLUMN IF EXISTS org_id;

DROP POLICY IF EXISTS bom_template_items_access ON bom_template_items;
ALTER TABLE bom_template_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE bom_template_items DROP COLUMN IF EXISTS org_id;

DROP POLICY IF EXISTS eq_panels_access ON eq_panels;
DROP POLICY IF EXISTS eq_inverters_access ON eq_inverters;
DROP POLICY IF EXISTS eq_batteries_access ON eq_batteries;
DROP POLICY IF EXISTS eq_meters_access ON eq_meters;
DROP POLICY IF EXISTS eq_lightning_arresters_access ON eq_lightning_arresters;

DROP INDEX IF EXISTS idx_eq_panels_global;
DROP INDEX IF EXISTS idx_eq_inverters_global;
DROP INDEX IF EXISTS idx_eq_batteries_global;
DROP INDEX IF EXISTS idx_eq_meters_org;
DROP INDEX IF EXISTS idx_eq_las_org;

-- Rollback for 202606200001_canonical_pricing_columns.sql
ALTER TABLE eq_panels DROP COLUMN IF EXISTS rate_per_watt;
ALTER TABLE eq_inverters DROP COLUMN IF EXISTS rate;
ALTER TABLE eq_batteries DROP COLUMN IF EXISTS rate;

DROP INDEX IF EXISTS idx_eq_panels_org_active;
DROP INDEX IF EXISTS idx_eq_inverters_org_active;
DROP INDEX IF EXISTS idx_eq_batteries_org_active;
DROP INDEX IF EXISTS idx_bom_template_items_category;
DROP INDEX IF EXISTS idx_bom_categories_display_order;
