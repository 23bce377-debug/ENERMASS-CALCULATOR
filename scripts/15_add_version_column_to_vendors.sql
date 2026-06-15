-- ============================================================
-- MIGRATION 15: Add version column to vendors table
-- ============================================================

BEGIN;

ALTER TABLE vendors 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMIT;
