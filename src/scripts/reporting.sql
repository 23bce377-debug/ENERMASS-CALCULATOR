-- ==============================================================================
-- ENERMASS SOLAR EPC ERP — REPORTING & DASHBOARDS MATERIALIZED VIEWS
-- Focus: Performance Optimization (< 100ms dashboard reads)
-- ==============================================================================

BEGIN;

-- 1. Quote Pipeline Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_quote_pipeline AS
SELECT
  org_id,
  status,
  COUNT(*) AS quote_count,
  COALESCE(SUM(final_customer_price), 0) AS total_value,
  COALESCE(AVG(effective_margin_pct), 0) AS avg_margin_pct
FROM quotes
GROUP BY org_id, status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_quote_pipeline_org ON mv_quote_pipeline(org_id, status);

-- 2. Inventory Valuation
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_valuation AS
SELECT
  w.org_id,
  sb.warehouse_id,
  w.name AS warehouse_name,
  SUM(sb.qty_on_hand * sb.wac_price) AS total_valuation,
  COUNT(DISTINCT sb.item_id) AS unique_items_count
FROM inv_stock_balances sb
JOIN inv_warehouses w ON sb.warehouse_id = w.id
GROUP BY w.org_id, sb.warehouse_id, w.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_valuation_org ON mv_inventory_valuation(org_id, warehouse_id);

-- 3. Project Profitability
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_profitability AS
WITH budgeted_costs AS (
  SELECT 
    p.id AS project_id,
    SUM(qi.qty * qi.rate_per_unit) AS budget_material_cost
  FROM epc_projects p
  JOIN quotes q ON p.quote_id = q.id
  JOIN quote_items qi ON qi.quote_id = q.id
  WHERE qi.is_included = TRUE
  GROUP BY p.id
),
actual_materials AS (
  SELECT 
    project_id,
    SUM(qty * unit_cost_wac) AS actual_material_cost
  FROM inv_stock_transactions
  WHERE transaction_type = 'issue_to_project'
  GROUP BY project_id
),
actual_services AS (
  SELECT 
    project_id,
    SUM(taxable_amount) AS actual_labor_cost
  FROM acc_invoices
  WHERE status = 'posted'
  GROUP BY project_id
)
SELECT 
  p.org_id,
  p.id AS project_id,
  p.project_number,
  p.status AS project_status,
  COALESCE(bc.budget_material_cost, 0) AS budgeted_cost,
  COALESCE(am.actual_material_cost, 0) AS actual_material_cost,
  COALESCE(asv.actual_labor_cost, 0) AS actual_labor_cost,
  (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0)) AS total_actual_cost,
  (COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) AS gross_profit_variance,
  CASE 
    WHEN COALESCE(bc.budget_material_cost, 0) = 0 THEN 0
    ELSE ROUND(((COALESCE(bc.budget_material_cost, 0) - (COALESCE(am.actual_material_cost, 0) + COALESCE(asv.actual_labor_cost, 0))) / bc.budget_material_cost) * 100, 2)
  END AS margin_percentage_variance
FROM epc_projects p
LEFT JOIN budgeted_costs bc ON bc.project_id = p.id
LEFT JOIN actual_materials am ON am.project_id = p.id
LEFT JOIN actual_services asv ON asv.project_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_profitability_org ON mv_project_profitability(org_id, project_id);

-- 4. Procurement Spend
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_procurement_spend AS
SELECT
  po.org_id,
  po.vendor_id,
  v.name AS vendor_name,
  SUM(po.total_amount) AS total_spend,
  COUNT(po.id) AS total_pos
FROM proc_purchase_orders po
JOIN vendors v ON po.vendor_id = v.id
GROUP BY po.org_id, po.vendor_id, v.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_procurement_spend_org ON mv_procurement_spend(org_id, vendor_id);

-- 5. Accounts Receivable Aging
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ar_aging AS
SELECT
  org_id,
  id AS invoice_id,
  invoice_number,
  invoice_date,
  due_date,
  total_invoice,
  status,
  CURRENT_DATE - due_date AS days_overdue
FROM acc_invoices
WHERE status IN ('issued', 'partially_paid') AND due_date < CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ar_aging_org ON mv_ar_aging(org_id, invoice_id);

-- 6. Margin Trends
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_margin_trends AS
SELECT
  org_id,
  TO_CHAR(created_at, 'YYYY-MM') AS month_label,
  COUNT(*) AS won_quotes_count,
  AVG(effective_margin_pct) AS avg_margin_pct
FROM quotes
WHERE status = 'won'
GROUP BY org_id, TO_CHAR(created_at, 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_margin_trends_org ON mv_margin_trends(org_id, month_label);

-- 7. Vendor Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vendor_performance AS
SELECT
  po.org_id,
  po.vendor_id,
  v.name AS vendor_name,
  COUNT(DISTINCT po.id) AS total_orders,
  AVG(grn.receipt_date - po.delivery_date)::numeric(8,2) AS avg_delay_days
FROM proc_purchase_orders po
JOIN vendors v ON po.vendor_id = v.id
LEFT JOIN proc_goods_receipt_notes grn ON grn.po_id = po.id
GROUP BY po.org_id, po.vendor_id, v.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vendor_performance_org ON mv_vendor_performance(org_id, vendor_id);


-- Concurrent refresh procedure (Server Action/cron triggers this)
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_quote_pipeline;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_valuation;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_profitability;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_procurement_spend;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ar_aging;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_margin_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendor_performance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
