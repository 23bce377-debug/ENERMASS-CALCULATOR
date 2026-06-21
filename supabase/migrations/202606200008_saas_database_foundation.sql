-- SaaS database foundation: subscriptions, seats, device licensing, and audit events.
-- Idempotent by design so it can be rerun after partial migration attempts.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Keep helper behavior unforgeable where profiles exists, but tolerate older JWT-only installs.
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claims AS (
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) AS jwt
  )
  SELECT COALESCE(
    (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid()),
    NULLIF((SELECT jwt ->> 'org_id' FROM claims), '')::uuid,
    NULLIF((SELECT jwt -> 'app_metadata' ->> 'org_id' FROM claims), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claims AS (
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) AS jwt
  )
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    NULLIF((SELECT jwt ->> 'user_role' FROM claims), ''),
    NULLIF((SELECT jwt ->> 'role' FROM claims), ''),
    NULLIF((SELECT jwt -> 'app_metadata' ->> 'user_role' FROM claims), ''),
    NULLIF((SELECT jwt -> 'app_metadata' ->> 'role' FROM claims), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_org_id();
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role();
$$;

CREATE OR REPLACE FUNCTION public.saas_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  monthly_price numeric(12,2) NOT NULL DEFAULT 0,
  yearly_price numeric(12,2) NOT NULL DEFAULT 0,
  seat_limit integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_code_key UNIQUE (code),
  CONSTRAINT subscription_plans_prices_nonnegative CHECK (monthly_price >= 0 AND yearly_price >= 0),
  CONSTRAINT subscription_plans_seat_limit_positive CHECK (seat_limit > 0)
);

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trialing',
  seat_limit integer NOT NULL DEFAULT 1,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_subscriptions_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  CONSTRAINT org_subscriptions_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly', 'trial', 'manual')),
  CONSTRAINT org_subscriptions_seat_limit_positive CHECK (seat_limit > 0),
  CONSTRAINT org_subscriptions_period_check CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start
  )
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_members_org_user_key UNIQUE (org_id, user_id),
  CONSTRAINT org_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer')),
  CONSTRAINT org_members_status_check CHECK (status IN ('invited', 'active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  device_install_id text NOT NULL,
  public_key text NOT NULL,
  fingerprint_hash text NOT NULL,
  device_name text,
  browser text,
  os text,
  status text NOT NULL DEFAULT 'active',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT user_devices_status_check CHECK (status IN ('active', 'pending', 'revoked'))
);

CREATE TABLE IF NOT EXISTS public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.user_devices(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  ip_address inet,
  user_agent text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT device_sessions_token_hash_key UNIQUE (session_token_hash),
  CONSTRAINT device_sessions_status_check CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT device_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.device_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  old_device_id uuid REFERENCES public.user_devices(id) ON DELETE SET NULL,
  requested_device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  CONSTRAINT device_reset_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.org_subscriptions(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'INR',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'manual',
  invoice_number text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_payments_amount_nonnegative CHECK (amount >= 0),
  CONSTRAINT subscription_payments_status_check CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  CONSTRAINT subscription_payments_currency_check CHECK (currency = upper(currency))
);

CREATE TABLE IF NOT EXISTS public.license_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  actor_role text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing-table compatibility: add missing columns without overwriting legacy data.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS monthly_price numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_price numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seat_limit integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS seat_limit integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS device_install_id text,
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS device_id uuid,
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.device_reset_requests
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS old_device_id uuid,
  ADD COLUMN IF NOT EXISTS requested_device_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_id uuid,
  ADD COLUMN IF NOT EXISTS amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.license_events
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS event_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
DECLARE
  fk_org_table text;
BEGIN
  SELECT c.relname INTO fk_org_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN ('organisations', 'organizations')
    AND a.attname = 'id'
  ORDER BY CASE c.relname WHEN 'organisations' THEN 0 ELSE 1 END
  LIMIT 1;

  IF fk_org_table IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_subscriptions_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.org_subscriptions ADD CONSTRAINT org_subscriptions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.org_members ADD CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.device_sessions ADD CONSTRAINT device_sessions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.device_reset_requests ADD CONSTRAINT device_reset_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.subscription_payments ADD CONSTRAINT subscription_payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'license_events_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.license_events ADD CONSTRAINT license_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE SET NULL NOT VALID', fk_org_table);
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_user_id_fkey') THEN
      ALTER TABLE public.org_members ADD CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_user_id_fkey') THEN
      ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_user_id_fkey') THEN
      ALTER TABLE public.device_sessions ADD CONSTRAINT device_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_user_id_fkey') THEN
      ALTER TABLE public.device_reset_requests ADD CONSTRAINT device_reset_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_subscriptions_plan_id_fkey') THEN
    ALTER TABLE public.org_subscriptions ADD CONSTRAINT org_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sessions_device_id_fkey') THEN
    ALTER TABLE public.device_sessions ADD CONSTRAINT device_sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.user_devices(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_reset_requests_old_device_id_fkey') THEN
    ALTER TABLE public.device_reset_requests ADD CONSTRAINT device_reset_requests_old_device_id_fkey FOREIGN KEY (old_device_id) REFERENCES public.user_devices(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_subscription_id_fkey') THEN
    ALTER TABLE public.subscription_payments ADD CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.org_subscriptions(id) ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS org_subscriptions_one_current_per_org_idx
  ON public.org_subscriptions(org_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE UNIQUE INDEX IF NOT EXISTS org_members_org_user_idx
  ON public.org_members(org_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_org_install_idx
  ON public.user_devices(org_id, device_install_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_one_active_per_user_idx
  ON public.user_devices(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS org_subscriptions_org_status_idx ON public.org_subscriptions(org_id, status);
CREATE INDEX IF NOT EXISTS org_members_user_status_idx ON public.org_members(user_id, status);
CREATE INDEX IF NOT EXISTS user_devices_org_user_status_idx ON public.user_devices(org_id, user_id, status);
CREATE INDEX IF NOT EXISTS device_sessions_device_status_idx ON public.device_sessions(device_id, status);
CREATE INDEX IF NOT EXISTS device_reset_requests_org_status_idx ON public.device_reset_requests(org_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS subscription_payments_org_created_idx ON public.subscription_payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS license_events_org_created_idx ON public.license_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS license_events_entity_idx ON public.license_events(entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claims AS (
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) AS jwt
  )
  SELECT COALESCE(
    NULLIF((SELECT jwt ->> 'role' FROM claims), '') = 'service_role',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_service_role() OR public.auth_role() IN ('superadmin', 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.org_members m
      WHERE m.org_id = p_org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.org_id = p_org_id
        AND p.id = auth.uid()
        AND COALESCE(p.is_active, true)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.org_members m
      WHERE m.org_id = p_org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.org_id = p_org_id
        AND p.id = auth.uid()
        AND COALESCE(p.is_active, true)
        AND p.role IN ('owner', 'admin', 'superadmin')
    );
$$;

CREATE OR REPLACE FUNCTION public.saas_enforce_org_subscription_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_limit integer;
  active_count integer;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT s.seat_limit
    INTO active_limit
  FROM public.org_subscriptions s
  WHERE s.org_id = NEW.org_id
    AND s.status IN ('trialing', 'active', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end >= now())
  ORDER BY
    CASE s.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END,
    s.current_period_end DESC NULLS LAST,
    s.created_at DESC
  LIMIT 1;

  IF active_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO active_count
  FROM public.org_members m
  WHERE m.org_id = NEW.org_id
    AND m.status = 'active'
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF active_count >= active_limit THEN
    RAISE EXCEPTION 'Active org member seat limit exceeded for org %', NEW.org_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.saas_enforce_subscription_plan_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_limit integer;
BEGIN
  SELECT p.seat_limit INTO plan_limit
  FROM public.subscription_plans p
  WHERE p.id = NEW.plan_id;

  IF plan_limit IS NULL THEN
    RAISE EXCEPTION 'Subscription plan % does not exist', NEW.plan_id
      USING ERRCODE = '23503';
  END IF;

  IF NEW.seat_limit IS NULL THEN
    NEW.seat_limit := plan_limit;
  END IF;

  IF NEW.seat_limit > plan_limit THEN
    RAISE EXCEPTION 'Subscription seat_limit % exceeds plan seat_limit %', NEW.seat_limit, plan_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.saas_validate_session_device_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_record record;
BEGIN
  SELECT org_id, user_id INTO device_record
  FROM public.user_devices
  WHERE id = NEW.device_id;

  IF device_record.org_id IS NULL THEN
    RAISE EXCEPTION 'Device % does not exist', NEW.device_id
      USING ERRCODE = '23503';
  END IF;

  IF NEW.org_id IS DISTINCT FROM device_record.org_id OR NEW.user_id IS DISTINCT FROM device_record.user_id THEN
    RAISE EXCEPTION 'Device session org/user must match the device';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_set_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_set_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.saas_set_updated_at();

DROP TRIGGER IF EXISTS org_subscriptions_set_updated_at ON public.org_subscriptions;
CREATE TRIGGER org_subscriptions_set_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.saas_set_updated_at();

DROP TRIGGER IF EXISTS org_members_set_updated_at ON public.org_members;
CREATE TRIGGER org_members_set_updated_at
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.saas_set_updated_at();

DROP TRIGGER IF EXISTS org_members_enforce_seat_limit ON public.org_members;
CREATE TRIGGER org_members_enforce_seat_limit
  BEFORE INSERT OR UPDATE OF org_id, status ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.saas_enforce_org_subscription_seat_limit();

DROP TRIGGER IF EXISTS org_subscriptions_enforce_plan_seat_limit ON public.org_subscriptions;
CREATE TRIGGER org_subscriptions_enforce_plan_seat_limit
  BEFORE INSERT OR UPDATE OF plan_id, seat_limit ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.saas_enforce_subscription_plan_seat_limit();

DROP TRIGGER IF EXISTS device_sessions_validate_device_org ON public.device_sessions;
CREATE TRIGGER device_sessions_validate_device_org
  BEFORE INSERT OR UPDATE OF org_id, user_id, device_id ON public.device_sessions
  FOR EACH ROW EXECUTE FUNCTION public.saas_validate_session_device_org();

INSERT INTO public.subscription_plans (name, code, monthly_price, yearly_price, seat_limit, features, is_active)
VALUES
  (
    'Starter',
    'starter',
    1999,
    19990,
    1,
    '{"calculator": true, "erp": false, "inventory": false, "reports": true, "master_data": true, "device_management": false, "billing": true, "custom_rates": false, "max_projects": 25}'::jsonb,
    true
  ),
  (
    'Team',
    'team',
    4999,
    49990,
    5,
    '{"calculator": true, "erp": true, "inventory": true, "reports": true, "master_data": true, "device_management": true, "billing": true, "custom_rates": true, "max_projects": 100}'::jsonb,
    true
  ),
  (
    'Business',
    'business',
    14999,
    149990,
    25,
    '{"calculator": true, "erp": true, "inventory": true, "reports": true, "master_data": true, "device_management": true, "billing": true, "custom_rates": true, "max_projects": 500}'::jsonb,
    true
  ),
  (
    'Enterprise',
    'enterprise',
    49999,
    499990,
    1000,
    '{"calculator": true, "erp": true, "inventory": true, "reports": true, "master_data": true, "device_management": true, "billing": true, "custom_rates": true, "max_projects": 10000}'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    monthly_price = EXCLUDED.monthly_price,
    yearly_price = EXCLUDED.yearly_price,
    seat_limit = EXCLUDED.seat_limit,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.org_members (org_id, user_id, role, status)
SELECT
  p.org_id,
  p.id AS user_id,
  CASE
    WHEN p.role IN ('owner', 'admin', 'manager', 'staff', 'viewer') THEN p.role
    WHEN p.role = 'sales_exec' THEN 'staff'
    WHEN p.role = 'superadmin' THEN 'owner'
    ELSE 'staff'
  END AS role,
  CASE WHEN COALESCE(p.is_active, true) THEN 'active' ELSE 'disabled' END AS status
FROM public.profiles p
WHERE p.org_id IS NOT NULL
ON CONFLICT (org_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = now();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
CREATE POLICY subscription_plans_read
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_superadmin());

DROP POLICY IF EXISTS subscription_plans_superadmin_manage ON public.subscription_plans;
CREATE POLICY subscription_plans_superadmin_manage
  ON public.subscription_plans
  FOR ALL
  TO authenticated, service_role
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS org_subscriptions_org_read ON public.org_subscriptions;
CREATE POLICY org_subscriptions_org_read
  ON public.org_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR org_id = public.auth_org_id());

DROP POLICY IF EXISTS org_subscriptions_admin_manage ON public.org_subscriptions;
CREATE POLICY org_subscriptions_admin_manage
  ON public.org_subscriptions
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS org_subscriptions_superadmin_manage ON public.org_subscriptions;
CREATE POLICY org_subscriptions_superadmin_manage
  ON public.org_subscriptions
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS org_members_org_read ON public.org_members;
CREATE POLICY org_members_org_read
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR org_id = public.auth_org_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS org_members_org_admin_manage ON public.org_members;
CREATE POLICY org_members_org_admin_manage
  ON public.org_members
  FOR ALL
  TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS org_members_service_manage ON public.org_members;
CREATE POLICY org_members_service_manage
  ON public.org_members
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS user_devices_org_or_own_read ON public.user_devices;
CREATE POLICY user_devices_org_or_own_read
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR public.is_org_admin(org_id) OR (org_id = public.auth_org_id() AND user_id = auth.uid()));

DROP POLICY IF EXISTS user_devices_org_admin_manage ON public.user_devices;
CREATE POLICY user_devices_org_admin_manage
  ON public.user_devices
  FOR ALL
  TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS user_devices_service_manage ON public.user_devices;
CREATE POLICY user_devices_service_manage
  ON public.user_devices
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS device_sessions_org_or_own_read ON public.device_sessions;
CREATE POLICY device_sessions_org_or_own_read
  ON public.device_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR public.is_org_admin(org_id) OR (org_id = public.auth_org_id() AND user_id = auth.uid()));

DROP POLICY IF EXISTS device_sessions_service_manage ON public.device_sessions;
CREATE POLICY device_sessions_service_manage
  ON public.device_sessions
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS device_reset_requests_org_or_own_read ON public.device_reset_requests;
CREATE POLICY device_reset_requests_org_or_own_read
  ON public.device_reset_requests
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR public.is_org_admin(org_id) OR (org_id = public.auth_org_id() AND user_id = auth.uid()));

DROP POLICY IF EXISTS device_reset_requests_user_create ON public.device_reset_requests;
CREATE POLICY device_reset_requests_user_create
  ON public.device_reset_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.auth_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS device_reset_requests_org_admin_review ON public.device_reset_requests;
CREATE POLICY device_reset_requests_org_admin_review
  ON public.device_reset_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS device_reset_requests_service_manage ON public.device_reset_requests;
CREATE POLICY device_reset_requests_service_manage
  ON public.device_reset_requests
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS subscription_payments_org_read ON public.subscription_payments;
CREATE POLICY subscription_payments_org_read
  ON public.subscription_payments
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR org_id = public.auth_org_id());

DROP POLICY IF EXISTS subscription_payments_service_manage ON public.subscription_payments;
CREATE POLICY subscription_payments_service_manage
  ON public.subscription_payments
  FOR ALL
  TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS subscription_payments_superadmin_manage ON public.subscription_payments;
CREATE POLICY subscription_payments_superadmin_manage
  ON public.subscription_payments
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS license_events_org_read ON public.license_events;
CREATE POLICY license_events_org_read
  ON public.license_events
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR org_id = public.auth_org_id());

DROP POLICY IF EXISTS license_events_service_insert ON public.license_events;
CREATE POLICY license_events_service_insert
  ON public.license_events
  FOR INSERT
  TO service_role
  WITH CHECK (public.is_service_role());

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.org_subscriptions, public.subscription_payments, public.license_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members, public.user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.device_reset_requests TO authenticated;
GRANT SELECT ON public.device_sessions TO authenticated;
GRANT ALL ON public.subscription_plans, public.org_subscriptions, public.org_members, public.user_devices,
  public.device_sessions, public.device_reset_requests, public.subscription_payments, public.license_events TO service_role;

COMMIT;
