-- Migration: Remove device binding and add key tracking to profiles
-- Add key_id to profiles for tracking activation keys and drop unique index on activated_by.

BEGIN;

-- 1. Add key_id to public.profiles referencing activation_keys
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS key_id uuid REFERENCES public.activation_keys(id) ON DELETE SET NULL;

-- 2. Backfill existing profiles with their key association
UPDATE public.profiles p
SET key_id = k.id
FROM public.activation_keys k
WHERE p.id = k.activated_by;

-- 3. Create index on profiles(key_id)
CREATE INDEX IF NOT EXISTS profiles_key_id_idx ON public.profiles(key_id);

-- 4. Drop the unique constraint index on activation_keys(activated_by)
-- so that a single key can be redeemed/activated by multiple users.
DROP INDEX IF EXISTS public.idx_activation_keys_activated_by;

-- 5. Recreate as a normal non-unique index for performance
CREATE INDEX IF NOT EXISTS idx_activation_keys_activated_by ON public.activation_keys(activated_by) WHERE activated_by IS NOT NULL;

-- 6. Update activation_keys check_activated_by_not_null constraint to remove device_id requirement
ALTER TABLE public.activation_keys DROP CONSTRAINT IF EXISTS check_activated_by_not_null;
ALTER TABLE public.activation_keys ADD CONSTRAINT check_activated_by_not_null CHECK (status <> 'activated' OR activated_by IS NOT NULL);

COMMIT;
