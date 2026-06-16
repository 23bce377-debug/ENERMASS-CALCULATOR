-- ==============================================================================
-- PHASE 9: SECURITY, CONCURRENCY, AND IDENTITY
-- Migration Date: 2026-06-16
-- Description: Enforces RLS and Serializable isolation for financial transactions
-- ==============================================================================

-- 1. Ensure all financial tables have strictly enforced RLS based on auth_org_id()
ALTER TABLE acc_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_access_acc_accounts" ON acc_accounts;
CREATE POLICY "org_access_acc_accounts" ON acc_accounts
    FOR ALL USING (org_id = auth_org_id());

ALTER TABLE acc_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_access_acc_journal_entries" ON acc_journal_entries;
CREATE POLICY "org_access_acc_journal_entries" ON acc_journal_entries
    FOR ALL USING (org_id = auth_org_id());

ALTER TABLE acc_journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_access_acc_journal_lines" ON acc_journal_lines;
CREATE POLICY "org_access_acc_journal_lines" ON acc_journal_lines
    FOR ALL USING (org_id = auth_org_id());

-- 2. Modify the Journal Entry creation RPC to enforce strict concurrency (SERIALIZABLE)
-- This prevents race conditions during double-entry postings
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
SET transaction_isolation TO 'serializable'
AS $$
DECLARE
    v_entry_id uuid;
    v_total_debit numeric := 0;
    v_total_credit numeric := 0;
    v_line jsonb;
    v_auth_org_id text;
BEGIN
    -- Authorization Check
    BEGIN
        v_auth_org_id := current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'org_id';
    EXCEPTION WHEN OTHERS THEN
        v_auth_org_id := NULL;
    END;
    
    IF v_auth_org_id IS NOT NULL AND v_auth_org_id != p_org_id::text THEN
        RAISE EXCEPTION 'Unauthorized: org_id mismatch.';
    END IF;

    -- Validate double-entry balance
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
        v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
        
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
            org_id, entry_id, account_id, debit, credit, project_id
        )
        VALUES (
            p_org_id, v_entry_id, (v_line->>'account_id')::uuid,
            COALESCE((v_line->>'debit')::numeric, 0),
            COALESCE((v_line->>'credit')::numeric, 0),
            NULLIF(v_line->>'project_id', '')::uuid
        );
    END LOOP;

    RETURN v_entry_id;
END;
$$;
