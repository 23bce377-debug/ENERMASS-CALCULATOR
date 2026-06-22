-- Add key_version column to activation_keys to support versioned key rotation
BEGIN;

ALTER TABLE public.activation_keys
  ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;

COMMIT;
