-- Add columns to system_presets
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS system_type text CHECK (system_type IN ('on_grid', 'off_grid', 'hybrid')) DEFAULT 'on_grid';
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS system_kw numeric;
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS last_used_at timestamp;
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE system_presets ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

-- Create preset_line_items table
CREATE TABLE IF NOT EXISTS preset_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id uuid NOT NULL REFERENCES system_presets(id) ON DELETE CASCADE,
    catalog_item_id uuid REFERENCES bom_template_items(id),  -- null for custom items
    sku_code text,
    description text NOT NULL,
    category text NOT NULL,
    unit text NOT NULL,
    quantity numeric,
    unit_rate numeric NOT NULL,
    is_survey_dependent boolean DEFAULT false,
    is_included boolean DEFAULT true,
    sort_order integer,
    org_id uuid REFERENCES organisations(id),
    created_at timestamp DEFAULT now()
);

-- RLS
ALTER TABLE preset_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preset_line_items_org_isolation"
    ON preset_line_items FOR ALL
    USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
