-- DB-backed reusable BOM item presets for system preset authoring.
BEGIN;

CREATE TABLE IF NOT EXISTS public.bom_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_presets_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS bom_presets_org_name_active_idx
  ON public.bom_presets (org_id, lower(trim(name)))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.bom_preset_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_preset_id uuid NOT NULL REFERENCES public.bom_presets(id) ON DELETE CASCADE,
  category text NOT NULL,
  catalog_item_id uuid,
  catalog_type text NOT NULL DEFAULT 'custom',
  sku_code text,
  description text NOT NULL,
  brand text,
  model text,
  specification_details text,
  unit text NOT NULL DEFAULT 'Nos',
  quantity numeric NOT NULL DEFAULT 1,
  unit_rate numeric NOT NULL DEFAULT 0,
  gst_pct numeric,
  is_included boolean NOT NULL DEFAULT true,
  is_survey_dependent boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_preset_items_category_check CHECK (
    category IN ('dc_protection', 'ac_protection', 'cable', 'earthing', 'civil', 'logistics', 'accessory', 'miscellaneous')
  ),
  CONSTRAINT bom_preset_items_catalog_type_check CHECK (
    catalog_type IN ('custom', 'bom_template', 'equipment', 'structure_component')
  ),
  CONSTRAINT bom_preset_items_description_not_blank CHECK (length(trim(description)) > 0),
  CONSTRAINT bom_preset_items_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT bom_preset_items_rate_non_negative CHECK (unit_rate >= 0),
  CONSTRAINT bom_preset_items_gst_range CHECK (gst_pct IS NULL OR (gst_pct >= 0 AND gst_pct <= 1))
);

CREATE INDEX IF NOT EXISTS bom_preset_items_preset_sort_idx
  ON public.bom_preset_items (bom_preset_id, sort_order, id);

ALTER TABLE public.bom_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_preset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bom_presets_org_access ON public.bom_presets;
CREATE POLICY bom_presets_org_access
  ON public.bom_presets
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR public.is_org_member(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR public.is_org_member(org_id)
  );

DROP POLICY IF EXISTS bom_preset_items_org_access ON public.bom_preset_items;
CREATE POLICY bom_preset_items_org_access
  ON public.bom_preset_items
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.bom_presets bp
      WHERE bp.id = bom_preset_items.bom_preset_id
        AND public.is_org_member(bp.org_id)
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.bom_presets bp
      WHERE bp.id = bom_preset_items.bom_preset_id
        AND public.is_org_member(bp.org_id)
    )
  );

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
