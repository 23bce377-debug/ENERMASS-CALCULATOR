-- Migration: 0012_gst_reporting
-- Description: Add GST reporting fields to invoices and vendor payments, and invoice auto-sequencing

-- 1. acc_invoices alterations
ALTER TABLE public.acc_invoices ADD COLUMN customer_gstin varchar(15);
ALTER TABLE public.acc_invoices ADD COLUMN customer_state_code varchar(2);
ALTER TABLE public.acc_invoices ADD COLUMN company_state_code varchar(2) DEFAULT '24';
ALTER TABLE public.acc_invoices ADD COLUMN hsn_sac_code varchar(10) DEFAULT '85414000';
ALTER TABLE public.acc_invoices ADD COLUMN supply_type varchar(20) CHECK (supply_type IN ('B2B', 'B2C_LARGE', 'B2C_SMALL'));
ALTER TABLE public.acc_invoices ADD COLUMN total_gst numeric GENERATED ALWAYS AS (COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0) + COALESCE(igst_amount, 0)) STORED;

-- 2. vendor_payments alterations (for exact ITC calculation)
ALTER TABLE public.vendor_payments ADD COLUMN taxable_amount numeric DEFAULT 0;
ALTER TABLE public.vendor_payments ADD COLUMN cgst_amount numeric DEFAULT 0;
ALTER TABLE public.vendor_payments ADD COLUMN sgst_amount numeric DEFAULT 0;
ALTER TABLE public.vendor_payments ADD COLUMN igst_amount numeric DEFAULT 0;
ALTER TABLE public.vendor_payments ADD COLUMN total_gst numeric GENERATED ALWAYS AS (COALESCE(cgst_amount, 0) + COALESCE(sgst_amount, 0) + COALESCE(igst_amount, 0)) STORED;

-- 3. Sequence tracking table
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    financial_year text PRIMARY KEY,
    last_sequence integer NOT NULL DEFAULT 0
);

-- Enable RLS for sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all authenticated users" ON public.invoice_sequences AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.invoice_sequences AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for authenticated users" ON public.invoice_sequences AS PERMISSIVE FOR UPDATE TO authenticated USING (true);

-- 4. Function to generate sequential invoice numbers safely
CREATE OR REPLACE FUNCTION generate_invoice_number(fy text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_seq integer;
    seq_str text;
BEGIN
    -- Ensure the row exists and lock it
    INSERT INTO public.invoice_sequences (financial_year, last_sequence)
    VALUES (fy, 0)
    ON CONFLICT (financial_year) DO NOTHING;
    
    -- Increment and return
    UPDATE public.invoice_sequences
    SET last_sequence = last_sequence + 1
    WHERE financial_year = fy
    RETURNING last_sequence INTO next_seq;
    
    -- Pad with zeros (e.g. 001, 047)
    seq_str := lpad(next_seq::text, 3, '0');
    
    RETURN 'ENM/' || fy || '/' || seq_str;
END;
$$;
