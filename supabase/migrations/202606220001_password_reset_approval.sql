-- Password reset requests with admin approval flow.
-- Users request a reset → org admin must approve → then Supabase sends the email.

BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  user_id         uuid NOT NULL,

  status          text NOT NULL DEFAULT 'pending_admin_approval'
                  CHECK (status IN (
                    'pending_admin_approval',
                    'approved',
                    'rejected',
                    'link_sent',
                    'completed',
                    'expired'
                  )),

  requested_at    timestamptz NOT NULL DEFAULT now(),
  approved_by     uuid,
  approved_at     timestamptz,
  rejected_by     uuid,
  rejected_at     timestamptz,
  link_sent_at    timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),

  ip_address      inet,
  user_agent      text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_requests_org_id_fkey') THEN
    BEGIN
      ALTER TABLE public.password_reset_requests
        ADD CONSTRAINT password_reset_requests_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE NOT VALID;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add password_reset_requests_org_id_fkey: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_requests_user_id_fkey') THEN
      ALTER TABLE public.password_reset_requests
        ADD CONSTRAINT password_reset_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_org_status
  ON public.password_reset_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user
  ON public.password_reset_requests(user_id, created_at DESC);

-- RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_reset_own_read ON public.password_reset_requests;
CREATE POLICY password_reset_own_read
  ON public.password_reset_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(org_id) OR public.is_superadmin());

DROP POLICY IF EXISTS password_reset_user_create ON public.password_reset_requests;
CREATE POLICY password_reset_user_create
  ON public.password_reset_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS password_reset_admin_review ON public.password_reset_requests;
CREATE POLICY password_reset_admin_review
  ON public.password_reset_requests FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id) OR public.is_superadmin());

DROP POLICY IF EXISTS password_reset_service ON public.password_reset_requests;
CREATE POLICY password_reset_service
  ON public.password_reset_requests FOR ALL TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;

COMMIT;
