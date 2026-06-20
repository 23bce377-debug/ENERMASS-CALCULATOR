-- High-cardinality lookup patterns
CREATE INDEX IF NOT EXISTS idx_eq_panels_brand_model ON eq_panels(brand, model) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_eq_inverters_capacity ON eq_inverters(capacity_kw) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_eq_batteries_chemistry ON eq_batteries(chemistry) WHERE is_active = true;

-- State rules (frequent join)
CREATE INDEX IF NOT EXISTS idx_state_rules_name ON state_rules(state_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_state_rules_code ON state_rules(state_code) WHERE is_active = true;

-- Scheme slabs (subsidy calculation)
CREATE INDEX IF NOT EXISTS idx_scheme_slabs_scheme ON scheme_slabs(scheme_id, slab_index ASC);

-- System items (BOM assembly)
CREATE INDEX IF NOT EXISTS idx_system_items_system ON system_items(system_id, sort_order ASC);

-- Quote performance
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(org_id, status, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id) WHERE project_id IS NOT NULL; (project_id does not exist on quotes)

-- Inventory performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(org_id, created_at DESC);

-- BOM template items
CREATE INDEX IF NOT EXISTS idx_bom_template_items_sku ON bom_template_items(sku_code);

-- COMMENT: Expected query performance improvements
-- eq_panels lookup by org+active: 10ms -> <1ms (idx_eq_panels_org_active)
-- State rule lookup: 5ms -> <0.5ms (idx_state_rules_name)
-- Scheme slabs join: 8ms -> <1ms (idx_scheme_slabs_scheme)
