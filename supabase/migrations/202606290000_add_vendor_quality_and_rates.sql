-- Migration: Add quality_score and rates_url to vendors table
-- Description: Supports quality scoring and vendor rates reference URL in vendors master

BEGIN;

-- Add quality_score column if it doesn't exist
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS quality_score NUMERIC(4,2) DEFAULT NULL;

-- Add rates_url column if it doesn't exist
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS rates_url TEXT DEFAULT NULL;

COMMIT;
