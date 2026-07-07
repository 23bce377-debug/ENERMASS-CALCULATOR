-- Compatibility objects required by current backend Supabase calls.

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs (org_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_org_read ON public.audit_logs;
CREATE POLICY audit_logs_org_read
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_org_member(org_id));
DROP POLICY IF EXISTS audit_logs_org_insert ON public.audit_logs;
CREATE POLICY audit_logs_org_insert
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.inv_cost_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.inv_warehouses(id) ON DELETE RESTRICT,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  initial_qty numeric NOT NULL DEFAULT 0,
  remaining_qty numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inv_cost_layers_nonnegative_qty CHECK (initial_qty >= 0 AND remaining_qty >= 0)
);

CREATE INDEX IF NOT EXISTS inv_cost_layers_fifo_idx
  ON public.inv_cost_layers (org_id, warehouse_id, catalog_item_id, received_date, created_at)
  WHERE remaining_qty > 0;

ALTER TABLE public.inv_cost_layers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_cost_layers_org_access ON public.inv_cost_layers;
CREATE POLICY inv_cost_layers_org_access
  ON public.inv_cost_layers FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_superadmin() OR public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.site_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.epc_projects(id) ON DELETE SET NULL,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  item_description text,
  qty numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Nos',
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_inventory_org_access ON public.site_inventory;
CREATE POLICY site_inventory_org_access
  ON public.site_inventory FOR ALL TO authenticated
  USING (org_id IS NULL OR public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (org_id IS NULL OR public.is_superadmin() OR public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.epc_projects(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_requests_org_access ON public.purchase_requests;
CREATE POLICY purchase_requests_org_access
  ON public.purchase_requests FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_superadmin() OR public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.project_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.epc_projects(id) ON DELETE SET NULL,
  entry_type text NOT NULL DEFAULT 'manual',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_ledger_org_access ON public.project_ledger;
CREATE POLICY project_ledger_org_access
  ON public.project_ledger FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.is_org_member(org_id))
  WITH CHECK (public.is_superadmin() OR public.is_org_member(org_id));

CREATE TABLE IF NOT EXISTS public.tax_gst_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hsn_sac_id uuid NOT NULL REFERENCES public.tax_hsn_sac(id) ON DELETE CASCADE,
  cgst_rate numeric NOT NULL DEFAULT 0,
  sgst_rate numeric NOT NULL DEFAULT 0,
  igst_rate numeric NOT NULL DEFAULT 0,
  cess_rate numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_gst_rates_hsn_effective_idx
  ON public.tax_gst_rates (hsn_sac_id, effective_from DESC);

ALTER TABLE public.tax_gst_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_gst_rates_read ON public.tax_gst_rates;
CREATE POLICY tax_gst_rates_read
  ON public.tax_gst_rates FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS tax_gst_rates_admin_write ON public.tax_gst_rates;
CREATE POLICY tax_gst_rates_admin_write
  ON public.tax_gst_rates FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

INSERT INTO public.tax_gst_rates (hsn_sac_id, cgst_rate, sgst_rate, igst_rate, cess_rate, effective_from)
SELECT h.id,
       COALESCE(h.gst_rate, 0) / 2,
       COALESCE(h.gst_rate, 0) / 2,
       COALESCE(h.gst_rate, 0),
       0,
       CURRENT_DATE
FROM public.tax_hsn_sac h
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_gst_rates r WHERE r.hsn_sac_id = h.id
);

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.inv_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS qty numeric,
  ADD COLUMN IF NOT EXISTS unit_cost_wac numeric,
  ADD COLUMN IF NOT EXISTS cost_layer_id uuid REFERENCES public.inv_cost_layers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valuation_method text;

CREATE OR REPLACE FUNCTION public.decrement_layer_qty(
  p_layer_id uuid,
  p_qty numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  UPDATE public.inv_cost_layers
  SET remaining_qty = remaining_qty - p_qty,
      updated_at = now()
  WHERE id = p_layer_id
    AND remaining_qty >= p_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient quantity in cost layer %', p_layer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_org_id uuid,
  p_entry_date date,
  p_reference_no text,
  p_description text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_line jsonb;
BEGIN
  IF NOT (public.is_service_role() OR public.is_superadmin() OR public.is_org_member(p_org_id)) THEN
    RAISE EXCEPTION 'Unauthorized journal entry org %', p_org_id;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);

    IF NOT EXISTS (
      SELECT 1
      FROM public.acc_accounts
      WHERE id = (v_line->>'account_id')::uuid
        AND org_id = p_org_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Account % does not exist or is inactive for org %', v_line->>'account_id', p_org_id;
    END IF;
  END LOOP;

  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION 'Journal Entry must balance. Debit: %, Credit: %', v_total_debit, v_total_credit;
  END IF;

  IF v_total_debit = 0 THEN
    RAISE EXCEPTION 'Journal Entry cannot be zero.';
  END IF;

  INSERT INTO public.acc_journal_entries (org_id, entry_date, reference_no, description)
  VALUES (p_org_id, p_entry_date, p_reference_no, p_description)
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.acc_journal_lines (
      org_id, entry_id, account_id, debit, credit, project_id
    )
    VALUES (
      p_org_id,
      v_entry_id,
      (v_line->>'account_id')::uuid,
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0),
      NULLIF(v_line->>'project_id', '')::uuid
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE VIEW public.v_gstr3b_export
WITH (security_invoker = true)
AS
SELECT
  org_id,
  'Outward taxable supplies'::text AS nature_of_supplies,
  0::numeric AS total_taxable_value,
  0::numeric AS total_tax_liability,
  0::numeric AS total_itc
FROM public.acc_journal_entries
GROUP BY org_id;

CREATE OR REPLACE FUNCTION public.get_gstr3b_summary(
  p_org_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  nature_of_supplies text,
  total_taxable_value numeric,
  total_tax_liability numeric,
  total_itc numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    'Outward taxable supplies'::text,
    0::numeric,
    0::numeric,
    0::numeric
  WHERE public.is_service_role()
     OR public.is_superadmin()
     OR public.is_org_member(p_org_id);
$$;

GRANT SELECT ON
  public.audit_logs,
  public.inv_cost_layers,
  public.site_inventory,
  public.purchase_requests,
  public.project_ledger,
  public.tax_gst_rates,
  public.v_gstr3b_export
TO authenticated, service_role;

GRANT INSERT, UPDATE, DELETE ON
  public.audit_logs,
  public.inv_cost_layers,
  public.site_inventory,
  public.purchase_requests,
  public.project_ledger,
  public.tax_gst_rates
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.decrement_layer_qty(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.decrement_layer_qty(uuid, numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_journal_entry(uuid, date, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(uuid, date, text, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_gstr3b_summary(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gstr3b_summary(uuid, date, date) TO authenticated, service_role;

COMMIT;
