-- 202606150000_audit_remediation_security.sql

BEGIN;

-- 1. Fix Leaky Policies on Quotes and Presets
DROP POLICY IF EXISTS "quotes_org_insert" ON public.quotes;
CREATE POLICY "quotes_org_insert" ON public.quotes 
FOR INSERT 
WITH CHECK (org_id = current_org_id());

DROP POLICY IF EXISTS "Allow public read for published presets" ON public.system_presets;
CREATE POLICY "system_presets_org_isolation" ON public.system_presets 
FOR SELECT 
USING (
  org_id = current_org_id() 
  OR (org_id IS NULL AND status = 'published')
);

-- 2. Enable RLS on Unsecured Tables (Dynamic block)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'sys_roles', 'state_scheme_overrides', 'sys_dashboards', 'master_data_changes_log', 
            'sys_user_roles', 'acc_accounts', 'quote_additional_costs', 'acc_bank_statements', 
            'proc_rfq_items', 'sys_approval_steps'
        )
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        -- Add basic org_id isolation if the column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'org_id') THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.tablename || '_org_isolation', r.tablename);
            EXECUTE format('CREATE POLICY "%I_org_isolation" ON public.%I FOR ALL USING (org_id = current_org_id())', r.tablename, r.tablename);
        END IF;
    END LOOP;
END;
$$;

-- 3. Inventory Ledger Immutability Trigger
CREATE OR REPLACE FUNCTION prevent_inventory_mutations()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Inventory transactions are immutable and append-only. UPDATE and DELETE are blocked.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_inv_mutations ON public.inv_stock_transactions;
CREATE TRIGGER trg_prevent_inv_mutations
BEFORE UPDATE OR DELETE ON public.inv_stock_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_inventory_mutations();

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON public.quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_epc_projects_org_id ON public.epc_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_epc_projects_status ON public.epc_projects(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org_id ON public.crm_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_balances_warehouse_id ON public.inv_stock_balances(warehouse_id);

COMMIT;
