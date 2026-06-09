-- ============================================================
-- ENERMASS Solar Calculator — Migration: Master Data Versioning & Audit
-- ============================================================

-- Create master_data_imports to track batch-level metadata
CREATE TABLE IF NOT EXISTS master_data_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    source_file TEXT NOT NULL,
    status TEXT NOT NULL, -- 'dry_run', 'completed', 'failed'
    summary JSONB -- { rows_imported: X, rows_updated: Y, rows_rejected: Z }
);

-- Create master_data_changes_log to capture audit trails of imports
CREATE TABLE IF NOT EXISTS master_data_changes_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL, -- 'eq_panels', 'eq_inverters', etc.
    entity_id UUID NOT NULL,
    change_type TEXT NOT NULL, -- 'inserted', 'updated', 'deleted'
    old_values JSONB,
    new_values JSONB,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create pricing_reference table
CREATE TABLE IF NOT EXISTS pricing_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capacity_kw NUMERIC(8,3) NOT NULL,
    panels INTEGER NOT NULL,
    inverter_kw NUMERIC(8,3),
    type TEXT NOT NULL, -- 'premium' | 'standard'
    beneficiary_contribution NUMERIC(12,2) NOT NULL,
    subsidy NUMERIC(12,2),
    system_price NUMERIC(12,2) NOT NULL,
    import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL,
    source_file TEXT,
    sheet_name TEXT,
    row_number INTEGER,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_pricing_ref UNIQUE (capacity_kw, type)
);

-- Add metadata columns to existing tables
DO $$
BEGIN
    -- eq_panels
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_panels ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_inverters
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_inverters ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_batteries
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_batteries ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_meters
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_meters ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_lightning_arresters
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_lightning_arresters ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_mounting_structures
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_mounting_structures ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- structure_weight_lookup
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE structure_weight_lookup ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_bom_items
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_bom_items ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- eq_communication_devices
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE eq_communication_devices ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- systems
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE systems ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- system_items
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES master_data_imports(id) ON DELETE SET NULL;
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS sheet_name TEXT;
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS row_number INTEGER;
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
    ALTER TABLE system_items ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

END $$;
