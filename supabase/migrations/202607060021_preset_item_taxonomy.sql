-- Add preset item taxonomy:
-- top categories: Panels, Inverters, Batteries, Structures, BOM Items, Miscellaneous
-- BOM subcategories are aligned to "price calculator template.xlsx".

BEGIN;

ALTER TABLE public.bom_categories
  ADD COLUMN IF NOT EXISTS top_category text NOT NULL DEFAULT 'bom_item',
  ADD COLUMN IF NOT EXISTS subcategory_name text;

ALTER TABLE public.bom_preset_items
  ADD COLUMN IF NOT EXISTS top_category text,
  ADD COLUMN IF NOT EXISTS subcategory text;

UPDATE public.bom_categories
SET subcategory_name = COALESCE(NULLIF(subcategory_name, ''), name);

UPDATE public.bom_categories
SET top_category = CASE
  WHEN lower(name) IN ('mounting structure', 'structure', 'structure & accessories') THEN 'structure'
  WHEN lower(name) IN ('miscellaneous', 'miscellenous', 'misc', 'other') THEN 'miscellaneous'
  ELSE 'bom_item'
END
WHERE top_category IS NULL
   OR top_category = ''
   OR lower(name) IN ('mounting structure', 'structure', 'structure & accessories', 'miscellaneous', 'miscellenous', 'misc', 'other');

CREATE UNIQUE INDEX IF NOT EXISTS uq_bom_categories_org_top_subcategory
  ON public.bom_categories (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(top_category)),
    lower(trim(subcategory_name))
  );

CREATE TEMP TABLE _preset_taxonomy_categories (
  top_category text NOT NULL,
  subcategory_name text NOT NULL,
  display_order integer NOT NULL,
  is_optional boolean NOT NULL DEFAULT true
) ON COMMIT DROP;

INSERT INTO _preset_taxonomy_categories (top_category, subcategory_name, display_order, is_optional) VALUES
  ('structure', 'Structure & Accessories', 10, false),
  ('bom_item', 'Distribution Boxes', 20, false),
  ('bom_item', 'Meters', 30, false),
  ('bom_item', 'Wiring Accessories', 40, true),
  ('bom_item', 'Cables & Wires', 50, false),
  ('bom_item', 'LA & Earthings', 60, false),
  ('bom_item', 'Meter Boxes', 70, true),
  ('miscellaneous', 'Miscellaneous', 999, true);

INSERT INTO public.bom_categories (
  org_id,
  name,
  top_category,
  subcategory_name,
  display_order,
  is_optional
)
SELECT
  NULL,
  src.subcategory_name,
  src.top_category,
  src.subcategory_name,
  src.display_order,
  src.is_optional
FROM _preset_taxonomy_categories src
WHERE NOT EXISTS (
  SELECT 1
  FROM public.bom_categories c
  WHERE c.org_id IS NULL
    AND lower(trim(c.top_category)) = lower(trim(src.top_category))
    AND lower(trim(COALESCE(c.subcategory_name, c.name))) = lower(trim(src.subcategory_name))
);

CREATE TEMP TABLE _excel_item_taxonomy (
  sku_code text PRIMARY KEY,
  top_category text NOT NULL,
  subcategory_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO _excel_item_taxonomy (sku_code, top_category, subcategory_name) VALUES
  ('BLOCK', 'structure', 'Structure & Accessories'),
  ('U_CLAMP', 'structure', 'Structure & Accessories'),
  ('END_CLAMP', 'structure', 'Structure & Accessories'),
  ('CHEMICAL', 'structure', 'Structure & Accessories'),
  ('LADDER', 'structure', 'Structure & Accessories'),
  ('WALK_WAY', 'structure', 'Structure & Accessories'),

  ('DCDB', 'bom_item', 'Distribution Boxes'),
  ('ACDB', 'bom_item', 'Distribution Boxes'),
  ('MAIN_DB', 'bom_item', 'Distribution Boxes'),

  ('SOLAR_METER', 'bom_item', 'Meters'),
  ('NET_METER', 'bom_item', 'Meters'),

  ('WIRING_PIPE', 'bom_item', 'Wiring Accessories'),
  ('L_BOW', 'bom_item', 'Wiring Accessories'),
  ('TEE', 'bom_item', 'Wiring Accessories'),
  ('CLAMP', 'bom_item', 'Wiring Accessories'),
  ('FISHER_GRIP', 'bom_item', 'Wiring Accessories'),
  ('SCREW', 'bom_item', 'Wiring Accessories'),
  ('CABLE_TIE', 'bom_item', 'Wiring Accessories'),
  ('FLEXIBLE_HOSE', 'bom_item', 'Wiring Accessories'),
  ('GREEN_SLEEVE', 'bom_item', 'Wiring Accessories'),
  ('PVC_CHANNEL', 'bom_item', 'Wiring Accessories'),

  ('DC_CABLE', 'bom_item', 'Cables & Wires'),
  ('AC_CABLE', 'bom_item', 'Cables & Wires'),
  ('ALUM_CABLE_50_SQMM', 'bom_item', 'Cables & Wires'),
  ('ALUM_CABLE_16_SQMM', 'bom_item', 'Cables & Wires'),
  ('COPPER', 'bom_item', 'Cables & Wires'),

  ('L_A', 'bom_item', 'LA & Earthings'),
  ('EARTH_ROD', 'bom_item', 'LA & Earthings'),
  ('EARTH_COMPOUND', 'bom_item', 'LA & Earthings'),
  ('CHAMBER_BOX', 'bom_item', 'LA & Earthings'),
  ('EARTH_BENCH', 'bom_item', 'LA & Earthings'),
  ('COPPER_LUGS', 'bom_item', 'LA & Earthings'),
  ('ALUMINIUM_LUGS', 'bom_item', 'LA & Earthings'),
  ('HOLDER_NYLON', 'bom_item', 'LA & Earthings'),

  ('SOLAR_METER_BOX', 'bom_item', 'Meter Boxes'),
  ('NETMETER_BOX', 'bom_item', 'Meter Boxes'),
  ('MC4_ADDITIONAL', 'bom_item', 'Meter Boxes'),
  ('ISOLATOR', 'bom_item', 'Meter Boxes'),
  ('TRANSPORTATION', 'bom_item', 'Meter Boxes'),
  ('COMMISSION', 'bom_item', 'Meter Boxes'),
  ('SITE_VISIT', 'bom_item', 'Meter Boxes'),
  ('INSTALLATION', 'bom_item', 'Meter Boxes');

UPDATE public.bom_template_items item
SET category_id = category.id,
    updated_at = now()
FROM _excel_item_taxonomy map
JOIN public.bom_categories category
  ON category.org_id IS NULL
 AND lower(trim(category.top_category)) = lower(trim(map.top_category))
 AND lower(trim(COALESCE(category.subcategory_name, category.name))) = lower(trim(map.subcategory_name))
WHERE lower(trim(item.sku_code)) = lower(trim(map.sku_code));

UPDATE public.bom_preset_items
SET top_category = CASE
    WHEN category = 'miscellaneous' THEN 'miscellaneous'
    ELSE 'bom_item'
  END,
  subcategory = COALESCE(NULLIF(subcategory, ''), category)
WHERE top_category IS NULL OR top_category = '';

CREATE OR REPLACE FUNCTION public.save_bom_preset_atomic(
  p_bom_preset_id uuid,
  p_org_id uuid,
  p_name text,
  p_description text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bom_preset_id uuid;
  v_owner_org_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation id is required';
  END IF;

  IF NOT (
    public.is_service_role()
    OR public.is_superadmin()
    OR public.is_org_member(p_org_id)
  ) THEN
    RAISE EXCEPTION 'Forbidden: you cannot save BOM presets for this organisation';
  END IF;

  IF length(trim(COALESCE(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'BOM preset name is required';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'BOM preset must contain at least one BOM item';
  END IF;

  IF p_bom_preset_id IS NULL THEN
    INSERT INTO public.bom_presets (
      org_id,
      name,
      description,
      is_active,
      created_by,
      updated_at
    )
    VALUES (
      p_org_id,
      trim(p_name),
      NULLIF(trim(COALESCE(p_description, '')), ''),
      true,
      p_user_id,
      now()
    )
    RETURNING id INTO v_bom_preset_id;
  ELSE
    SELECT org_id INTO v_owner_org_id
    FROM public.bom_presets
    WHERE id = p_bom_preset_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BOM preset not found';
    END IF;

    IF v_owner_org_id <> p_org_id THEN
      RAISE EXCEPTION 'Forbidden: BOM preset belongs to another organisation';
    END IF;

    UPDATE public.bom_presets
    SET
      name = trim(p_name),
      description = NULLIF(trim(COALESCE(p_description, '')), ''),
      updated_at = now()
    WHERE id = p_bom_preset_id
    RETURNING id INTO v_bom_preset_id;

    DELETE FROM public.bom_preset_items
    WHERE bom_preset_id = v_bom_preset_id;
  END IF;

  INSERT INTO public.bom_preset_items (
    bom_preset_id,
    category,
    top_category,
    subcategory,
    catalog_item_id,
    catalog_type,
    sku_code,
    description,
    brand,
    model,
    specification_details,
    unit,
    quantity,
    unit_rate,
    gst_pct,
    is_included,
    is_survey_dependent,
    sort_order,
    updated_at
  )
  SELECT
    v_bom_preset_id,
    item.category,
    COALESCE(NULLIF(item.top_category, ''), CASE WHEN item.category = 'miscellaneous' THEN 'miscellaneous' ELSE 'bom_item' END),
    COALESCE(NULLIF(item.subcategory, ''), item.category),
    item.catalog_item_id,
    COALESCE(item.catalog_type, 'custom'),
    item.sku_code,
    item.description,
    item.brand,
    item.model,
    item.specification_details,
    COALESCE(item.unit, 'Nos'),
    COALESCE(item.quantity, 1),
    COALESCE(item.unit_rate, 0),
    item.gst_pct,
    COALESCE(item.is_included, true),
    COALESCE(item.is_survey_dependent, false),
    COALESCE(item.sort_order, 1),
    now()
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    category text,
    top_category text,
    subcategory text,
    catalog_item_id uuid,
    catalog_type text,
    sku_code text,
    description text,
    brand text,
    model text,
    specification_details text,
    unit text,
    quantity numeric,
    unit_rate numeric,
    gst_pct numeric,
    is_included boolean,
    is_survey_dependent boolean,
    sort_order integer
  );

  RETURN v_bom_preset_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_bom_preset_atomic(uuid, uuid, text, text, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_bom_preset_atomic(uuid, uuid, text, text, jsonb, uuid) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
