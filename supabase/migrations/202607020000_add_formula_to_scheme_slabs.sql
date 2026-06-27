-- Migration: Add formula to scheme_slabs
-- Adds formula column (text) to store dynamic subsidy calculations.

BEGIN;

ALTER TABLE public.scheme_slabs ADD COLUMN IF NOT EXISTS formula TEXT;

COMMIT;
