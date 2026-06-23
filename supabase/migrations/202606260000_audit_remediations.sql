-- Database migration: Audit remediations for RBAC, constraints, and device policies.
-- Safe to run multiple times (idempotent).

BEGIN;

-- ─── 1. Update is_superadmin() to check profiles.is_super_admin column ───
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_service_role()
    OR public.auth_role() IN ('superadmin', 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_super_admin, false) = true
    );
$$;

-- ─── 2. Add profiles <-> org_members role sync triggers ───
CREATE OR REPLACE FUNCTION public.sync_profile_to_member_role()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) THEN
    UPDATE public.org_members
    SET role = CASE
      WHEN NEW.role IN ('owner', 'admin', 'manager', 'staff', 'viewer') THEN NEW.role
      WHEN NEW.role = 'sales_exec' THEN 'staff'
      WHEN NEW.role = 'superadmin' THEN 'owner'
      ELSE 'staff'
    END
    WHERE user_id = NEW.id AND org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_member_to_profile_role()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role) THEN
    UPDATE public.profiles
    SET role = NEW.role
    WHERE id = NEW.user_id AND org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_profile_to_member_role_trg ON public.profiles;
CREATE TRIGGER sync_profile_to_member_role_trg
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_member_role();

DROP TRIGGER IF EXISTS sync_member_to_profile_role_trg ON public.org_members;
CREATE TRIGGER sync_member_to_profile_role_trg
  AFTER UPDATE OF role ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_to_profile_role();


-- ─── 3. Enforce activated_by constraint on activation_keys ───
DO $$
BEGIN
  -- Cleanup any existing inconsistent records if they exist (defensive)
  UPDATE public.activation_keys
  SET status = 'unused'
  WHERE status = 'activated' AND (activated_by IS NULL OR device_id IS NULL);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_activated_by_not_null') THEN
    ALTER TABLE public.activation_keys
      ADD CONSTRAINT check_activated_by_not_null
      CHECK (status <> 'activated' OR (activated_by IS NOT NULL AND device_id IS NOT NULL));
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_activation_keys_activated_by;
CREATE UNIQUE INDEX idx_activation_keys_activated_by
  ON public.activation_keys(activated_by)
  WHERE status = 'activated' AND activated_by IS NOT NULL;


-- ─── 4. Seat limit enforcement trigger on org_subscriptions ───
CREATE OR REPLACE FUNCTION public.saas_enforce_subscription_seat_limit_on_sub()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_members_count integer;
BEGIN
  IF NEW.status NOT IN ('trialing', 'active', 'past_due') THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO active_members_count
  FROM public.org_members m
  WHERE m.org_id = NEW.org_id
    AND m.status IN ('active', 'invited');

  IF active_members_count > NEW.seat_limit THEN
    RAISE EXCEPTION 'Cannot update subscription seat limit to % because organization % currently has % active/invited members.', NEW.seat_limit, NEW.org_id, active_members_count
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_subscriptions_enforce_seat_limit ON public.org_subscriptions;
CREATE TRIGGER org_subscriptions_enforce_seat_limit
  BEFORE INSERT OR UPDATE OF seat_limit, status ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.saas_enforce_subscription_seat_limit_on_sub();


-- ─── 5. Update device reset request RLS policy to allow org admins ───
DROP POLICY IF EXISTS device_reset_requests_superadmin_review ON public.device_reset_requests;
DROP POLICY IF EXISTS device_reset_requests_org_admin_review ON public.device_reset_requests;
DROP POLICY IF EXISTS device_reset_requests_admin_review ON public.device_reset_requests;

CREATE POLICY device_reset_requests_admin_review
  ON public.device_reset_requests FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.is_org_admin(org_id))
  WITH CHECK (public.is_superadmin() OR public.is_org_admin(org_id));

-- ─── 6. Add missing device_secret_hash column to user_devices for existing DBs ───
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS device_secret_hash text;

-- ─── 7. Create missing rate_master_audit_logs table ───
CREATE TABLE IF NOT EXISTS public.rate_master_audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  rate_master_id      UUID NOT NULL,
  old_rate            NUMERIC(12,4),
  new_rate            NUMERIC(12,4),
  changed_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. Enable RLS and add policies for password_reset_requests ───
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_reset_requests_admin_access ON public.password_reset_requests;
CREATE POLICY password_reset_requests_admin_access
  ON public.password_reset_requests
  FOR ALL
  TO authenticated
  USING (public.is_superadmin() OR public.is_org_admin(org_id))
  WITH CHECK (public.is_superadmin() OR public.is_org_admin(org_id));

COMMIT;
