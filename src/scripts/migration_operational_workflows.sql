-- Migration: Operational Workflows & Gaps
-- Identifies and fills workflow blind spots

-- 1. Create Missing ENUMs
DO $$ BEGIN CREATE TYPE quote_extended_status AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'revision_requested', 'won', 'lost', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE vendor_status AS ENUM ('draft', 'active', 'suspended', 'blacklisted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE po_status AS ENUM ('draft', 'submitted_for_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE work_order_status AS ENUM ('draft', 'assigned', 'in_progress', 'completed', 'blocked', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE site_survey_status AS ENUM ('scheduled', 'in_progress', 'completed', 'needs_rework', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'posted', 'partially_paid', 'paid', 'overdue', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE amc_status AS ENUM ('draft', 'active', 'pending_renewal', 'expired', 'suspended', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE claim_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'resolved'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE escalation_status AS ENUM ('open', 'acknowledged', 'investigating', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Modify Existing Tables with New Statuses

-- We alter columns that were previously TEXT to the new ENUM types, using a using clause or altering directly if they match.
-- For vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status vendor_status NOT NULL DEFAULT 'draft';

-- For purchase orders
ALTER TABLE proc_purchase_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE proc_purchase_orders ALTER COLUMN status TYPE po_status USING (
  CASE 
    WHEN status IN ('draft', 'approved', 'sent', 'partially_received', 'received', 'cancelled') THEN status::po_status
    ELSE 'draft'::po_status
  END
);
ALTER TABLE proc_purchase_orders ALTER COLUMN status SET DEFAULT 'draft'::po_status;

-- For work orders
ALTER TABLE epc_work_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE epc_work_orders ALTER COLUMN status TYPE work_order_status USING (
  CASE
    WHEN status IN ('assigned', 'in_progress', 'completed', 'blocked', 'cancelled') THEN status::work_order_status
    ELSE 'assigned'::work_order_status
  END
);
ALTER TABLE epc_work_orders ALTER COLUMN status SET DEFAULT 'assigned'::work_order_status;

-- For site surveys
ALTER TABLE epc_site_surveys ADD COLUMN IF NOT EXISTS status site_survey_status NOT NULL DEFAULT 'scheduled';

-- For invoices
DROP VIEW IF EXISTS v_project_profitability_audit;
DROP MATERIALIZED VIEW IF EXISTS mv_project_profitability, mv_ar_aging;

ALTER TABLE acc_invoices ALTER COLUMN status DROP DEFAULT;
ALTER TABLE acc_invoices ALTER COLUMN status TYPE invoice_status USING (
  CASE
    WHEN status IN ('draft', 'issued', 'posted', 'partially_paid', 'paid', 'overdue', 'cancelled') THEN status::invoice_status
    ELSE 'draft'::invoice_status
  END
);
ALTER TABLE acc_invoices ALTER COLUMN status SET DEFAULT 'draft'::invoice_status;

-- For AMC contracts
ALTER TABLE field_amc_contracts ALTER COLUMN status DROP DEFAULT;
ALTER TABLE field_amc_contracts ALTER COLUMN status TYPE amc_status USING (
  CASE
    WHEN status = 'active' THEN 'active'::amc_status
    WHEN status = 'expired' THEN 'expired'::amc_status
    WHEN status = 'cancelled' THEN 'cancelled'::amc_status
    ELSE 'draft'::amc_status
  END
);
ALTER TABLE field_amc_contracts ALTER COLUMN status SET DEFAULT 'draft'::amc_status;


-- 3. Create Missing Tables

-- 3.1 Warranty Claims (Procurement/Vendor workflow)
CREATE TABLE IF NOT EXISTS proc_warranty_claims (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    asset_id                UUID NOT NULL REFERENCES field_customer_assets(id),
    vendor_id               UUID NOT NULL REFERENCES vendors(id),
    ticket_id               UUID REFERENCES field_service_tickets(id),
    claim_number            TEXT UNIQUE NOT NULL,
    status                  claim_status NOT NULL DEFAULT 'draft',
    issue_description       TEXT,
    vendor_rma_number       TEXT,
    submitted_at            TIMESTAMPTZ,
    resolved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Escalations
CREATE TABLE IF NOT EXISTS sys_escalations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    entity_type             TEXT NOT NULL, -- 'project', 'ticket', 'po'
    entity_id               UUID NOT NULL,
    escalated_by            UUID NOT NULL REFERENCES profiles(id),
    assigned_to             UUID REFERENCES profiles(id),
    reason                  TEXT NOT NULL,
    status                  escalation_status NOT NULL DEFAULT 'open',
    severity                INTEGER NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Approval Rules (Engine)
CREATE TABLE IF NOT EXISTS sys_approval_rules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    module                  TEXT NOT NULL, -- 'quote', 'po', 'expense'
    condition_sql           TEXT NOT NULL, -- e.g., 'discount_percentage > 5'
    approver_role           TEXT NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 EPC Commissioning & Handover
CREATE TABLE IF NOT EXISTS epc_commissioning_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    commissioned_by         UUID NOT NULL REFERENCES profiles(id),
    net_meter_number        TEXT,
    capacity_tested_kw      NUMERIC(10,2),
    is_approved             BOOLEAN NOT NULL DEFAULT FALSE,
    customer_signoff        BOOLEAN NOT NULL DEFAULT FALSE,
    signoff_date            DATE,
    remarks                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 Dashboards
CREATE TABLE IF NOT EXISTS sys_dashboards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    profile_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    dashboard_name          TEXT NOT NULL,
    layout_json             JSONB NOT NULL DEFAULT '{}',
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Apply RLS to new tables
ALTER TABLE proc_warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_commissioning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proc_warranty_claims_org_isolation" ON proc_warranty_claims FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_escalations_org_isolation" ON sys_escalations FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_approval_rules_org_isolation" ON sys_approval_rules FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "epc_commissioning_reports_org_isolation" ON epc_commissioning_reports FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_dashboards_org_isolation" ON sys_dashboards FOR ALL USING (org_id = auth_org_id());

-- 5. Recreate Dependent Views
CREATE OR REPLACE VIEW v_project_profitability_audit AS
WITH budgeted_costs AS (
  SELECT 
    p.id AS project_id,
    SUM(qi.qty * qi.rate_per_unit) AS budget_material_cost
  FROM epc_projects p
  JOIN quotes q ON p.quote_id = q.id
  JOIN quote_items qi ON qi.quote_id = q.id
  WHERE qi.is_included = TRUE
  GROUP BY p.id
),
actual_materials AS (
  SELECT 
    project_id,
    SUM(qty * unit_cost_wac) AS actual_material_cost
  FROM inv_stock_transactions
  WHERE transaction_type = 'issue_to_project'
  GROUP BY project_id
),
actual_services AS (
  SELECT 
    project_id,
    SUM(taxable_amount) AS actual_labor_cost
  FROM acc_invoices
  WHERE status = 'posted'
  GROUP BY project_id
)
SELECT 
  p.id AS project_id,
  p.project_number,
  p.status AS project_status,
  COALESCE(bc.budget_material_cost, 0) AS budgeted_cost,
  COALESCE(am.actual_material_cost, 0) AS actual_material_cost,
  COALESCE(asv.actual_labor_cost, 0) AS actual_labor_cost,
  (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0)) AS total_actual_cost,
  (COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) AS gross_profit_variance,
  CASE 
    WHEN COALESCE(bc.budget_material_cost, 0) = 0 THEN 0
    ELSE ROUND(((COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) / bc.budget_material_cost) * 100, 2)
  END AS margin_percentage_variance
FROM epc_projects p
LEFT JOIN budgeted_costs bc ON bc.project_id = p.id
LEFT JOIN actual_materials am ON am.project_id = p.id
LEFT JOIN actual_services asv ON asv.project_id = p.id;

-- Recreate mv_project_profitability
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_profitability AS
WITH budgeted_costs AS (
  SELECT 
    p.id AS project_id,
    SUM(qi.qty * qi.rate_per_unit) AS budget_material_cost
  FROM epc_projects p
  JOIN quotes q ON p.quote_id = q.id
  JOIN quote_items qi ON qi.quote_id = q.id
  WHERE qi.is_included = TRUE
  GROUP BY p.id
),
actual_materials AS (
  SELECT 
    project_id,
    SUM(qty * unit_cost_wac) AS actual_material_cost
  FROM inv_stock_transactions
  WHERE transaction_type = 'issue_to_project'
  GROUP BY project_id
),
actual_services AS (
  SELECT 
    project_id,
    SUM(taxable_amount) AS actual_labor_cost
  FROM acc_invoices
  WHERE status = 'posted'
  GROUP BY project_id
)
SELECT 
  p.org_id,
  p.id AS project_id,
  p.project_number,
  p.status AS project_status,
  COALESCE(bc.budget_material_cost, 0) AS budgeted_cost,
  COALESCE(am.actual_material_cost, 0) AS actual_material_cost,
  COALESCE(asv.actual_labor_cost, 0) AS actual_labor_cost,
  (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0)) AS total_actual_cost,
  (COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) AS gross_profit_variance,
  CASE 
    WHEN COALESCE(bc.budget_material_cost, 0) = 0 THEN 0
    ELSE ROUND(((COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) / bc.budget_material_cost) * 100, 2)
  END AS margin_percentage_variance
FROM epc_projects p
LEFT JOIN budgeted_costs bc ON bc.project_id = p.id
LEFT JOIN actual_materials am ON am.project_id = p.id
LEFT JOIN actual_services asv ON asv.project_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_profitability_org ON mv_project_profitability(org_id, project_id);

-- Recreate mv_ar_aging
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ar_aging AS
SELECT
  org_id,
  id AS invoice_id,
  invoice_number,
  invoice_date,
  due_date,
  total_invoice,
  status,
  CURRENT_DATE - due_date AS days_overdue
FROM acc_invoices
WHERE status IN ('issued', 'partially_paid') AND due_date < CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ar_aging_org ON mv_ar_aging(org_id, invoice_id);
