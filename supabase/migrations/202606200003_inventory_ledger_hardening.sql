-- Add org_id to inventory_movements if missing
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

-- Ensure inventory_movements is truly append-only by creating a trigger that blocks UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_inventory_movement_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is an append-only ledger. UPDATE and DELETE are forbidden. Reference: ENERMASS-INV-IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_immutable ON inventory_movements;
CREATE TRIGGER trg_inventory_immutable
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

-- RLS for inventory_movements
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_movements' AND policyname = 'org_inventory_access') THEN
    CREATE POLICY "org_inventory_access" ON inventory_movements
      FOR ALL USING (org_id = auth_org_id());
  END IF;
END $$;

-- Index for ledger queries
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_org ON inventory_movements(item_id, org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_project ON inventory_movements(project_id, org_id) WHERE project_id IS NOT NULL;

-- VALIDATION COMMENT:
-- SELECT * FROM pg_triggers WHERE tgname = 'trg_inventory_immutable';
-- Confirm trigger exists before deploying
