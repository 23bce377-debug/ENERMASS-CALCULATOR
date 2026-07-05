-- Reconcile BOM master rows with the workbook baseline in
-- "price calculator template.xlsx".
--
-- The migration is idempotent:
-- - matching global/org baseline rows are updated in place
-- - missing rows are inserted once as global baseline items
-- - source-linked org overrides are not modified

BEGIN;

CREATE TEMP TABLE _excel_bom_ref (
  sku_code text PRIMARY KEY,
  match_skus text[] NOT NULL,
  description text NOT NULL,
  category_name text NOT NULL,
  unit text NOT NULL,
  default_rate numeric NOT NULL DEFAULT 0,
  qty_formula text,
  specification_details text,
  notes text
) ON COMMIT DROP;

INSERT INTO _excel_bom_ref (
  sku_code,
  match_skus,
  description,
  category_name,
  unit,
  default_rate,
  qty_formula,
  specification_details,
  notes
) VALUES
  ('BLOCK', ARRAY['BLOCK', 'SOLID_BLOCK'], 'Block', 'Mounting Structure', 'Nos', 110, '4', 'Structure accessory block as per workbook baseline.', 'Workbook section: Structure & Accessories'),
  ('U_CLAMP', ARRAY['U_CLAMP'], 'U Clamp', 'Mounting Structure', 'Nos', 18.5, '8', 'Structure U clamp as per workbook baseline.', 'Workbook section: Structure & Accessories'),
  ('END_CLAMP', ARRAY['END_CLAMP'], 'End Clamp', 'Mounting Structure', 'Nos', 16, '8', 'Panel end clamp as per workbook baseline.', 'Workbook section: Structure & Accessories'),
  ('CHEMICAL', ARRAY['CHEMICAL'], 'Chemical', 'Mounting Structure', 'Nos', 320, '1', 'Structure chemical accessory as per workbook baseline.', 'Workbook section: Structure & Accessories'),
  ('LADDER', ARRAY['LADDER'], 'Ladder', 'Mounting Structure', 'Nos', 0, NULL, 'Ladder placeholder from workbook baseline; rate to be maintained in masters.', 'Workbook section: Structure & Accessories'),
  ('WALK_WAY', ARRAY['WALK_WAY'], 'Walk Way', 'Mounting Structure', 'Mtr', 600, '10', 'Walkway as per workbook baseline.', 'Workbook section: Structure & Accessories'),

  ('DCDB', ARRAY['DCDB', 'DCDB_1PH'], 'DCDB', 'DC Protection', 'Nos', 1775, '1', 'DC distribution box as per workbook baseline.', 'Workbook section: Distribution Boxes'),
  ('ACDB', ARRAY['ACDB', 'ACDB_1PH'], 'ACDB', 'AC Protection', 'Nos', 1395, '1', 'AC distribution box as per workbook baseline.', 'Workbook section: Distribution Boxes'),
  ('MAIN_DB', ARRAY['MAIN_DB'], 'Main DB', 'AC Protection', 'Nos', 0, NULL, 'Main distribution box placeholder from workbook baseline.', 'Workbook section: Distribution Boxes'),

  ('SOLAR_METER', ARRAY['SOLAR_METER'], 'Solar Meter', 'Monitoring & Safety', 'Nos', 1150, '1', 'Solar meter as per workbook baseline.', 'Workbook section: Meters'),
  ('NET_METER', ARRAY['NET_METER'], 'Net Meter', 'Monitoring & Safety', 'Nos', 2000, '0', 'Net meter as per workbook baseline.', 'Workbook section: Meters'),

  ('WIRING_PIPE', ARRAY['WIRING_PIPE', 'WIRING_PIPE_20MM'], 'Wiring Pipe', 'Monitoring & Safety', 'Nos', 55, '13', 'Wiring pipe as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('L_BOW', ARRAY['L_BOW', 'PVC_ELBOW'], 'L Bow', 'Monitoring & Safety', 'Nos', 4.2, '30', 'L bow / PVC elbow as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('TEE', ARRAY['TEE', 'PVC_TEE'], 'Tee', 'Monitoring & Safety', 'Nos', 5, '4', 'Tee fitting as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('CLAMP', ARRAY['CLAMP'], 'Clamp', 'Monitoring & Safety', 'Nos', 1.4, '50', 'General wiring clamp as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('FISHER_GRIP', ARRAY['FISHER_GRIP'], 'Fisher / Grip', 'Monitoring & Safety', 'packet', 22, '1', 'Fisher/grip packet as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('SCREW', ARRAY['SCREW'], 'Screw', 'Monitoring & Safety', 'Nos', 1, '50', 'Screw as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('CABLE_TIE', ARRAY['CABLE_TIE', 'CABLE_TIE_300'], 'Cable Tie', 'Monitoring & Safety', 'Nos', 2.6, '20', 'Cable tie as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('FLEXIBLE_HOSE', ARRAY['FLEXIBLE_HOSE', 'FLEXIBLE_HOSW', 'FLEXIBLE_PIPE'], 'Flexible Hose', 'Monitoring & Safety', 'Mtr', 25, '1', 'Flexible hose as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('GREEN_SLEEVE', ARRAY['GREEN_SLEEVE', 'GREEN_SLEEV'], 'Green Sleeve', 'Monitoring & Safety', 'Mtr', 30, '0.5', 'Green sleeve as per workbook baseline.', 'Workbook section: Wiring Accessories'),
  ('PVC_CHANNEL', ARRAY['PVC_CHANNEL'], 'PVC Channel', 'Monitoring & Safety', 'Mtr', 110, '1', 'PVC channel as per workbook baseline.', 'Workbook section: Wiring Accessories'),

  ('DC_CABLE', ARRAY['DC_CABLE', 'DC_CABLE_BOS'], 'DC Cable', 'Cables & Conduit', 'Mtr', 55, '50', 'DC cable as per workbook baseline.', 'Workbook section: Cables & Wires'),
  ('AC_CABLE', ARRAY['AC_CABLE', 'AC_CABLE_BOS'], 'AC Cable', 'Cables & Conduit', 'Mtr', 52, '20', 'AC cable as per workbook baseline.', 'Workbook section: Cables & Wires'),
  ('ALUM_CABLE_50_SQMM', ARRAY['ALUM_CABLE_50_SQMM'], 'Alum Cable 50 SQMM', 'Cables & Conduit', 'Mtr', 63, '25', 'Aluminium cable 50 SQMM as per workbook baseline.', 'Workbook section: Cables & Wires'),
  ('ALUM_CABLE_16_SQMM', ARRAY['ALUM_CABLE_16_SQMM'], 'Alum Cable 16 SQMM', 'Cables & Conduit', 'Mtr', 22.5, '25', 'Aluminium cable 16 SQMM as per workbook baseline.', 'Workbook section: Cables & Wires'),
  ('COPPER', ARRAY['COPPER'], 'Copper', 'Cables & Conduit', 'Kg', 1200, '1', 'Copper by weight as per workbook baseline.', 'Workbook section: Cables & Wires'),

  ('L_A', ARRAY['L_A'], 'L/A', 'Earthing', 'Nos', 600, '1', 'Lightning arrester / L-A as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('EARTH_ROD', ARRAY['EARTH_ROD'], 'Earth Rod', 'Earthing', 'Nos', 235, '3', 'Earth rod as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('EARTH_COMPOUND', ARRAY['EARTH_COMPOUND'], 'Earth Compound', 'Earthing', 'bag', 115, '1', 'Earth compound as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('CHAMBER_BOX', ARRAY['CHAMBER_BOX'], 'Chamber Box', 'Earthing', 'Nos', 140, '3', 'Chamber box as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('EARTH_BENCH', ARRAY['EARTH_BENCH'], 'Earth Bench', 'Earthing', 'Nos', 115, '1', 'Earth bench as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('COPPER_LUGS', ARRAY['COPPER_LUGS', 'COPER_LUGS', 'COPPER_LUG_6MM'], 'Copper Lugs', 'Earthing', '6mm', 6, '6', 'Copper lugs as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('ALUMINIUM_LUGS', ARRAY['ALUMINIUM_LUGS'], 'Aluminium Lugs', 'Earthing', '35mm', 15, '2', 'Aluminium lugs as per workbook baseline.', 'Workbook section: LA & Earthings'),
  ('HOLDER_NYLON', ARRAY['HOLDER_NYLON'], 'Holder Nylon', 'Earthing', 'Nos', 7, '20', 'Nylon holder as per workbook baseline.', 'Workbook section: LA & Earthings'),

  ('SOLAR_METER_BOX', ARRAY['SOLAR_METER_BOX'], 'Solar Meter Box', 'Monitoring & Safety', 'Nos', 600, '1', 'Solar meter box as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('NETMETER_BOX', ARRAY['NETMETER_BOX'], 'Netmeter Box', 'Monitoring & Safety', 'Nos', 0, '1', 'Netmeter box placeholder from workbook baseline.', 'Workbook section: Meter Boxes'),
  ('MC4_ADDITIONAL', ARRAY['MC4_ADDITIONAL', 'MC4_CONNECTOR'], 'MC4 (Additional)', 'Monitoring & Safety', 'set', 27, '2', 'Additional MC4 connector set as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('ISOLATOR', ARRAY['ISOLATOR'], 'Isolator', 'AC Protection', 'Nos', 235, '1', 'Isolator as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('TRANSPORTATION', ARRAY['TRANSPORTATION'], 'Transportation', 'Logistics & Handling', 'PERKILOWATT', 2000, '1', 'Transportation per kilowatt as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('COMMISSION', ARRAY['COMMISSION'], 'Commission', 'Civil Works', 'rate/kilowatt', 5000, '3', 'Commission per kilowatt as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('SITE_VISIT', ARRAY['SITE_VISIT'], 'Site Visit', 'Civil Works', 'Nos', 800, '4', 'Site visit as per workbook baseline.', 'Workbook section: Meter Boxes'),
  ('INSTALLATION', ARRAY['INSTALLATION'], 'Installation', 'Civil Works', 'rate/kilowatt', 3000, '3', 'Installation per kilowatt as per workbook baseline.', 'Workbook section: Meter Boxes');

WITH normalized_ref AS (
  SELECT
    r.*,
    ARRAY(SELECT lower(trim(s)) FROM unnest(r.match_skus) AS s) AS match_skus_lower,
    regexp_replace(lower(r.description), '[^a-z0-9]+', ' ', 'g') AS normalized_description
  FROM _excel_bom_ref r
)
UPDATE public.bom_template_items b
SET
  category_id = c.id,
  unit = r.unit,
  default_rate = r.default_rate,
  gst_pct = 0.18000,
  qty_formula = CASE
    WHEN b.qty_formula IS NULL OR trim(b.qty_formula) = '' THEN r.qty_formula
    ELSE b.qty_formula
  END,
  specification_details = COALESCE(NULLIF(b.specification_details, ''), r.specification_details),
  notes = COALESCE(NULLIF(b.notes, ''), r.notes),
  is_active = true,
  updated_at = now()
FROM normalized_ref r
JOIN public.bom_categories c
  ON c.name = r.category_name
WHERE b.source_global_id IS NULL
  AND (
    lower(b.sku_code) = ANY(r.match_skus_lower)
    OR regexp_replace(lower(b.description), '[^a-z0-9]+', ' ', 'g') = r.normalized_description
  );

WITH normalized_ref AS (
  SELECT
    r.*,
    ARRAY(SELECT lower(trim(s)) FROM unnest(r.match_skus) AS s) AS match_skus_lower,
    regexp_replace(lower(r.description), '[^a-z0-9]+', ' ', 'g') AS normalized_description
  FROM _excel_bom_ref r
)
INSERT INTO public.bom_template_items (
  category_id,
  sku_code,
  description,
  unit,
  unit_rate_min,
  unit_rate_max,
  default_rate,
  qty_formula,
  is_survey_dependent,
  civil_required_only,
  notes,
  org_id,
  source_global_id,
  is_active,
  is_custom,
  gst_pct,
  specification_details,
  created_at,
  updated_at
)
SELECT
  c.id,
  r.sku_code,
  r.description,
  r.unit,
  r.default_rate,
  r.default_rate,
  r.default_rate,
  r.qty_formula,
  false,
  false,
  r.notes,
  NULL,
  NULL,
  true,
  false,
  0.18000,
  r.specification_details,
  now(),
  now()
FROM normalized_ref r
JOIN public.bom_categories c
  ON c.name = r.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.bom_template_items b
  WHERE b.org_id IS NULL
    AND b.source_global_id IS NULL
    AND (
      lower(b.sku_code) = ANY(r.match_skus_lower)
      OR regexp_replace(lower(b.description), '[^a-z0-9]+', ' ', 'g') = r.normalized_description
    )
);

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
