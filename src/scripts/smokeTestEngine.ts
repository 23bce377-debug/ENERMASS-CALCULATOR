import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/types/schema.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runEngineSmoke() {
  console.log('\n═══ ENERMASS Runtime Engine Smoke Test ═══\n');

  // 1. Pick a system template
  const { data: systems, error: sysErr } = await supabase
    .from('systems')
    .select('id, name, category, capacity_kw, panel_wattage, panel_qty, target_margin_pct')
    .limit(3);
  if (sysErr) throw sysErr;
  console.log(`✅ Systems found: ${systems?.length ?? 0}`);
  if (!systems || systems.length === 0) throw new Error('No systems in DB');
  const system = systems[0];
  console.log(`   Using: "${system.name}" (${system.capacity_kw} kW, ${system.category})`);

  // 2. Resolve BOM for this system
  const { data: bomItems, error: bomErr } = await supabase
    .from('system_items')
    .select('id, description, qty, rate_per_unit, gst_pct, unit, remarks, catalog_item_id')
    .eq('system_id', system.id)
    .eq('is_active', true);
  if (bomErr) throw bomErr;
  console.log(`✅ BOM items for "${system.name}": ${bomItems?.length ?? 0} items`);
  if (bomItems) {
    for (const item of bomItems.slice(0, 5)) {
      console.log(`   • ${item.description}: qty=${item.qty}, rate=₹${item.rate_per_unit}, GST=${(Number(item.gst_pct) * 100).toFixed(0)}%`);
    }
  }

  // 3. Load state rules
  const { data: stateRules, error: stateErr } = await supabase
    .from('state_rules')
    .select('id, state, sun_hours_per_day, performance_ratio, labour_multiplier, gst_on_output')
    .limit(3);
  if (stateErr) throw stateErr;
  console.log(`\n✅ State rules available: ${stateRules?.length ?? 0}`);
  if (stateRules && stateRules.length > 0) {
    const s = stateRules[0];
    console.log(`   Using state: "${s.state}" — sun=${s.sun_hours_per_day}h/day, PR=${s.performance_ratio}`);
  }

  // 4. Load subsidy slabs
  const { data: slabs, error: slabErr } = await supabase
    .from('scheme_slabs')
    .select('id, scheme_id, start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount')
    .limit(5);
  if (slabErr) throw slabErr;
  console.log(`\n✅ Subsidy slabs loaded: ${slabs?.length ?? 0}`);

  // 5. Load calculation schemes
  const { data: schemes, error: schemeErr } = await supabase
    .from('calculation_schemes')
    .select('id, name, is_active, gst_on_output, default_margin_pct')
    .eq('is_active', true)
    .limit(3);
  if (schemeErr) throw schemeErr;
  console.log(`✅ Active calculation schemes: ${schemes?.length ?? 0}`);

  // 6. Load pricing reference
  const { data: pricing, error: priceErr } = await supabase
    .from('pricing_reference')
    .select('capacity_kw, panels, inverter_kw, premium_price, standard_price, subsidy')
    .eq('system_id', system.id)
    .limit(3);
  if (priceErr) throw priceErr;
  console.log(`✅ Pricing reference rows for this system: ${pricing?.length ?? 0}`);

  // 7. Manual BOM pricing calculation (simulating the engine)
  if (bomItems && bomItems.length > 0 && stateRules && stateRules.length > 0) {
    const state = stateRules[0];
    let bomCostExclGST = 0;
    let gstTotal = 0;
    for (const item of bomItems) {
      const lineExcl = Number(item.qty) * Number(item.rate_per_unit);
      const lineGST = lineExcl * Number(item.gst_pct);
      bomCostExclGST += lineExcl;
      gstTotal += lineGST;
    }
    const margin = Number(system.target_margin_pct) / 100;
    const mrpExclGST = bomCostExclGST / (1 - margin);
    const gstOnOutput = mrpExclGST * Number(state.gst_on_output);
    const mrpInclGST = mrpExclGST + gstOnOutput;

    console.log('\n─── Engine Calculation (Manual Verify) ───');
    console.log(`   BOM Cost (excl. GST):  ₹${bomCostExclGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`   GST on Inputs:         ₹${gstTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`   Target Margin:         ${system.target_margin_pct}%`);
    console.log(`   MRP (excl. GST):       ₹${mrpExclGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`   GST on Output (${(Number(state.gst_on_output) * 100).toFixed(0)}%):   ₹${gstOnOutput.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`   Final Customer Price:  ₹${mrpInclGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`   Per-kW (incl. GST):    ₹${(mrpInclGST / system.capacity_kw).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/kW`);

    // Energy generation
    const dailyKWh = system.capacity_kw * state.sun_hours_per_day * state.performance_ratio;
    const annualKWh = dailyKWh * 365;
    const annualSavings = annualKWh * 8.0; // default tariff ₹8/kWh
    const payback = mrpInclGST / annualSavings;
    console.log(`\n─── Energy & Financial Projections ───`);
    console.log(`   Daily Generation:      ${dailyKWh.toFixed(1)} kWh/day`);
    console.log(`   Annual Generation:     ${Math.round(annualKWh).toLocaleString()} kWh/year`);
    console.log(`   Annual Savings:        ₹${Math.round(annualSavings).toLocaleString('en-IN')}/year`);
    console.log(`   Simple Payback:        ${payback.toFixed(1)} years`);
  }

  // 8. Check catalog_items
  const { data: catalog, error: catErr } = await supabase
    .from('catalog_items')
    .select('id, name, sku, category, base_rate, gst_pct, is_active')
    .eq('is_active', true)
    .limit(5);
  if (catErr) throw catErr;
  console.log(`\n✅ Catalog items (active): ${catalog?.length ?? 0}`);
  if (catalog) {
    for (const c of catalog) {
      console.log(`   • [${c.category}] ${c.name} — ₹${c.base_rate} + GST${(Number(c.gst_pct) * 100).toFixed(0)}%`);
    }
  }

  console.log('\n🎉 Runtime engine smoke test PASSED — all DB layers responding correctly.\n');
}

runEngineSmoke().catch((e) => {
  console.error('❌ Smoke test failed:', e);
  process.exit(1);
});
