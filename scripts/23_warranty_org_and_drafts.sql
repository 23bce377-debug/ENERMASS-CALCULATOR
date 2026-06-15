-- ============================================================
-- MIGRATION 23: Warranty Claims org_id Enforcement (P0-9)
-- ============================================================

BEGIN;

-- Ensure org_id is set on all existing warranty claims
-- (backfill from vendor's org_id if missing)
UPDATE proc_warranty_claims w
  SET org_id = v.org_id
  FROM vendors v
  WHERE w.vendor_id = v.id
    AND w.org_id IS NULL;

-- Drop existing weak RLS policy if any
DROP POLICY IF EXISTS "proc_warranty_claims_org" ON proc_warranty_claims;

-- Add strict RLS
CREATE POLICY "proc_warranty_claims_org_strict" ON proc_warranty_claims
  FOR ALL USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- Ensure future inserts always have org_id via trigger
CREATE OR REPLACE FUNCTION fn_enforce_warranty_org_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO v_org_id FROM vendors WHERE id = NEW.vendor_id;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create warranty claim without org_id. Vendor org_id not found.';
    END IF;
    NEW.org_id := v_org_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_warranty_org_id ON proc_warranty_claims;
CREATE TRIGGER trg_enforce_warranty_org_id
  BEFORE INSERT ON proc_warranty_claims
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_warranty_org_id();

-- Draft quotes persistence table (P0-10: calculator data loss)
CREATE TABLE IF NOT EXISTS draft_quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  state_json  JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_draft UNIQUE (user_id)
);

ALTER TABLE draft_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draft_quotes_user" ON draft_quotes
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
