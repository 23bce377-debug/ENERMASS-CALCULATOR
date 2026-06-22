-- Schema validation: validate previously-NOT VALID constraints, add performance indexes,
-- and enforce data integrity checks that were deferred from earlier migrations.
-- Idempotent — safe to rerun.

BEGIN;

-- ─── 1. Validate NOT VALID foreign key constraints ─────────────────────────────
-- These were added NOT VALID in migration 0008 to avoid failing on dirty data.
-- Now that data is clean (all joins tested), we validate them.

DO $$
BEGIN
  -- org_subscriptions
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_subscriptions_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.org_subscriptions VALIDATE CONSTRAINT org_subscriptions_org_id_fkey;
    RAISE NOTICE 'Validated org_subscriptions_org_id_fkey';
  END IF;

  -- org_members
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.org_members VALIDATE CONSTRAINT org_members_org_id_fkey;
    RAISE NOTICE 'Validated org_members_org_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_user_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.org_members VALIDATE CONSTRAINT org_members_user_id_fkey;
    RAISE NOTICE 'Validated org_members_user_id_fkey';
  END IF;

  -- user_devices
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.user_devices VALIDATE CONSTRAINT user_devices_org_id_fkey;
    RAISE NOTICE 'Validated user_devices_org_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_user_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.user_devices VALIDATE CONSTRAINT user_devices_user_id_fkey;
    RAISE NOTICE 'Validated user_devices_user_id_fkey';
  END IF;

  -- device_reset_requests
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.device_reset_requests VALIDATE CONSTRAINT device_reset_requests_org_id_fkey;
    RAISE NOTICE 'Validated device_reset_requests_org_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_user_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.device_reset_requests VALIDATE CONSTRAINT device_reset_requests_user_id_fkey;
    RAISE NOTICE 'Validated device_reset_requests_user_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_old_device_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.device_reset_requests VALIDATE CONSTRAINT device_reset_requests_old_device_id_fkey;
    RAISE NOTICE 'Validated device_reset_requests_old_device_id_fkey';
  END IF;

  -- subscription_payments
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.subscription_payments VALIDATE CONSTRAINT subscription_payments_org_id_fkey;
    RAISE NOTICE 'Validated subscription_payments_org_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_subscription_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.subscription_payments VALIDATE CONSTRAINT subscription_payments_subscription_id_fkey;
    RAISE NOTICE 'Validated subscription_payments_subscription_id_fkey';
  END IF;

  -- license_events
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'license_events_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.license_events VALIDATE CONSTRAINT license_events_org_id_fkey;
    RAISE NOTICE 'Validated license_events_org_id_fkey';
  END IF;

  -- activation_keys
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_org_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.activation_keys VALIDATE CONSTRAINT activation_keys_org_id_fkey;
    RAISE NOTICE 'Validated activation_keys_org_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_device_id_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.activation_keys VALIDATE CONSTRAINT activation_keys_device_id_fkey;
    RAISE NOTICE 'Validated activation_keys_device_id_fkey';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_activated_by_fkey' AND NOT convalidated) THEN
    ALTER TABLE public.activation_keys VALIDATE CONSTRAINT activation_keys_activated_by_fkey;
    RAISE NOTICE 'Validated activation_keys_activated_by_fkey';
  END IF;
END;
$$;

-- ─── 2. Ensure device_secret_hash is NOT NULL (should already be after simplify migration) ─
DO $$
BEGIN
  -- Check for any NULL device_secret_hash values (defensive)
  IF EXISTS (SELECT 1 FROM public.user_devices WHERE device_secret_hash IS NULL) THEN
    RAISE EXCEPTION 'Data integrity error: user_devices has NULL device_secret_hash rows. Fix data before continuing.';
  END IF;
  RAISE NOTICE 'user_devices.device_secret_hash integrity check passed.';
END;
$$;

-- ─── 3. Performance indexes ────────────────────────────────────────────────────

-- Fast is_superadmin() lookup: profiles(is_super_admin) for superadmin guard
CREATE INDEX IF NOT EXISTS profiles_is_super_admin_idx
  ON public.profiles(id)
  WHERE is_super_admin = true;

-- Fast password reset lookup by user + org
CREATE INDEX IF NOT EXISTS password_reset_requests_user_org_status_idx
  ON public.password_reset_requests(user_id, org_id, status);

-- Fast activation key lookup by status per org
CREATE INDEX IF NOT EXISTS activation_keys_org_status_created_idx
  ON public.activation_keys(org_id, status, created_at DESC);

-- ─── 4. Data integrity: no orphaned device_ids on activation_keys ─────────────
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.activation_keys ak
  WHERE ak.device_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_devices ud WHERE ud.id = ak.device_id
    );

  IF orphan_count > 0 THEN
    -- Nullify orphaned device_id references (FK is ON DELETE SET NULL anyway)
    UPDATE public.activation_keys
    SET device_id = NULL
    WHERE device_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_devices ud WHERE ud.id = device_id
      );
    RAISE WARNING 'Nullified % orphaned activation_keys.device_id references.', orphan_count;
  ELSE
    RAISE NOTICE 'activation_keys.device_id integrity check passed — no orphans found.';
  END IF;
END;
$$;

COMMIT;
