import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Querying live DB schema...');

  // ── 1. All tables ──────────────────────────────────────────────
  const tablesRes = await fetch(
    process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?select',
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Accept: 'application/openapi+json',
      }
    }
  );
  const swagger = await tablesRes.json().catch(() => null);

  // Extract table names from swagger paths
  const dbTables: string[] = swagger?.paths
    ? Object.keys(swagger.paths)
        .filter((p: string) => p.startsWith('/') && !p.includes('{'))
        .map((p: string) => p.slice(1))
        .filter(Boolean)
        .sort()
    : [];

  console.log('\n=== LIVE DB TABLES (' + dbTables.length + ') ===');
  dbTables.forEach(t => console.log('  DB:', t));

  // ── 2. Check each expected table for existence ────────────────
  const expectedFromCode = [
    // Master Equipment
    'eq_panels', 'eq_inverters', 'eq_batteries', 'eq_bom_items',
    'eq_meters', 'eq_lightning_arresters', 'eq_communication_devices',
    'eq_mounting_structures', 'structure_weight_lookup',
    // NEW: structure components (from our latest migration)
    'eq_structure_components', 'eq_structure_bom', 'eq_structure_addons',
    // Calculator
    'systems', 'system_items', 'custom_presets', 'calculation_schemes', 'scheme_slabs',
    // Quotes
    'quotes', 'quote_items', 'quote_variants', 'quote_additional_costs',
    'quote_format_templates', 'quote_status_history',
    // Pricing / Reference
    'pricing_reference', 'catalog_items', 'gst_master', 'category_margins',
    'state_rules', 'state_scheme_overrides',
    // Profiles / Org
    'profiles', 'organisations', 'app_settings',
    // Procurement
    'proc_purchase_orders', 'proc_po_items', 'proc_rfqs', 'proc_rfq_items',
    'proc_vendor_bids', 'proc_goods_receipt_notes', 'proc_grn_items',
    'proc_warranty_claims', 'vendors',
    // Inventory
    'inventory_ledger', 'inventory_summary', 'inv_warehouses',
    'inv_stock_transactions', 'inv_stock_balances', 'inv_serialized_items',
    'inv_transfers', 'inv_transfer_items',
    // CRM
    'crm_leads', 'crm_opportunities', 'crm_timeline',
    // EPC
    'epc_projects', 'epc_project_milestones', 'epc_site_surveys',
    'epc_work_orders', 'epc_commissioning_reports',
    // Field Service
    'field_service_tickets', 'field_amc_contracts',
    'field_customer_assets', 'field_checklist_items',
    // Acquisitions
    'acquisitions', 'acquisition_items', 'acquisition_bundles',
    'bundle_presets', 'bundle_preset_items',
    // Accounting
    'acc_invoices', 'acc_payments', 'acc_journal_entries', 'acc_journal_lines',
    'acc_accounts', 'acc_bank_statements', 'acc_bank_statement_lines', 'acc_adjustments',
    // System / Platform
    'sys_audit_logs', 'sys_event_bus', 'sys_notification_queue',
    'sys_notifications', 'sys_notification_templates',
    'sys_roles', 'sys_user_roles', 'sys_permissions', 'sys_role_permissions',
    'sys_approval_requests', 'sys_approval_rules', 'sys_approval_workflows',
    'sys_approval_steps', 'sys_approvals', 'sys_approval_history',
    'sys_escalations', 'sys_dashboards',
    'master_data_imports', 'master_data_changes_log',
    'engineering_rules_metadata',
  ].sort();

  console.log('\n=== EXISTENCE CHECK ===');
  const missing: string[] = [];
  const present: string[] = [];

  for (const table of expectedFromCode) {
    if (dbTables.includes(table)) {
      present.push(table);
      console.log('  ✅ EXISTS   :', table);
    } else {
      missing.push(table);
      console.log('  ❌ MISSING  :', table);
    }
  }

  // ── 3. Tables in DB but NOT in our expected list ──────────────
  const unknown = dbTables.filter(t => !expectedFromCode.includes(t));
  console.log('\n=== IN DB BUT NOT IN EXPECTED LIST ===');
  unknown.forEach(t => console.log('  ❓ EXTRA:', t));

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log('  DB Tables Total  :', dbTables.length);
  console.log('  Expected Total   :', expectedFromCode.length);
  console.log('  Present          :', present.length);
  console.log('  MISSING          :', missing.length, missing.join(', '));
  console.log('  Extra (unknown)  :', unknown.length, unknown.join(', '));
}

main().catch(console.error);
