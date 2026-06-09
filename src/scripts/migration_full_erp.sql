-- ============================================================
-- ENERMASS SOLAR EPC ERP — COMPREHENSIVE PRODUCTION SCHEMA
-- ============================================================
-- Target standard: SAP B1, Oracle NetSuite, Salesforce Field Service
-- Compliance: India GST, TDS (194C, 194Q), PM Surya Ghar Scheme
-- Concurrency: CAS optimistic versioning
-- Multi-Tenancy: Isolated via Row Level Security (RLS) on auth_org_id()
-- ============================================================

-- ─── SECTION 1: GLOBAL TYPES & ENUMS ──────────────────────────
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

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'upi', 'neft', 'rtgs', 'cheque', 'cash', 'credit_card'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'pending', 'approved', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM (
        'draft', 'transit', 'completed', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ─── SECTION 2: CRM & LEADS MANAGEMENT ───────────────────────

-- CRM Leads Register
CREATE TABLE IF NOT EXISTS crm_leads (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    first_name         TEXT NOT NULL,
    last_name          TEXT,
    phone              TEXT NOT NULL,
    email              TEXT,
    lead_source        TEXT NOT NULL DEFAULT 'organic',
    status             crm_lead_status NOT NULL DEFAULT 'new',
    monthly_bill       NUMERIC(10,2),
    roof_area_estimate NUMERIC(8,2),
    assigned_to        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON crm_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);

-- CRM Opportunities (Pipelines)
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

CREATE INDEX IF NOT EXISTS idx_crm_opps_org ON crm_opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_lead ON crm_opportunities(lead_id);

-- CRM Event History / Touchpoints
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


-- ─── SECTION 3: EPC OPERATIONS & SITE SURVEYS ────────────────

-- EPC Projects
CREATE TABLE IF NOT EXISTS epc_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    quote_id        UUID UNIQUE REFERENCES quotes(id) ON DELETE SET NULL,
    project_number  TEXT UNIQUE NOT NULL, -- PRJ-YYYY-NNNN
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

-- Project Milestones Tracker
CREATE TABLE IF NOT EXISTS epc_project_milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    milestone       milestone_type NOT NULL,
    target_date     DATE NOT NULL,
    actual_date     DATE,
    status          TEXT NOT NULL DEFAULT 'pending',
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


-- ─── SECTION 4: FIELD SERVICE & WARRANTY ─────────────────────

-- Field Service Tickets (AMC & Breakdown maintenance)
CREATE TABLE IF NOT EXISTS field_service_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES epc_projects(id) ON DELETE CASCADE,
    ticket_number   TEXT UNIQUE NOT NULL, -- TKT-YYYY-NNNN
    status          service_ticket_status NOT NULL DEFAULT 'unassigned',
    assigned_crew_id UUID,
    scheduled_date  DATE NOT NULL,
    completed_at    TIMESTAMPTZ,
    issue_details   TEXT NOT NULL,
    action_taken    TEXT,
    arrival_lat     NUMERIC(9,6),
    arrival_lng     NUMERIC(9,6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_tickets_project ON field_service_tickets(project_id);

-- Field Checklist Items
CREATE TABLE IF NOT EXISTS field_checklist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES field_service_tickets(id) ON DELETE CASCADE,
    task_label      TEXT NOT NULL,
    is_checked      BOOLEAN NOT NULL DEFAULT FALSE,
    measured_value  TEXT,
    photo_s3_key    TEXT,
    completed_at    TIMESTAMPTZ
);

-- Installed Customer Assets (For Warranty tracking)
CREATE TABLE IF NOT EXISTS field_customer_assets (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id             UUID REFERENCES epc_projects(id) ON DELETE SET NULL,
    item_type              TEXT NOT NULL, -- 'panel', 'inverter', 'battery'
    brand                  TEXT NOT NULL,
    model                  TEXT NOT NULL,
    serial_number          TEXT UNIQUE NOT NULL,
    installation_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    warranty_expiry_date   DATE NOT NULL,
    warranty_certificate   TEXT, -- link in Vault
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_project ON field_customer_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON field_customer_assets(org_id);

-- Annual Maintenance Contracts (AMC)
CREATE TABLE IF NOT EXISTS field_amc_contracts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    customer_name      TEXT NOT NULL,
    customer_phone     TEXT NOT NULL,
    asset_id           UUID REFERENCES field_customer_assets(id) ON DELETE CASCADE,
    contract_number    TEXT UNIQUE NOT NULL, -- AMC-YYYY-NNNN
    start_date         DATE NOT NULL,
    end_date           DATE NOT NULL,
    amc_price          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    visits_per_year    INTEGER NOT NULL DEFAULT 2,
    completed_visits   INTEGER NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amc_asset ON field_amc_contracts(asset_id);
CREATE INDEX IF NOT EXISTS idx_amc_org ON field_amc_contracts(org_id);


-- ─── SECTION 5: MULTI-WAREHOUSE & INVENTORY ─────────────────

-- Warehouses
CREATE TABLE IF NOT EXISTS inv_warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL, -- 'WH-MAIN', 'WH-TRANSIT'
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouse_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_org ON inv_warehouses(org_id);

-- Stock Balances
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

-- Warehouse Transfers
CREATE TABLE IF NOT EXISTS inv_transfers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    transfer_number      TEXT UNIQUE NOT NULL, -- TRF-YYYY-NNNN
    from_warehouse_id    UUID NOT NULL REFERENCES inv_warehouses(id),
    to_warehouse_id      UUID NOT NULL REFERENCES inv_warehouses(id),
    status               transfer_status NOT NULL DEFAULT 'draft',
    shipped_at           TIMESTAMPTZ,
    received_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_org ON inv_transfers(org_id);

-- Warehouse Transfer Items
CREATE TABLE IF NOT EXISTS inv_transfer_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id     UUID NOT NULL REFERENCES inv_transfers(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL,
    item_id         UUID NOT NULL,
    qty             NUMERIC(12,4) NOT NULL,
    serials         TEXT[] -- Scanned list of serials
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_parent ON inv_transfer_items(transfer_id);

-- Stock Ledger Transactions (The source of truth for stock movement)
CREATE TABLE IF NOT EXISTS inv_stock_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id        UUID REFERENCES epc_projects(id) ON DELETE SET NULL,
    warehouse_id      UUID NOT NULL REFERENCES inv_warehouses(id) ON DELETE CASCADE,
    item_type         TEXT NOT NULL,
    item_id           UUID NOT NULL,
    transaction_type  TEXT NOT NULL, -- 'receipt', 'issue_to_project', 'transfer_out', 'transfer_in', 'writeoff'
    qty               NUMERIC(12,4) NOT NULL,
    unit_cost_wac     NUMERIC(12,2) NOT NULL,
    reference_id      UUID, -- references PO, Dispatch, or Transfer ID
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_trans_warehouse ON inv_stock_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_project ON inv_stock_transactions(project_id);


-- ─── SECTION 6: PROCUREMENT & PO MANAGEMENT ──────────────────

-- Request for Quotation (RFQ)
CREATE TABLE IF NOT EXISTS proc_rfqs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    rfq_number      TEXT UNIQUE NOT NULL, -- RFQ-YYYY-NNNN
    status          TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'closed'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfqs_org ON proc_rfqs(org_id);

-- RFQ Items
CREATE TABLE IF NOT EXISTS proc_rfq_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id          UUID NOT NULL REFERENCES proc_rfqs(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL,
    item_id         UUID NOT NULL,
    qty_requested   NUMERIC(12,4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rfq_items_parent ON proc_rfq_items(rfq_id);

-- Vendor Bids
CREATE TABLE IF NOT EXISTS proc_vendor_bids (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id          UUID NOT NULL REFERENCES proc_rfqs(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    unit_price      NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    lead_time_days  INTEGER NOT NULL DEFAULT 7,
    valid_until     DATE NOT NULL,
    is_selected     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_bids_parent ON proc_vendor_bids(rfq_id);

-- Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS proc_purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    po_number       TEXT UNIQUE NOT NULL, -- PO-YYYY-NNNN
    status          TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'sent', 'partially_received', 'received', 'cancelled'
    delivery_date   DATE,
    total_taxable   NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    cgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    sgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    igst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_po_org ON proc_purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON proc_purchase_orders(vendor_id);

-- PO items
CREATE TABLE IF NOT EXISTS proc_po_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id           UUID NOT NULL REFERENCES proc_purchase_orders(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL,
    item_id         UUID NOT NULL,
    qty_ordered     NUMERIC(12,4) NOT NULL,
    qty_received    NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    unit_price      NUMERIC(12,2) NOT NULL,
    gst_pct         NUMERIC(5,2) NOT NULL DEFAULT 18.00
);

CREATE INDEX IF NOT EXISTS idx_po_items_parent ON proc_po_items(po_id);

-- Goods Receipt Notes (GRN)
CREATE TABLE IF NOT EXISTS proc_goods_receipt_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    po_id           UUID NOT NULL REFERENCES proc_purchase_orders(id) ON DELETE CASCADE,
    warehouse_id    UUID NOT NULL REFERENCES inv_warehouses(id) ON DELETE CASCADE,
    grn_number      TEXT UNIQUE NOT NULL, -- GRN-YYYY-NNNN
    receipt_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_org ON proc_goods_receipt_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON proc_goods_receipt_notes(po_id);

-- GRN Items
CREATE TABLE IF NOT EXISTS proc_grn_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id          UUID NOT NULL REFERENCES proc_goods_receipt_notes(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL,
    item_id         UUID NOT NULL,
    qty_received    NUMERIC(12,4) NOT NULL,
    serials         TEXT[] -- Serial numbers scanned on receipt
);


-- ─── SECTION 7: DOUBLE ENTRY GENERAL LEDGER ──────────────────

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS acc_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL, -- Account code e.g. '1200'
    name            TEXT NOT NULL, -- Account name e.g. 'Accounts Receivable'
    type            acc_account_type NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_code UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON acc_accounts(org_id);

-- Journal Entries
CREATE TABLE IF NOT EXISTS acc_journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_no    TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON acc_journal_entries(org_id);

-- Journal Lines (Credits & Debits)
CREATE TABLE IF NOT EXISTS acc_journal_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    entry_id        UUID NOT NULL REFERENCES acc_journal_entries(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES acc_accounts(id) ON DELETE CASCADE,
    debit           NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    credit          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    project_id      UUID REFERENCES epc_projects(id) ON DELETE SET NULL,
    CONSTRAINT ck_debit_credit CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON acc_journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_project ON acc_journal_lines(project_id);

-- Accounts Receivable Sales Invoicing
CREATE TABLE IF NOT EXISTS acc_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES epc_projects(id) ON DELETE CASCADE,
    invoice_number  TEXT UNIQUE NOT NULL, -- INV-YYYY-NNNN
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
    
    tds_deducted    NUMERIC(14,2) NOT NULL DEFAULT 0.00, -- TDS deducted under Section 194C
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON acc_invoices(project_id);

-- Customer & Vendor Payments
CREATE TABLE IF NOT EXISTS acc_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    invoice_id      UUID REFERENCES acc_invoices(id) ON DELETE CASCADE, -- Null for PO vendor payments
    po_id           UUID REFERENCES proc_purchase_orders(id) ON DELETE CASCADE,
    payment_number  TEXT UNIQUE NOT NULL, -- PAY-YYYY-NNNN
    payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    amount          NUMERIC(14,2) NOT NULL,
    method          payment_method NOT NULL DEFAULT 'neft',
    reference_no    TEXT, -- Transaction ID/Cheque No
    tds_deducted    NUMERIC(14,2) NOT NULL DEFAULT 0.00, -- TDS deducted at payment time (Section 194Q)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org ON acc_payments(org_id);

-- Credit Notes & Debit Notes (Tax adjustments)
CREATE TABLE IF NOT EXISTS acc_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    invoice_id      UUID REFERENCES acc_invoices(id) ON DELETE CASCADE,
    po_id           UUID REFERENCES proc_purchase_orders(id) ON DELETE CASCADE,
    adjustment_no   TEXT UNIQUE NOT NULL, -- ADJ-YYYY-NNNN
    adj_type        TEXT NOT NULL, -- 'credit_note', 'debit_note'
    amount          NUMERIC(14,2) NOT NULL,
    cgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    sgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    igst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_org ON acc_adjustments(org_id);

-- Bank Statement upload for reconciliation
CREATE TABLE IF NOT EXISTS acc_bank_statements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    statement_date  DATE NOT NULL,
    account_number  TEXT NOT NULL,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_org ON acc_bank_statements(org_id);

-- Bank Statement Lines
CREATE TABLE IF NOT EXISTS acc_bank_statement_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id    UUID NOT NULL REFERENCES acc_bank_statements(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description     TEXT NOT NULL,
    amount          NUMERIC(14,2) NOT NULL, -- positive for credit, negative for debit
    is_reconciled   BOOLEAN NOT NULL DEFAULT FALSE,
    payment_id      UUID REFERENCES acc_payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_statement_lines_parent ON acc_bank_statement_lines(statement_id);


-- ─── SECTION 8: PROCESS CONTROL & APPROVALS ──────────────────

-- Approval Logs for POs, Claims, Designs
CREATE TABLE IF NOT EXISTS sys_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL, -- 'purchase_order', 'design_freeze', 'discount_override'
    document_id     UUID NOT NULL, -- PO ID, Survey ID, or Quote ID
    requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status          approval_status NOT NULL DEFAULT 'pending',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_org ON sys_approvals(org_id);

-- System Notifications (Escalation / alerts)
CREATE TABLE IF NOT EXISTS sys_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON sys_notifications(recipient_id);


-- ─── SECTION 9: DETERMINISTIC WORKFLOW TRIGGERS & PROCS ───────

-- Add counter for projects on organisations table if not exists
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS project_counter INTEGER NOT NULL DEFAULT 1000;

-- Trigger: Automatically generate Project upon Quote 'won'
CREATE OR REPLACE FUNCTION fn_trigger_create_project_on_win()
RETURNS TRIGGER AS $$
DECLARE
    v_project_no TEXT;
    v_counter INTEGER;
    v_year TEXT;
BEGIN
    IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
        -- Atomic increment of project_counter on organisations table to prevent duplicate race conditions
        UPDATE organisations
        SET project_counter = project_counter + 1
        WHERE id = NEW.org_id
        RETURNING project_counter
        INTO v_counter;

        v_year := TO_CHAR(NOW(), 'YYYY');
        v_project_no := 'PRJ-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');

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

-- Procedure: Receive Stock, Update Warehouse WAC, and Post to General Ledger
CREATE OR REPLACE FUNCTION process_grn_receipt(
    p_grn_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_grn RECORD;
    v_item RECORD;
    v_current_qty NUMERIC;
    v_current_wac NUMERIC;
    v_new_qty NUMERIC;
    v_new_wac NUMERIC;
    v_entry_id UUID;
    v_total_taxable NUMERIC := 0.00;
    v_total_gst NUMERIC := 0.00;
    v_line_taxable NUMERIC;
    v_line_gst NUMERIC;
BEGIN
    -- Fetch GRN (strictly within authenticated tenant context)
    SELECT * INTO v_grn 
    FROM proc_goods_receipt_notes 
    WHERE id = p_grn_id AND org_id = auth_org_id();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Goods Receipt Note not found');
    END IF;

    -- Process items
    FOR v_item IN (SELECT item_type, item_id, qty_received FROM proc_grn_items WHERE grn_id = p_grn_id)
    LOOP
        -- Lookup current balance inside warehouse
        SELECT qty_on_hand, wac_price INTO v_current_qty, v_current_wac
        FROM inv_stock_balances
        WHERE warehouse_id = v_grn.warehouse_id AND item_type = v_item.item_type AND item_id = v_item.item_id;

        -- Fetch rate and GST from corresponding PO item
        DECLARE
            v_rate NUMERIC;
            v_gst_pct NUMERIC;
        BEGIN
            SELECT unit_price, gst_pct INTO v_rate, v_gst_pct
            FROM proc_po_items 
            WHERE po_id = v_grn.po_id AND item_type = v_item.item_type AND item_id = v_item.item_id
            LIMIT 1;

            v_rate := COALESCE(v_rate, 0);
            v_gst_pct := COALESCE(v_gst_pct, 18.00);

            IF v_current_qty IS NULL THEN
                -- Insert new stock entry
                INSERT INTO inv_stock_balances (warehouse_id, item_type, item_id, qty_on_hand, wac_price)
                VALUES (v_grn.warehouse_id, v_item.item_type, v_item.item_id, v_item.qty_received, v_rate);
            ELSE
                -- Update existing balance & compute WAC
                v_new_qty := v_current_qty + v_item.qty_received;
                -- If current qty is zero or negative, reset WAC to current purchase price to prevent distortion
                IF v_current_qty <= 0 THEN
                    v_new_wac := v_rate;
                ELSIF v_new_qty > 0 THEN
                    v_new_wac := ((v_current_qty * v_current_wac) + (v_item.qty_received * v_rate)) / v_new_qty;
                ELSE
                    v_new_wac := v_current_wac;
                END IF;

                UPDATE inv_stock_balances
                SET qty_on_hand = v_new_qty, wac_price = v_new_wac, updated_at = NOW()
                WHERE warehouse_id = v_grn.warehouse_id AND item_type = v_item.item_type AND item_id = v_item.item_id;
            END IF;

            -- Accumulate financials for GL posting
            v_line_taxable := v_item.qty_received * v_rate;
            v_line_gst := v_line_taxable * (v_gst_pct / 100);
            v_total_taxable := v_total_taxable + v_line_taxable;
            v_total_gst := v_total_gst + v_line_gst;

            -- Log transaction ledger (using auth_org_id() directly)
            INSERT INTO inv_stock_transactions (org_id, warehouse_id, item_type, item_id, transaction_type, qty, unit_cost_wac, reference_id)
            VALUES (auth_org_id(), v_grn.warehouse_id, v_item.item_type, v_item.item_id, 'receipt', v_item.qty_received, v_rate, p_grn_id);
        END;
    END LOOP;

    -- Post GL entries atomically for the Goods Receipt Note
    IF v_total_taxable > 0 THEN
      INSERT INTO acc_journal_entries (org_id, reference_no, description)
      VALUES (auth_org_id(), v_grn.grn_number, 'Goods Receipt Note posting for PO ' || (SELECT po_number FROM proc_purchase_orders WHERE id = v_grn.po_id))
      RETURNING id INTO v_entry_id;

      -- Debit Inventory Asset ('1300')
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, get_or_create_account(auth_org_id(), '1300', 'Inventory Asset', 'asset'), v_total_taxable, 0.00, auth_org_id());

      -- Debit GST Input Receivable ('1400')
      IF v_total_gst > 0 THEN
        INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
        VALUES (v_entry_id, get_or_create_account(auth_org_id(), '1400', 'GST Input Receivable', 'asset'), v_total_gst, 0.00, auth_org_id());
      END IF;

      -- Credit Accounts Payable ('2000')
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, get_or_create_account(auth_org_id(), '2000', 'Accounts Payable', 'liability'), 0.00, v_total_taxable + v_total_gst, auth_org_id());
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ─── SECTION 10: DYNAMIC VIEWS FOR VARIANCES & AUDITING ───────

-- View: Project-level financial variance analyzer
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


-- ─── SECTION 11: ROW LEVEL SECURITY (RLS) POLICIES ────────────

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_site_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE epc_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_customer_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_serialized_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_vendor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_notifications ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies via auth_org_id() lookup
DROP POLICY IF EXISTS "crm_leads_org_isolation" ON crm_leads;
CREATE POLICY "crm_leads_org_isolation" ON crm_leads FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "crm_opportunities_org_isolation" ON crm_opportunities;
CREATE POLICY "crm_opportunities_org_isolation" ON crm_opportunities FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "crm_timeline_org_isolation" ON crm_timeline;
DROP POLICY IF EXISTS "crm_timeline_via_lead" ON crm_timeline;
CREATE POLICY "crm_timeline_via_lead" ON crm_timeline FOR ALL USING (lead_id IN (SELECT id FROM crm_leads WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "epc_projects_org_isolation" ON epc_projects;
CREATE POLICY "epc_projects_org_isolation" ON epc_projects FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "epc_site_surveys_org_isolation" ON epc_site_surveys;
DROP POLICY IF EXISTS "epc_site_surveys_via_project" ON epc_site_surveys;
CREATE POLICY "epc_site_surveys_via_project" ON epc_site_surveys FOR ALL USING (project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "epc_project_milestones_org_isolation" ON epc_project_milestones;
DROP POLICY IF EXISTS "epc_project_milestones_via_project" ON epc_project_milestones;
CREATE POLICY "epc_project_milestones_via_project" ON epc_project_milestones FOR ALL USING (project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "epc_work_orders_org_isolation" ON epc_work_orders;
DROP POLICY IF EXISTS "epc_work_orders_via_project" ON epc_work_orders;
CREATE POLICY "epc_work_orders_via_project" ON epc_work_orders FOR ALL USING (project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "field_service_tickets_org_isolation" ON field_service_tickets;
DROP POLICY IF EXISTS "field_service_tickets_via_project" ON field_service_tickets;
CREATE POLICY "field_service_tickets_via_project" ON field_service_tickets FOR ALL USING (project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "field_checklist_items_org_isolation" ON field_checklist_items;
DROP POLICY IF EXISTS "field_checklist_items_via_ticket" ON field_checklist_items;
CREATE POLICY "field_checklist_items_via_ticket" ON field_checklist_items FOR ALL USING (ticket_id IN (SELECT id FROM field_service_tickets WHERE project_id IN (SELECT id FROM epc_projects WHERE org_id = auth_org_id())));
DROP POLICY IF EXISTS "field_customer_assets_org_isolation" ON field_customer_assets;
CREATE POLICY "field_customer_assets_org_isolation" ON field_customer_assets FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "field_amc_contracts_org_isolation" ON field_amc_contracts;
CREATE POLICY "field_amc_contracts_org_isolation" ON field_amc_contracts FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "inv_warehouses_org_isolation" ON inv_warehouses;
CREATE POLICY "inv_warehouses_org_isolation" ON inv_warehouses FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "inv_stock_balances_org_isolation" ON inv_stock_balances;
DROP POLICY IF EXISTS "inv_stock_balances_via_warehouse" ON inv_stock_balances;
CREATE POLICY "inv_stock_balances_via_warehouse" ON inv_stock_balances FOR ALL USING (warehouse_id IN (SELECT id FROM inv_warehouses WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "inv_serialized_items_org_isolation" ON inv_serialized_items;
CREATE POLICY "inv_serialized_items_org_isolation" ON inv_serialized_items FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "inv_transfers_org_isolation" ON inv_transfers;
CREATE POLICY "inv_transfers_org_isolation" ON inv_transfers FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "inv_transfer_items_org_isolation" ON inv_transfer_items;
DROP POLICY IF EXISTS "inv_transfer_items_via_transfer" ON inv_transfer_items;
CREATE POLICY "inv_transfer_items_via_transfer" ON inv_transfer_items FOR ALL USING (transfer_id IN (SELECT id FROM inv_transfers WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "inv_stock_transactions_org_isolation" ON inv_stock_transactions;
CREATE POLICY "inv_stock_transactions_org_isolation" ON inv_stock_transactions FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "proc_rfqs_org_isolation" ON proc_rfqs;
CREATE POLICY "proc_rfqs_org_isolation" ON proc_rfqs FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "proc_rfq_items_org_isolation" ON proc_rfq_items;
DROP POLICY IF EXISTS "proc_rfq_items_via_rfq" ON proc_rfq_items;
CREATE POLICY "proc_rfq_items_via_rfq" ON proc_rfq_items FOR ALL USING (rfq_id IN (SELECT id FROM proc_rfqs WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "proc_vendor_bids_org_isolation" ON proc_vendor_bids;
DROP POLICY IF EXISTS "proc_vendor_bids_via_rfq" ON proc_vendor_bids;
CREATE POLICY "proc_vendor_bids_via_rfq" ON proc_vendor_bids FOR ALL USING (rfq_id IN (SELECT id FROM proc_rfqs WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "proc_purchase_orders_org_isolation" ON proc_purchase_orders;
CREATE POLICY "proc_purchase_orders_org_isolation" ON proc_purchase_orders FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "proc_po_items_org_isolation" ON proc_po_items;
DROP POLICY IF EXISTS "proc_po_items_via_po" ON proc_po_items;
CREATE POLICY "proc_po_items_via_po" ON proc_po_items FOR ALL USING (po_id IN (SELECT id FROM proc_purchase_orders WHERE org_id = auth_org_id()));
DROP POLICY IF EXISTS "proc_grn_org_isolation" ON proc_goods_receipt_notes;
CREATE POLICY "proc_grn_org_isolation" ON proc_goods_receipt_notes FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "proc_grn_items_org_isolation" ON proc_grn_items;
DROP POLICY IF EXISTS "proc_grn_items_via_grn" ON proc_grn_items;
CREATE POLICY "proc_grn_items_via_grn" ON proc_grn_items FOR ALL USING (grn_id IN (SELECT id FROM proc_goods_receipt_notes WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "acc_accounts_org_isolation" ON acc_accounts;
CREATE POLICY "acc_accounts_org_isolation" ON acc_accounts FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_journal_entries_org_isolation" ON acc_journal_entries;
CREATE POLICY "acc_journal_entries_org_isolation" ON acc_journal_entries FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_journal_lines_org_isolation" ON acc_journal_lines;
CREATE POLICY "acc_journal_lines_org_isolation" ON acc_journal_lines FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_invoices_org_isolation" ON acc_invoices;
CREATE POLICY "acc_invoices_org_isolation" ON acc_invoices FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_payments_org_isolation" ON acc_payments;
CREATE POLICY "acc_payments_org_isolation" ON acc_payments FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_adjustments_org_isolation" ON acc_adjustments;
CREATE POLICY "acc_adjustments_org_isolation" ON acc_adjustments FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_bank_statements_org_isolation" ON acc_bank_statements;
CREATE POLICY "acc_bank_statements_org_isolation" ON acc_bank_statements FOR ALL USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "acc_bank_statement_lines_org_isolation" ON acc_bank_statement_lines;
DROP POLICY IF EXISTS "acc_bank_statement_lines_via_statement" ON acc_bank_statement_lines;
CREATE POLICY "acc_bank_statement_lines_via_statement" ON acc_bank_statement_lines FOR ALL USING (statement_id IN (SELECT id FROM acc_bank_statements WHERE org_id = auth_org_id()));

-- sys_approvals RBAC split policies
DROP POLICY IF EXISTS "sys_approvals_org_isolation" ON sys_approvals;
DROP POLICY IF EXISTS "sys_approvals_select" ON sys_approvals;
DROP POLICY IF EXISTS "sys_approvals_insert" ON sys_approvals;
DROP POLICY IF EXISTS "sys_approvals_update" ON sys_approvals;
DROP POLICY IF EXISTS "sys_approvals_delete" ON sys_approvals;
CREATE POLICY "sys_approvals_select" ON sys_approvals FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "sys_approvals_insert" ON sys_approvals FOR INSERT WITH CHECK (org_id = auth_org_id() AND status = 'pending');
CREATE POLICY "sys_approvals_update" ON sys_approvals FOR UPDATE USING (org_id = auth_org_id() AND auth_role() IN ('owner', 'admin'));
CREATE POLICY "sys_approvals_delete" ON sys_approvals FOR DELETE USING (org_id = auth_org_id() AND auth_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "sys_notifications_org_isolation" ON sys_notifications;
CREATE POLICY "sys_notifications_org_isolation" ON sys_notifications FOR ALL USING (org_id = auth_org_id());


-- ─── SECTION 12: GENERAL AUDIT & VERSION TRIGGERS ─────────────

-- updated_at
DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_opportunities_updated_at ON crm_opportunities;
CREATE TRIGGER trg_crm_opportunities_updated_at BEFORE UPDATE ON crm_opportunities FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_epc_projects_updated_at ON epc_projects;
CREATE TRIGGER trg_epc_projects_updated_at BEFORE UPDATE ON epc_projects FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_epc_work_orders_updated_at ON epc_work_orders;
CREATE TRIGGER trg_epc_work_orders_updated_at BEFORE UPDATE ON epc_work_orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_field_service_tickets_updated_at ON field_service_tickets;
CREATE TRIGGER trg_field_service_tickets_updated_at BEFORE UPDATE ON field_service_tickets FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_field_amc_contracts_updated_at ON field_amc_contracts;
CREATE TRIGGER trg_field_amc_contracts_updated_at BEFORE UPDATE ON field_amc_contracts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_warehouses_updated_at ON inv_warehouses;
CREATE TRIGGER trg_inv_warehouses_updated_at BEFORE UPDATE ON inv_warehouses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_stock_balances_updated_at ON inv_stock_balances;
CREATE TRIGGER trg_inv_stock_balances_updated_at BEFORE UPDATE ON inv_stock_balances FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inv_transfers_updated_at ON inv_transfers;
CREATE TRIGGER trg_inv_transfers_updated_at BEFORE UPDATE ON inv_transfers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_proc_rfqs_updated_at ON proc_rfqs;
CREATE TRIGGER trg_proc_rfqs_updated_at BEFORE UPDATE ON proc_rfqs FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_proc_purchase_orders_updated_at ON proc_purchase_orders;
CREATE TRIGGER trg_proc_purchase_orders_updated_at BEFORE UPDATE ON proc_purchase_orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_acc_accounts_updated_at ON acc_accounts;
CREATE TRIGGER trg_acc_accounts_updated_at BEFORE UPDATE ON acc_accounts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_acc_invoices_updated_at ON acc_invoices;
CREATE TRIGGER trg_acc_invoices_updated_at BEFORE UPDATE ON acc_invoices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_sys_approvals_updated_at ON sys_approvals;
CREATE TRIGGER trg_sys_approvals_updated_at BEFORE UPDATE ON sys_approvals FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- versions
DROP TRIGGER IF EXISTS trg_epc_projects_version ON epc_projects;
CREATE TRIGGER trg_epc_projects_version BEFORE UPDATE ON epc_projects FOR EACH ROW EXECUTE FUNCTION fn_increment_version();

DROP TRIGGER IF EXISTS trg_proc_purchase_orders_version ON proc_purchase_orders;
CREATE TRIGGER trg_proc_purchase_orders_version BEFORE UPDATE ON proc_purchase_orders FOR EACH ROW EXECUTE FUNCTION fn_increment_version();
