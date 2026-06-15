-- Migration 0006: Quote Versioning & Survey Link

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES quotes(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS survey_id UUID REFERENCES crm_site_surveys(id);

CREATE INDEX IF NOT EXISTS idx_quotes_parent_id ON quotes(parent_quote_id);
