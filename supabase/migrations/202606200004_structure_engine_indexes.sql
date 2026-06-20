-- Structure component indexes
CREATE INDEX IF NOT EXISTS idx_structure_weight_lookup_struct ON structure_weight_lookup(structure_id, capacity_kw_min, capacity_kw_max);
CREATE INDEX IF NOT EXISTS idx_eq_structure_components_struct ON eq_structure_components(structure_id);
CREATE INDEX IF NOT EXISTS idx_structure_template_items_template ON structure_template_items(template_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_structure_material_rates_vendor ON structure_material_rates(vendor_id, material_type);
CREATE INDEX IF NOT EXISTS idx_structure_accessory_rates_active ON structure_accessory_rates(is_active) WHERE is_active = true;

-- Ensure org isolation on structure tables
ALTER TABLE eq_mounting_structures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_mounting_structures' AND policyname = 'eq_mounting_structures_access') THEN
    CREATE POLICY "eq_mounting_structures_access" ON eq_mounting_structures
      FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
END $$;

-- eq_structure_components
ALTER TABLE eq_structure_components ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_structure_components' AND policyname = 'eq_structure_components_access') THEN
    CREATE POLICY "eq_structure_components_access" ON eq_structure_components
      FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
END $$;
