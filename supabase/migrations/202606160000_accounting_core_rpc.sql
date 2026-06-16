-- ==============================================================================
-- PHASE 2: ACCOUNTING CORE IMPLEMENTATION
-- Migration Date: 2026-06-16
-- Description: Creates default Chart of Accounts and Journal Entry RPC logic
-- ==============================================================================

-- 1. Create Bootstrap Function for Chart of Accounts
CREATE OR REPLACE FUNCTION bootstrap_finance_accounts(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert Default Chart of Accounts if they don't exist
    -- Asset Accounts
    INSERT INTO acc_accounts (org_id, code, name, type, is_active)
    VALUES 
        (p_org_id, '1000', 'Cash', 'asset', true),
        (p_org_id, '1100', 'Bank', 'asset', true),
        (p_org_id, '1200', 'Accounts Receivable', 'asset', true),
        (p_org_id, '1300', 'Inventory Asset', 'asset', true),
        (p_org_id, '1400', 'GST Input (ITC)', 'asset', true),
        (p_org_id, '1500', 'WIP (Project Asset)', 'asset', true)
    ON CONFLICT DO NOTHING;

    -- Liability Accounts
    INSERT INTO acc_accounts (org_id, code, name, type, is_active)
    VALUES 
        (p_org_id, '2000', 'Accounts Payable', 'liability', true),
        (p_org_id, '2100', 'GST Output Liability', 'liability', true),
        (p_org_id, '2200', 'GRNI (Goods Receipt Not Invoiced)', 'liability', true),
        (p_org_id, '2300', 'Customer Advances', 'liability', true)
    ON CONFLICT DO NOTHING;

    -- Equity Accounts
    INSERT INTO acc_accounts (org_id, code, name, type, is_active)
    VALUES 
        (p_org_id, '3000', 'Retained Earnings', 'equity', true)
    ON CONFLICT DO NOTHING;

    -- Revenue Accounts
    INSERT INTO acc_accounts (org_id, code, name, type, is_active)
    VALUES 
        (p_org_id, '4000', 'Solar EPC Revenue', 'revenue', true),
        (p_org_id, '4100', 'Service Revenue', 'revenue', true)
    ON CONFLICT DO NOTHING;

    -- Expense / COGS Accounts
    INSERT INTO acc_accounts (org_id, code, name, type, is_active)
    VALUES 
        (p_org_id, '5000', 'Cost of Goods Sold (COGS)', 'expense', true),
        (p_org_id, '5100', 'Direct Labor Cost', 'expense', true),
        (p_org_id, '6000', 'Operating Expenses', 'expense', true),
        (p_org_id, '6100', 'Freight and Shipping', 'expense', true)
    ON CONFLICT DO NOTHING;
END;
$$;

-- 2. Bootstrap existing organizations
DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM organisations LOOP
        PERFORM bootstrap_finance_accounts(org.id);
    END LOOP;
END;
$$;

-- 3. Create Trigger to automatically bootstrap new organizations
CREATE OR REPLACE FUNCTION trigger_bootstrap_finance_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM bootstrap_finance_accounts(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_finance_accounts ON organisations;
CREATE TRIGGER trg_bootstrap_finance_accounts
    AFTER INSERT ON organisations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_bootstrap_finance_accounts();

-- 4. Create the Journal Entry RPC
CREATE OR REPLACE FUNCTION create_journal_entry(
    p_org_id uuid,
    p_entry_date date,
    p_reference_no text,
    p_description text,
    p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id uuid;
    v_total_debit numeric := 0;
    v_total_credit numeric := 0;
    v_line jsonb;
    v_auth_org_id text;
BEGIN
    -- Authorization Check: Ensure the caller belongs to the org or is a service_role bypass
    -- Try to get auth_org_id if it exists, otherwise rely on jwt claim
    BEGIN
        v_auth_org_id := current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'org_id';
    EXCEPTION WHEN OTHERS THEN
        v_auth_org_id := NULL;
    END;
    
    -- If jwt claims exist and org_id is present, it MUST match p_org_id
    IF v_auth_org_id IS NOT NULL AND v_auth_org_id != p_org_id::text THEN
        RAISE EXCEPTION 'Unauthorized: org_id mismatch.';
    END IF;

    -- Validate double-entry balance
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
        v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
        
        -- Validate account exists for this org
        IF NOT EXISTS (
            SELECT 1 FROM acc_accounts 
            WHERE id = (v_line->>'account_id')::uuid 
            AND org_id = p_org_id 
            AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Account % does not exist or is inactive for org %', v_line->>'account_id', p_org_id;
        END IF;
    END LOOP;

    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'Journal Entry must balance. Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    IF v_total_debit = 0 THEN
        RAISE EXCEPTION 'Journal Entry cannot be zero.';
    END IF;

    -- Insert Header
    INSERT INTO acc_journal_entries (org_id, entry_date, reference_no, description)
    VALUES (p_org_id, p_entry_date, p_reference_no, p_description)
    RETURNING id INTO v_entry_id;

    -- Insert Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO acc_journal_lines (
            org_id, 
            entry_id, 
            account_id, 
            debit, 
            credit, 
            project_id
        )
        VALUES (
            p_org_id,
            v_entry_id,
            (v_line->>'account_id')::uuid,
            COALESCE((v_line->>'debit')::numeric, 0),
            COALESCE((v_line->>'credit')::numeric, 0),
            NULLIF(v_line->>'project_id', '')::uuid
        );
    END LOOP;

    RETURN v_entry_id;
END;
$$;
