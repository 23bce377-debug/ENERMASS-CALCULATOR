-- ============================================================
-- ENERMASS SOLAR EPC ERP — DB SECURITY & REMEDIATION PATCH
-- ============================================================
-- Patches: Quote RLS Bypass, Sub-ledger GL automations, balancing check, 
-- Negative Stock WAC fixes, GSTR-1 split constraint, and RLS speedups
-- ============================================================

-- ─── 1. FIX QUOTE RLS POLICY PRIVILEGE ESCALATION ────────────
DROP POLICY IF EXISTS "quotes_org_write" ON quotes;

CREATE POLICY "quotes_org_insert" ON quotes 
  FOR INSERT WITH CHECK (org_id = auth_org_id());
  
CREATE POLICY "quotes_org_update" ON quotes 
  FOR UPDATE USING (
    org_id = auth_org_id() AND (
      auth_role() IN ('owner', 'admin') OR
      exec_id = auth.uid()
    )
  );
  
CREATE POLICY "quotes_org_delete" ON quotes 
  FOR DELETE USING (
    org_id = auth_org_id() AND (
      auth_role() IN ('owner', 'admin')
    )
  );


-- ─── 2. DENORMALIZE org_id FOR RLS PERFORMANCE & SECURITY ───

-- Helper function to conditionally alter tables and copy org_id
CREATE OR REPLACE FUNCTION patch_denormalize_org_id()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- quote_items
  ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE quote_items qi SET org_id = q.org_id FROM quotes q WHERE qi.quote_id = q.id AND qi.org_id IS NULL;
  
  -- quote_variants
  ALTER TABLE quote_variants ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE quote_variants qv SET org_id = q.org_id FROM quotes q WHERE qv.quote_id = q.id AND qv.org_id IS NULL;
  
  -- quote_additional_costs
  ALTER TABLE quote_additional_costs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE quote_additional_costs qac SET org_id = q.org_id FROM quotes q WHERE qac.quote_id = q.id AND qac.org_id IS NULL;
  
  -- quote_status_history
  ALTER TABLE quote_status_history ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE quote_status_history qsh SET org_id = q.org_id FROM quotes q WHERE qsh.quote_id = q.id AND qsh.org_id IS NULL;
  
  -- epc_site_surveys
  ALTER TABLE epc_site_surveys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE epc_site_surveys ess SET org_id = ep.org_id FROM epc_projects ep WHERE ess.project_id = ep.id AND ess.org_id IS NULL;
  
  -- epc_project_milestones
  ALTER TABLE epc_project_milestones ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE epc_project_milestones epm SET org_id = ep.org_id FROM epc_projects ep WHERE epm.project_id = ep.id AND epm.org_id IS NULL;
  
  -- epc_work_orders
  ALTER TABLE epc_work_orders ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE epc_work_orders ewo SET org_id = ep.org_id FROM epc_projects ep WHERE ewo.project_id = ep.id AND ewo.org_id IS NULL;
  
  -- field_service_tickets
  ALTER TABLE field_service_tickets ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE field_service_tickets fst SET org_id = ep.org_id FROM epc_projects ep WHERE fst.project_id = ep.id AND fst.org_id IS NULL;
  
  -- field_checklist_items
  ALTER TABLE field_checklist_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE field_checklist_items fci SET org_id = fst.org_id FROM field_service_tickets fst WHERE fci.ticket_id = fst.id AND fci.org_id IS NULL;
  
  -- inv_stock_balances
  ALTER TABLE inv_stock_balances ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE inv_stock_balances isb SET org_id = iw.org_id FROM inv_warehouses iw WHERE isb.warehouse_id = iw.id AND isb.org_id IS NULL;
  
  -- inv_transfer_items
  ALTER TABLE inv_transfer_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE inv_transfer_items iti SET org_id = it.org_id FROM inv_transfers it WHERE iti.transfer_id = it.id AND iti.org_id IS NULL;
  
  -- proc_rfq_items
  ALTER TABLE proc_rfq_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE proc_rfq_items pri SET org_id = pr.org_id FROM proc_rfqs pr WHERE pri.rfq_id = pr.id AND pri.org_id IS NULL;
  
  -- proc_po_items
  ALTER TABLE proc_po_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE proc_po_items ppi SET org_id = ppo.org_id FROM proc_purchase_orders ppo WHERE ppi.po_id = ppo.id AND ppi.org_id IS NULL;
  
  -- proc_grn_items
  ALTER TABLE proc_grn_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE proc_grn_items pgi SET org_id = pgrn.org_id FROM proc_goods_receipt_notes pgrn WHERE pgi.grn_id = pgrn.id AND pgi.org_id IS NULL;
  
  -- acc_journal_lines
  ALTER TABLE acc_journal_lines ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE acc_journal_lines ajl SET org_id = aje.org_id FROM acc_journal_entries aje WHERE ajl.entry_id = aje.id AND ajl.org_id IS NULL;
  
  -- acc_bank_statement_lines
  ALTER TABLE acc_bank_statement_lines ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
  UPDATE acc_bank_statement_lines absl SET org_id = abs.org_id FROM acc_bank_statements abs WHERE absl.statement_id = abs.id AND absl.org_id IS NULL;
END;
$$;

SELECT patch_denormalize_org_id();
DROP FUNCTION patch_denormalize_org_id();

-- Rewrite RLS policies to simple org_id queries for maximum indexing performance
DROP POLICY IF EXISTS "quote_items_via_quote" ON quote_items;
CREATE POLICY "quote_items_org_isolation" ON quote_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "quote_costs_via_quote" ON quote_additional_costs;
CREATE POLICY "quote_costs_org_isolation" ON quote_additional_costs FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "quote_history_via_quote" ON quote_status_history;
CREATE POLICY "quote_history_org_isolation" ON quote_status_history FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "quote_variants_via_quote" ON quote_variants;
CREATE POLICY "quote_variants_org_isolation" ON quote_variants FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "epc_site_surveys_via_project" ON epc_site_surveys;
CREATE POLICY "epc_site_surveys_org_isolation" ON epc_site_surveys FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "epc_project_milestones_via_project" ON epc_project_milestones;
CREATE POLICY "epc_project_milestones_org_isolation" ON epc_project_milestones FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "epc_work_orders_via_project" ON epc_work_orders;
CREATE POLICY "epc_work_orders_org_isolation" ON epc_work_orders FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "field_service_tickets_via_project" ON field_service_tickets;
CREATE POLICY "field_service_tickets_org_isolation" ON field_service_tickets FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "field_checklist_items_via_ticket" ON field_checklist_items;
CREATE POLICY "field_checklist_items_org_isolation" ON field_checklist_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "inv_stock_balances_via_warehouse" ON inv_stock_balances;
CREATE POLICY "inv_stock_balances_org_isolation" ON inv_stock_balances FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "inv_transfer_items_via_transfer" ON inv_transfer_items;
CREATE POLICY "inv_transfer_items_org_isolation" ON inv_transfer_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "proc_rfq_items_via_rfq" ON proc_rfq_items;
CREATE POLICY "proc_rfq_items_org_isolation" ON proc_rfq_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "proc_po_items_via_po" ON proc_po_items;
CREATE POLICY "proc_po_items_org_isolation" ON proc_po_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "proc_grn_items_via_grn" ON proc_grn_items;
CREATE POLICY "proc_grn_items_org_isolation" ON proc_grn_items FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "acc_journal_lines_via_entry" ON acc_journal_lines;
CREATE POLICY "acc_journal_lines_org_isolation" ON acc_journal_lines FOR ALL USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "acc_bank_statement_lines_via_statement" ON acc_bank_statement_lines;
CREATE POLICY "acc_bank_statement_lines_org_isolation" ON acc_bank_statement_lines FOR ALL USING (org_id = auth_org_id());


-- ─── 3. DOUBLE-ENTRY GENERAL LEDGER BALANCING TRIGGER ────────

CREATE OR REPLACE FUNCTION fn_assert_journal_entry_balanced()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT SUM(debit) - SUM(credit) INTO v_balance
  FROM acc_journal_lines
  WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);
  
  IF v_balance != 0 THEN
    RAISE EXCEPTION 'Journal Entry % is unbalanced by % INR. Total Debits must equal Total Credits.', 
      COALESCE(NEW.entry_id, OLD.entry_id), v_balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_journal_entry_balanced ON acc_journal_lines;
CREATE CONSTRAINT TRIGGER trg_assert_journal_entry_balanced
AFTER INSERT OR UPDATE OR DELETE ON acc_journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION fn_assert_journal_entry_balanced();


-- ─── 4. AUTOMATED JOURNAL ENTRY POSTINGS (SUB-LEDGERS) ────────

-- Dynamic account resolver helper
CREATE OR REPLACE FUNCTION get_or_create_account(p_org_id UUID, p_code TEXT, p_name TEXT, p_type acc_account_type)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM acc_accounts WHERE org_id = p_org_id AND code = p_code;
  IF NOT FOUND THEN
    INSERT INTO acc_accounts (org_id, code, name, type)
    VALUES (p_org_id, p_code, p_name, p_type)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- 4.1 AR Invoices -> GL Trigger
CREATE OR REPLACE FUNCTION fn_post_invoice_to_gl()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_entry_id UUID;
  v_proj_num TEXT;
  v_ar_acct UUID;
  v_rev_acct UUID;
  v_gst_acct UUID;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT project_number INTO v_proj_num FROM epc_projects WHERE id = NEW.project_id;
    
    -- Insert Header
    INSERT INTO acc_journal_entries (org_id, reference_no, description)
    VALUES (NEW.org_id, NEW.invoice_number, 'Customer Billing for Project ' || COALESCE(v_proj_num, ''))
    RETURNING id INTO v_entry_id;

    -- Resolve Accounts
    v_ar_acct  := get_or_create_account(NEW.org_id, '1200', 'Accounts Receivable', 'asset');
    v_rev_acct := get_or_create_account(NEW.org_id, '4000', 'Sales Revenue', 'revenue');
    v_gst_acct := get_or_create_account(NEW.org_id, '2200', 'GST Output Payable', 'liability');

    -- AR Debit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, project_id, org_id)
    VALUES (v_entry_id, v_ar_acct, NEW.total_invoice, 0.00, NEW.project_id, NEW.org_id);

    -- Revenue Credit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, project_id, org_id)
    VALUES (v_entry_id, v_rev_acct, 0.00, NEW.taxable_amount, NEW.project_id, NEW.org_id);

    -- GST Output Credit
    IF (NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount) > 0 THEN
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, project_id, org_id)
      VALUES (v_entry_id, v_gst_acct, 0.00, (NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount), NEW.project_id, NEW.org_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_invoice_to_gl ON acc_invoices;
CREATE TRIGGER trg_post_invoice_to_gl
AFTER INSERT OR UPDATE ON acc_invoices
FOR EACH ROW EXECUTE FUNCTION fn_post_invoice_to_gl();

-- 4.2 Payments -> GL Trigger
CREATE OR REPLACE FUNCTION fn_post_payment_to_gl()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_entry_id UUID;
  v_bank_acct UUID;
  v_tds_rec_acct UUID;
  v_tds_pay_acct UUID;
  v_ar_acct UUID;
  v_ap_acct UUID;
  v_ref_num TEXT;
BEGIN
  v_bank_acct := get_or_create_account(NEW.org_id, '1100', 'Bank Account', 'asset');
  
  IF NEW.invoice_id IS NOT NULL THEN
    -- Customer Payment (AR Receipt)
    SELECT invoice_number INTO v_ref_num FROM acc_invoices WHERE id = NEW.invoice_id;
    
    INSERT INTO acc_journal_entries (org_id, reference_no, description)
    VALUES (NEW.org_id, NEW.payment_number, 'Receipt for Invoice ' || COALESCE(v_ref_num, ''))
    RETURNING id INTO v_entry_id;

    v_ar_acct := get_or_create_account(NEW.org_id, '1200', 'Accounts Receivable', 'asset');
    v_tds_rec_acct := get_or_create_account(NEW.org_id, '1500', 'TDS Receivable', 'asset');

    -- Bank Debit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (v_entry_id, v_bank_acct, NEW.amount, 0.00, NEW.org_id);

    -- TDS Receivable Debit (Asset)
    IF NEW.tds_deducted > 0 THEN
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, v_tds_rec_acct, NEW.tds_deducted, 0.00, NEW.org_id);
    END IF;

    -- AR Credit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (v_entry_id, v_ar_acct, 0.00, NEW.amount + NEW.tds_deducted, NEW.org_id);

  ELIF NEW.po_id IS NOT NULL THEN
    -- Vendor Payment (AP Disbursement)
    SELECT po_number INTO v_ref_num FROM proc_purchase_orders WHERE id = NEW.po_id;

    INSERT INTO acc_journal_entries (org_id, reference_no, description)
    VALUES (NEW.org_id, NEW.payment_number, 'Vendor Payment for PO ' || COALESCE(v_ref_num, ''))
    RETURNING id INTO v_entry_id;

    v_ap_acct := get_or_create_account(NEW.org_id, '2000', 'Accounts Payable', 'liability');
    v_tds_pay_acct := get_or_create_account(NEW.org_id, '2300', 'TDS Payable', 'liability');

    -- AP Debit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (v_entry_id, v_ap_acct, NEW.amount + NEW.tds_deducted, 0.00, NEW.org_id);

    -- Bank Credit
    INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
    VALUES (v_entry_id, v_bank_acct, 0.00, NEW.amount, NEW.org_id);

    -- TDS Payable Credit (Liability)
    IF NEW.tds_deducted > 0 THEN
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, org_id)
      VALUES (v_entry_id, v_tds_pay_acct, 0.00, NEW.tds_deducted, NEW.org_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_payment_to_gl ON acc_payments;
CREATE TRIGGER trg_post_payment_to_gl
AFTER INSERT ON acc_payments
FOR EACH ROW EXECUTE FUNCTION fn_post_payment_to_gl();

-- 4.3 Inventory Issues -> GL Trigger
CREATE OR REPLACE FUNCTION fn_post_issue_to_gl()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_entry_id UUID;
  v_proj_num TEXT;
  v_expense_acct UUID;
  v_inventory_acct UUID;
  v_amount NUMERIC;
BEGIN
  IF NEW.transaction_type = 'issue_to_project' THEN
    v_amount := NEW.qty * NEW.unit_cost_wac;
    IF v_amount > 0 THEN
      SELECT project_number INTO v_proj_num FROM epc_projects WHERE id = NEW.project_id;
      
      INSERT INTO acc_journal_entries (org_id, reference_no, description)
      VALUES (NEW.org_id, NEW.id::text, 'Material Issue for Project ' || COALESCE(v_proj_num, ''))
      RETURNING id INTO v_entry_id;

      v_expense_acct := get_or_create_account(NEW.org_id, '5000', 'Material Cost / COGS', 'expense');
      v_inventory_acct := get_or_create_account(NEW.org_id, '1300', 'Inventory Asset', 'asset');

      -- Expense Debit
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, project_id, org_id)
      VALUES (v_entry_id, v_expense_acct, v_amount, 0.00, NEW.project_id, NEW.org_id);

      -- Inventory Asset Credit
      INSERT INTO acc_journal_lines (entry_id, account_id, debit, credit, project_id, org_id)
      VALUES (v_entry_id, v_inventory_acct, 0.00, v_amount, NEW.project_id, NEW.org_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_issue_to_gl ON inv_stock_transactions;
CREATE TRIGGER trg_post_issue_to_gl
AFTER INSERT ON inv_stock_transactions
FOR EACH ROW EXECUTE FUNCTION fn_post_issue_to_gl();


-- ─── 5. NEGATIVE STOCK WAC COST VALUATION PROTECTION ─────────

CREATE OR REPLACE FUNCTION update_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventory_summary (org_id, item_description, category, current_qty, weighted_avg_cost, last_updated)
    VALUES (NEW.org_id, NEW.item_description, NEW.category, NEW.change_qty, COALESCE(NEW.rate_at_time, 0), NOW())
    ON CONFLICT (org_id, item_description) DO UPDATE SET
        weighted_avg_cost = CASE 
            -- If stock is negative or empty, override previous WAC directly with new rate to prevent division bias
            WHEN inventory_summary.current_qty <= 0 THEN NEW.rate_at_time
            WHEN NEW.change_qty > 0 AND (inventory_summary.current_qty + NEW.change_qty) > 0 THEN
                ((inventory_summary.current_qty * inventory_summary.weighted_avg_cost) + (NEW.change_qty * NEW.rate_at_time)) / (inventory_summary.current_qty + NEW.change_qty)
            ELSE inventory_summary.weighted_avg_cost
        END,
        current_qty = inventory_summary.current_qty + NEW.change_qty,
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 6. ACQUISITION HEADER-TO-LINE VALIDATION TRIGGER ────────

CREATE OR REPLACE FUNCTION fn_validate_acquisition_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_items_sum NUMERIC;
    v_header_total NUMERIC;
    v_acq_id UUID;
BEGIN
    v_acq_id := COALESCE(NEW.acquisition_id, OLD.acquisition_id);
    
    SELECT COALESCE(SUM(qty * rate_per_unit * (1 + gst_pct)), 0.00)
    INTO v_items_sum
    FROM acquisition_items
    WHERE acquisition_id = v_acq_id;

    SELECT total_amount INTO v_header_total
    FROM acquisitions
    WHERE id = v_acq_id;

    IF ABS(v_items_sum - v_header_total) > 0.05 THEN
        RAISE EXCEPTION 'Acquisition total mismatch. Header amount is %, but the sum of items is %.',
            v_header_total, v_items_sum;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_acquisition_items_totals ON acquisition_items;
CREATE CONSTRAINT TRIGGER trg_validate_acquisition_items_totals
AFTER INSERT OR UPDATE OR DELETE ON acquisition_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION fn_validate_acquisition_totals();


-- ─── 7. COMPLIANCE WORKFLOWS & CONSTRAINTS ────────────────────

-- CGST & SGST must equal (and both must be set for intra-state) OR IGST set (for inter-state). Never both.
ALTER TABLE acc_invoices DROP CONSTRAINT IF EXISTS ck_india_gst_split;
ALTER TABLE acc_invoices ADD CONSTRAINT ck_india_gst_split CHECK (
  (igst_pct > 0 AND cgst_pct = 0 AND sgst_pct = 0) OR
  (igst_pct = 0 AND cgst_pct >= 0 AND sgst_pct = cgst_pct)
);

ALTER TABLE proc_purchase_orders DROP CONSTRAINT IF EXISTS ck_india_gst_split;
ALTER TABLE proc_purchase_orders ADD CONSTRAINT ck_india_gst_split CHECK (
  (igst_amount > 0 AND cgst_amount = 0 AND sgst_amount = 0) OR
  (igst_amount = 0 AND cgst_amount >= 0 AND sgst_amount = cgst_amount)
);

-- Update Outdated GST Seeds to legal rates (12% Panels, 18% Inverters/Batteries)
UPDATE eq_panels SET gst_pct = 0.12000;
UPDATE eq_inverters SET gst_pct = 0.18000;
UPDATE eq_batteries SET gst_pct = 0.18000;
