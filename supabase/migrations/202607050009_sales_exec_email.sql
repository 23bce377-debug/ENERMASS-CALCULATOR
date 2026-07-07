-- Migration: Quote sales executive email
-- Stores the mandatory sales contact email shown on quote PDFs.

BEGIN;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS sales_exec_email TEXT;

COMMIT;
