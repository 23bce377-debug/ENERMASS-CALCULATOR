-- MIGRATION 14: Link field_service_tickets to field_amc_contracts and auto-increment completed_visits
-- Severity: P1

-- 1. Add amc_contract_id FK column if not exists
ALTER TABLE field_service_tickets 
ADD COLUMN IF NOT EXISTS amc_contract_id UUID REFERENCES field_amc_contracts(id) ON DELETE SET NULL;

-- 2. Create trigger function to auto-increment completed_visits
CREATE OR REPLACE FUNCTION fn_increment_amc_completed_visits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.amc_contract_id IS NOT NULL THEN
    UPDATE field_amc_contracts
    SET completed_visits = COALESCE(completed_visits, 0) + 1
    WHERE id = NEW.amc_contract_id;
  END IF;
  RETURN NEW;
END; $$;

-- 3. Create trigger on field_service_tickets
DROP TRIGGER IF EXISTS trg_amc_visits ON field_service_tickets;
CREATE TRIGGER trg_amc_visits
AFTER UPDATE ON field_service_tickets
FOR EACH ROW EXECUTE FUNCTION fn_increment_amc_completed_visits();
