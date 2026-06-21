-- Simplify device binding: drop web crypto key pairs and sessions, use single secret hash.

BEGIN;

-- Drop foreign keys and tables that rely on user_devices first to avoid conflicts
ALTER TABLE public.device_sessions DROP CONSTRAINT IF EXISTS device_sessions_device_id_fkey;
DROP TABLE IF EXISTS public.device_sessions;
DROP TABLE IF EXISTS public.device_challenges;

-- Truncate existing devices as they are no longer valid under the new scheme
TRUNCATE TABLE public.user_devices CASCADE;

-- Alter user_devices
ALTER TABLE public.user_devices 
  DROP COLUMN IF EXISTS public_key,
  DROP COLUMN IF EXISTS fingerprint_hash,
  DROP COLUMN IF EXISTS device_install_id;

ALTER TABLE public.user_devices 
  ADD COLUMN IF NOT EXISTS device_secret_hash text NOT NULL;

-- Update indexes
DROP INDEX IF EXISTS public.user_devices_org_install_idx;
-- one_active_per_user_idx remains valid

-- Remove related audits from license events if necessary, though it's append only.

COMMIT;
