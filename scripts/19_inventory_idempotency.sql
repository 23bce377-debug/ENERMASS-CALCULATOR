-- ============================================================
-- MIGRATION 19: Inventory Idempotency Guards
-- Prevents double-GRN (idempotency failure P0-5)
-- ============================================================

BEGIN;

-- Add idempotency key to acquisition_items to prevent duplicate GRNs
ALTER TABLE inventory_ledger 
  ADD COLUMN IF NOT EXISTS acquisition_item_id UUID REFERENCES acquisition_items(id) ON DELETE SET NULL;

-- Unique constraint: one ledger entry per acquisition_item (prevents double-click GRN)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_acquisition_item 
  ON inventory_ledger(acquisition_item_id) 
  WHERE acquisition_item_id IS NOT NULL AND qty_change > 0;

-- Add processed_at for traceability
ALTER TABLE inventory_ledger 
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NOW();

-- Add idempotency_key column for external tracking
ALTER TABLE acquisitions
  ADD COLUMN IF NOT EXISTS grn_processed BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
