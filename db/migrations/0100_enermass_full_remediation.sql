-- ─── STEP 1: ALTER existing tables ───

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 0.138,
  ADD COLUMN IF NOT EXISTS structure_type text NOT NULL DEFAULT 'rcc_roof_elevated',
  ADD COLUMN IF NOT EXISTS validation_acknowledged jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS civil_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logistics_cost_estimated numeric,
  ADD COLUMN IF NOT EXISTS subsidy_breakdown text,
  ADD COLUMN IF NOT EXISTS subsidy_eligible boolean NOT NULL DEFAULT false;

-- Create vendor_payments if it does not exist (as it was missing from db)
CREATE TABLE IF NOT EXISTS vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES epc_projects(id),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  invoice_number text NOT NULL,
  invoice_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  taxable_amount numeric,
  cgst_amount numeric,
  sgst_amount numeric,
  igst_amount numeric,
  total_gst numeric,
  created_at timestamp DEFAULT now()
);

ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS retention_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS retention_released_at timestamp,
  ADD COLUMN IF NOT EXISTS retention_release_approved_by uuid REFERENCES profiles(id);

-- retention_amount as generated column (postgres 12+)
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS retention_amount numeric
  GENERATED ALWAYS AS (invoice_amount * retention_percent / 100) STORED;

-- ─── STEP 2: Create site_surveys ───

CREATE TABLE IF NOT EXISTS site_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES crm_leads(id),
  quote_id uuid REFERENCES quotes(id),
  conducted_by uuid REFERENCES profiles(id),
  conducted_at timestamp,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'waived')),
  -- Physical
  roof_area_sqft numeric,
  roof_type text,
  roof_height_ft numeric,
  shadowing_notes text,
  -- Electrical
  existing_load_kw numeric,
  sanctioned_load_kw numeric,
  meter_phase text CHECK (meter_phase IN ('single', 'three')),
  distance_inverter_to_meter_m numeric,
  distance_panel_to_inverter_m numeric,
  -- DISCOM
  discom_name text,
  consumer_number text,
  net_metering_available boolean,
  -- Evidence
  photo_urls jsonb NOT NULL DEFAULT '[]',
  survey_notes text,
  waived_by uuid REFERENCES profiles(id),
  waive_reason text CHECK (
    waive_reason IS NULL OR length(trim(waive_reason)) >= 20
  ),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- ─── STEP 3: Create inventory_movements (append-only ledger) ───

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL, -- references catalog_items or similar
  project_id uuid NOT NULL REFERENCES epc_projects(id),  -- NOT NULL: prevents cross-project loss
  from_state text,
  to_state text NOT NULL CHECK (to_state IN (
    'in_warehouse', 'in_transit', 'at_site',
    'installed', 'commissioned', 'returned_to_warehouse', 'scrapped'
  )),
  quantity numeric NOT NULL CHECK (quantity > 0),
  moved_by uuid REFERENCES profiles(id),
  moved_at timestamp NOT NULL DEFAULT now(),
  vehicle_number text,
  driver_contact text,
  site_received_by text,
  site_received_at timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
  -- NO updated_at: this is an immutable ledger
);

-- Immutability enforcement via trigger
CREATE OR REPLACE FUNCTION prevent_inventory_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is an append-only ledger. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_movements_no_update ON inventory_movements;
CREATE TRIGGER inventory_movements_no_update
  BEFORE UPDATE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

DROP TRIGGER IF EXISTS inventory_movements_no_delete ON inventory_movements;
CREATE TRIGGER inventory_movements_no_delete
  BEFORE DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

-- Inventory positions view
CREATE OR REPLACE VIEW inventory_positions AS
SELECT
  item_id,
  project_id,
  SUM(CASE WHEN to_state = 'in_warehouse'   THEN quantity ELSE 0 END)
  - SUM(CASE WHEN from_state = 'in_warehouse' THEN quantity ELSE 0 END)
    AS qty_in_warehouse,
  SUM(CASE WHEN to_state = 'in_transit'    THEN quantity ELSE 0 END)
  - SUM(CASE WHEN from_state = 'in_transit'  THEN quantity ELSE 0 END)
    AS qty_in_transit,
  SUM(CASE WHEN to_state = 'at_site'       THEN quantity ELSE 0 END)
  - SUM(CASE WHEN from_state = 'at_site'    THEN quantity ELSE 0 END)
    AS qty_at_site,
  SUM(CASE WHEN to_state = 'installed'     THEN quantity ELSE 0 END)
    AS qty_installed
FROM inventory_movements
GROUP BY item_id, project_id;

-- ─── STEP 4: Create net_metering_applications ───

CREATE TABLE IF NOT EXISTS net_metering_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES epc_projects(id),
  discom_name text NOT NULL,
  consumer_number text NOT NULL,
  current_stage text NOT NULL DEFAULT 'feasibility'
    CHECK (current_stage IN (
      'feasibility', 'registration', 'inspection', 'meter_change', 'approved'
    )),
  application_date date,
  registration_number text,
  inspection_date date,
  net_meter_serial text,
  commissioning_cert_url text,
  document_urls jsonb NOT NULL DEFAULT '{}',
  estimated_completion_date date,
  notes text,
  last_updated_by uuid REFERENCES profiles(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Stage SLA constants (working days)
COMMENT ON COLUMN net_metering_applications.current_stage IS
  'feasibility=15d, registration=30d, inspection=21d, meter_change=15d';

-- ─── STEP 5: Create payment_schedules ───

CREATE TABLE IF NOT EXISTS payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id),
  milestone_name text NOT NULL,
  trigger_event text NOT NULL
    CHECK (trigger_event IN (
      'order_confirmed', 'site_delivery', 'installation', 'commissioning'
    )),
  percent numeric NOT NULL CHECK (percent > 0 AND percent <= 100),
  amount numeric NOT NULL,
  due_date date,
  paid_at timestamp,
  payment_reference text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ─── STEP 6: Create bom_categories and bom_template_items ───

CREATE TABLE IF NOT EXISTS bom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL,
  is_optional boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS bom_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES bom_categories(id),
  sku_code text NOT NULL UNIQUE,
  description text NOT NULL,
  unit text NOT NULL,
  unit_rate_min numeric,
  unit_rate_max numeric,
  default_rate numeric,
  qty_formula text,
  is_survey_dependent boolean NOT NULL DEFAULT false,
  civil_required_only boolean NOT NULL DEFAULT false,
  notes text
);

-- ─── STEP 7: RLS policies ───

-- Enable RLS on all new tables
ALTER TABLE site_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_metering_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

-- inventory_movements: INSERT only (no UPDATE/DELETE RLS either — triggers handle that)
DROP POLICY IF EXISTS "inventory_movements_select" ON inventory_movements;
CREATE POLICY "inventory_movements_select"
  ON inventory_movements FOR SELECT
  USING (auth.role() IN ('admin', 'project_manager', 'warehouse_staff', 'finance'));

DROP POLICY IF EXISTS "inventory_movements_insert" ON inventory_movements;
CREATE POLICY "inventory_movements_insert"
  ON inventory_movements FOR INSERT
  WITH CHECK (auth.role() IN ('admin', 'warehouse_staff', 'site_supervisor'));

-- site_surveys: standard CRUD for appropriate roles
DROP POLICY IF EXISTS "site_surveys_all" ON site_surveys;
CREATE POLICY "site_surveys_all"
  ON site_surveys FOR ALL
  USING (auth.role() IN ('admin', 'sales', 'project_manager'));

-- ─── STEP 8: v1 quote immutability trigger ───

CREATE OR REPLACE FUNCTION prevent_v1_quote_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version = 1 AND OLD.parent_quote_id IS NULL THEN
    -- Allow only status changes by admin; block all other field changes
    IF OLD.id = NEW.id
       AND OLD.version = NEW.version
       AND (NEW.status IS DISTINCT FROM OLD.status)
       AND auth.role() = 'admin' THEN
      RETURN NEW;  -- admin-only status change on v1 is allowed
    END IF;
    IF OLD.* IS DISTINCT FROM NEW.* THEN
      RAISE EXCEPTION 'Quote version 1 is immutable. Create a new version via reviseQuote().';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_v1_immutable ON quotes;
CREATE TRIGGER quotes_v1_immutable
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION prevent_v1_quote_mutation();
