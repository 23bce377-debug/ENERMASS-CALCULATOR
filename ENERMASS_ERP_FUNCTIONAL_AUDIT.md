# ENERMASS ERP — FUNCTIONAL AUDIT REPORT

**Date:** 2026-06-11
**Auditor Role:** Principal ERP Functional Auditor
**Trigger:** Post database normalization and master-data restructuring
**Schema Version Audited:** 2.0.0 (post-migration)

---

## EXECUTIVE SUMMARY

The normalization migration was architecturally correct and largely successful. However, **6 P0 broken business flows** were identified — all caused by the same class of problem: **application code, UI components, and backend services were not updated to match the new schema after migration**. The ORM and UI still reference pre-migration column names, deprecated tables, and missing RPC functions.

---

## PART 1 — FUNCTIONAL AUDIT REPORT

### Module-by-Module Assessment

---

### CALCULATOR MODULE

| Check | Status |
|---|---|
| System template loading | PASS — via /api/erp/bootstrap |
| State/irradiance lookup | PASS |
| BOM generation from system_items | PASS |
| Subsidy calculation (PM Surya Ghar) | PASS — calculate_subsidy() RPC confirmed |
| Energy/payback projections | PASS (client-side formula) |
| Rate master overrides | PARTIAL — see P0-03 |
| Structure pricing (weight-based) | PASS — get_structure_rate() RPC confirmed |
| Structure pricing (ERP/template mode) | FAIL P0 — see P0-01 |

**Critical Note — Column Drift:**
The `schema.sql` declares `eq_panels.rate_per_watt` and `eq_panels.rate_per_panel`. The live DB has only `selling_price` and `buy_price`. `dbCalculator.ts` L196 has a fallback: `ratePerWatt: Number(p.rate_per_watt || (Number(p.selling_price) / Number(p.wattage_w)))`. This masks the mismatch. Similarly `eq_inverters` has `selling_price` in the live DB but `schema.sql` declares `rate`. `dbCalculator.ts` L204 handles it with `inv.selling_price || inv.rate`. These are **defensive but fragile** workarounds.

---

### QUOTES MODULE

| Check | Status |
|---|---|
| Create Quote | PASS |
| Quote number auto-generation | PASS — fn_generate_quote_number() confirmed |
| Duplicate Quote | P2 — no dedicated duplicate logic; UI manually reconstructs |
| Quote status pipeline (draft to sent to won to lost) | PASS |
| Quote status history | P1 — SPLIT BRAIN: two tables exist (quote_history AND quote_status_history). DB trigger writes to quote_history, but ORM reads quote_status_history. History always appears empty in UI. |
| Optimistic locking | PASS (version column) |
| Rate drift validation on save | P1 — validates against selling_price but schema.sql declares a different column name |

---

### QUOTE VARIANTS MODULE

| Check | Status |
|---|---|
| Create variant | PASS — table exists, ORM correct |
| Variant pricing overrides | PASS — JSONB snapshot approach is functional |
| Promoting variant to active | P2 — is_selected flag on quote_variants has no DB uniqueness constraint. Multiple variants can be selected simultaneously. |
| Variant to Quote conversion | FAIL — No implementation found; UI missing |

---

### PROJECTS MODULE

| Check | Status |
|---|---|
| Quote to Project conversion | PASS — fn_trigger_create_project_on_win fires on quotes.status = won |
| Project milestone seeding | PASS — fn_trigger_seed_project_milestones confirmed |
| Project status progression | PASS — epc_projects ORM operational |
| Site survey capture | PASS — epc_site_surveys table exists, ORM correct |
| PM assignment | PASS — ORM correct |
| Work orders | Table exists (epc_work_orders) — not surfaced in UI |

---

### COMMISSIONING MODULE

| Check | Status |
|---|---|
| Commissioning report creation | WARNING — ORM targets epc_commissioning_reports (EXISTS in DB) but workflow.ts uses (supabase as any) cast — no type-safety |
| Customer sign-off | PASS — field exists |
| Net meter number capture | PASS — field exists |
| Report linked to project | PASS — project_id FK exists |

---

### WARRANTY MODULE

| Check | Status |
|---|---|
| Warranty claim creation | FAIL P0 — proc_warranty_claims table EXISTS with correct columns. WarrantyClaim interface in workflow.ts does not enforce org_id which is NOT NULL in DB. All inserts will fail if org_id is absent. |
| Claim linked to asset | PASS — asset_id FK exists |
| Claim linked to vendor | PASS — vendor_id FK exists |
| UI for warranty claims | FAIL — No page found in /src/app/ |

---

### AMC MODULE (Annual Maintenance Contracts)

| Check | Status |
|---|---|
| AMC contract creation | FAIL — field_amc_contracts table exists with all fields. No ORM in /src/backend/orm/. No UI page. |
| AMC linked to asset | PASS — asset_id FK exists |
| Visit tracking | PASS — completed_visits + visits_per_year columns exist |
| AMC to Service Ticket | FAIL — field_service_tickets has project_id FK but no amc_contract_id FK. AMC visits cannot be formally linked to service tickets. |

---

### PROCUREMENT MODULE

| Check | Status |
|---|---|
| Purchase Orders | PASS — proc_purchase_orders, proc_po_items tables exist |
| RFQ management | PASS — proc_rfqs, proc_rfq_items, proc_vendor_bids exist |
| GRN (Goods Receipt) | PASS — proc_goods_receipt_notes, proc_grn_items exist; process_grn_receipt RPC confirmed |
| Procurement list from BOM | P2 — No automated Project to PO generation found |
| Analytics endpoint | PASS — /api/procurement/analytics exists |

---

### ACQUISITION AND INVENTORY MODULE

| Check | Status |
|---|---|
| Create Acquisition | FAIL P0 — calls create_acquisition_atomic RPC which does not exist in DB |
| Mark as Received | PASS — mark_acquisition_as_received RPC confirmed |
| Inventory ledger | PASS — inventory_ledger table exists |
| Inventory summary | PASS — inventory_summary view exists |
| Stock balances | PASS — inv_stock_balances exists |
| Bundle Preset create | FAIL P0 — create_bundle_preset_atomic RPC does not exist in DB |
| Bundle Preset update | FAIL P0 — update_bundle_preset_atomic RPC does not exist in DB |
| Catalog linkage | PASS — catalog_items exists; catalog_item_id FK added via migration 09 |

---

### VENDORS AND CRM MODULE

| Check | Status |
|---|---|
| Vendor CRUD | PASS — vendors table correct post-migration (has is_structure_vendor flag) |
| CRM Leads | Table exists (crm_leads) — No UI |
| CRM Opportunities | Table exists (crm_opportunities) — No UI |
| CRM Timeline | Table exists (crm_timeline) — No UI |

---

### DASHBOARDS AND REPORTING MODULE

| Check | Status |
|---|---|
| Dashboard config | PASS — sys_dashboards table; getDashboardConfig ORM correct |
| v_quote_summary | PASS — View exists |
| v_margin_trends | PASS — View exists |
| v_procurement_spend | PASS — View exists |
| v_project_profitability | PASS — View exists |
| v_ar_aging | PASS — View exists |
| v_vendor_performance | PASS — View exists |
| v_inventory_valuation | PASS — View exists |
| Accounting GL | PASS — Full acc_* table family exists |
| Dashboard UI pages | FAIL — No /app/dashboards or /app/reporting routes |

---

## PART 2 — WORKFLOW INTEGRITY REPORT

| Scenario | Result | Notes |
|---|---|---|
| Create Quote | PASS | Full flow operational |
| Duplicate Quote | PARTIAL | UI reconstructs manually; no atomic duplicate RPC |
| Create Variant | PASS | Table and ORM correct |
| Convert Quote to Project | PASS | DB trigger fires automatically on status=won |
| Generate BOM | PARTIAL | Legacy structure_vendors still queried in dbCalculator.ts — will silently error |
| Generate Procurement List | FAIL | No automated Project to PO workflow |
| Receive Inventory (Mark as Received) | PASS | RPC exists |
| Consume Inventory (Create Acquisition) | FAIL | create_acquisition_atomic RPC missing from DB |
| Generate Invoice | PASS | fn_generate_invoice_number + acc_invoices table exists |
| Create Warranty Claim | FAIL | Interface missing org_id enforcement; no UI page |
| Create AMC Contract | FAIL | No ORM, no UI page for field_amc_contracts |

---

## PART 3 — MASTER DATA USAGE REPORT

| Table | Schema Status | ORM | UI | Issues |
|---|---|---|---|---|
| organisations | OK | YES | YES | — |
| profiles | OK | YES | YES | — |
| state_rules | OK | YES | YES | — |
| calculation_schemes | OK | YES | YES | — |
| scheme_slabs | OK | YES | YES | — |
| state_scheme_overrides | OK | YES | YES | — |
| eq_panels | OK (live: selling_price + buy_price) | YES | YES | schema.sql shows rate_per_watt — outdated |
| eq_inverters | OK (live: selling_price + buy_price) | YES | YES | schema.sql shows rate — outdated |
| eq_batteries | OK | YES | YES | — |
| eq_meters | OK | YES | YES | — |
| eq_lightning_arresters | OK | YES | YES | — |
| eq_mounting_structures | OK | YES | YES | — |
| eq_bom_items | OK | YES | YES | — |
| eq_communication_devices | OK | YES | YES | — |
| eq_structure_components | OK (post-migration) | YES | BROKEN | UI still references rate_appolo, rate_tata, rate_deemac — columns GONE |
| structure_component_vendor_rates | OK (new, post-migration) | YES | NO | UI not updated to use new table |
| structure_accessory_rates | OK | YES | NO | No admin page |
| rate_master | OK in live (has item_name col) | PARTIAL | YES | schema.sql missing item_name; ORM upsert uses it OK; seed data broken |
| systems + system_items | OK | YES | YES | — |
| vendors | OK | YES | YES | — |
| structure_vendors | DEPRECATED (renamed structure_vendors_deprecated) | NO | NO | 3 code locations still query this table name |
| catalog_items | OK | NO | NO | No explicit ORM |
| custom_presets | OK | YES | YES | — |
| bundle_presets | OK | YES | YES | RPC functions missing — feature broken |
| walkway_templates | OK | YES | YES | — |
| ladder_templates | OK | YES | YES | — |
| crm_leads | OK | NO | NO | Fully unimplemented in frontend |
| crm_opportunities | OK | NO | NO | Fully unimplemented in frontend |
| field_amc_contracts | OK | NO | NO | Fully unimplemented in frontend |

---

## PART 4 — DEPRECATED ARCHITECTURE USAGE REPORT

### Tables Still Queried After Being Renamed

| Deprecated Table | Migration | Active Code Locations | Severity |
|---|---|---|---|
| structure_vendors | Migration 04 — renamed to structure_vendors_deprecated | 3 (bootstrap route.ts, dbCalculator.ts, structures/page.tsx) | P0 |
| gst_master | Migration 06 — renamed to gst_master_deprecated | schema.types.ts type still exported | P2 |
| pricing_reference | Migration 06 — renamed | schema.types.ts type still exported | P2 |
| engineering_rules_metadata | Migration 06 — renamed | schema.types.ts type still exported | P2 |
| quote_history | Superseded by quote_status_history | DB trigger writes here; ORM reads quote_status_history | P0 |

### Columns Removed But Still Referenced in Application Code

| Removed Column | Table | Where Referenced | Severity |
|---|---|---|---|
| rate_appolo | eq_structure_components | structures/page.tsx L1091, EquipmentSelector.tsx L3431 | P0 |
| rate_tata | eq_structure_components | structures/page.tsx L1092, EquipmentSelector.tsx | P0 |
| rate_deemac | eq_structure_components | structures/page.tsx L1093, EquipmentSelector.tsx | P0 |
| rate_per_watt | eq_panels | dbCalculator.ts L196 (fallback exists — will not crash) | P1 |
| rate (inverter) | eq_inverters | dbCalculator.ts L204 (fallback exists — will not crash) | P1 |

### RPC Functions Called in Application Code But Not Deployed to DB

| Missing RPC | Called By | Severity |
|---|---|---|
| create_acquisition_atomic | acquisition.ts L159 | P0 |
| create_bundle_preset_atomic | bundle.ts L26 | P0 |
| update_bundle_preset_atomic | bundle.ts L35 | P0 |

---

## PART 5 — PRIORITIZED FIX LIST

---

### P0 — BROKEN BUSINESS FLOWS (Fix Immediately — System Non-Operational)

#### P0-01: Three code locations query structure_vendors (deprecated table)

**Symptom:** `src/app/api/erp/bootstrap/route.ts` ~L65, `src/lib/engine/dbCalculator.ts` ~L183, and `src/app/master/structures/page.tsx` ~L138 all call `.from('structure_vendors')`. This table was renamed to `structure_vendors_deprecated` in Migration 04. All three locations throw "relation does not exist" in production.

**Fix:**
- Change all three callsites: `.from('structure_vendors')` → `.from('vendors').eq('is_structure_vendor', true)`
- Update bootstrap response shape: remove `structureVendors` key, replace with `vendors` filtered by flag (already fetched at L60)
- No data migration needed — the vendors table already has the `is_structure_vendor` boolean column populated

---

#### P0-02: Structure component UI reads rate_appolo, rate_tata, rate_deemac (columns dropped in Migration 05)

**Symptom:** `structures/page.tsx` L1082-1093 renders a table with "Rs Appolo", "Rs Tata", "Rs Deemac" columns. These columns were dropped in Migration 05 when vendor rates were normalized into `structure_component_vendor_rates`. The query returns records but all three price columns are `undefined` — every row shows blank pricing.

**Fix:**
- Update `StructureComponent` interface in `structures/page.tsx` (L76-88): Remove `rate_appolo`, `rate_tata`, `rate_deemac`. Add `vendor_rates` fetched from `structure_component_vendor_rates`
- Query `v_structure_components_with_rates` view instead (created in Migration 05, already joins vendor rates correctly)
- Apply identical fix in `EquipmentSelector.tsx` L38 and L3431 where the same interface is consumed

---

#### P0-03: create_acquisition_atomic RPC does not exist in DB

**Symptom:** Creating any new acquisition order calls `supabase.rpc('create_acquisition_atomic', ...)` at `acquisition.ts:159`. This function is not deployed. Every acquisition creation throws: "Could not find the function public.create_acquisition_atomic in the schema cache".

**Fix:** Deploy the following PL/pgSQL function via Supabase SQL editor:

```sql
CREATE OR REPLACE FUNCTION create_acquisition_atomic(
  p_acquisition JSONB,
  p_items JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_acq_id UUID;
  v_result JSONB;
BEGIN
  INSERT INTO acquisitions
  SELECT * FROM jsonb_populate_record(null::acquisitions, p_acquisition)
  RETURNING id INTO v_acq_id;

  INSERT INTO acquisition_items
  SELECT v_acq_id, * FROM jsonb_populate_recordset(null::acquisition_items, p_items);

  SELECT row_to_json(a) INTO v_result FROM acquisitions a WHERE a.id = v_acq_id;
  RETURN v_result;
END;
$$;
```

---

#### P0-04: create_bundle_preset_atomic and update_bundle_preset_atomic RPCs do not exist

**Symptom:** `bundle.ts` L26 calls `create_bundle_preset_atomic` and L35 calls `update_bundle_preset_atomic`. Neither exists in the DB. The entire Bundle Preset feature is non-functional — creates and updates both throw RPC not found errors.

**Fix:** Deploy both RPCs. Pattern: insert into `bundle_presets`, then `bundle_preset_items` in one transaction. For update: upsert `bundle_presets` + delete existing items + re-insert new items atomically.

---

#### P0-05: Quote status history split-brain

**Symptom:** The DB function `fn_log_quote_history` fires as a trigger on the `quotes` table and writes status change records to the `quote_history` table. The `QuoteStatusHistoryORM` reads from `quote_status_history`. These are two different tables. As a result, the status history timeline in the quote detail UI is always empty, even after real status transitions.

**Fix:**
1. Check which table has live data: `SELECT COUNT(*) FROM quote_history; SELECT COUNT(*) FROM quote_status_history;`
2. `quote_status_history` is the schema.sql-declared canonical table
3. Update `fn_log_quote_history` to `INSERT INTO quote_status_history` instead of `quote_history`
4. If `quote_history` has existing live data, migrate it: `INSERT INTO quote_status_history SELECT ... FROM quote_history ON CONFLICT DO NOTHING;`

---

#### P0-06: WarrantyClaim interface missing org_id — all warranty claim inserts fail

**Symptom:** `proc_warranty_claims.org_id` is `NOT NULL` in the DB. The `createWarrantyClaim` ORM function in `workflow.ts` inserts the record. However there is no UI page to call this function, meaning `org_id` is never passed from a user session context. Any direct API call that omits `org_id` will fail with a NOT NULL constraint violation.

**Fix:**
1. Create `/src/app/warranty/page.tsx` with a proper form
2. In the server action, always source `org_id` from `await getOrganisationId()` (same pattern as other ORMs), never accept it from form input
3. Enforce this at the ORM layer — add `org_id` auto-injection in `createWarrantyClaim`

---

### P1 — INCORRECT BUSINESS LOGIC (Fix This Week)

#### P1-01: schema.sql is out of sync with production database

`schema.sql` declares `eq_panels.rate_per_watt`, `eq_panels.rate_per_panel` (generated), and `eq_inverters.rate`. Production has `selling_price + buy_price` on all equipment tables. The `schema.sql` is a documentation liability. Any developer reading it gets a false picture of the schema.

**Fix:** `pg_dump --schema-only -h db.xjdqpwmizmfkcdcgcxqv.supabase.co -U postgres > schema.sql` and commit the regenerated file.

---

#### P1-02: Rate drift validation in QuoteORM.create() uses fuzzy string matching

`quote.ts` L53-55 matches panel brand/model via `.includes()` on string values. A panel named "Adani" would fuzzy-match "Adani 580W" AND potentially another model. A wrong match triggers a false rate drift warning that blocks quote saving.

**Fix:** Pass `panel_id`, `inverter_id`, `battery_id` UUIDs directly in the quote payload. Look up by PK (`eq('id', panelId)`) instead of string fuzzing.

---

#### P1-03: rate_master schema mismatch between schema.sql and production

`schema.sql` L500-511 defines `rate_master` with `bom_item_id UUID NOT NULL` and unique constraint `(org_id, bom_item_id)`. Production has `bom_item_id` as nullable, an additional `item_name TEXT NOT NULL`, and unique constraint `(org_id, item_name)`. The seed data at `schema.sql` L1529-1541 inserts with a column named `description` that does not exist in either version. The seed will fail on any fresh environment.

**Fix:** Update `schema.sql` rate_master section to match production schema. Fix seed data to use `item_name`.

---

#### P1-04: quote_variants.is_selected has no DB-level uniqueness constraint

Multiple variants on a quote can all have `is_selected = TRUE` simultaneously. There is no constraint preventing this. Downstream logic for "convert selected variant to project" becomes ambiguous.

**Fix:**
```sql
CREATE UNIQUE INDEX uq_one_selected_variant
ON quote_variants(quote_id)
WHERE is_selected = TRUE;
```

---

#### P1-05: field_service_tickets has no amc_contract_id FK; completed_visits has no auto-increment

AMC service visits have no formal link to the contract that spawned them. The `completed_visits` counter on `field_amc_contracts` has no trigger to auto-increment when a ticket is marked complete.

**Fix:**
```sql
ALTER TABLE field_service_tickets
ADD COLUMN amc_contract_id UUID REFERENCES field_amc_contracts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION fn_increment_amc_completed_visits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.amc_contract_id IS NOT NULL THEN
    UPDATE field_amc_contracts
    SET completed_visits = completed_visits + 1
    WHERE id = NEW.amc_contract_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_amc_visits
AFTER UPDATE ON field_service_tickets
FOR EACH ROW EXECUTE FUNCTION fn_increment_amc_completed_visits();
```

---

### P2 — UX AND PROCESS GAPS (Fix This Sprint)

| ID | Gap | Description |
|---|---|---|
| P2-01 | No Warranty UI page | /src/app/warranty/ does not exist. Table and ORM exist but are invisible to users. |
| P2-02 | No AMC UI page | /src/app/amc/ does not exist. field_amc_contracts is operational at DB level but invisible. |
| P2-03 | No CRM UI pages | crm_leads, crm_opportunities, crm_timeline all exist with no UI surfaces. |
| P2-04 | No Dashboards/Reporting pages | 8 materialized views exist with no /app/dashboards or /app/reporting route. |
| P2-05 | No atomic Quote Duplicate | Duplicate requires re-implementing the full BOM snapshot client-side. Should be a single server action or RPC. |
| P2-06 | Structure Accessory Rates unmanageable | structure_accessory_rates has no admin page. Rates are effectively frozen at migration seed values. |
| P2-07 | schema.types.ts exports deprecated table types | gst_master, pricing_reference, engineering_rules_metadata types still exported. Misleads developers. |
| P2-08 | No Project to PO generation workflow | When a project enters engineering_design phase, no automated procurement list is generated from the project BOM. Manual process only. |
| P2-09 | structure_component_vendor_rates has no admin UI | The normalized vendor rates table cannot be edited without direct DB access. |
| P2-10 | epc_work_orders has no UI | Work orders exist in DB but are not surfaced in the Projects module. |

---

## SUMMARY SCORECARD

| Category | Count |
|---|---|
| **P0 Broken Business Flows** | **6** |
| **P1 Incorrect Business Logic** | **5** |
| **P2 UX/Process Gaps** | **10** |

**Modules fully operational:** Calculator core, Quotes CRUD, Quote Variants (create/update), Projects (trigger-based conversion), Procurement (PO/RFQ/GRN), Inventory (receive side), Dashboards (data layer only).

**Modules completely non-operational:** Acquisition creation, Bundle Preset management, Warranty Claims (no UI), AMC Contracts (no ORM, no UI), CRM (no UI).

---

*End of Audit Report — ENERMASS ERP v2.0.0 Post-Migration*
