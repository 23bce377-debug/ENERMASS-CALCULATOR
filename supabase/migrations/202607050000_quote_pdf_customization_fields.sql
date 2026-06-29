-- Migration: Quote PDF customization persistence
-- Adds the columns written by the quote generation UI so quote save/PDF flows
-- do not fail on environments created from the older base schema.

BEGIN;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS company_cin TEXT,
  ADD COLUMN IF NOT EXISTS company_gstin TEXT,
  ADD COLUMN IF NOT EXISTS company_pan TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_website TEXT,
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS ceo_name TEXT,
  ADD COLUMN IF NOT EXISTS ceo_designation TEXT,
  ADD COLUMN IF NOT EXISTS ceo_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS sales_exec_role TEXT,
  ADD COLUMN IF NOT EXISTS sales_exec_phone TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS bank_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS terms_json JSONB,
  ADD COLUMN IF NOT EXISTS why_solar_json JSONB;

COMMIT;
