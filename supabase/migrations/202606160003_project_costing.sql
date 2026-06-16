-- ==============================================================================
-- PHASE 6: PROJECT COSTING AND PROFITABILITY
-- Migration Date: 2026-06-16
-- Description: Adds WIP, revenue recognition tracking, and updates profitability view
-- ==============================================================================

-- 1. Add Tracking Fields to epc_projects
ALTER TABLE epc_projects ADD COLUMN budgeted_cost numeric DEFAULT 0;
ALTER TABLE epc_projects ADD COLUMN actual_cost numeric DEFAULT 0;
ALTER TABLE epc_projects ADD COLUMN recognized_revenue numeric DEFAULT 0;
ALTER TABLE epc_projects ADD COLUMN wip_balance numeric DEFAULT 0;

-- 2. Refactor v_project_profitability to run off actual Journal Entries
-- Currently it probably runs off quotes/estimates. We redefine it to read acc_journal_lines
DROP VIEW IF EXISTS v_project_profitability CASCADE;

CREATE OR REPLACE VIEW v_project_profitability AS
SELECT 
    p.id AS project_id,
    p.org_id,
    p.project_no,
    p.name AS project_name,
    p.status,
    p.budgeted_cost,
    
    -- Actual Revenue is the total credit to Revenue Accounts (type='revenue') for this project
    COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'revenue'), 0) - 
    COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'revenue'), 0) AS actual_revenue,
    
    -- Actual Cost is the total debit to COGS/Expense Accounts (type='expense') for this project
    COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'expense'), 0) - 
    COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'expense'), 0) AS actual_cogs,
    
    -- Profit = Revenue - COGS
    (
      COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'revenue'), 0) - 
      COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'revenue'), 0)
    ) - 
    (
      COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'expense'), 0) - 
      COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'expense'), 0)
    ) AS gross_profit,

    -- Margin %
    CASE 
        WHEN (
          COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'revenue'), 0) - 
          COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'revenue'), 0)
        ) > 0 
        THEN 
            (
              (
                COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'revenue'), 0) - 
                COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'revenue'), 0)
              ) - 
              (
                COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'expense'), 0) - 
                COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'expense'), 0)
              )
            ) / 
            (
              COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'revenue'), 0) - 
              COALESCE(SUM(jl.debit) FILTER (WHERE a.type = 'revenue'), 0)
            ) * 100
        ELSE 0 
    END AS gross_margin_pct

FROM epc_projects p
LEFT JOIN acc_journal_lines jl ON p.id = jl.project_id
LEFT JOIN acc_accounts a ON jl.account_id = a.id
GROUP BY p.id, p.org_id, p.project_no, p.name, p.status, p.budgeted_cost;
