-- Activation Keys: cryptographically secure, encrypted-at-rest license keys.
-- Each key is single-use, bound to an org, and becomes a user+device upon activation.

BEGIN;

CREATE TABLE IF NOT EXISTS public.activation_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,

  -- The key itself: NEVER stored in plaintext.
  --   key_hash:      SHA-256 of the raw key (for O(1) lookup)
  --   key_encrypted: AES-256-GCM ciphertext as base64(iv || ciphertext || authTag)
  --   key_prefix:    First segment "EMSOL-XXXX" for masked display
  key_hash        text NOT NULL,
  key_encrypted   text NOT NULL,
  key_prefix      varchar(10) NOT NULL,

  -- Lifecycle
  status          text NOT NULL DEFAULT 'unused'
                  CHECK (status IN ('unused', 'activated', 'revoked', 'expired')),

  -- Activation details (populated when key is redeemed)
  activated_by    uuid,
  activated_at    timestamptz,
  device_id       uuid,

  -- Metadata
  batch_id        uuid,
  created_by      uuid NOT NULL,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activation_keys_hash_unique UNIQUE (key_hash),
  CONSTRAINT activation_keys_prefix_check CHECK (length(key_prefix) >= 5)
);

-- Foreign keys (tolerant of missing auth schema in test environments)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_org_id_fkey') THEN
    BEGIN
      ALTER TABLE public.activation_keys
        ADD CONSTRAINT activation_keys_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE NOT VALID;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add activation_keys_org_id_fkey: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_activated_by_fkey') THEN
      ALTER TABLE public.activation_keys
        ADD CONSTRAINT activation_keys_activated_by_fkey
        FOREIGN KEY (activated_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_created_by_fkey') THEN
      ALTER TABLE public.activation_keys
        ADD CONSTRAINT activation_keys_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_revoked_by_fkey') THEN
      ALTER TABLE public.activation_keys
        ADD CONSTRAINT activation_keys_revoked_by_fkey
        FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_device_id_fkey') THEN
    BEGIN
      ALTER TABLE public.activation_keys
        ADD CONSTRAINT activation_keys_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES public.user_devices(id) ON DELETE SET NULL NOT VALID;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add activation_keys_device_id_fkey: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activation_keys_org_status
  ON public.activation_keys(org_id, status);
CREATE INDEX IF NOT EXISTS idx_activation_keys_batch
  ON public.activation_keys(batch_id) WHERE batch_id IS NOT NULL;
-- Each user can only have ONE activated key
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_keys_activated_by
  ON public.activation_keys(activated_by) WHERE status = 'activated';

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS activation_keys_set_updated_at ON public.activation_keys;
CREATE TRIGGER activation_keys_set_updated_at
  BEFORE UPDATE ON public.activation_keys
  FOR EACH ROW EXECUTE FUNCTION public.saas_set_updated_at();

-- RLS
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- Super admin: full CRUD
DROP POLICY IF EXISTS activation_keys_superadmin_all ON public.activation_keys;
CREATE POLICY activation_keys_superadmin_all
  ON public.activation_keys FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Service role: full CRUD (API routes using admin client)
DROP POLICY IF EXISTS activation_keys_service_all ON public.activation_keys;
CREATE POLICY activation_keys_service_all
  ON public.activation_keys FOR ALL TO service_role
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- Org admin: read-only (they see prefix + status, NOT key_encrypted)
DROP POLICY IF EXISTS activation_keys_org_admin_read ON public.activation_keys;
CREATE POLICY activation_keys_org_admin_read
  ON public.activation_keys FOR SELECT TO authenticated
  USING (public.is_org_admin(org_id));

-- Grants
GRANT SELECT ON public.activation_keys TO authenticated;
GRANT ALL ON public.activation_keys TO service_role;

COMMIT;
