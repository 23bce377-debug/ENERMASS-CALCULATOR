-- ============================================================
-- MIGRATION 22: Vendor Retention Tracking (P0-8)
-- Tracks 5% retention withheld until commissioning
-- ============================================================

BEGIN;

-- Add retention tracking to vendor_payments
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS retention_pct NUMERIC(5,4) NOT NULL DEFAULT 0.0500,
  ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_released BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retention_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_release_notes TEXT;

-- Trigger to auto-compute retention_amount on insert/update
CREATE OR REPLACE FUNCTION fn_compute_retention()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.retention_amount := NEW.amount * NEW.retention_pct;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_retention ON vendor_payments;
CREATE TRIGGER trg_compute_retention
  BEFORE INSERT OR UPDATE ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION fn_compute_retention();

COMMIT;
