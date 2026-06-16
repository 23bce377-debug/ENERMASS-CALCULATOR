-- ==============================================================================
-- PHASE 3: GST COMPLIANCE
-- Migration Date: 2026-06-16
-- Description: Creates GST master tables and HSN/SAC codes
-- ==============================================================================

-- 1. HSN/SAC Code Master
CREATE TABLE tax_hsn_sac (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    code text NOT NULL,
    description text,
    type text NOT NULL CHECK (type IN ('HSN', 'SAC')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(org_id, code)
);

-- Enable RLS
ALTER TABLE tax_hsn_sac ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_tax_hsn_sac" ON tax_hsn_sac
    FOR ALL USING (org_id = auth_org_id());

-- 2. GST Rate Master
CREATE TABLE tax_gst_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hsn_sac_id uuid NOT NULL REFERENCES tax_hsn_sac(id) ON DELETE CASCADE,
    effective_from date NOT NULL,
    effective_to date,
    cgst_rate numeric NOT NULL DEFAULT 0,
    sgst_rate numeric NOT NULL DEFAULT 0,
    igst_rate numeric NOT NULL DEFAULT 0,
    cess_rate numeric NOT NULL DEFAULT 0,
    is_reverse_charge boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Enable RLS
ALTER TABLE tax_gst_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access_tax_gst_rates" ON tax_gst_rates
    FOR ALL USING (org_id = auth_org_id());

-- 3. Modify equipment tables to link to HSN/SAC instead of relying on constants
ALTER TABLE eq_panels ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_inverters ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_batteries ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_meters ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_lightning_arresters ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_communication_devices ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_mounting_structures ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
ALTER TABLE eq_structure_components ADD COLUMN hsn_sac_id uuid REFERENCES tax_hsn_sac(id);
