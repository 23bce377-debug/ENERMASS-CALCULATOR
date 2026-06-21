-- SaaS security hardening after deep licensing audit.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_super_admin = true
WHERE role IN ('superadmin', 'super_admin');

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_service_role()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_super_admin, false) = true
    );
$$;

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS fingerprint_hash text;

UPDATE public.device_sessions s
SET fingerprint_hash = d.fingerprint_hash
FROM public.user_devices d
WHERE s.device_id = d.id
  AND s.fingerprint_hash IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_fingerprint_hash_required'
  ) THEN
    ALTER TABLE public.device_sessions
      ADD CONSTRAINT device_sessions_fingerprint_hash_required
      CHECK (fingerprint_hash IS NOT NULL AND length(fingerprint_hash) >= 8)
      NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_unique_org_invoice_idx
  ON public.subscription_payments(org_id, invoice_number)
  WHERE invoice_number IS NOT NULL AND btrim(invoice_number) <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_subscriptions_current_period_required'
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_current_period_required
      CHECK (
        status NOT IN ('trialing', 'active', 'past_due')
        OR current_period_end IS NOT NULL
      )
      NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.saas_enforce_org_subscription_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_limit integer;
  billable_count integer;
BEGIN
  IF NEW.status NOT IN ('active', 'invited') THEN
    RETURN NEW;
  END IF;

  SELECT s.seat_limit
    INTO active_limit
  FROM public.org_subscriptions s
  WHERE s.org_id = NEW.org_id
    AND s.status IN ('trialing', 'active', 'past_due')
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end >= now()
  ORDER BY
    CASE s.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END,
    s.current_period_end DESC,
    s.created_at DESC
  LIMIT 1;

  IF active_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO billable_count
  FROM public.org_members m
  WHERE m.org_id = NEW.org_id
    AND m.status IN ('active', 'invited')
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF billable_count >= active_limit THEN
    RAISE EXCEPTION 'Org member seat limit exceeded for org %', NEW.org_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_members_enforce_seat_limit ON public.org_members;
CREATE TRIGGER org_members_enforce_seat_limit
  BEFORE INSERT OR UPDATE OF org_id, status ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.saas_enforce_org_subscription_seat_limit();

COMMIT;
