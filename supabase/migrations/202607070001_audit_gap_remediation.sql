-- =============================================================================
-- Migration: Audit remediation — create all missing tables, views, and RPCs
-- referenced by existing ORM code but absent from the database schema.
--
-- Covers:
--   GAP-DB-001: draft_quotes
--   GAP-DB-002: acquisitions, acquisition_items, acquisition_bundles + RPCs
--   GAP-DB-003: bundle_presets, bundle_preset_items + RPCs
--   GAP-DB-004: structure_accessory_rates
--   GAP-DB-005: structure_component_vendor_rates
--   GAP-DB-006: inventory_summary (view), inventory_ledger (view)
--   GAP-DB-007: sys_escalations
--   GAP-DB-008: sys_dashboards
--   GAP-DB-009: epc_commissioning_reports
--   GAP-DB-010: crm_site_surveys
--   GAP-DB-011: proc_purchase_orders + proc_po_items + proc_grn
--   GAP-DB-012: system_hidden_presets
--
-- All tables follow existing conventions:
--   * UUID PK with gen_random_uuid()
--   * org_id FK to organisations(id) ON DELETE CASCADE
--   * RLS enabled with is_service_role()/is_superadmin()/is_org_member() pattern
--   * created_at/updated_at timestamptz defaults
-- =============================================================================
BEGIN;

-- ============================================================
-- 1. draft_quotes (GAP-DB-001)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draft_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_name text,
  system_kw numeric,
  estimated_total numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS draft_quotes_user_id_idx
  ON public.draft_quotes (user_id);

ALTER TABLE public.draft_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_quotes_org_access ON public.draft_quotes;
CREATE POLICY draft_quotes_org_access
  ON public.draft_quotes
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR (auth.uid() = user_id AND public.is_org_member(org_id))
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR (auth.uid() = user_id AND public.is_org_member(org_id))
  );

-- ============================================================
-- 2. system_hidden_presets (GAP-DB-012)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_hidden_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_hidden_presets_unique UNIQUE (org_id, system_id)
);

ALTER TABLE public.system_hidden_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_hidden_presets_org_access ON public.system_hidden_presets;
CREATE POLICY system_hidden_presets_org_access
  ON public.system_hidden_presets
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

-- ============================================================
-- 3. structure_accessory_rates (GAP-DB-004)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.structure_accessory_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  item_aliases text[] NOT NULL DEFAULT '{}',
  unit text NOT NULL DEFAULT 'Nos',
  rate numeric NOT NULL DEFAULT 0,
  gst_pct numeric NOT NULL DEFAULT 0.18,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT structure_accessory_rates_name_not_blank CHECK (length(trim(item_name)) > 0),
  CONSTRAINT structure_accessory_rates_rate_non_negative CHECK (rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS structure_accessory_rates_name_org_idx
  ON public.structure_accessory_rates (lower(trim(item_name)), COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.structure_accessory_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS structure_accessory_rates_access ON public.structure_accessory_rates;
CREATE POLICY structure_accessory_rates_access
  ON public.structure_accessory_rates
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR org_id IS NULL
    OR public.is_org_member(org_id)
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR public.is_org_member(org_id)
  );

-- ============================================================
-- 4. structure_component_vendor_rates (GAP-DB-005)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.structure_component_vendor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.eq_structure_components(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  rate_per_unit numeric NOT NULL DEFAULT 0,
  effective_from timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scvr_rate_non_negative CHECK (rate_per_unit >= 0),
  CONSTRAINT scvr_unique_component_vendor UNIQUE (component_id, vendor_id)
);

ALTER TABLE public.structure_component_vendor_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scvr_access ON public.structure_component_vendor_rates;
CREATE POLICY scvr_access
  ON public.structure_component_vendor_rates
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.eq_structure_components sc
      WHERE sc.id = structure_component_vendor_rates.component_id
        AND (sc.org_id IS NULL OR public.is_org_member(sc.org_id))
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.eq_structure_components sc
      WHERE sc.id = structure_component_vendor_rates.component_id
        AND public.is_org_member(sc.org_id)
    )
  );

-- ============================================================
-- 5. crm_site_surveys (GAP-DB-010)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_site_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  lead_id uuid,
  quote_id uuid,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'waived', 'cancelled')),
  scheduled_date timestamptz,
  completed_date timestamptz,
  conducted_at timestamptz,
  conducted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  waived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  waive_reason text,
  site_type text,
  roof_type text,
  roof_area_sqft numeric,
  roof_height_ft numeric,
  electrical_load_kw numeric,
  existing_load_kw numeric,
  sanctioned_load_kw numeric,
  meter_phase text,
  net_metering_available boolean,
  discom_name text,
  consumer_number text,
  distance_panel_to_inverter_m numeric,
  distance_inverter_to_meter_m numeric,
  shade_analysis text,
  shadowing_notes text,
  site_photos jsonb DEFAULT '[]'::jsonb,
  photo_urls jsonb DEFAULT '[]'::jsonb,
  notes text,
  survey_notes text,
  survey_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_site_surveys
  ADD COLUMN IF NOT EXISTS conducted_at timestamptz,
  ADD COLUMN IF NOT EXISTS roof_height_ft numeric,
  ADD COLUMN IF NOT EXISTS existing_load_kw numeric,
  ADD COLUMN IF NOT EXISTS sanctioned_load_kw numeric,
  ADD COLUMN IF NOT EXISTS meter_phase text,
  ADD COLUMN IF NOT EXISTS net_metering_available boolean,
  ADD COLUMN IF NOT EXISTS discom_name text,
  ADD COLUMN IF NOT EXISTS consumer_number text,
  ADD COLUMN IF NOT EXISTS distance_panel_to_inverter_m numeric,
  ADD COLUMN IF NOT EXISTS distance_inverter_to_meter_m numeric,
  ADD COLUMN IF NOT EXISTS shadowing_notes text,
  ADD COLUMN IF NOT EXISTS photo_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS survey_notes text;

ALTER TABLE public.crm_site_surveys
  DROP CONSTRAINT IF EXISTS crm_site_surveys_conducted_by_fkey,
  DROP CONSTRAINT IF EXISTS crm_site_surveys_waived_by_fkey,
  ADD CONSTRAINT crm_site_surveys_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT crm_site_surveys_waived_by_fkey FOREIGN KEY (waived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_site_surveys_lead_idx ON public.crm_site_surveys (lead_id);
CREATE INDEX IF NOT EXISTS crm_site_surveys_org_idx ON public.crm_site_surveys (org_id);

ALTER TABLE public.crm_site_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_site_surveys_org_access ON public.crm_site_surveys;
CREATE POLICY crm_site_surveys_org_access
  ON public.crm_site_surveys
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

-- ============================================================
-- 6. proc_purchase_orders + items + GRN (GAP-DB-011)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proc_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.epc_projects(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted_for_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled')),
  pr_status text NOT NULL DEFAULT 'draft'
    CHECK (pr_status IN ('draft', 'pending', 'approved', 'rejected', 'po_generated')),
  total_taxable numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  delivery_date timestamptz,
  notes text,
  items_count integer NOT NULL DEFAULT 0,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS proc_po_number_org_idx
  ON public.proc_purchase_orders (org_id, po_number);

ALTER TABLE public.proc_purchase_orders
  ALTER COLUMN vendor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

UPDATE public.proc_purchase_orders
SET status = 'partially_received'
WHERE status::text = 'partial';

ALTER TABLE public.proc_purchase_orders
  DROP CONSTRAINT IF EXISTS proc_purchase_orders_status_check,
  ADD CONSTRAINT proc_purchase_orders_status_check
    CHECK (status IN ('draft', 'submitted_for_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.proc_po_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.proc_purchase_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_id uuid,
  item_type text,
  item_description text,
  category text,
  unit text NOT NULL DEFAULT 'Nos',
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  estimated_rate numeric NOT NULL DEFAULT 0,
  gst_pct numeric NOT NULL DEFAULT 0.18,
  is_pr_item boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proc_po_items
  ALTER COLUMN catalog_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text;

CREATE TABLE IF NOT EXISTS public.proc_goods_receipt_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES public.proc_purchase_orders(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.inv_warehouses(id) ON DELETE RESTRICT,
  grn_number text NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  is_processed boolean NOT NULL DEFAULT false,
  idempotency_key text,
  processed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proc_grn_idempotency_unique UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.proc_grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.proc_goods_receipt_notes(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_id uuid,
  item_type text,
  item_description text,
  qty_received numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Nos',
  serials text[] DEFAULT '{}'::text[],
  CONSTRAINT proc_grn_items_grn_catalog_unique UNIQUE (grn_id, catalog_item_id)
);

ALTER TABLE public.proc_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_grn_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proc_po_org_access ON public.proc_purchase_orders;
CREATE POLICY proc_po_org_access
  ON public.proc_purchase_orders
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

DROP POLICY IF EXISTS proc_po_items_access ON public.proc_po_items;
CREATE POLICY proc_po_items_access
  ON public.proc_po_items
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.proc_purchase_orders po
      WHERE po.id = proc_po_items.po_id
        AND public.is_org_member(po.org_id)
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.proc_purchase_orders po
      WHERE po.id = proc_po_items.po_id
        AND public.is_org_member(po.org_id)
    )
  );

DROP POLICY IF EXISTS proc_grn_org_access ON public.proc_goods_receipt_notes;
CREATE POLICY proc_grn_org_access
  ON public.proc_goods_receipt_notes
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

DROP POLICY IF EXISTS proc_grn_items_access ON public.proc_grn_items;
CREATE POLICY proc_grn_items_access
  ON public.proc_grn_items
  FOR ALL
  TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.proc_goods_receipt_notes grn
      WHERE grn.id = proc_grn_items.grn_id
        AND public.is_org_member(grn.org_id)
    )
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.proc_goods_receipt_notes grn
      WHERE grn.id = proc_grn_items.grn_id
        AND public.is_org_member(grn.org_id)
    )
  );

-- ============================================================
-- 7. acquisitions + acquisition_items + acquisition_bundles (GAP-DB-002)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'cancelled')),
  grn_processed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acquisition_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id uuid NOT NULL REFERENCES public.acquisitions(id) ON DELETE CASCADE,
  bundle_preset_id uuid,
  name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  effective_bundle_price numeric NOT NULL DEFAULT 0,
  allocation_strategy text NOT NULL DEFAULT 'proportional_cost'
    CHECK (allocation_strategy IN ('proportional_cost', 'proportional_qty', 'manual')),
  gst_pct numeric DEFAULT 0.18,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.acquisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id uuid NOT NULL REFERENCES public.acquisitions(id) ON DELETE CASCADE,
  acquisition_bundle_id uuid REFERENCES public.acquisition_bundles(id) ON DELETE SET NULL,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  category text,
  qty numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Nos',
  rate_per_unit numeric NOT NULL DEFAULT 0,
  gst_pct numeric DEFAULT 0.18,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acquisitions
  ADD COLUMN IF NOT EXISTS grn_processed boolean NOT NULL DEFAULT false;

ALTER TABLE public.acquisition_bundles
  ADD COLUMN IF NOT EXISTS bundle_preset_id uuid;

ALTER TABLE public.acquisition_items
  ADD COLUMN IF NOT EXISTS acquisition_bundle_id uuid REFERENCES public.acquisition_bundles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

ALTER TABLE public.acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisition_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acquisitions_org_access ON public.acquisitions;
CREATE POLICY acquisitions_org_access
  ON public.acquisitions FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

DROP POLICY IF EXISTS acquisition_items_access ON public.acquisition_items;
CREATE POLICY acquisition_items_access
  ON public.acquisition_items FOR ALL TO authenticated
  USING (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.acquisitions a WHERE a.id = acquisition_items.acquisition_id AND public.is_org_member(a.org_id))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.acquisitions a WHERE a.id = acquisition_items.acquisition_id AND public.is_org_member(a.org_id))
  );

DROP POLICY IF EXISTS acquisition_bundles_access ON public.acquisition_bundles;
CREATE POLICY acquisition_bundles_access
  ON public.acquisition_bundles FOR ALL TO authenticated
  USING (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.acquisitions a WHERE a.id = acquisition_bundles.acquisition_id AND public.is_org_member(a.org_id))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.acquisitions a WHERE a.id = acquisition_bundles.acquisition_id AND public.is_org_member(a.org_id))
  );

-- RPC: create_acquisition_atomic
CREATE OR REPLACE FUNCTION public.create_acquisition_atomic(
  p_acquisition jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acquisition_id uuid;
  v_org_id uuid;
  v_result jsonb;
BEGIN
  v_org_id := (p_acquisition->>'org_id')::uuid;
  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized acquisition org %', v_org_id;
  END IF;

  INSERT INTO public.acquisitions (
    org_id, vendor_id, invoice_number, invoice_date,
    total_amount, status, notes
  )
  VALUES (
    (p_acquisition->>'org_id')::uuid,
    (p_acquisition->>'vendor_id')::uuid,
    p_acquisition->>'invoice_number',
    COALESCE((p_acquisition->>'invoice_date')::timestamptz, now()),
    COALESCE((p_acquisition->>'total_amount')::numeric, 0),
    COALESCE(p_acquisition->>'status', 'pending'),
    p_acquisition->>'notes'
  )
  RETURNING id INTO v_acquisition_id;

  INSERT INTO public.acquisition_items (
    acquisition_id, item_description, category, qty, unit, rate_per_unit, gst_pct
  )
  SELECT
    v_acquisition_id,
    item.item_description,
    item.category,
    COALESCE(item.qty, 0),
    COALESCE(item.unit, 'Nos'),
    COALESCE(item.rate_per_unit, 0),
    item.gst_pct
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    item_description text,
    category text,
    qty numeric,
    unit text,
    rate_per_unit numeric,
    gst_pct numeric
  );

  SELECT to_jsonb(a.*) INTO v_result
  FROM public.acquisitions a
  WHERE a.id = v_acquisition_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_acquisition_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_acquisition_atomic(jsonb, jsonb) TO authenticated, service_role;

-- RPC: mark_acquisition_as_received
CREATE OR REPLACE FUNCTION public.mark_acquisition_as_received(
  p_acquisition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE public.acquisitions
  SET status = 'received', grn_processed = true, updated_at = now()
  WHERE id = p_acquisition_id
    AND (public.is_superadmin() OR public.is_org_member(org_id))
  RETURNING to_jsonb(acquisitions.*) INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acquisition % not found', p_acquisition_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_acquisition_as_received(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_acquisition_as_received(uuid) TO authenticated, service_role;

-- ============================================================
-- 8. bundle_presets + bundle_preset_items + RPCs (GAP-DB-003)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bundle_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  name text NOT NULL,
  effective_bundle_price numeric NOT NULL DEFAULT 0,
  allocation_strategy text NOT NULL DEFAULT 'proportional_cost'
    CHECK (allocation_strategy IN ('proportional_cost', 'proportional_qty', 'manual')),
  notes text,
  gst_pct numeric DEFAULT 0.18,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_presets_name_not_blank CHECK (length(trim(name)) > 0)
);

ALTER TABLE public.bundle_presets
  ADD COLUMN IF NOT EXISTS effective_bundle_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocation_strategy text NOT NULL DEFAULT 'proportional_cost',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS gst_pct numeric DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.bundle_preset_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_preset_id uuid NOT NULL REFERENCES public.bundle_presets(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  category text,
  qty numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Nos',
  base_cost numeric NOT NULL DEFAULT 0,
  allocated_cost_override numeric,
  gst_pct numeric DEFAULT 0.18,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bundle_preset_items
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocated_cost_override numeric;

ALTER TABLE public.bundle_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_preset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_presets_org_access ON public.bundle_presets;
CREATE POLICY bundle_presets_org_access
  ON public.bundle_presets FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

DROP POLICY IF EXISTS bundle_preset_items_access ON public.bundle_preset_items;
CREATE POLICY bundle_preset_items_access
  ON public.bundle_preset_items FOR ALL TO authenticated
  USING (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.bundle_presets bp WHERE bp.id = bundle_preset_items.bundle_preset_id AND public.is_org_member(bp.org_id))
  )
  WITH CHECK (
    public.is_service_role() OR public.is_superadmin()
    OR EXISTS (SELECT 1 FROM public.bundle_presets bp WHERE bp.id = bundle_preset_items.bundle_preset_id AND public.is_org_member(bp.org_id))
  );

-- RPC: create_bundle_preset_atomic
CREATE OR REPLACE FUNCTION public.create_bundle_preset_atomic(
  p_preset jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_result jsonb;
  v_org_id uuid;
BEGIN
  v_org_id := (p_preset->>'org_id')::uuid;
  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized bundle preset org %', v_org_id;
  END IF;

  INSERT INTO public.bundle_presets (
    org_id, vendor_id, name, notes, effective_bundle_price,
    allocation_strategy, gst_pct, created_by, is_active
  )
  VALUES (
    v_org_id,
    NULLIF(p_preset->>'vendor_id', '')::uuid,
    p_preset->>'name',
    COALESCE(p_preset->>'notes', p_preset->>'description'),
    COALESCE((p_preset->>'effective_bundle_price')::numeric, (p_preset->>'total_price')::numeric, 0),
    COALESCE(p_preset->>'allocation_strategy', 'proportional_cost'),
    COALESCE((p_preset->>'gst_pct')::numeric, 0.18),
    NULLIF(p_preset->>'created_by', '')::uuid,
    COALESCE((p_preset->>'is_active')::boolean, true)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.bundle_preset_items (
    bundle_preset_id, catalog_item_id, item_description, category, qty, unit,
    base_cost, allocated_cost_override, gst_pct
  )
  SELECT v_id, item.catalog_item_id, item.item_description, item.category,
    COALESCE(item.qty, 1), COALESCE(item.unit, 'Nos'),
    COALESCE(item.base_cost, item.rate_per_unit, 0), item.allocated_cost_override,
    item.gst_pct
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    catalog_item_id uuid, item_description text, category text, qty numeric, unit text,
    base_cost numeric, rate_per_unit numeric, allocated_cost_override numeric, gst_pct numeric
  );

  SELECT to_jsonb(bp.*) INTO v_result
  FROM public.bundle_presets bp WHERE bp.id = v_id;

  RETURN v_result;
END;
$$;

-- RPC: update_bundle_preset_atomic
CREATE OR REPLACE FUNCTION public.update_bundle_preset_atomic(
  p_preset_id uuid,
  p_updates jsonb,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.bundle_presets
  WHERE id = p_preset_id;

  IF v_org_id IS NULL OR NOT (public.is_superadmin() OR public.is_org_member(v_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized bundle preset %', p_preset_id;
  END IF;

  UPDATE public.bundle_presets
  SET
    name = COALESCE(p_updates->>'name', name),
    notes = COALESCE(p_updates->>'notes', p_updates->>'description', notes),
    vendor_id = CASE WHEN p_updates ? 'vendor_id' THEN NULLIF(p_updates->>'vendor_id', '')::uuid ELSE vendor_id END,
    effective_bundle_price = CASE
      WHEN p_updates ? 'effective_bundle_price' THEN (p_updates->>'effective_bundle_price')::numeric
      WHEN p_updates ? 'total_price' THEN (p_updates->>'total_price')::numeric
      ELSE effective_bundle_price
    END,
    allocation_strategy = COALESCE(p_updates->>'allocation_strategy', allocation_strategy),
    gst_pct = CASE WHEN p_updates ? 'gst_pct' THEN (p_updates->>'gst_pct')::numeric ELSE gst_pct END,
    version = version + 1,
    updated_at = now()
  WHERE id = p_preset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle preset % not found', p_preset_id;
  END IF;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.bundle_preset_items WHERE bundle_preset_id = p_preset_id;

    INSERT INTO public.bundle_preset_items (
      bundle_preset_id, catalog_item_id, item_description, category, qty, unit,
      base_cost, allocated_cost_override, gst_pct
    )
    SELECT p_preset_id, item.catalog_item_id, item.item_description, item.category,
      COALESCE(item.qty, 1), COALESCE(item.unit, 'Nos'),
      COALESCE(item.base_cost, item.rate_per_unit, 0), item.allocated_cost_override,
      item.gst_pct
    FROM jsonb_to_recordset(p_items) AS item(
      catalog_item_id uuid, item_description text, category text, qty numeric, unit text,
      base_cost numeric, rate_per_unit numeric, allocated_cost_override numeric, gst_pct numeric
    );
  END IF;

  SELECT to_jsonb(bp.*) INTO v_result
  FROM public.bundle_presets bp WHERE bp.id = p_preset_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bundle_preset_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_bundle_preset_atomic(jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_bundle_preset_atomic(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_bundle_preset_atomic(uuid, jsonb, jsonb) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'acquisition_bundles_bundle_preset_id_fkey'
      AND conrelid = 'public.acquisition_bundles'::regclass
  ) THEN
    ALTER TABLE public.acquisition_bundles
      ADD CONSTRAINT acquisition_bundles_bundle_preset_id_fkey
      FOREIGN KEY (bundle_preset_id)
      REFERENCES public.bundle_presets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 9. inventory_summary + inventory_ledger (GAP-DB-006)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_summary (
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  category text,
  current_qty numeric NOT NULL DEFAULT 0,
  weighted_avg_cost numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'Nos',
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, item_description)
);

ALTER TABLE public.inventory_summary
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS reorder_level numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'Nos';

CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  acquisition_item_id uuid REFERENCES public.acquisition_items(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  category text,
  transaction_type text NOT NULL,
  change_qty numeric NOT NULL,
  rate_at_time numeric,
  reference_id uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_ledger
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquisition_item_id uuid REFERENCES public.acquisition_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS change_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_at_time numeric,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.inventory_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_summary_org_access ON public.inventory_summary;
CREATE POLICY inventory_summary_org_access
  ON public.inventory_summary FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

DROP POLICY IF EXISTS inventory_ledger_org_access ON public.inventory_ledger;
CREATE POLICY inventory_ledger_org_access
  ON public.inventory_ledger FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

-- ============================================================
-- 10. sys_escalations (GAP-DB-007)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sys_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'ticket', 'po')),
  entity_id uuid NOT NULL,
  escalated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'closed')),
  severity integer NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sys_escalations
  DROP CONSTRAINT IF EXISTS sys_escalations_escalated_by_fkey,
  DROP CONSTRAINT IF EXISTS sys_escalations_assigned_to_fkey,
  ADD CONSTRAINT sys_escalations_escalated_by_fkey FOREIGN KEY (escalated_by) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT sys_escalations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sys_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sys_escalations_org_access ON public.sys_escalations;
CREATE POLICY sys_escalations_org_access
  ON public.sys_escalations FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

-- ============================================================
-- 11. sys_dashboards (GAP-DB-008)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sys_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dashboard_name text NOT NULL,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sys_dashboards
  DROP CONSTRAINT IF EXISTS sys_dashboards_profile_id_fkey,
  ADD CONSTRAINT sys_dashboards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS sys_dashboards_profile_name_idx
  ON public.sys_dashboards (profile_id, dashboard_name);

ALTER TABLE public.sys_dashboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sys_dashboards_access ON public.sys_dashboards;
CREATE POLICY sys_dashboards_access
  ON public.sys_dashboards FOR ALL TO authenticated
  USING (
    public.is_service_role()
    OR public.is_superadmin()
    OR (auth.uid() = profile_id AND public.is_org_member(org_id))
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_superadmin()
    OR (auth.uid() = profile_id AND public.is_org_member(org_id))
  );

-- ============================================================
-- 12. epc_commissioning_reports (GAP-DB-009)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.epc_commissioning_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.epc_projects(id) ON DELETE CASCADE,
  commissioned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  net_meter_number text,
  capacity_tested_kw numeric,
  is_approved boolean NOT NULL DEFAULT false,
  customer_signoff boolean NOT NULL DEFAULT false,
  signoff_date timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.epc_commissioning_reports
  DROP CONSTRAINT IF EXISTS epc_commissioning_reports_commissioned_by_fkey,
  ADD CONSTRAINT epc_commissioning_reports_commissioned_by_fkey FOREIGN KEY (commissioned_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.epc_commissioning_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS epc_commissioning_reports_access ON public.epc_commissioning_reports;
CREATE POLICY epc_commissioning_reports_access
  ON public.epc_commissioning_reports FOR ALL TO authenticated
  USING (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(org_id));

-- ============================================================
-- Explicit Data API grants for Supabase projects that do not
-- auto-expose newly-created tables to authenticated roles.
-- RLS policies above remain the row-level authorization layer.
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

REVOKE ALL ON TABLE
  public.draft_quotes,
  public.system_hidden_presets,
  public.structure_accessory_rates,
  public.structure_component_vendor_rates,
  public.crm_site_surveys,
  public.proc_purchase_orders,
  public.proc_po_items,
  public.proc_goods_receipt_notes,
  public.proc_grn_items,
  public.acquisitions,
  public.acquisition_items,
  public.acquisition_bundles,
  public.bundle_presets,
  public.bundle_preset_items,
  public.inventory_summary,
  public.inventory_ledger,
  public.sys_escalations,
  public.sys_dashboards,
  public.epc_commissioning_reports
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.draft_quotes,
  public.system_hidden_presets,
  public.structure_accessory_rates,
  public.structure_component_vendor_rates,
  public.crm_site_surveys,
  public.proc_purchase_orders,
  public.proc_po_items,
  public.proc_goods_receipt_notes,
  public.proc_grn_items,
  public.acquisitions,
  public.acquisition_items,
  public.acquisition_bundles,
  public.bundle_presets,
  public.bundle_preset_items,
  public.inventory_summary,
  public.inventory_ledger,
  public.sys_escalations,
  public.sys_dashboards,
  public.epc_commissioning_reports
TO authenticated, service_role;

-- ============================================================
-- Notify PostgREST to reload schema
-- ============================================================
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

COMMIT;
