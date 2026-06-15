ALTER TABLE quotes ADD COLUMN IF NOT EXISTS civil_applicable BOOLEAN DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS logistics_cost_estimated NUMERIC(10,2) DEFAULT 0;

ALTER TYPE milestone_type ADD VALUE IF NOT EXISTS 'concrete_curing';
