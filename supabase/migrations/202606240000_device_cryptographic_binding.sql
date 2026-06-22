-- Add cryptographic binding columns to user_devices
ALTER TABLE public.user_devices 
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS fingerprint_hash text;
