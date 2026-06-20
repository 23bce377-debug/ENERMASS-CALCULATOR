#!/usr/bin/env node
/**
 * ENERMASS — Schema Type Verification Script
 * ==========================================
 * Run after `supabase gen types typescript` to verify
 * all required fields exist in the generated types.
 *
 * Usage:
 *   node scripts/verify-types.js
 *
 * Exit code 0 = all checks passed
 * Exit code 1 = one or more checks failed
 */

const fs = require('fs');
const path = require('path');

const TYPES_PATH = path.join(__dirname, '../src/lib/types/schema.types.ts');

if (!fs.existsSync(TYPES_PATH)) {
  console.error(`[FAIL] schema.types.ts not found at ${TYPES_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(TYPES_PATH, 'utf-8');

const checks = [
  // PHASE 2: Canonical pricing columns
  { label: 'eq_panels has rate_per_watt',       pattern: /eq_panels[\s\S]{0,2000}rate_per_watt/m },
  { label: 'eq_inverters has rate',              pattern: /eq_inverters[\s\S]{0,2000}rate:/m },
  { label: 'eq_batteries has rate',              pattern: /eq_batteries[\s\S]{0,2000}rate:/m },

  // PHASE 4: BOM ORM tables exist
  { label: 'bom_categories table type exists',   pattern: /bom_categories:\s*\{/ },
  { label: 'bom_template_items table type exists', pattern: /bom_template_items:\s*\{/ },
  { label: 'bom_template_items has qty_formula', pattern: /qty_formula/ },
  { label: 'bom_template_items has sku_code',    pattern: /sku_code/ },

  // PHASE 5: Master cache tables
  { label: 'eq_meters table type exists',        pattern: /eq_meters:\s*\{/ },
  { label: 'eq_lightning_arresters type exists', pattern: /eq_lightning_arresters:\s*\{/ },
  { label: 'eq_mounting_structures type exists', pattern: /eq_mounting_structures:\s*\{/ },
  { label: 'structure_weight_lookup type exists', pattern: /structure_weight_lookup:\s*\{/ },

  // PHASE 9: Inventory tables
  { label: 'inventory_movements table exists',   pattern: /inventory_movements:\s*\{/ },
  { label: 'inventory_positions table exists',   pattern: /inventory_positions:\s*\{/ },

  // GST tables
  { label: 'tax_hsn_sac table exists',           pattern: /tax_hsn_sac:\s*\{/ },
  { label: 'tax_gst_rates table exists',         pattern: /tax_gst_rates:\s*\{/ },

  // Scheme tables
  { label: 'calculation_schemes table exists',   pattern: /calculation_schemes:\s*\{/ },
  { label: 'scheme_slabs table exists',          pattern: /scheme_slabs:\s*\{/ },
  { label: 'state_scheme_overrides table exists', pattern: /state_scheme_overrides:\s*\{/ },
];

let passed = 0;
let failed = 0;

console.log('\n=== ENERMASS Schema Type Verification ===\n');

for (const check of checks) {
  const ok = check.pattern.test(content);
  if (ok) {
    console.log(`  ✅ PASS: ${check.label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${check.label}`);
    failed++;
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failed > 0) {
  console.error(`[ACTION REQUIRED] ${failed} type check(s) failed.`);
  console.error(`Run: npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/lib/types/schema.types.ts`);
  console.error(`Then re-run this script.\n`);
  process.exit(1);
} else {
  console.log('[OK] All schema type checks passed. System is type-safe.\n');
  process.exit(0);
}
