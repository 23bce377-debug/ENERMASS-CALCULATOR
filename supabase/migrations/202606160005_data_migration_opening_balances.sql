-- ==============================================================================
-- PHASE 10: DATA MIGRATION & NORMALIZATION
-- Migration Date: 2026-06-16
-- Description: Script for initializing Opening Balances for organizations
-- ==============================================================================

-- Create a helper function to post Opening Balances.
-- Since the system didn't have a GL before, this "Go-Live" script allows
-- the finance team to plug starting balances into AR, AP, Inventory, and Retained Earnings.

CREATE OR REPLACE FUNCTION post_opening_balances(
    p_org_id uuid,
    p_go_live_date date,
    p_ar_balance numeric,
    p_ap_balance numeric,
    p_inventory_value numeric,
    p_retained_earnings numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ar_acc_id uuid;
    v_ap_acc_id uuid;
    v_inv_acc_id uuid;
    v_retained_earnings_id uuid;
    v_total_debit numeric := 0;
    v_total_credit numeric := 0;
    v_entry_id uuid;
BEGIN
    -- Fetch accounts
    SELECT id INTO v_ar_acc_id FROM acc_accounts WHERE org_id = p_org_id AND code = '1200';
    SELECT id INTO v_ap_acc_id FROM acc_accounts WHERE org_id = p_org_id AND code = '2000';
    SELECT id INTO v_inv_acc_id FROM acc_accounts WHERE org_id = p_org_id AND code = '1300';
    SELECT id INTO v_retained_earnings_id FROM acc_accounts WHERE org_id = p_org_id AND code = '3000';

    IF v_ar_acc_id IS NULL OR v_ap_acc_id IS NULL OR v_inv_acc_id IS NULL OR v_retained_earnings_id IS NULL THEN
        RAISE EXCEPTION 'Chart of Accounts missing for organization %', p_org_id;
    END IF;

    -- Calculate Totals
    v_total_debit := COALESCE(p_ar_balance, 0) + COALESCE(p_inventory_value, 0);
    v_total_credit := COALESCE(p_ap_balance, 0) + COALESCE(p_retained_earnings, 0);

    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'Opening balances do not balance. Assets: %, Liabilities+Equity: %', v_total_debit, v_total_credit;
    END IF;

    -- Insert Journal
    INSERT INTO acc_journal_entries (org_id, entry_date, reference_no, description)
    VALUES (p_org_id, p_go_live_date, 'OPENING-BAL', 'Go-Live Opening Balances')
    RETURNING id INTO v_entry_id;

    -- Insert Lines
    IF p_ar_balance > 0 THEN
        INSERT INTO acc_journal_lines (org_id, entry_id, account_id, debit, credit)
        VALUES (p_org_id, v_entry_id, v_ar_acc_id, p_ar_balance, 0);
    END IF;

    IF p_inventory_value > 0 THEN
        INSERT INTO acc_journal_lines (org_id, entry_id, account_id, debit, credit)
        VALUES (p_org_id, v_entry_id, v_inv_acc_id, p_inventory_value, 0);
    END IF;

    IF p_ap_balance > 0 THEN
        INSERT INTO acc_journal_lines (org_id, entry_id, account_id, debit, credit)
        VALUES (p_org_id, v_entry_id, v_ap_acc_id, 0, p_ap_balance);
    END IF;

    IF p_retained_earnings > 0 THEN
        INSERT INTO acc_journal_lines (org_id, entry_id, account_id, debit, credit)
        VALUES (p_org_id, v_entry_id, v_retained_earnings_id, 0, p_retained_earnings);
    END IF;

    RETURN v_entry_id;
END;
$$;
