-- Daily, change-only catalog rate snapshots plus quote-line source metadata.
-- Quote items already store immutable quoted rates; these additions let us
-- compare those locked rates against the current catalog later.

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_item_id uuid,
  ADD COLUMN IF NOT EXISTS source_label text,
  ADD COLUMN IF NOT EXISTS quoted_rate_date date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.bom_template_items
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gst_pct numeric(6,5) NOT NULL DEFAULT 0.18000;

CREATE INDEX IF NOT EXISTS idx_quote_items_source
  ON public.quote_items(source_table, source_item_id)
  WHERE source_table IS NOT NULL AND source_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.catalog_rate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  org_scope text NOT NULL DEFAULT 'global',
  source_table text NOT NULL,
  source_item_id uuid NOT NULL,
  item_label text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  selling_price numeric(14,4) NOT NULL DEFAULT 0,
  buy_price numeric(14,4),
  gst_pct numeric(6,5) NOT NULL DEFAULT 0,
  rate_unit text NOT NULL DEFAULT 'unit',
  price_signature text NOT NULL,
  item_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_rate_snapshot_daily
  ON public.catalog_rate_snapshots(source_table, source_item_id, org_scope, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_catalog_rate_snapshots_latest
  ON public.catalog_rate_snapshots(source_table, source_item_id, org_scope, snapshot_date DESC);

ALTER TABLE public.catalog_rate_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'catalog_rate_snapshots'
      AND policyname = 'catalog_rate_snapshots_org_read'
  ) THEN
    CREATE POLICY "catalog_rate_snapshots_org_read"
      ON public.catalog_rate_snapshots
      FOR SELECT
      TO authenticated
      USING (org_id IS NULL OR org_id = public.auth_org_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.snapshot_catalog_rates(
  p_org_id uuid DEFAULT public.auth_org_id(),
  p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH catalog AS (
    SELECT
      p.org_id,
      COALESCE(p.org_id::text, 'global') AS org_scope,
      'eq_panels'::text AS source_table,
      p.id AS source_item_id,
      CONCAT_WS(' ', p.brand, p.model, CONCAT('(', p.wattage_w, 'W)')) AS item_label,
      p.selling_price::numeric(14,4) AS selling_price,
      p.buy_price::numeric(14,4) AS buy_price,
      p.gst_pct::numeric(6,5) AS gst_pct,
      'panel'::text AS rate_unit,
      jsonb_build_object('brand', p.brand, 'model', p.model, 'wattage_w', p.wattage_w) AS item_payload
    FROM public.eq_panels p
    WHERE p.is_active = true AND (p_org_id IS NULL OR p.org_id IS NULL OR p.org_id = p_org_id)

    UNION ALL
    SELECT
      i.org_id,
      COALESCE(i.org_id::text, 'global'),
      'eq_inverters',
      i.id,
      CONCAT_WS(' ', i.brand, i.model, CONCAT('(', i.capacity_kw, 'kW)')),
      i.selling_price::numeric(14,4),
      i.buy_price::numeric(14,4),
      i.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('brand', i.brand, 'model', i.model, 'capacity_kw', i.capacity_kw)
    FROM public.eq_inverters i
    WHERE i.is_active = true AND (p_org_id IS NULL OR i.org_id IS NULL OR i.org_id = p_org_id)

    UNION ALL
    SELECT
      b.org_id,
      COALESCE(b.org_id::text, 'global'),
      'eq_batteries',
      b.id,
      CONCAT_WS(' ', b.brand, b.model, CONCAT('(', b.capacity_kwh, 'kWh)')),
      b.selling_price::numeric(14,4),
      b.buy_price::numeric(14,4),
      b.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('brand', b.brand, 'model', b.model, 'capacity_kwh', b.capacity_kwh)
    FROM public.eq_batteries b
    WHERE b.is_active = true AND (p_org_id IS NULL OR b.org_id IS NULL OR b.org_id = p_org_id)

    UNION ALL
    SELECT
      m.org_id,
      COALESCE(m.org_id::text, 'global'),
      'eq_meters',
      m.id,
      CONCAT_WS(' ', m.brand, m.model, CONCAT('(', m.meter_type, ')')),
      m.selling_price::numeric(14,4),
      m.buy_price::numeric(14,4),
      m.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('brand', m.brand, 'model', m.model, 'meter_type', m.meter_type)
    FROM public.eq_meters m
    WHERE m.is_active = true AND (p_org_id IS NULL OR m.org_id IS NULL OR m.org_id = p_org_id)

    UNION ALL
    SELECT
      la.org_id,
      COALESCE(la.org_id::text, 'global'),
      'eq_lightning_arresters',
      la.id,
      CONCAT_WS(' ', la.brand, la.model),
      la.selling_price::numeric(14,4),
      la.buy_price::numeric(14,4),
      la.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('brand', la.brand, 'model', la.model, 'la_type', la.la_type)
    FROM public.eq_lightning_arresters la
    WHERE la.is_active = true AND (p_org_id IS NULL OR la.org_id IS NULL OR la.org_id = p_org_id)

    UNION ALL
    SELECT
      cd.org_id,
      COALESCE(cd.org_id::text, 'global'),
      'eq_communication_devices',
      cd.id,
      CONCAT_WS(' ', cd.brand, cd.model),
      cd.selling_price::numeric(14,4),
      cd.buy_price::numeric(14,4),
      cd.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('brand', cd.brand, 'model', cd.model, 'compatible_inverter_brand', cd.compatible_inverter_brand)
    FROM public.eq_communication_devices cd
    WHERE cd.is_active = true AND (p_org_id IS NULL OR cd.org_id IS NULL OR cd.org_id = p_org_id)

    UNION ALL
    SELECT
      s.org_id,
      COALESCE(s.org_id::text, 'global'),
      'eq_mounting_structures',
      s.id,
      s.name,
      COALESCE(s.selling_price, s.rate_per_kg, 0)::numeric(14,4),
      s.buy_price::numeric(14,4),
      s.gst_pct::numeric(6,5),
      CASE WHEN s.selling_price IS NULL THEN 'kg' ELSE 'unit' END,
      jsonb_build_object('name', s.name, 'material', s.material, 'rate_per_kg', s.rate_per_kg)
    FROM public.eq_mounting_structures s
    WHERE s.is_active = true AND (p_org_id IS NULL OR s.org_id IS NULL OR s.org_id = p_org_id)

    UNION ALL
    SELECT
      bt.org_id,
      COALESCE(bt.org_id::text, 'global'),
      'bom_template_items',
      bt.id,
      bt.description,
      COALESCE(bt.default_rate, 0)::numeric(14,4),
      NULL::numeric(14,4),
      COALESCE(bt.gst_pct, 0.18)::numeric(6,5),
      bt.unit,
      jsonb_build_object('sku_code', bt.sku_code, 'description', bt.description, 'unit', bt.unit)
    FROM public.bom_template_items bt
    WHERE (p_org_id IS NULL OR bt.org_id IS NULL OR bt.org_id = p_org_id)

    UNION ALL
    SELECT
      sc.org_id,
      COALESCE(sc.org_id::text, 'global'),
      'eq_structure_components',
      sc.id,
      sc.name,
      sc.selling_price::numeric(14,4),
      sc.buy_price::numeric(14,4),
      sc.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('name', sc.name, 'category', sc.category, 'unit', sc.unit)
    FROM public.eq_structure_components sc
    WHERE sc.is_active = true AND (p_org_id IS NULL OR sc.org_id IS NULL OR sc.org_id = p_org_id)

    UNION ALL
    SELECT
      sa.org_id,
      COALESCE(sa.org_id::text, 'global'),
      'eq_structure_addons',
      sa.id,
      sa.name,
      sa.rate_per_unit::numeric(14,4),
      sa.buy_price::numeric(14,4),
      sa.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('name', sa.name, 'material', sa.material, 'unit', sa.unit)
    FROM public.eq_structure_addons sa
    WHERE sa.is_active = true AND (p_org_id IS NULL OR sa.org_id IS NULL OR sa.org_id = p_org_id)

    UNION ALL
    SELECT
      sc.org_id,
      COALESCE(sc.org_id::text, 'global'),
      'structure_component_master',
      sc.id,
      sc.name,
      sc.selling_price::numeric(14,4),
      sc.buy_price::numeric(14,4),
      sc.gst_pct::numeric(6,5),
      'unit',
      jsonb_build_object('name', sc.name, 'type', sc.type, 'material', sc.material)
    FROM public.structure_component_master sc
    WHERE sc.is_active = true AND (p_org_id IS NULL OR sc.org_id IS NULL OR sc.org_id = p_org_id)
  ),
  prepared AS (
    SELECT
      c.*,
      md5(CONCAT_WS('|', c.selling_price::text, COALESCE(c.buy_price::text, ''), c.gst_pct::text, c.rate_unit)) AS price_signature
    FROM catalog c
  ),
  latest AS (
    SELECT DISTINCT ON (s.source_table, s.source_item_id, s.org_scope)
      s.source_table,
      s.source_item_id,
      s.org_scope,
      s.price_signature
    FROM public.catalog_rate_snapshots s
    ORDER BY s.source_table, s.source_item_id, s.org_scope, s.snapshot_date DESC, s.created_at DESC
  ),
  changed AS (
    SELECT p.*
    FROM prepared p
    LEFT JOIN latest l
      ON l.source_table = p.source_table
      AND l.source_item_id = p.source_item_id
      AND l.org_scope = p.org_scope
    WHERE l.price_signature IS NULL OR l.price_signature <> p.price_signature
  ),
  upserted AS (
    INSERT INTO public.catalog_rate_snapshots (
      org_id,
      org_scope,
      source_table,
      source_item_id,
      item_label,
      snapshot_date,
      selling_price,
      buy_price,
      gst_pct,
      rate_unit,
      price_signature,
      item_payload
    )
    SELECT
      org_id,
      org_scope,
      source_table,
      source_item_id,
      item_label,
      p_snapshot_date,
      selling_price,
      buy_price,
      gst_pct,
      rate_unit,
      price_signature,
      item_payload
    FROM changed
    ON CONFLICT (source_table, source_item_id, org_scope, snapshot_date)
    DO UPDATE SET
      item_label = EXCLUDED.item_label,
      selling_price = EXCLUDED.selling_price,
      buy_price = EXCLUDED.buy_price,
      gst_pct = EXCLUDED.gst_pct,
      rate_unit = EXCLUDED.rate_unit,
      price_signature = EXCLUDED.price_signature,
      item_payload = EXCLUDED.item_payload,
      created_at = now()
    WHERE public.catalog_rate_snapshots.price_signature <> EXCLUDED.price_signature
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM upserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_catalog_rates(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
