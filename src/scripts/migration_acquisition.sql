-- ============================================================
-- ENERMASS SOLAR CALCULATOR — ACQUISITION & EARNINGS MODULE
-- ============================================================

-- ─── ENUMS ──────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE acquisition_status AS ENUM ('pending', 'received', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── VENDORS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    contact_person TEXT,
    email          TEXT,
    phone          TEXT,
    gst_number     TEXT,
    address        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(org_id);

-- ─── ACQUISITIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acquisitions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    vendor_id      UUID REFERENCES vendors(id) ON DELETE SET NULL,
    invoice_number TEXT,
    invoice_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status         acquisition_status NOT NULL DEFAULT 'pending',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acquisitions_org ON acquisitions(org_id);
CREATE INDEX IF NOT EXISTS idx_acquisitions_vendor ON acquisitions(vendor_id);

-- ─── ACQUISITION ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS acquisition_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acquisition_id UUID NOT NULL REFERENCES acquisitions(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    category       bom_section, -- Reusing existing enum from schema.sql
    qty            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit           TEXT DEFAULT 'Nos',
    rate_per_unit  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gst_pct        NUMERIC(5, 4) DEFAULT 0.18,
    -- total_amount = qty * rate_per_unit * (1 + gst_pct)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acq_items_parent ON acquisition_items(acquisition_id);

-- ─── INVENTORY LEDGER ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    category         bom_section,
    change_qty       NUMERIC(12, 2) NOT NULL, -- positive for buy, negative for sell
    transaction_type TEXT NOT NULL, -- 'purchase', 'sale', 'adjustment', 'return'
    reference_id     UUID, -- points to acquisition_id or quote_id
    rate_at_time     NUMERIC(15, 2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_ledger_org_item ON inventory_ledger(org_id, item_description);

-- ─── INVENTORY SUMMARY ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_summary (
    org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    item_description   TEXT NOT NULL,
    category           bom_section,
    current_qty        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    weighted_avg_cost  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    last_updated       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, item_description)
);

-- ─── TRIGGERS FOR INVENTORY UPDATES ─────────────────────────

-- Function to update summary when ledger changes
CREATE OR REPLACE FUNCTION update_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventory_summary (org_id, item_description, category, current_qty, weighted_avg_cost, last_updated)
    VALUES (NEW.org_id, NEW.item_description, NEW.category, NEW.change_qty, COALESCE(NEW.rate_at_time, 0), NOW())
    ON CONFLICT (org_id, item_description) DO UPDATE SET
        -- New WAC = ((Old Qty * Old WAC) + (New Qty * New Rate)) / (Old Qty + New Qty)
        -- Only update WAC if it's a purchase (positive change)
        weighted_avg_cost = CASE 
            WHEN NEW.change_qty > 0 AND (inventory_summary.current_qty + NEW.change_qty) > 0 THEN
                ((inventory_summary.current_qty * inventory_summary.weighted_avg_cost) + (NEW.change_qty * NEW.rate_at_time)) / (inventory_summary.current_qty + NEW.change_qty)
            ELSE inventory_summary.weighted_avg_cost
        END,
        current_qty = inventory_summary.current_qty + NEW.change_qty,
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_inventory_summary ON inventory_ledger;
CREATE OR REPLACE TRIGGER trg_update_inventory_summary
AFTER INSERT ON inventory_ledger
FOR EACH ROW EXECUTE FUNCTION update_inventory_summary();

-- ============================================================
-- HARDENING & SECURITY UPGRADES
-- ============================================================

-- ─── 1. REDEFINE auth_org_id TO BYPASS JWT CHICKEN-AND-EGG GAP ───
-- Reads from profiles table dynamically as SECURITY DEFINER
CREATE OR REPLACE FUNCTION auth_org_id() 
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid();
$$;

-- ─── 2. ATOMIC TRANSACTION: MARK AS RECEIVED ───
CREATE OR REPLACE FUNCTION mark_acquisition_as_received(
    p_acquisition_id UUID,
    p_org_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_status acquisition_status;
    v_item RECORD;
BEGIN
    -- Verify ownership
    SELECT status INTO v_status FROM acquisitions WHERE id = p_acquisition_id AND org_id = p_org_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Unauthorized'); END IF;
    IF v_status = 'received' THEN RETURN jsonb_build_object('error', 'Already processed'); END IF;

    -- Update state
    UPDATE acquisitions SET status = 'received', updated_at = NOW() WHERE id = p_acquisition_id;

    -- Update stock ledger (triggers inventory_summary update)
    FOR v_item IN (SELECT item_description, category, qty, rate_per_unit FROM acquisition_items WHERE acquisition_id = p_acquisition_id)
    LOOP
        INSERT INTO inventory_ledger (org_id, item_description, category, change_qty, transaction_type, reference_id, rate_at_time)
        VALUES (p_org_id, v_item.item_description, v_item.category, v_item.qty, 'purchase', p_acquisition_id, v_item.rate_per_unit);
    END LOOP;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 3. SECURITY: ENABLE ROW LEVEL SECURITY ───
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_summary ENABLE ROW LEVEL SECURITY;

-- ─── 4. SECURITY: DEFINE RLS POLICIES ───
DROP POLICY IF EXISTS "vendors_org_isolation" ON vendors;
CREATE POLICY "vendors_org_isolation" ON vendors 
  FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "acquisitions_org_isolation" ON acquisitions;
CREATE POLICY "acquisitions_org_isolation" ON acquisitions 
  FOR ALL USING (org_id = auth_org_id());

-- acquisition_items has no org_id, must resolve via parent acquisition
DROP POLICY IF EXISTS "acquisitions_items_via_parent" ON acquisition_items;
CREATE POLICY "acquisitions_items_via_parent" ON acquisition_items 
  FOR ALL USING (acquisition_id IN (SELECT id FROM acquisitions WHERE org_id = auth_org_id()));

DROP POLICY IF EXISTS "inventory_ledger_org_isolation" ON inventory_ledger;
CREATE POLICY "inventory_ledger_org_isolation" ON inventory_ledger 
  FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "inventory_summary_org_isolation" ON inventory_summary;
CREATE POLICY "inventory_summary_org_isolation" ON inventory_summary 
  FOR ALL USING (org_id = auth_org_id());

