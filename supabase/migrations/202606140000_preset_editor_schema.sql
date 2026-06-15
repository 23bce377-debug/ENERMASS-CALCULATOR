ALTER TABLE system_presets
  ADD COLUMN IF NOT EXISTS system_type text DEFAULT 'on_grid'
    CHECK (system_type IN ('on_grid', 'off_grid', 'hybrid', 'upgrade')),
  ADD COLUMN IF NOT EXISTS system_kw numeric,
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS notes text;

DROP TABLE IF EXISTS preset_line_items CASCADE;

CREATE TABLE preset_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES system_presets(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organisations(id),
  category text NOT NULL CHECK (category IN (
    'panel', 'inverter', 'battery', 'structure',
    'dc_protection', 'ac_protection', 'cable', 'earthing',
    'civil', 'logistics', 'accessory', 'other'
  )),
  catalog_item_id uuid,
  catalog_type text CHECK (catalog_type IN ('equipment', 'bom_template', 'custom')),
  sku_code text,
  description text NOT NULL,
  brand text,
  model text,
  unit text NOT NULL DEFAULT 'units',
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_rate numeric NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  is_included boolean NOT NULL DEFAULT true,
  is_survey_dependent boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Enable RLS
ALTER TABLE preset_line_items ENABLE ROW LEVEL SECURITY;

-- Org isolation RLS policy
DROP POLICY IF EXISTS "preset_line_items_org_isolation" ON preset_line_items;
CREATE POLICY "preset_line_items_org_isolation" ON preset_line_items
  FOR ALL USING (org_id = current_org_id());

-- Note: Since we are recreating preset_line_items and relying on the new actions,
-- old JSON line items from calculatorStore will need to be re-saved through the new UI.
