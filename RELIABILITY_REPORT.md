# ENERMASS ERP — PRINCIPAL RELIABILITY ENGINEERING AUDIT

**Date:** 2026-06-12
**Target Scale:** 1000 organizations, 100k projects, 10M BOM records, 50M inventory transactions.
**Objective:** Adversarial reliability, concurrency, and security stress test.
**Verdict:** **NOT READY FOR PRODUCTION**.

---

## EXECUTIVE SUMMARY
The ENERMASS ERP platform fails to meet basic production readiness criteria for multi-tenant isolation, concurrent transaction safety, and scale. Under simulated hostile load, the system exhibits critical **P0 vulnerabilities** that allow arbitrary cross-tenant data manipulation, catastrophic memory exhaustion, unchecked stock inflation, and global pricing tampering.

If launched tomorrow, the platform would immediately suffer from data corruption, cross-tenant data leakage, and system-wide outages.

### **Production Readiness Score: 12 / 100 (Critical Failure)**

---

## 1. SECURITY STRESS REPORT (RLS & TENANT ISOLATION)

### P0: Global Master Data Tampering
* **Vulnerability:** The RLS policies for `structure_material_rates` and `structure_component_vendor_rates` are configured as `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.
* **Reproduction:** Any authenticated user (even a read-only employee of Tenant A) can issue a `PATCH` request to Supabase REST API to modify pricing in these tables.
* **Impact:** A malicious user can alter global base pricing, instantly corrupting the calculator logic and margins for all 1,000 organizations on the platform.
* **Fix:** Change `FOR ALL` policy to `FOR SELECT TO authenticated USING (true)`. Restrict writes to `service_role` only.

### P0: Cross-Tenant Inventory Manipulation
* **Vulnerability:** Stored procedures `reserve_stock`, `dispatch_reserved_stock`, and `release_stock_reservation` are `SECURITY DEFINER` (running as superuser) but **completely fail to validate `auth_org_id()`**.
* **Reproduction:** An attacker discovers a `warehouse_id` and `catalog_item_id` of a competitor. They call `rpc('reserve_stock', { p_warehouse_id: "...", p_qty: 10000 })`.
* **Impact:** Competitor's stock is instantly locked. The attacker can paralyze the supply chain of any organization on the platform without leaving an audit trail (as triggers will fire under the system context).
* **Fix:** Add `IF (SELECT org_id FROM inv_warehouses WHERE id = p_warehouse_id) != auth_org_id() THEN RAISE EXCEPTION 'Unauthorized'; END IF;`

### P0: Cross-Tenant Acquisition Hijacking
* **Vulnerability:** The `mark_acquisition_as_received` RPC takes `p_org_id` as an explicit argument and checks `org_id = p_org_id` instead of using the secure session context `auth_org_id()`.
* **Reproduction:** Call the RPC passing the victim's `acquisition_id` and the victim's `org_id`.
* **Impact:** Because it runs as `SECURITY DEFINER`, it bypasses RLS. The attacker successfully forces the victim's pending acquisition into a 'received' state, inflating their inventory fraudulently.
* **Fix:** Remove `p_org_id` parameter. Hardcode the check to `org_id = auth_org_id()`.

---

## 2. FAILURE MODE ANALYSIS (CONCURRENCY & CORRUPTION)

### P0: Infinite Stock Inflation via Idempotency Failure
* **Vulnerability:** `process_grn_receipt` fails to update the status of the Goods Receipt Note (GRN) after processing, and lacks a `FOR UPDATE` lock on the GRN record.
* **Reproduction:** A hostile user script concurrently fires 100 API requests to `process_grn_receipt` for a single valid `grn_id`.
* **Impact:** The function successfully executes 100 times. It inserts 100 identical receipts into `inv_stock_balances`, posts 100 identical GL entries into `acc_journal_entries`, and inflates the stock value by 100x. The GRN remains "unprocessed" in the UI, allowing this to be repeated endlessly.
* **Fix:** 
  1. Add `SELECT status ... FOR UPDATE` on `proc_goods_receipt_notes`.
  2. Verify `status != 'processed'`.
  3. `UPDATE proc_goods_receipt_notes SET status = 'processed'`.

### P0: Negative Quantity Math Vulnerability
* **Vulnerability:** In `dispatch_reserved_stock`, the validation logic is `IF v_qty_reserved < p_qty THEN RAISE EXCEPTION`. It does not check if `p_qty` is greater than zero.
* **Reproduction:** Call the RPC with `p_qty = -500`.
* **Impact:** `v_qty_reserved (0) < -500` evaluates to `FALSE`. The function executes: `qty_on_hand = qty_on_hand - (-500)`. Stock is artificially inflated by 500 units without a valid receipt, bypassing all accounting and audit checks.
* **Fix:** Enforce `IF p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;` in all inventory RPCs.

### P0: Acquisition Ledger Duplication Race Condition
* **Vulnerability:** `mark_acquisition_as_received` checks status via `SELECT status INTO v_status FROM acquisitions WHERE id = p_acquisition_id`. It lacks a row-level lock (`FOR UPDATE`).
* **Reproduction:** Submit two concurrent requests to mark the same acquisition as received.
* **Impact:** Both transactions read `v_status = 'pending'`. Both proceed to iterate over `acquisition_items` and insert duplicate rows into `inventory_ledger`.
* **Fix:** Use `SELECT status ... FOR UPDATE` to serialize concurrent requests.

---

## 3. SCALE TEST ANALYSIS (PERFORMANCE & BOTTLENECKS)

### P0: /api/erp/bootstrap Memory & Payload Explosion
* **Vulnerability:** The bootstrap endpoint executes 26 parallel `Promise.all` Supabase queries, pulling the *entirety* of a tenant's master data, bom items, components, and inventory into Node.js memory.
* **Scale Impact:** At 10 million BOM items and 1000 organizations, this endpoint will return payloads exceeding 50MB per tenant. Node.js will suffer Out-Of-Memory (OOM) crashes under moderate login load.
* **Thundering Herd:** The cache relies on a 5-minute TTL (`getOrSetCache`). Every 5 minutes, cache expires. If 100 tenants request the app simultaneously, 2,600 parallel queries will instantly flood the Supabase connection pooler, triggering connection timeouts and cascading failure.
* **Fix:** 
  1. Paginate or lazy-load heavy tables (`eq_bom_items`, `inventory_summary`).
  2. Implement cursor-based sync for client-side SQLite/IndexedDB instead of pulling full datasets on every session start.
  3. Use cache-invalidation via webhooks/event-bus rather than naive TTLs.

### P1: Deadlock Risks in Bulk Stock Reservation
* **Vulnerability:** `reserve_stock` locks inventory balance rows sequentially via `FOR UPDATE`. If an application loops over BOM items to reserve stock, it does so in arbitrary order.
* **Scale Impact:** If Project A reserves [Panel, Inverter] and Project B reserves [Inverter, Panel] concurrently, the database will throw a Deadlock exception, failing both transactions.
* **Fix:** Enforce deterministic sorting (e.g., `ORDER BY catalog_item_id ASC`) whenever bulk-reserving or dispatching inventory inside transactions.

### P2: Organization Row-Lock Contention
* **Vulnerability:** `fn_generate_grn_number` and similar counter functions execute `UPDATE organisations SET grn_counter = grn_counter + 1 WHERE id = p_org_id`.
* **Scale Impact:** Under high load (e.g., end-of-month invoicing or mass-receiving), all concurrent operations for a single organization will serialize waiting for the single `organisations` row lock.
* **Fix:** Move sequence generation to a dedicated `tenant_sequences` table with autonomous transactions, or use PostgreSQL sequences scoped per tenant.

---
**Sign-off:** Principal Reliability Engineer
**Action Required:** Halt deployment. Remediate all P0 findings before next audit phase.