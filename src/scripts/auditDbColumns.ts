/**
 * ENERMASS — Full DB Column Audit
 * Checks every actively-used table's columns vs what the code expects
 * Run: npx tsx src/scripts/auditDbColumns.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// What each key table MUST have (columns the code actually reads/writes)
const REQUIRED_COLUMNS: Record<string, string[]> = {
  eq_panels: [
    'id', 'org_id', 'name', 'brand', 'model', 'wattage_w', 'voc', 'isc', 'efficiency_pct',
    'length_mm', 'width_mm', 'weight_kg', 'cell_technology', 'warranty_years',
    'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_inverters: [
    'id', 'org_id', 'name', 'brand', 'model', 'capacity_kw', 'efficiency_pct',
    'phase', 'mppt_count', 'warranty_years', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_batteries: [
    'id', 'org_id', 'name', 'brand', 'model', 'capacity_kwh', 'voltage_v',
    'chemistry', 'warranty_years', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_bom_items: [
    'id', 'org_id', 'name', 'category', 'unit', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_meters: [
    'id', 'org_id', 'name', 'brand', 'meter_type', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_lightning_arresters: [
    'id', 'org_id', 'name', 'brand', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_communication_devices: [
    'id', 'org_id', 'name', 'brand', 'protocol', 'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  eq_mounting_structures: [
    'id', 'org_id', 'name', 'material', 'roof_mount_type', 'elevation_height_mm',
    'raw_material_rate', 'fabrication_rate', 'galvanizing_rate',
    'wastage_pct', 'fastener_weight_pct', 'base_weight_kg',
    'selling_price', 'buy_price', 'gst_pct', 'is_active',
  ],
  structure_weight_lookup: [
    'id', 'structure_id', 'capacity_kw_min', 'capacity_kw_max',
    'panel_qty', 'weight_per_panel_kg', 'bracket_fixed_weight', 'total_weight_kg',
  ],
  eq_structure_components: [
    'id', 'org_id', 'structure_id', 'category', 'name', 'unit',
    'rate_appolo', 'rate_tata', 'rate_deemac', 'selling_price', 'buy_price',
    'gst_pct', 'is_active',
  ],
  eq_structure_bom: [
    'id', 'component_id', 'structure_id', 'capacity_kw_min', 'capacity_kw_max',
    'panel_qty', 'qty', 'total_weight_kg',
  ],
  eq_structure_addons: [
    'id', 'org_id', 'name', 'material', 'unit', 'rate_per_unit', 'buy_price', 'gst_pct', 'is_active',
  ],
  systems: ['id', 'org_id', 'name', 'capacity_kw', 'panel_id', 'inverter_id', 'is_preset', 'created_at'],
  system_items: ['id', 'system_id', 'item_type', 'item_id', 'qty', 'unit_price'],
  custom_presets: ['id', 'org_id', 'name', 'capacity_kw', 'created_at'],
  quotes: [
    'id', 'org_id', 'quote_number', 'customer_name', 'status', 'total_amount',
    'gst_amount', 'net_amount', 'created_at',
  ],
  quote_items: [
    'id', 'quote_id', 'item_type', 'item_name', 'qty', 'unit_price', 'gst_pct', 'total_price',
  ],
  quote_variants: ['id', 'quote_id', 'name', 'is_selected'],
  quote_additional_costs: ['id', 'quote_id', 'description', 'amount', 'gst_pct'],
  pricing_reference: ['id', 'org_id', 'item_type', 'item_name', 'sell_price', 'gst_pct'],
  catalog_items: ['id', 'org_id', 'name', 'category', 'hsn_code', 'unit', 'gst_pct'],
  gst_master: ['id', 'hsn_code', 'description', 'gst_rate', 'item_type'],
  category_margins: ['id', 'category', 'margin_pct'],
  calculation_schemes: ['id', 'org_id', 'name', 'scheme_type', 'is_active'],
  scheme_slabs: ['id', 'scheme_id', 'min_kw', 'max_kw', 'rate'],
  state_rules: ['id', 'state_code', 'state_name', 'net_metering_limit_kw', 'discom'],
  state_scheme_overrides: ['id', 'state_code', 'scheme_id', 'override_rate'],
  profiles: ['id', 'email', 'full_name', 'role', 'org_id', 'created_at'],
  organisations: ['id', 'name', 'gstin', 'created_at'],
  app_settings: ['id', 'org_id', 'key', 'value'],
  inventory_ledger: ['id', 'item_type', 'item_id', 'item_description', 'txn_type', 'qty', 'created_at'],
  inventory_summary: ['id', 'item_description', 'item_type', 'current_qty', 'weighted_avg_cost'],
  vendors: ['id', 'org_id', 'name', 'gstin', 'email', 'is_active'],
  acquisitions: ['id', 'org_id', 'vendor_id', 'status', 'total_amount', 'created_at'],
  acquisition_items: ['id', 'acquisition_id', 'item_type', 'item_id', 'qty', 'unit_cost'],
  bundle_presets: ['id', 'org_id', 'name', 'capacity_kw', 'is_active'],
  bundle_preset_items: ['id', 'preset_id', 'item_type', 'item_id', 'qty'],
  proc_purchase_orders: ['id', 'org_id', 'vendor_id', 'status', 'total_amount', 'created_at'],
  proc_goods_receipt_notes: ['id', 'po_id', 'org_id', 'status', 'received_at'],
};

async function getColumns(table: string): Promise<string[]> {
  // Use the OpenAPI spec from supabase REST to get columns
  const r = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?limit=0`,
    {
      method: 'HEAD',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        Accept: 'application/json',
        Prefer: 'count=none',
      }
    }
  );
  // Alternatively, do a select of 1 row to see columns
  const { data, error } = await (sb as any).from(table).select('*').limit(1);
  if (error || !data || data.length === 0) {
    // Try with explicit column grab via count
    const { data: d2 } = await (sb as any).from(table).select('*').limit(0);
    return [];
  }
  return Object.keys(data[0]);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         ENERMASS — FULL DB COLUMN AUDIT                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const drift: Record<string, string[]> = {};
  let totalMissing = 0;

  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = await getColumns(table);
    if (actual.length === 0) {
      console.log(`\n❌ TABLE MISSING OR EMPTY: ${table}`);
      drift[table] = required;
      totalMissing += required.length;
      continue;
    }
    const missing = required.filter(col => !actual.includes(col));
    const extra = actual.filter(col => !required.includes(col));
    const hasIssue = missing.length > 0;

    console.log(`\n${hasIssue ? '⚠️ ' : '✅'} ${table}`);
    console.log(`   Columns in DB : ${actual.length}  |  Required: ${required.length}`);
    if (missing.length > 0) {
      console.log(`   ❌ MISSING COLS: ${missing.join(', ')}`);
      drift[table] = missing;
      totalMissing += missing.length;
    }
    if (extra.length > 0 && extra.length <= 8) {
      console.log(`   ➕ EXTRA COLS  : ${extra.join(', ')}`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DRIFT SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const driftEntries = Object.entries(drift);
  if (driftEntries.length === 0) {
    console.log('✅ No schema drift detected. All tables and columns are aligned.');
  } else {
    console.log(`\n${driftEntries.length} tables have missing columns (${totalMissing} total):\n`);
    driftEntries.forEach(([table, cols]) => {
      console.log(`  ${table}:`);
      cols.forEach(c => console.log(`    - ${c}`));
    });
  }
}

main().catch(console.error);
