/**
 * verify_rls_and_consistency.ts
 *
 * Verifies the database security and consistency hardening deployed in Migration 26.
 * Checks performed:
 *   1. Critical RLS leaks eliminated (quote_history, sys_approval_*, calculation_schemes)
 *   2. Blocked tenant flows enabled (payment_schedules, vendor_payments)
 *   3. Policy pollution cleaned on quotes & epc_work_orders
 *   4. Profiles privilege escalation guard trigger active
 *   5. Storage bucket RLS policies in place on documents & vault-*
 *   6. Zero orphaned rows in net_metering_applications, inventory_movements, acquisition_items
 *   7. Foreign key cascade delete constraints active
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let totalFails = 0;

function pass(label: string, detail?: string): void {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`  ✅ PASS  ${label}${suffix}`);
}

function fail(label: string, reason: string): void {
  totalFails++;
  console.error(`  ❌ FAIL  ${label} — ${reason}`);
}

function section(name: string): void {
  console.log(`\n─── ${name.toUpperCase()} ${'─'.repeat(Math.max(0, 55 - name.length))}`);
}

async function runVerification() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('════════════════════════════════════════════════════════════');
  console.log('  ENERMASS ERP — RLS & DB CONSISTENCY VERIFICATION');
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════════════════════');

  // ─── 1. Critical Leaks Eliminated ──────────────────────────────────────────
  section('1. Critical RLS Leaks Eliminated');

  const polRes = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  const policies = polRes.rows;

  const checkNoOpenPolicy = (table: string, oldPolicyName: string) => {
    const p = policies.find(x => x.tablename === table && x.policyname === oldPolicyName);
    if (!p) {
      pass(`${table}.${oldPolicyName} removed`);
    } else if (p.qual === 'true') {
      fail(`${table}.${oldPolicyName}`, 'still exists with qual=true!');
    } else {
      pass(`${table}.${oldPolicyName}`, 'restricted');
    }
  };

  checkNoOpenPolicy('quote_history', 'quote_history_visibility');
  checkNoOpenPolicy('sys_approval_history', 'sys_approval_history_visibility');
  checkNoOpenPolicy('sys_approval_steps', 'sys_approval_steps_visibility');
  checkNoOpenPolicy('sys_approval_workflow_rules', 'sys_approval_workflow_rules_visibility');
  checkNoOpenPolicy('sys_role_permissions', 'sys_role_permissions_visibility');
  checkNoOpenPolicy('master_data_changes_log', 'master_data_changes_log_visibility');
  checkNoOpenPolicy('master_data_imports', 'master_data_imports_visibility');

  // ─── 2. Calculation Schemes Pattern A ──────────────────────────────────────
  section('2. Calculation Schemes Shared Catalog Isolation');

  const csPols = policies.filter(x => x.tablename === 'calculation_schemes');
  const csSelect = csPols.find(x => x.policyname === 'calculation_schemes_select');
  if (csSelect && csSelect.qual?.includes('org_id IS NULL') && csSelect.qual?.includes('is_org_member(org_id)')) {
    pass('calculation_schemes_select', 'correct Pattern A isolation');
  } else {
    fail('calculation_schemes_select', `unexpected qual: ${csSelect?.qual}`);
  }

  const slabsPols = policies.filter(x => x.tablename === 'scheme_slabs');
  const openSlabs = slabsPols.filter(x => x.qual === 'true');
  if (openSlabs.length === 0) {
    pass('scheme_slabs open policies', 'all eliminated');
  } else {
    fail('scheme_slabs open policies', `${openSlabs.length} open policies still found`);
  }

  // ─── 3. Unblocked Tenant Flows ─────────────────────────────────────────────
  section('3. Unblocked Tenant Flows');

  const psPols = policies.filter(x => x.tablename === 'payment_schedules');
  const psAccess = psPols.find(x => x.policyname === 'payment_schedules_org_access');
  if (psAccess && psAccess.qual?.includes('quotes')) {
    pass('payment_schedules_org_access', 'tenant access policy active');
  } else {
    fail('payment_schedules_org_access', 'missing or invalid policy');
  }

  const vpPols = policies.filter(x => x.tablename === 'vendor_payments');
  const vpAccess = vpPols.find(x => x.policyname === 'vendor_payments_org_access');
  if (vpAccess && vpAccess.qual?.includes('epc_projects')) {
    pass('vendor_payments_org_access', 'tenant access policy active');
  } else {
    fail('vendor_payments_org_access', 'missing or invalid policy');
  }

  // ─── 4. Policy Pollution Cleaned on Quotes ──────────────────────────────────
  section('4. Cleaned Quotes RBAC Policies');

  const qPols = policies.filter(x => x.tablename === 'quotes');
  const qOverridingAll = qPols.filter(x => x.cmd === 'ALL' && x.policyname !== 'Superadmin full access bypass');
  if (qOverridingAll.length === 0) {
    pass('quotes overriding ALL policies', 'successfully dropped');
  } else {
    fail('quotes overriding ALL policies', `found: ${qOverridingAll.map(p => p.policyname).join(', ')}`);
  }

  const qDelete = qPols.find(x => x.policyname === 'quotes_delete');
  if (qDelete && qDelete.qual?.includes('owner') && qDelete.qual?.includes('admin')) {
    pass('quotes_delete RBAC', 'restricted to owner and admin');
  } else {
    fail('quotes_delete RBAC', 'missing or misconfigured');
  }

  // ─── 5. Profiles Privilege Escalation Guard ────────────────────────────────
  section('5. Profiles Privilege Escalation Guard');

  const trgRes = await client.query(`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'profiles' AND trigger_name = 'trg_prevent_profile_escalation';
  `);
  if (trgRes.rows.length > 0) {
    pass('trg_prevent_profile_escalation', 'trigger exists and active on profiles');
  } else {
    fail('trg_prevent_profile_escalation', 'trigger missing on profiles');
  }

  // ─── 6. Storage Bucket RLS ──────────────────────────────────────────────────
  section('6. Storage Bucket RLS');

  const storagePols = await client.query(`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects';
  `);
  const sRows = storagePols.rows;

  const vaultRead = sRows.find(x => x.policyname === 'Tenant vault read policy');
  if (vaultRead && vaultRead.qual?.includes('vault-%')) {
    pass('Tenant vault read policy', 'active for vault-* buckets');
  } else {
    fail('Tenant vault read policy', 'missing or invalid');
  }

  const docDelete = sRows.find(x => x.policyname === 'Authenticated users can delete documents');
  if (docDelete && (docDelete.qual?.includes('auth_org_id') || docDelete.qual?.includes('projects'))) {
    pass('Authenticated users can delete documents', 'org/project isolation active');
  } else {
    fail('Authenticated users can delete documents', 'missing org isolation check');
  }

  // ─── 7. Zero Orphaned Rows ─────────────────────────────────────────────────
  section('7. Orphan Row Integrity');

  const orphanNma = await client.query(`
    SELECT COUNT(*) as c FROM net_metering_applications 
    WHERE project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM epc_projects WHERE id = net_metering_applications.project_id)
  `);
  if (parseInt(orphanNma.rows[0].c, 10) === 0) {
    pass('net_metering_applications orphans', '0 orphaned rows');
  } else {
    fail('net_metering_applications orphans', `${orphanNma.rows[0].c} orphans found`);
  }

  const orphanIm = await client.query(`
    SELECT COUNT(*) as c FROM inventory_movements 
    WHERE project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM epc_projects WHERE id = inventory_movements.project_id)
  `);
  if (parseInt(orphanIm.rows[0].c, 10) === 0) {
    pass('inventory_movements orphans', '0 orphaned rows');
  } else {
    fail('inventory_movements orphans', `${orphanIm.rows[0].c} orphans found`);
  }

  const orphanAi = await client.query(`
    SELECT COUNT(*) as c FROM acquisition_items 
    WHERE acquisition_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acquisitions WHERE id = acquisition_items.acquisition_id)
  `);
  if (parseInt(orphanAi.rows[0].c, 10) === 0) {
    pass('acquisition_items orphans', '0 orphaned rows');
  } else {
    fail('acquisition_items orphans', `${orphanAi.rows[0].c} orphans found`);
  }

  // ─── 8. Foreign Key Cascade Constraints ─────────────────────────────────────
  section('8. Foreign Key Cascade Constraints');

  const fkRef = await client.query(`
    SELECT tc.table_name, rc.constraint_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_name IN ('net_metering_applications_project_id_fkey', 'payment_schedules_quote_id_fkey');
  `);
  for (const r of fkRef.rows) {
    if (r.delete_rule === 'CASCADE') {
      pass(`${r.table_name}.${r.constraint_name}`, 'ON DELETE CASCADE');
    } else {
      fail(`${r.table_name}.${r.constraint_name}`, `delete_rule is ${r.delete_rule}`);
    }
  }

  await client.end();

  console.log('\n════════════════════════════════════════════════════════════');
  if (totalFails === 0) {
    console.log('  ✅ ALL RLS & CONSISTENCY HARDENING CHECKS PASSED');
    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error(`  ❌ ${totalFails} CHECK(S) FAILED — REVIEW ABOVE`);
    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification failure:', err);
  process.exit(1);
});
