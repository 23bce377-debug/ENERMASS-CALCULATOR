-- ============================================================
-- ENERMASS SOLAR EPC ERP — TIER 1 DATABASE MIGRATION SCRIPT
-- ============================================================

-- ─── 1. ENUMS & REGISTRATION ──────────────────────────────────
DO $$ BEGIN
    CREATE TYPE epc_project_status AS ENUM (
        'draft', 'survey_phase', 'engineering_design', 'permitting', 
        'material_dispatched', 'installation_started', 'net_metering_pending', 
        'commissioned', 'closed', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE milestone_type AS ENUM (
        'survey_approved', 'structural_design_freeze', 'civil_foundation_done', 
        'panel_installation_done', 'inverter_wiring_done', 'net_metering_approved', 
        'discom_charging', 'handover'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE crm_lead_status AS ENUM (
        'new', 'qualified', 'site_survey_requested', 'quote_presented', 
        'negotiation', 'won', 'lost'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE crm_timeline_event AS ENUM (
        'lead_created', 'phone_call', 'whatsapp_sent', 'whatsapp_received', 
        'email_sent', 'email_received', 'quote_generated', 'status_changed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE acc_account_type AS ENUM (
        'asset', 'liability', 'equity', 'revenue', 'expense'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE service_ticket_status AS ENUM (
        'unassigned', 'scheduled', 'ongoing', 'resolved', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ─── 2. CRM & SALES TABLES ───────────────────────────────────

-- CRM Leads
CREATE TABLE IF NOT EXISTS crm_leads (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    first_name         TEXT NOT NULL,
    last_name          TEXT,
    phone              TEXT NOT NULL,
    email              TEXT,
    lead_source        TEXT NOT NULL DEFAULT 'organic', -- 'google_ads', 'referral', 'justdial'
    status             crm_lead_status NOT NULL DEFAULT 'new',
    monthly_bill       NUMERIC(10,2),
    roof_area_estimate NUMERIC(8,2),
    assigned_to        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON crm_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);

-- CRM Opportunities
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    lead_id         UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    expected_value  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    probability_pct INTEGER NOT NULL DEFAULT 10,
    stage           TEXT NOT NULL DEFAULT 'qualification',
    close_date      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_opps_lead ON crm_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_org ON crm_opportunities(org_id);

-- CRM timeline events
CREATE TABLE IF NOT EXISTS crm_timeline (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    event_type      crm_timeline_event NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    logged_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_timeline_lead ON crm_timeline(lead_id);


-- ─── 3. OPERATIONS & PROJECT TABLES ──────────────────────────

-- EPC Projects
CREATE TABLE IF NOT EXISTS epc_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    quote_id        UUID UNIQUE REFERENCES quotes(id) ON DELETE SET NULL,
    project_number  TEXT UNIQUE NOT NULL,
    status          epc_project_status NOT NULL DEFAULT 'draft',
    assigned_pm_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    planned_start   DATE,
    planned_end     DATE,
    actual_start    DATE,
    actual_end      DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_epc_projects_org ON epc_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_epc_projects_quote ON epc_projects(quote_id);

-- Site Surveys
CREATE TABLE IF NOT EXISTS epc_site_surveys (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID UNIQUE NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    surveyor_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
    surveyed_at             TIMESTAMPTZ,
    roof_mount_type         roof_mount_type NOT NULL DEFAULT 'rcc_flat',
    tilt_angle_deg          NUMERIC(5,2),
    usable_area_sqft        NUMERIC(10,2),
    roof_load_capacity_kgm2 NUMERIC(8,2),
    distribution_distance_m NUMERIC(6,2),
    shading_percentage      NUMERIC(5,2),
    solar_access_pct        NUMERIC(5,2),
    survey_notes            TEXT,
    gps_lat                 NUMERIC(9,6),
    gps_lng                 NUMERIC(9,6),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Milestones
CREATE TABLE IF NOT EXISTS epc_project_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    milestone       milestone_type NOT NULL,
    target_date     DATE NOT NULL,
    actual_date     DATE,
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'overdue'
    completed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_parent ON epc_project_milestones(project_id);

-- Work Orders
CREATE TABLE IF NOT EXISTS epc_work_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    wo_number       TEXT UNIQUE NOT NULL,
    assigned_crew_id UUID,
    instructions    TEXT,
    scheduled_start DATE NOT NULL,
    scheduled_end   DATE,
    status          TEXT NOT NULL DEFAULT 'assigned',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_project ON epc_work_orders(project_id);


-- ─── 4. MULTI-WAREHOUSE INVENTORY TABLES ─────────────────────

-- Warehouses
CREATE TABLE IF NOT EXISTS inv_warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL, -- e.g. 'WH-AHMEDABAD'
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouse_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_org ON inv_warehouses(org_id);

-- Warehouse specific stock balances (overrides generic inventory_summary)
CREATE TABLE IF NOT EXISTS inv_stock_balances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    UUID NOT NULL REFERENCES inv_warehouses(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL, -- 'panel', 'inverter', 'battery', 'bom_item'
    item_id         UUID NOT NULL,
    qty_on_hand     NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    qty_reserved    NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    qty_damaged     NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    wac_price       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouse_item_balance UNIQUE (warehouse_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON inv_stock_balances(warehouse_id);

-- Serial Traceability
CREATE TABLE IF NOT EXISTS inv_serialized_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    serial_number   TEXT UNIQUE NOT NULL,
    item_type       TEXT NOT NULL,
    item_id         UUID NOT NULL,
    warehouse_id    UUID REFERENCES inv_warehouses(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES epc_projects(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock', 'transit', 'installed', 'damaged'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serialized_org ON inv_serialized_items(org_id);
CREATE INDEX IF NOT EXISTS idx_serialized_warehouse ON inv_serialized_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_serialized_project ON inv_serialized_items(project_id);


-- ─── 5. FINANCE & LEDGER TABLES ──────────────────────────────

-- Accounts (COA)
CREATE TABLE IF NOT EXISTS acc_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    type            acc_account_type NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON acc_accounts(org_id);

-- General Ledger entries
CREATE TABLE IF NOT EXISTS acc_journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_no    TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON acc_journal_entries(org_id);

-- Ledger lines (Debits and Credits)
CREATE TABLE IF NOT EXISTS acc_journal_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id        UUID NOT NULL REFERENCES acc_journal_entries(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES acc_accounts(id) ON DELETE CASCADE,
    debit           NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    credit          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    project_id      UUID REFERENCES epc_projects(id) ON DELETE SET NULL,
    CONSTRAINT ck_debit_credit CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON acc_journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_project ON acc_journal_lines(project_id);

-- AR Sales Invoicing
CREATE TABLE IF NOT EXISTS acc_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    invoice_number  TEXT UNIQUE NOT NULL,
    invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE NOT NULL,
    taxable_amount  NUMERIC(14,2) NOT NULL,
    cgst_pct        NUMERIC(4,2) NOT NULL DEFAULT 0,
    sgst_pct        NUMERIC(4,2) NOT NULL DEFAULT 0,
    igst_pct        NUMERIC(4,2) NOT NULL DEFAULT 0,
    cgst_amount     NUMERIC(14,2) GENERATED ALWAYS AS (taxable_amount * (cgst_pct / 100)) STORED,
    sgst_amount     NUMERIC(14,2) GENERATED ALWAYS AS (taxable_amount * (sgst_pct / 100)) STORED,
    igst_amount     NUMERIC(14,2) GENERATED ALWAYS AS (taxable_amount * (igst_pct / 100)) STORED,
    total_invoice   NUMERIC(14,2) GENERATED ALWAYS AS (taxable_amount + (taxable_amount * ((cgst_pct + sgst_pct + igst_pct) / 100))) STORED,
    tds_deducted    NUMERIC(14,2) NOT NULL DEFAULT 0.00, -- Section 194C
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON acc_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON acc_invoices(org_id);


-- ─── 6. TRIGGERS FOR VERSIONING & UPDATED_AT ──────────────────

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_opportunities_updated_at ON crm_opportunities;
CREATE TRIGGER trg_crm_opportunities_updated_at BEFORE UPDATE ON crm_opportunities FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_epc_projects_updated_at ON epc_projects;
CREATE TRIGGER trg_epc_projects_updated_at BEFORE UPDATE ON epc_projects FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_epc_work_orders_updated_at ON epc_work_orders;
CREATE TRIGGER trg_epc_work_orders_updated_at BEFORE UPDATE ON epc_work_orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_warehouses_updated_at ON inv_warehouses;
CREATE TRIGGER trg_inv_warehouses_updated_at BEFORE UPDATE ON inv_warehouses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_stock_balances_updated_at ON inv_stock_balances;
CREATE TRIGGER trg_inv_stock_balances_updated_at BEFORE UPDATE ON inv_stock_balances FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_acc_accounts_updated_at ON acc_accounts;
CREATE TRIGGER trg_acc_accounts_updated_at BEFORE UPDATE ON acc_accounts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_acc_invoices_updated_at ON acc_invoices;
CREATE TRIGGER trg_acc_invoices_updated_at BEFORE UPDATE ON acc_invoices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- version triggers
DROP TRIGGER IF EXISTS trg_epc_projects_version ON epc_projects;
CREATE TRIGGER trg_epc_projects_version BEFORE UPDATE ON epc_projects FOR EACH ROW EXECUTE FUNCTION fn_increment_version();


-- ─── 7. ROW LEVEL SECURITY (RLS) POLICIES ────────────────────

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_site_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_serialized_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_invoices ENABLE ROW LEVEL SECURITY;

-- Leads RLS
DROP POLICY IF EXISTS "crm_leads_org_isolation" ON crm_leads;
CREATE POLICY "crm_leads_org_isolation" ON crm_leads FOR ALL USING (org_id = auth_org_id());

-- Opportunities RLS
DROP POLICY IF EXISTS "crm_opportunities_org_isolation" ON crm_opportunities;
CREATE POLICY "crm_opportunities_org_isolation" ON crm_opportunities FOR ALL USING (org_id = auth_org_id());

-- Timeline RLS (transitive via Leads)
DROP POLICY IF EXISTS "crm_timeline_via_lead" ON crm_timeline;
CREATE POLICY "crm_timeline_via_lead" ON crm_timeline FOR ALL USING (
    lead_id IN (SELECT id FROM crm_leads WHERE org_id = auth_org_id())
);

-- Projects RLS
DROP POLICY IF EXISTS "epc_projects_org_isolation" ON epc_projects;
CREATE POLICY "epc_projects_org_isolation" ON epc_projects FOR ALL USING (org_id = auth_org_id());

-- Site Surveys RLS (transitive via Projects)
DROP POLICY IF EXISTS "epc_site_surveys_via_project" ON epc_site_surveys;
CREATE POLICY "epc_site_surveys_via_project" ON epc_site_surveys FOR ALL USING (
    project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id())
);

-- Milestones RLS (transitive via Projects)
DROP POLICY IF EXISTS "epc_project_milestones_via_project" ON epc_project_milestones;
CREATE POLICY "epc_project_milestones_via_project" ON epc_project_milestones FOR ALL USING (
    project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id())
);

-- Work Orders RLS (transitive via Projects)
DROP POLICY IF EXISTS "epc_work_orders_via_project" ON epc_work_orders;
CREATE POLICY "epc_work_orders_via_project" ON epc_work_orders FOR ALL USING (
    project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id())
);

-- Warehouses RLS
DROP POLICY IF EXISTS "inv_warehouses_org_isolation" ON inv_warehouses;
CREATE POLICY "inv_warehouses_org_isolation" ON inv_warehouses FOR ALL USING (org_id = auth_org_id());

-- Stock Balances RLS (transitive via Warehouses)
DROP POLICY IF EXISTS "inv_stock_balances_via_warehouse" ON inv_stock_balances;
CREATE POLICY "inv_stock_balances_via_warehouse" ON inv_stock_balances FOR ALL USING (
    warehouse_id IN (SELECT id FROM inv_warehouses WHERE org_id = auth_org_id())
);

-- Serial Items RLS
DROP POLICY IF EXISTS "inv_serialized_items_org_isolation" ON inv_serialized_items;
CREATE POLICY "inv_serialized_items_org_isolation" ON inv_serialized_items FOR ALL USING (org_id = auth_org_id());

-- Accounts RLS
DROP POLICY IF EXISTS "acc_accounts_org_isolation" ON acc_accounts;
CREATE POLICY "acc_accounts_org_isolation" ON acc_accounts FOR ALL USING (org_id = auth_org_id());

-- Journal Entries RLS
DROP POLICY IF EXISTS "acc_journal_entries_org_isolation" ON acc_journal_entries;
CREATE POLICY "acc_journal_entries_org_isolation" ON acc_journal_entries FOR ALL USING (org_id = auth_org_id());

-- Journal Lines RLS (transitive via Entries)
DROP POLICY IF EXISTS "acc_journal_lines_via_entry" ON acc_journal_lines;
CREATE POLICY "acc_journal_lines_via_entry" ON acc_journal_lines FOR ALL USING (
    entry_id IN (SELECT id FROM acc_journal_entries WHERE org_id = auth_org_id())
);

-- Invoices RLS
DROP POLICY IF EXISTS "acc_invoices_org_isolation" ON acc_invoices;
CREATE POLICY "acc_invoices_org_isolation" ON acc_invoices FOR ALL USING (org_id = auth_org_id());


-- ─── 8. DETERMINISTIC PROJECT WORKFLOW TRIGGERS ────────────────

-- Trigger to automatically create an EPC Project record when a Quote status transitions to 'won'
CREATE OR REPLACE FUNCTION fn_trigger_create_project_on_win()
RETURNS TRIGGER AS $$
DECLARE
    v_project_no TEXT;
    v_year TEXT;
    v_count INTEGER;
BEGIN
    IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
        -- Generate Project Number PRJ-YYYY-NNNN
        v_year := TO_CHAR(NOW(), 'YYYY');
        SELECT COALESCE(COUNT(*), 0) + 1 INTO v_count 
        FROM epc_projects 
        WHERE org_id = NEW.org_id AND TO_CHAR(created_at, 'YYYY') = v_year;
        
        v_project_no := 'PRJ-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

        INSERT INTO epc_projects (org_id, quote_id, project_number, status, planned_start)
        VALUES (NEW.org_id, NEW.id, v_project_no, 'survey_phase', CURRENT_DATE)
        ON CONFLICT (quote_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_project_on_win ON quotes;
CREATE TRIGGER trg_create_project_on_win
AFTER UPDATE OF status ON quotes
FOR EACH ROW EXECUTE FUNCTION fn_trigger_create_project_on_win();
