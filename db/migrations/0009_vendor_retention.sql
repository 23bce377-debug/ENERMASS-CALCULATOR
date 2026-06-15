-- Migration: 0009_vendor_retention.sql

CREATE TABLE public.vendor_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.epc_projects(id) NOT NULL,
    vendor_id uuid REFERENCES public.vendors(id) NOT NULL,
    invoice_number text NOT NULL,
    invoice_amount numeric NOT NULL,
    retention_percent numeric DEFAULT 10,
    retention_amount numeric GENERATED ALWAYS AS (invoice_amount * retention_percent / 100) STORED,
    retention_released_at timestamp,
    retention_release_approved_by uuid REFERENCES auth.users(id),
    status text NOT NULL DEFAULT 'pending', -- pending, paid, retention_released
    created_at timestamp DEFAULT now()
);

-- Note: The user's prompt said "ALTER TABLE vendor_payments ADD COLUMN..." but the table didn't exist.
-- I'm creating it with the required columns.
