-- Migration: 0005_crm_site_surveys
-- Adds CRM-linked site survey table (pre-quote, attached to leads)
-- and a lead_id FK on quotes so the gate can look up the survey.

-- 1. New crm_site_surveys table
CREATE TABLE IF NOT EXISTS crm_site_surveys (
  id                           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                       UUID NOT NULL,
  lead_id                      UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  quote_id                     UUID REFERENCES quotes(id) ON DELETE SET NULL,
  conducted_by                 UUID REFERENCES profiles(id),
  conducted_at                 TIMESTAMPTZ,
  status                       TEXT NOT NULL DEFAULT 'scheduled'
                                 CHECK (status IN ('scheduled','in_progress','completed','waived')),

  -- Physical measurements
  roof_area_sqft               NUMERIC(10,2),
  roof_type                    TEXT,
  roof_height_ft               NUMERIC(8,2),
  shadowing_notes              TEXT,

  -- Electrical measurements
  existing_load_kw             NUMERIC(8,3),
  sanctioned_load_kw           NUMERIC(8,3),
  meter_phase                  TEXT CHECK (meter_phase IN ('single','three')),
  distance_inverter_to_meter_m NUMERIC(8,2),
  distance_panel_to_inverter_m NUMERIC(8,2),

  -- DISCOM info
  discom_name                  TEXT,
  consumer_number              TEXT,
  net_metering_available       BOOLEAN DEFAULT false,

  -- Evidence
  photo_urls                   JSONB DEFAULT '[]',
  survey_notes                 TEXT,

  -- Manager waiver
  waived_by                    UUID REFERENCES profiles(id),
  waive_reason                 TEXT,

  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add lead_id FK to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_leads(id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_crm_site_surveys_lead_id  ON crm_site_surveys(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_site_surveys_quote_id ON crm_site_surveys(quote_id);
CREATE INDEX IF NOT EXISTS idx_crm_site_surveys_org_id   ON crm_site_surveys(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id            ON quotes(lead_id);
