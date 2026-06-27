-- Migration: Simplify licensing and login
-- Adds max_uses to activation_keys and drops single active device restriction.

BEGIN;

ALTER TABLE public.activation_keys ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 5;

DROP INDEX IF EXISTS public.user_devices_one_active_per_user_idx;

COMMIT;
