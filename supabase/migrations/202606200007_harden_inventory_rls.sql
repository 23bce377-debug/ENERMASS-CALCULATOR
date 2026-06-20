-- Harden inventory_movements RLS policies to eliminate tenant isolation leaks
-- Drop the permissive policies that did not check org_id
DROP POLICY IF EXISTS inventory_movements_select ON inventory_movements;
DROP POLICY IF EXISTS inventory_movements_insert ON inventory_movements;
DROP POLICY IF EXISTS org_inventory_access ON inventory_movements;

-- Create secure, org-isolated select and insert policies
CREATE POLICY "org_inventory_select" ON inventory_movements
  FOR SELECT USING (
    org_id = auth_org_id()
  );

CREATE POLICY "org_inventory_insert" ON inventory_movements
  FOR INSERT WITH CHECK (
    org_id = auth_org_id()
  );
