-- ============================================================
-- MIGRATION 16: Cascade Delete Vendor Relations
-- Ensures deleting a vendor cleans up all referencing tables.
-- ============================================================

BEGIN;

-- 1. structure_material_rates: CASCADE delete
ALTER TABLE structure_material_rates 
  DROP CONSTRAINT IF EXISTS structure_material_rates_vendor_id_fkey;

ALTER TABLE structure_material_rates 
  ADD CONSTRAINT structure_material_rates_vendor_id_fkey 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

-- 2. structure_template_items: SET NULL delete
ALTER TABLE structure_template_items 
  DROP CONSTRAINT IF EXISTS structure_template_items_vendor_id_fkey;

ALTER TABLE structure_template_items 
  ADD CONSTRAINT structure_template_items_vendor_id_fkey 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- 3. vendor_payments: CASCADE delete
ALTER TABLE vendor_payments 
  DROP CONSTRAINT IF EXISTS vendor_payments_vendor_id_fkey;

ALTER TABLE vendor_payments 
  ADD CONSTRAINT vendor_payments_vendor_id_fkey 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

-- 4. proc_warranty_claims: CASCADE delete
ALTER TABLE proc_warranty_claims 
  DROP CONSTRAINT IF EXISTS proc_warranty_claims_vendor_id_fkey;

ALTER TABLE proc_warranty_claims 
  ADD CONSTRAINT proc_warranty_claims_vendor_id_fkey 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

COMMIT;
