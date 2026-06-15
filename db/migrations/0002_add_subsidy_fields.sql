-- Add new PM Surya Ghar subsidy fields to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subsidy_breakdown TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subsidy_eligible BOOLEAN DEFAULT false;
