-- Migration: 0008_quote_validation_state.sql

ALTER TABLE public.quotes ADD COLUMN validation_acknowledged jsonb DEFAULT '[]'::jsonb;
