CREATE TABLE IF NOT EXISTS public.device_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.user_devices(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip_address text,
  user_agent text,
  CONSTRAINT device_challenges_status_check CHECK (status IN ('active', 'used', 'expired')),
  CONSTRAINT device_challenges_expiry_check CHECK (expires_at > created_at)
);

DO $$
DECLARE
  fk_org_table text;
BEGIN
  SELECT table_name
  INTO fk_org_table
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('organisations', 'organizations')
  ORDER BY CASE table_name WHEN 'organisations' THEN 0 ELSE 1 END
  LIMIT 1;

  IF fk_org_table IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_challenges_org_id_fkey') THEN
      EXECUTE format('ALTER TABLE public.device_challenges ADD CONSTRAINT device_challenges_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID', fk_org_table);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_challenges_user_id_fkey') THEN
    ALTER TABLE public.device_challenges ADD CONSTRAINT device_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS device_challenges_user_status_idx ON public.device_challenges(user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS device_challenges_device_status_idx ON public.device_challenges(device_id, status);

ALTER TABLE public.device_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_challenges_service_manage ON public.device_challenges;
CREATE POLICY device_challenges_service_manage
  ON public.device_challenges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.device_challenges TO service_role;
