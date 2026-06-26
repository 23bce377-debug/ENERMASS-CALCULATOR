-- Migration: Add missing simplified statuses to epc_project_status enum
-- Description: Adds in_progress, on_hold, and completed to epc_project_status enum

ALTER TYPE public.epc_project_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.epc_project_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE public.epc_project_status ADD VALUE IF NOT EXISTS 'completed';
