-- Add org_id to bom_categories and bom_template_items
ALTER TABLE bom_categories ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE bom_template_items ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

-- Enable RLS on bom_categories
ALTER TABLE bom_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bom_categories' AND policyname = 'bom_categories_access') THEN
    CREATE POLICY "bom_categories_access" ON bom_categories
      FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
END $$;

-- Enable RLS on bom_template_items
ALTER TABLE bom_template_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bom_template_items' AND policyname = 'bom_template_items_access') THEN
    CREATE POLICY "bom_template_items_access" ON bom_template_items
      FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
END $$;

-- Add policies for equipment tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_panels' AND policyname = 'eq_panels_access') THEN
    CREATE POLICY "eq_panels_access" ON eq_panels FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_inverters' AND policyname = 'eq_inverters_access') THEN
    CREATE POLICY "eq_inverters_access" ON eq_inverters FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_batteries' AND policyname = 'eq_batteries_access') THEN
    CREATE POLICY "eq_batteries_access" ON eq_batteries FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_meters' AND policyname = 'eq_meters_access') THEN
    CREATE POLICY "eq_meters_access" ON eq_meters FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'eq_lightning_arresters' AND policyname = 'eq_lightning_arresters_access') THEN
    CREATE POLICY "eq_lightning_arresters_access" ON eq_lightning_arresters FOR ALL USING (org_id IS NULL OR org_id = auth_org_id());
  END IF;
END $$;

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_eq_panels_global ON eq_panels(is_active) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_inverters_global ON eq_inverters(is_active) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_batteries_global ON eq_batteries(is_active) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_eq_meters_org ON eq_meters(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_eq_las_org ON eq_lightning_arresters(org_id, is_active);

-- VALIDATION: Run these queries to verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'eq_%';
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
