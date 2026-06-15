-- Create preset manager tables

CREATE TABLE IF NOT EXISTS preset_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capacity_kw NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('residential', 'commercial', 'industrial')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'locked')),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_org_template BOOLEAN NOT NULL DEFAULT false,
  calculator_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preset_tag_mappings (
  preset_id UUID REFERENCES system_presets(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES preset_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (preset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS preset_favorites (
  preset_id UUID REFERENCES system_presets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (preset_id, user_id)
);

CREATE TABLE IF NOT EXISTS preset_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID REFERENCES system_presets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE preset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_tag_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for tags" ON preset_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read for published presets" ON system_presets FOR SELECT USING (status = 'published' OR status = 'locked' OR author_id = auth.uid());
CREATE POLICY "Allow authors to insert presets" ON system_presets FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Allow authors to update own presets" ON system_presets FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Allow public read for tag mappings" ON preset_tag_mappings FOR SELECT USING (true);
CREATE POLICY "Allow authors to manage tag mappings" ON preset_tag_mappings FOR ALL USING (
  EXISTS (SELECT 1 FROM system_presets p WHERE p.id = preset_id AND p.author_id = auth.uid())
);

CREATE POLICY "Allow users to manage own favorites" ON preset_favorites FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Allow users to track own usage" ON preset_usage_history FOR ALL USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp_presets()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_system_presets
BEFORE UPDATE ON system_presets
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp_presets();
