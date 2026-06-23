-- 202606280002_materialized_views.sql
-- Creates the underlying mv_ materialized views,
-- adds unique indexes to support concurrent refresh,
-- and recreates the v_ wrapper views to enforce RLS/auth filters.

BEGIN;

-- ============================================================
-- 1. DROP Existing Views / Materialized Views Defensively
-- ============================================================

DROP VIEW IF EXISTS public.v_margin_trends CASCADE;
DROP VIEW IF EXISTS public.v_project_profitability CASCADE;
DROP VIEW IF EXISTS public.v_procurement_spend CASCADE;
DROP VIEW IF EXISTS public.v_ar_aging CASCADE;
DROP VIEW IF EXISTS public.v_vendor_performance CASCADE;
DROP VIEW IF EXISTS public.v_inventory_valuation CASCADE;
DROP VIEW IF EXISTS public.v_quote_summary CASCADE;
DROP VIEW IF EXISTS public.v_vendor_retention CASCADE;

DROP MATERIALIZED VIEW IF EXISTS public.mv_margin_trends CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_project_profitability CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_procurement_spend CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_ar_aging CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendor_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_inventory_valuation CASCADE;

-- ============================================================
-- 2. CREATE Materialized Views (mv_ prefixed)
-- ============================================================

-- mv_margin_trends
CREATE MATERIALIZED VIEW public.mv_margin_trends AS
SELECT 
  org_id,
  to_char(created_at, 'YYYY-MM') AS month_label,
  count(id)::int AS won_quotes_count,
  COALESCE(avg(effective_margin_pct), 0)::numeric(5,4) AS avg_margin_pct
FROM public.quotes
WHERE status = 'won'
GROUP BY org_id, to_char(created_at, 'YYYY-MM');

CREATE UNIQUE INDEX idx_mv_margin_trends_org_month ON public.mv_margin_trends (org_id, month_label);


-- mv_project_profitability
CREATE MATERIALIZED VIEW public.mv_project_profitability AS
SELECT 
  p.org_id,
  p.id AS project_id,
  p.project_number,
  p.status::text AS project_status,
  COALESCE(p.budgeted_cost, 0)::numeric(14,4) AS budgeted_cost,
  COALESCE(SUM(jl.debit) FILTER (WHERE a.name ILIKE '%material%'), 0)::numeric(14,4) AS actual_material_cost,
  COALESCE(SUM(jl.debit) FILTER (WHERE a.name ILIKE '%labor%'), 0)::numeric(14,4) AS actual_labor_cost,
  COALESCE(p.actual_cost, 0)::numeric(14,4) AS total_actual_cost,
  (COALESCE(p.budgeted_cost, 0) - COALESCE(p.actual_cost, 0))::numeric(14,4) AS gross_profit_variance,
  COALESCE(
    CASE 
      WHEN p.budgeted_cost > 0 
      THEN ((p.budgeted_cost - p.actual_cost) / p.budgeted_cost * 100) 
      ELSE 0 
    END, 
    0
  )::numeric(5,2) AS margin_percentage_variance
FROM public.epc_projects p
LEFT JOIN public.acc_journal_lines jl ON p.id = jl.project_id
LEFT JOIN public.acc_accounts a ON jl.account_id = a.id
GROUP BY p.id, p.org_id, p.project_number, p.status, p.budgeted_cost, p.actual_cost;

CREATE UNIQUE INDEX idx_mv_project_profitability_id ON public.mv_project_profitability (project_id);


-- mv_procurement_spend
CREATE MATERIALIZED VIEW public.mv_procurement_spend AS
SELECT 
  po.org_id,
  po.vendor_id,
  v.name AS vendor_name,
  SUM(po.total_amount)::numeric(14,4) AS total_spend,
  count(po.id)::int AS total_pos
FROM public.proc_purchase_orders po
JOIN public.vendors v ON po.vendor_id = v.id
WHERE po.status != 'cancelled'
GROUP BY po.org_id, po.vendor_id, v.name;

CREATE UNIQUE INDEX idx_mv_procurement_spend_org_vendor ON public.mv_procurement_spend (org_id, vendor_id);


-- mv_ar_aging
CREATE MATERIALIZED VIEW public.mv_ar_aging AS
SELECT 
  inv.org_id,
  inv.id AS invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.due_date,
  inv.total_invoice,
  inv.status::text AS status,
  CASE 
    WHEN inv.status::text IN ('unpaid', 'partially_paid') AND inv.due_date < CURRENT_DATE 
    THEN (CURRENT_DATE - inv.due_date)::int 
    ELSE 0 
  END AS days_overdue
FROM public.acc_invoices inv;

CREATE UNIQUE INDEX idx_mv_ar_aging_invoice_id ON public.mv_ar_aging (invoice_id);


-- mv_vendor_performance
CREATE MATERIALIZED VIEW public.mv_vendor_performance AS
SELECT 
  po.org_id,
  v.id AS vendor_id,
  v.name AS vendor_name,
  count(po.id)::int AS total_orders,
  COALESCE(avg(extract(epoch from (grn.receipt_date::timestamp - po.created_at)) / 86400), 0)::numeric(5,2) AS avg_delay_days
FROM public.vendors v
JOIN public.proc_purchase_orders po ON po.vendor_id = v.id
LEFT JOIN public.proc_goods_receipt_notes grn ON grn.po_id = po.id
GROUP BY po.org_id, v.id, v.name;

CREATE UNIQUE INDEX idx_mv_vendor_perf_org_vendor ON public.mv_vendor_performance (org_id, vendor_id);


-- mv_inventory_valuation
CREATE MATERIALIZED VIEW public.mv_inventory_valuation AS
SELECT 
  w.org_id,
  sb.warehouse_id,
  w.name AS warehouse_name,
  SUM(sb.qty_on_hand * sb.wac_price)::numeric(14,4) AS total_valuation,
  COUNT(DISTINCT sb.catalog_item_id)::int AS unique_items_count
FROM public.inv_stock_balances sb
JOIN public.inv_warehouses w ON sb.warehouse_id = w.id
GROUP BY w.org_id, sb.warehouse_id, w.name;

CREATE UNIQUE INDEX idx_mv_inventory_valuation_wh ON public.mv_inventory_valuation (warehouse_id);


-- ============================================================
-- 3. CREATE Wrapper Views (v_ prefixed) that filter by org
-- ============================================================

-- v_margin_trends
CREATE OR REPLACE VIEW public.v_margin_trends AS
SELECT org_id, month_label, won_quotes_count, avg_margin_pct
FROM public.mv_margin_trends
WHERE org_id = public.auth_org_id();

-- v_project_profitability
CREATE OR REPLACE VIEW public.v_project_profitability AS
SELECT org_id, project_id, project_number, project_status, budgeted_cost, 
       actual_material_cost, actual_labor_cost, total_actual_cost, 
       gross_profit_variance, margin_percentage_variance
FROM public.mv_project_profitability
WHERE org_id = public.auth_org_id();

-- v_procurement_spend
CREATE OR REPLACE VIEW public.v_procurement_spend AS
SELECT org_id, vendor_id, vendor_name, total_spend, total_pos
FROM public.mv_procurement_spend
WHERE org_id = public.auth_org_id();

-- v_ar_aging
CREATE OR REPLACE VIEW public.v_ar_aging AS
SELECT org_id, invoice_id, invoice_number, invoice_date, due_date, total_invoice, status, days_overdue
FROM public.mv_ar_aging
WHERE org_id = public.auth_org_id();

-- v_vendor_performance
CREATE OR REPLACE VIEW public.v_vendor_performance AS
SELECT org_id, vendor_id, vendor_name, total_orders, avg_delay_days
FROM public.mv_vendor_performance
WHERE org_id = public.auth_org_id();

-- v_inventory_valuation
CREATE OR REPLACE VIEW public.v_inventory_valuation AS
SELECT org_id, warehouse_id, warehouse_name, total_valuation, unique_items_count
FROM public.mv_inventory_valuation
WHERE org_id = public.auth_org_id();

-- v_quote_summary
CREATE OR REPLACE VIEW public.v_quote_summary AS
SELECT 
  q.id AS id,
  q.org_id AS org_id,
  q.quote_number AS quote_number,
  q.status AS status,
  q.project_type AS project_type,
  q.customer_name AS customer_name,
  q.customer_phone AS customer_phone,
  s.state_name AS state_name,
  q.system_name AS system_name,
  q.system_capacity_kw AS system_capacity_kw,
  q.system_category AS system_category,
  q.mrp_incl_gst AS mrp_incl_gst,
  q.subsidy_amount AS subsidy_amount,
  q.beneficiary_contribution AS beneficiary_contribution,
  q.discount_type AS discount_type,
  q.discount_amount AS discount_amount,
  q.panel_brand_model AS panel_brand_model,
  q.panel_qty AS panel_qty,
  q.inverter_brand_model AS inverter_brand_model,
  q.created_at AS created_at,
  q.updated_at AS updated_at,
  q.valid_until AS valid_until,
  q.exec_name AS exec_name,
  q.version AS version
FROM public.quotes q
LEFT JOIN public.state_rules s ON q.state_id = s.id
WHERE q.org_id = public.auth_org_id();


-- v_vendor_retention
CREATE OR REPLACE VIEW public.v_vendor_retention AS
SELECT 
  vp.id,
  p.org_id,
  p.project_number,
  v.name AS vendor_name,
  vp.invoice_number,
  vp.invoice_amount,
  vp.retention_amount,
  vp.retention_percent,
  vp.status,
  vp.created_at
FROM public.vendor_payments vp
JOIN public.vendors v ON vp.vendor_id = v.id
JOIN public.epc_projects p ON vp.project_id = p.id
WHERE p.org_id = public.auth_org_id();

COMMIT;
