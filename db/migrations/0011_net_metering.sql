-- Migration: 0011_net_metering
-- Description: Creates the net_metering_applications table to track DISCOM stages post-installation

DO $$ BEGIN
    CREATE TYPE net_metering_stage AS ENUM ('feasibility', 'registration', 'inspection', 'meter_change', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.net_metering_applications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.epc_projects(id) ON DELETE CASCADE,
    discom_name text NOT NULL,
    consumer_number text NOT NULL,
    current_stage net_metering_stage NOT NULL DEFAULT 'feasibility'::net_metering_stage,
    application_date date,
    registration_number text,
    inspection_date date,
    net_meter_serial text,
    commissioning_cert_url text,
    document_urls jsonb DEFAULT '{}'::jsonb,
    estimated_completion_date date,
    notes text,
    last_updated_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.net_metering_applications ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming similar to epc_projects)
CREATE POLICY "Enable read access for all authenticated users" ON public.net_metering_applications
    AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.net_metering_applications
    AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.net_metering_applications
    AS PERMISSIVE FOR UPDATE TO authenticated USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_net_metering_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_net_metering_applications_updated_at
    BEFORE UPDATE ON public.net_metering_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_net_metering_applications_updated_at();
