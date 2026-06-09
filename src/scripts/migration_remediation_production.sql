-- ==============================================================================
-- ENERMASS SOLAR EPC ERP — PRODUCTION-GRADE REMEDIATION & STABILITY MIGRATION
-- Architecture: Supabase PostgreSQL
-- Focus: Referential Integrity, Concurrency, Stock Reservation, Hardened RLS,
--        Materialized Views, and Database-Level Concurrency Guards
-- ==============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. UNIFIED CATALOG ITEMS ABSTRACTION (Phase 2: Referential Integrity)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID REFERENCES organisations(id) ON DELETE CASCADE, -- NULL = global master
    name        TEXT NOT NULL,
    category    bom_section NOT NULL,
    item_type   TEXT NOT NULL, -- 'panel', 'inverter', 'battery', 'meter', 'la', 'structure', 'bom_item', 'comm_device', 'custom'
    item_id     UUID, -- source equipment id
    sku         TEXT,
    unit        TEXT NOT NULL DEFAULT 'Nos',
    gst_pct     NUMERIC(5, 4) NOT NULL DEFAULT 0.18,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_catalog_item UNIQUE (item_type, item_id)
);

-- Index for multi-tenant and type-based lookups
CREATE INDEX IF NOT EXISTS idx_catalog_items_org ON catalog_items(org_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_type ON catalog_items(item_type, item_id);

-- Triggers to automatically sync master equipment tables with the catalog_items table
CREATE OR REPLACE FUNCTION fn_sync_panel_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'panel' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'panel' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.brand || ' ' || NEW.model || ' (' || NEW.wattage_w || 'W)', 'solar_panels', 'panel', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_panel_to_catalog ON eq_panels;
CREATE TRIGGER trg_sync_panel_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_panels
FOR EACH ROW EXECUTE FUNCTION fn_sync_panel_to_catalog();

-- Sync Inverter
CREATE OR REPLACE FUNCTION fn_sync_inverter_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'inverter' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'inverter' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.brand || ' ' || NEW.model || ' (' || NEW.capacity_kw || 'kW)', 'power_electronics', 'inverter', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inverter_to_catalog ON eq_inverters;
CREATE TRIGGER trg_sync_inverter_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_inverters
FOR EACH ROW EXECUTE FUNCTION fn_sync_inverter_to_catalog();

-- Sync Battery
CREATE OR REPLACE FUNCTION fn_sync_battery_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'battery' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'battery' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.brand || ' ' || NEW.model || ' (' || NEW.capacity_kwh || 'kWh)', 'power_electronics', 'battery', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_battery_to_catalog ON eq_batteries;
CREATE TRIGGER trg_sync_battery_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_batteries
FOR EACH ROW EXECUTE FUNCTION fn_sync_battery_to_catalog();

-- Sync Meter
CREATE OR REPLACE FUNCTION fn_sync_meter_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'meter' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'meter' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, COALESCE(NEW.brand, '') || ' ' || NEW.model || ' (' || NEW.meter_type || ')', 'metering', 'meter', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_meter_to_catalog ON eq_meters;
CREATE TRIGGER trg_sync_meter_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_meters
FOR EACH ROW EXECUTE FUNCTION fn_sync_meter_to_catalog();

-- Sync Lightning Arrester
CREATE OR REPLACE FUNCTION fn_sync_la_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'la' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'la' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, COALESCE(NEW.brand, '') || ' ' || NEW.model || ' (' || NEW.la_type || ')', 'electrical_protection', 'la', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_la_to_catalog ON eq_lightning_arresters;
CREATE TRIGGER trg_sync_la_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_lightning_arresters
FOR EACH ROW EXECUTE FUNCTION fn_sync_la_to_catalog();

-- Sync Mounting Structure
CREATE OR REPLACE FUNCTION fn_sync_structure_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'structure' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'structure' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.name || ' (' || NEW.material || ', ' || NEW.roof_mount_type || ')', 'mounting_structure', 'structure', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_structure_to_catalog ON eq_mounting_structures;
CREATE TRIGGER trg_sync_structure_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_mounting_structures
FOR EACH ROW EXECUTE FUNCTION fn_sync_structure_to_catalog();

-- Sync BOM Item
CREATE OR REPLACE FUNCTION fn_sync_bom_item_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'bom_item' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'bom_item' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.description || ' (' || NEW.sub_type || ')', NEW.section, 'bom_item', NEW.id, NEW.unit, NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bom_item_to_catalog ON eq_bom_items;
CREATE TRIGGER trg_sync_bom_item_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_bom_items
FOR EACH ROW EXECUTE FUNCTION fn_sync_bom_item_to_catalog();

-- Sync Comm Device
CREATE OR REPLACE FUNCTION fn_sync_comm_device_to_catalog()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM catalog_items WHERE item_type = 'comm_device' AND item_id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active = FALSE THEN
    DELETE FROM catalog_items WHERE item_type = 'comm_device' AND item_id = NEW.id;
    RETURN NEW;
  ELSE
    INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
    VALUES (NEW.org_id, NEW.brand || ' ' || NEW.model || ' (Comm Device)', 'power_electronics', 'comm_device', NEW.id, 'Nos', NEW.gst_pct)
    ON CONFLICT (item_type, item_id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      name = EXCLUDED.name,
      gst_pct = EXCLUDED.gst_pct,
      updated_at = NOW();
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_comm_device_to_catalog ON eq_communication_devices;
CREATE TRIGGER trg_sync_comm_device_to_catalog
AFTER INSERT OR UPDATE OR DELETE ON eq_communication_devices
FOR EACH ROW EXECUTE FUNCTION fn_sync_comm_device_to_catalog();

-- Bootstrap catalog from existing master records
INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, brand || ' ' || model || ' (' || wattage_w || 'W)', 'solar_panels', 'panel', id, 'Nos', gst_pct FROM eq_panels ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, brand || ' ' || model || ' (' || capacity_kw || 'kW)', 'power_electronics', 'inverter', id, 'Nos', gst_pct FROM eq_inverters ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, brand || ' ' || model || ' (' || capacity_kwh || 'kWh)', 'power_electronics', 'battery', id, 'Nos', gst_pct FROM eq_batteries ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, COALESCE(brand, '') || ' ' || model || ' (' || meter_type || ')', 'metering', 'meter', id, 'Nos', gst_pct FROM eq_meters ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, COALESCE(brand, '') || ' ' || model || ' (' || la_type || ')', 'electrical_protection', 'la', id, 'Nos', gst_pct FROM eq_lightning_arresters ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, name || ' (' || material || ', ' || roof_mount_type || ')', 'mounting_structure', 'structure', id, 'Nos', gst_pct FROM eq_mounting_structures ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, description || ' (' || sub_type || ')', section, 'bom_item', id, unit, gst_pct FROM eq_bom_items ON CONFLICT DO NOTHING;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT org_id, brand || ' ' || model || ' (Comm Device)', 'power_electronics', 'comm_device', id, 'Nos', gst_pct FROM eq_communication_devices ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. ALTER TRANSACTION TABLES TO USE catalog_items (Phase 2 & Phase 1 Audit)
-- ──────────────────────────────────────────────────────────────────────────────

-- 2.1 acquisition_items
ALTER TABLE acquisition_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;

-- Back-populate custom catalog items for free-text description mismatches
INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT DISTINCT ON (a.org_id, ai.item_description) 
  a.org_id, ai.item_description, COALESCE(ai.category, 'solar_panels'), 'custom', NULL, COALESCE(ai.unit, 'Nos'), COALESCE(ai.gst_pct, 0.18)
FROM acquisition_items ai
JOIN acquisitions a ON ai.acquisition_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci 
  WHERE ci.name = ai.item_description AND (ci.org_id = a.org_id OR ci.org_id IS NULL)
) ON CONFLICT DO NOTHING;

UPDATE acquisition_items ai
SET catalog_item_id = ci.id
FROM catalog_items ci, acquisitions a
WHERE ai.acquisition_id = a.id
  AND ci.name = ai.item_description 
  AND (ci.org_id = a.org_id OR ci.org_id IS NULL)
  AND ai.catalog_item_id IS NULL;

-- 2.2 bundle_preset_items
ALTER TABLE bundle_preset_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT DISTINCT ON (bp.org_id, bpi.item_description) 
  bp.org_id, bpi.item_description, bpi.category, 'custom', NULL, COALESCE(bpi.unit, 'Nos'), COALESCE(bpi.gst_pct, 0.18)
FROM bundle_preset_items bpi
JOIN bundle_presets bp ON bpi.bundle_preset_id = bp.id
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci 
  WHERE ci.name = bpi.item_description AND (ci.org_id = bp.org_id OR ci.org_id IS NULL)
) ON CONFLICT DO NOTHING;

UPDATE bundle_preset_items bpi
SET catalog_item_id = ci.id
FROM bundle_presets bp, catalog_items ci
WHERE bpi.bundle_preset_id = bp.id 
  AND ci.name = bpi.item_description 
  AND (ci.org_id = bp.org_id OR ci.org_id IS NULL)
  AND bpi.catalog_item_id IS NULL;

-- 2.3 inventory_ledger
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT DISTINCT ON (il.org_id, il.item_description) 
  il.org_id, il.item_description, COALESCE(il.category, 'solar_panels'), 'custom', NULL, 'Nos', 0.18
FROM inventory_ledger il
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci 
  WHERE ci.name = il.item_description AND (ci.org_id = il.org_id OR ci.org_id IS NULL)
) ON CONFLICT DO NOTHING;

UPDATE inventory_ledger il
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.name = il.item_description AND (ci.org_id = il.org_id OR ci.org_id IS NULL)
  AND il.catalog_item_id IS NULL;

-- 2.4 inventory_summary
ALTER TABLE inventory_summary ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;

INSERT INTO catalog_items (org_id, name, category, item_type, item_id, unit, gst_pct)
SELECT DISTINCT ON (isum.org_id, isum.item_description) 
  isum.org_id, isum.item_description, COALESCE(isum.category, 'solar_panels'), 'custom', NULL, 'Nos', 0.18
FROM inventory_summary isum
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items ci 
  WHERE ci.name = isum.item_description AND (ci.org_id = isum.org_id OR ci.org_id IS NULL)
) ON CONFLICT DO NOTHING;

UPDATE inventory_summary isum
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.name = isum.item_description AND (ci.org_id = isum.org_id OR ci.org_id IS NULL)
  AND isum.catalog_item_id IS NULL;

-- Drop text-based indexes and recreate with catalog_item_id keys
ALTER TABLE inventory_summary DROP CONSTRAINT IF EXISTS inventory_summary_pkey;
ALTER TABLE inventory_summary ADD CONSTRAINT inventory_summary_pkey PRIMARY KEY (org_id, catalog_item_id);

-- Polymorphic table migrations (inv_stock_balances, inv_serialized_items, inv_stock_transactions, etc.)
-- Migrate from item_type + item_id to catalog_item_id reference
ALTER TABLE inv_stock_balances ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE inv_stock_balances sb
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = sb.item_type AND ci.item_id = sb.item_id
  AND sb.catalog_item_id IS NULL;

ALTER TABLE inv_serialized_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE inv_serialized_items si
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = si.item_type AND ci.item_id = si.item_id
  AND si.catalog_item_id IS NULL;

ALTER TABLE inv_stock_transactions ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE inv_stock_transactions st
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = st.item_type AND ci.item_id = st.item_id
  AND st.catalog_item_id IS NULL;

ALTER TABLE proc_rfq_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE proc_rfq_items ri
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = ri.item_type AND ci.item_id = ri.item_id
  AND ri.catalog_item_id IS NULL;

ALTER TABLE proc_po_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE proc_po_items pi
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = pi.item_type AND ci.item_id = pi.item_id
  AND pi.catalog_item_id IS NULL;

ALTER TABLE proc_grn_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE proc_grn_items gi
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = gi.item_type AND ci.item_id = gi.item_id
  AND gi.catalog_item_id IS NULL;

ALTER TABLE inv_transfer_items ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES catalog_items(id) ON DELETE RESTRICT;
UPDATE inv_transfer_items ti
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.item_type = ti.item_type AND ci.item_id = ti.item_id
  AND ti.catalog_item_id IS NULL;


-- Set catalog_item_id NOT NULL constraints where appropriate
ALTER TABLE acquisition_items ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE bundle_preset_items ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE inventory_ledger ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE inventory_summary ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE inv_stock_balances ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE inv_stock_transactions ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE proc_po_items ALTER COLUMN catalog_item_id SET NOT NULL;
ALTER TABLE proc_grn_items ALTER COLUMN catalog_item_id SET NOT NULL;

-- Make old polymorphic columns nullable
ALTER TABLE inv_stock_balances ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE inv_serialized_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE inv_stock_transactions ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE proc_rfq_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE proc_po_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE proc_grn_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE inv_transfer_items ALTER COLUMN item_type DROP NOT NULL, ALTER COLUMN item_id DROP NOT NULL;


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. UNIQUE, FOREIGN KEY, AND INDEX ENFORCEMENTS (Phase 1 Database Audit)
-- ──────────────────────────────────────────────────────────────────────────────

-- Prevents duplicate vendor invoices per tenant to enforce finance integrity
ALTER TABLE acquisitions DROP CONSTRAINT IF EXISTS uq_acq_vendor_invoice;
ALTER TABLE acquisitions ADD CONSTRAINT uq_acq_vendor_invoice UNIQUE (org_id, vendor_id, invoice_number);

-- Prevents duplicate bundle names per tenant
ALTER TABLE bundle_presets DROP CONSTRAINT IF EXISTS uq_bundle_preset_name;
ALTER TABLE bundle_presets ADD CONSTRAINT uq_bundle_preset_name UNIQUE (org_id, name);

-- Unique constraint on warehouse stock balances per catalog_item_id
ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS uq_warehouse_catalog_balance;
ALTER TABLE inv_stock_balances ADD CONSTRAINT uq_warehouse_catalog_balance UNIQUE (warehouse_id, catalog_item_id);

-- Check constraints for positive inventory balances
ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS ck_qty_on_hand_positive;
ALTER TABLE inv_stock_balances ADD CONSTRAINT ck_qty_on_hand_positive CHECK (qty_on_hand >= 0);

ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS ck_qty_reserved_positive;
ALTER TABLE inv_stock_balances ADD CONSTRAINT ck_qty_reserved_positive CHECK (qty_reserved >= 0);

ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS ck_qty_damaged_positive;
ALTER TABLE inv_stock_balances ADD CONSTRAINT ck_qty_damaged_positive CHECK (qty_damaged >= 0);

-- Limit reservations to actual on hand stock
ALTER TABLE inv_stock_balances DROP CONSTRAINT IF EXISTS ck_qty_reservation_limit;
ALTER TABLE inv_stock_balances ADD CONSTRAINT ck_qty_reservation_limit CHECK (qty_on_hand >= qty_reserved);

-- Indexing for multi-tenant and foreign keys
CREATE INDEX IF NOT EXISTS idx_state_scheme_overrides_state ON state_scheme_overrides(state_id);
CREATE INDEX IF NOT EXISTS idx_state_scheme_overrides_scheme ON state_scheme_overrides(scheme_id);
CREATE INDEX IF NOT EXISTS idx_eq_panels_org ON eq_panels(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_inverters_org ON eq_inverters(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_batteries_org ON eq_batteries(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_meters_org ON eq_meters(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_la_org ON eq_lightning_arresters(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_structures_org ON eq_mounting_structures(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_bom_items_org ON eq_bom_items(org_id);
CREATE INDEX IF NOT EXISTS idx_eq_comm_devices_org ON eq_communication_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_state_id ON quotes(state_id);
CREATE INDEX IF NOT EXISTS idx_quotes_scheme_id ON quotes(subsidy_scheme_id);
CREATE INDEX IF NOT EXISTS idx_quotes_structure_id ON quotes(structure_id);
CREATE INDEX IF NOT EXISTS idx_quotes_solar_meter_id ON quotes(solar_meter_id);
CREATE INDEX IF NOT EXISTS idx_quotes_net_meter_id ON quotes(net_meter_id);
CREATE INDEX IF NOT EXISTS idx_quotes_la_id ON quotes(la_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_state_id ON app_settings(default_state_id);
CREATE INDEX IF NOT EXISTS idx_balances_catalog ON inv_stock_balances(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_serialized_catalog ON inv_serialized_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_wh ON inv_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_wh ON inv_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_catalog ON inv_transfer_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_org ON inv_stock_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_trans_catalog ON inv_stock_transactions(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_catalog ON proc_rfq_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bids_vendor ON proc_vendor_bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_items_catalog ON proc_po_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_grn_wh ON proc_goods_receipt_notes(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_catalog ON proc_grn_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON acc_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON acc_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON acc_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_po ON acc_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_invoice ON acc_adjustments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_po ON acc_adjustments(po_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_payment ON acc_bank_statement_lines(payment_id);
CREATE INDEX IF NOT EXISTS idx_sys_approvals_requested_by ON sys_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_sys_approvals_approved_by ON sys_approvals(approved_by);
CREATE INDEX IF NOT EXISTS idx_sys_notifications_org ON sys_notifications(org_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. CONCURRENCY COUNTERS & NUMBER GENERATORS (Phase 3 Concurrency Audit)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE organisations 
  ADD COLUMN IF NOT EXISTS po_counter INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS grn_counter INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS invoice_counter INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS transfer_counter INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS work_order_counter INTEGER NOT NULL DEFAULT 1000;

-- Atomic PO sequence generator
CREATE OR REPLACE FUNCTION fn_generate_po_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_year TEXT;
BEGIN
  UPDATE organisations
  SET po_counter = po_counter + 1
  WHERE id = p_org_id
  RETURNING quote_prefix, po_counter INTO v_prefix, v_counter;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN 'PO-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic GRN sequence generator
CREATE OR REPLACE FUNCTION fn_generate_grn_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_year TEXT;
BEGIN
  UPDATE organisations
  SET grn_counter = grn_counter + 1
  WHERE id = p_org_id
  RETURNING quote_prefix, grn_counter INTO v_prefix, v_counter;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN 'GRN-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Invoice sequence generator
CREATE OR REPLACE FUNCTION fn_generate_invoice_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_year TEXT;
BEGIN
  UPDATE organisations
  SET invoice_counter = invoice_counter + 1
  WHERE id = p_org_id
  RETURNING quote_prefix, invoice_counter INTO v_prefix, v_counter;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN 'INV-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Transfer sequence generator
CREATE OR REPLACE FUNCTION fn_generate_transfer_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_year TEXT;
BEGIN
  UPDATE organisations
  SET transfer_counter = transfer_counter + 1
  WHERE id = p_org_id
  RETURNING quote_prefix, transfer_counter INTO v_prefix, v_counter;

  v_year := TO_CHAR(NOW(), 'YYYY');
  RETURN 'TRF-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. STOCK RESERVATION ENGINE WITH ROW LOCKS (Phase 4 Inventory Consistency)
-- ──────────────────────────────────────────────────────────────────────────────

-- Reserve stock for a project
CREATE OR REPLACE FUNCTION reserve_stock(
  p_org_id UUID,
  p_warehouse_id UUID,
  p_catalog_item_id UUID,
  p_qty NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance_id UUID;
  v_qty_on_hand NUMERIC;
  v_qty_reserved NUMERIC;
BEGIN
  -- Strict row locking prevents concurrent double-allocations
  SELECT id, qty_on_hand, qty_reserved INTO v_balance_id, v_qty_on_hand, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist for warehouse % and item %.', p_warehouse_id, p_catalog_item_id;
  END IF;

  -- Insufficient stock validation
  IF (v_qty_on_hand - v_qty_reserved) < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock to reserve. On Hand: %, Reserved: %, Requested: %', v_qty_on_hand, v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_reserved = qty_reserved + p_qty, updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dispatch reserved stock (deduct from total on hand and reserved)
CREATE OR REPLACE FUNCTION dispatch_reserved_stock(
  p_org_id UUID,
  p_warehouse_id UUID,
  p_catalog_item_id UUID,
  p_qty NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance_id UUID;
  v_qty_on_hand NUMERIC;
  v_qty_reserved NUMERIC;
BEGIN
  SELECT id, qty_on_hand, qty_reserved INTO v_balance_id, v_qty_on_hand, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist.';
  END IF;

  IF v_qty_reserved < p_qty THEN
    RAISE EXCEPTION 'Cannot dispatch more than reserved quantity. Reserved: %, Requested: %', v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_on_hand = qty_on_hand - p_qty,
      qty_reserved = qty_reserved - p_qty,
      updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release reservation without dispatching
CREATE OR REPLACE FUNCTION release_stock_reservation(
  p_org_id UUID,
  p_warehouse_id UUID,
  p_catalog_item_id UUID,
  p_qty NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance_id UUID;
  v_qty_reserved NUMERIC;
BEGIN
  SELECT id, qty_reserved INTO v_balance_id, v_qty_reserved
  FROM inv_stock_balances
  WHERE warehouse_id = p_warehouse_id AND catalog_item_id = p_catalog_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory balance row does not exist.';
  END IF;

  IF v_qty_reserved < p_qty THEN
    RAISE EXCEPTION 'Cannot release more than reserved quantity. Reserved: %, Requested: %', v_qty_reserved, p_qty;
  END IF;

  UPDATE inv_stock_balances
  SET qty_reserved = qty_reserved - p_qty, updated_at = NOW()
  WHERE id = v_balance_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- 6. REFACTOR INVENTORY LEDGER TRIGGERS & GRN PROCEDURES (Phases 3 & 4)
-- ──────────────────────────────────────────────────────────────────────────────

-- Recompute summary with robust catalog references
CREATE OR REPLACE FUNCTION update_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventory_summary (org_id, catalog_item_id, current_qty, weighted_avg_cost, last_updated)
    VALUES (NEW.org_id, NEW.catalog_item_id, NEW.change_qty, COALESCE(NEW.rate_at_time, 0), NOW())
    ON CONFLICT (org_id, catalog_item_id) DO UPDATE SET
        weighted_avg_cost = CASE 
            -- Reset WAC if current stock is negative or zero to prevent skew
            WHEN inventory_summary.current_qty <= 0 THEN NEW.rate_at_time
            WHEN NEW.change_qty > 0 AND (inventory_summary.current_qty + NEW.change_qty) > 0 THEN
                ((inventory_summary.current_qty * inventory_summary.weighted_avg_cost) + (NEW.change_qty * NEW.rate_at_time)) / (inventory_summary.current_qty + NEW.change_qty)
            ELSE inventory_summary.weighted_avg_cost
        END,
        current_qty = inventory_summary.current_qty + NEW.change_qty,
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Refactored Goods Receipt Note processing with Row Locking and Catalog integration
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
    -- Fetch GRN within authenticated tenant context
    SELECT * INTO v_grn 
    FROM proc_goods_receipt_notes 
    WHERE id = p_grn_id AND org_id = auth_org_id();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Goods Receipt Note not found');
    END IF;

    -- Process items with catalog references
    FOR v_item IN (SELECT catalog_item_id, qty_received FROM proc_grn_items WHERE grn_id = p_grn_id)
    LOOP
        -- Row lock current stock balance to prevent concurrency skews
        SELECT qty_on_hand, wac_price INTO v_current_qty, v_current_wac
        FROM inv_stock_balances
        WHERE warehouse_id = v_grn.warehouse_id AND catalog_item_id = v_item.catalog_item_id
        FOR UPDATE;

        -- Fetch rate and GST from corresponding PO item
        DECLARE
            v_rate NUMERIC;
            v_gst_pct NUMERIC;
        BEGIN
            SELECT unit_price, gst_pct INTO v_rate, v_gst_pct
            FROM proc_po_items 
            WHERE po_id = v_grn.po_id AND catalog_item_id = v_item.catalog_item_id
            LIMIT 1;

            v_rate := COALESCE(v_rate, 0);
            v_gst_pct := COALESCE(v_gst_pct, 18.00);

            IF v_current_qty IS NULL THEN
                -- Insert new stock entry
                INSERT INTO inv_stock_balances (warehouse_id, catalog_item_id, qty_on_hand, wac_price)
                VALUES (v_grn.warehouse_id, v_item.catalog_item_id, v_item.qty_received, v_rate);
            ELSE
                v_new_qty := v_current_qty + v_item.qty_received;
                IF v_current_qty <= 0 THEN
                    v_new_wac := v_rate;
                ELSIF v_new_qty > 0 THEN
                    v_new_wac := ((v_current_qty * v_current_wac) + (v_item.qty_received * v_rate)) / v_new_qty;
                ELSE
                    v_new_wac := v_current_wac;
                END IF;

                UPDATE inv_stock_balances
                SET qty_on_hand = v_new_qty, wac_price = v_new_wac, updated_at = NOW()
                WHERE warehouse_id = v_grn.warehouse_id AND catalog_item_id = v_item.catalog_item_id;
            END IF;

            v_line_taxable := v_item.qty_received * v_rate;
            v_line_gst := v_line_taxable * (v_gst_pct / 100);
            v_total_taxable := v_total_taxable + v_line_taxable;
            v_total_gst := v_total_gst + v_line_gst;

            -- Log transaction ledger
            INSERT INTO inv_stock_transactions (org_id, warehouse_id, catalog_item_id, transaction_type, qty, unit_cost_wac, reference_id)
            VALUES (auth_org_id(), v_grn.warehouse_id, v_item.catalog_item_id, 'receipt', v_item.qty_received, v_rate, p_grn_id);
        END;
    END LOOP;

    -- Post GL entries atomically
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


-- ──────────────────────────────────────────────────────────────────────────────
-- 7. EVENTS SYSTEM INTERFACE (Phase 10 Event System)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_trigger_publish_quote_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    INSERT INTO sys_event_bus (org_id, event_type, entity_type, entity_id, payload, triggered_by)
    VALUES (NEW.org_id, 'quote.won', 'quote', NEW.id, jsonb_build_object('quote_number', NEW.quote_number, 'price', NEW.final_customer_price), NEW.exec_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publish_quote_event ON quotes;
CREATE TRIGGER trg_publish_quote_event
AFTER UPDATE OF status ON quotes
FOR EACH ROW EXECUTE FUNCTION fn_trigger_publish_quote_event();

COMMIT;
