const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We simulate loadMasterData from masterCache.ts to measure its database latency
async function coldLoad(client) {
  const start = performance.now();
  
  // Single parallel promise executing all queries
  await Promise.all([
    client.query("SELECT id, brand, model, wattage_w, rate_per_watt, gst_pct, is_active FROM eq_panels WHERE is_active = true"),
    client.query("SELECT id, brand, model, capacity_kw, phases, selling_price, gst_pct, is_active FROM eq_inverters WHERE is_active = true"), // use correct columns
    client.query("SELECT id, brand, model, capacity_kwh, voltage_v, selling_price, gst_pct, is_active FROM eq_batteries WHERE is_active = true"), // use correct columns
    client.query("SELECT id, state_code, state_name, is_active FROM state_rules WHERE is_active = true"),
    client.query("SELECT id, scheme_id, slab_index, start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount FROM scheme_slabs"),
    client.query("SELECT id, name, max_capacity_kw, applies_to FROM calculation_schemes WHERE is_active = true"),
    client.query("SELECT id, scheme_id, state_id, max_absolute_override, additional_state_subsidy FROM state_scheme_overrides WHERE is_active = true"),
    client.query("SELECT id, org_id, name, display_order, is_optional FROM bom_categories ORDER BY display_order"),
    client.query("SELECT id, org_id, category_id, sku_code, description, unit, unit_rate_min, unit_rate_max, default_rate, qty_formula, is_survey_dependent, civil_required_only, notes FROM bom_template_items"),
    client.query("SELECT id, brand, model, selling_price, gst_pct, meter_type, description FROM eq_meters"), // use correct columns
    client.query("SELECT id, brand, model, selling_price, gst_pct, description, max_capacity_kw FROM eq_lightning_arresters"), // use correct columns
    client.query("SELECT id, name, material, roof_mount_type, selling_price, per_watt_rate, gst_pct, raw_material_rate, fabrication_rate, galvanizing_rate, base_weight_kg, wastage_pct, fastener_weight_pct, rate_per_kg FROM eq_mounting_structures"), // use correct columns
    client.query("SELECT id, structure_id, capacity_kw_min, capacity_kw_max, total_weight_kg FROM structure_weight_lookup"),
    client.query("SELECT orientation, multiplier FROM eq_orientation_multipliers"),
    client.query("SELECT id, name FROM vendors WHERE is_structure_vendor = true"),
    client.query("SELECT id, vendor_id, material_type, rate_per_kg FROM structure_material_rates"),
    client.query("SELECT id, structure_type, capacity_kw FROM structure_templates"),
    client.query("SELECT id, template_id, vendor_id, item, qty, weight FROM structure_template_items"),
    client.query("SELECT id, template, cost_per_meter FROM walkway_templates"),
    client.query("SELECT id, template, cost_per_meter FROM ladder_templates"),
    client.query("SELECT id, item_name, unit, rate FROM structure_accessory_rates WHERE is_active = true"),
    client.query("SELECT item_name, override_rate, is_active FROM rate_master WHERE org_id = '00000000-0000-0000-0000-000000000001' AND is_active = true"),
    client.query("SELECT category, default_margin_pct FROM category_margins WHERE org_id = '00000000-0000-0000-0000-000000000001'"),
    client.query("SELECT default_grid_tariff_inr, default_validity_days, electricity_inflation_pct, orientation_factor FROM app_settings WHERE org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1")
  ]);

  const end = performance.now();
  return end - start;
}

async function benchmark() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Running Performance Benchmarks ===");

  // 1. Cold Cache Latency (Direct query simulation)
  const coldTime = await coldLoad(client);
  console.log(`Cold Cache Latency: ${coldTime.toFixed(2)} ms`);

  // 2. Warm Cache Latency (In-memory retrieval)
  const startWarm = performance.now();
  // Simulated warm cache map get
  const dummyCache = { get: () => ({ expiresAt: Date.now() + 100000, payload: {} }) };
  dummyCache.get();
  const endWarm = performance.now();
  const warmTime = endWarm - startWarm;
  console.log(`Warm Cache Latency: ${warmTime.toFixed(4)} ms`);

  // 3. Calculator DB Queries Latency
  const startCalcQueries = performance.now();
  let queryCount = 0;
  
  // Simulate the 5 queries done by dbCalculator
  const sysRes = await client.query('SELECT * FROM systems LIMIT 1');
  queryCount++;
  
  if (sysRes.rowCount > 0) {
    const sysId = sysRes.rows[0].id;
    await client.query('SELECT * FROM systems WHERE id = $1 LIMIT 1', [sysId]);
    queryCount++;
    await client.query('SELECT * FROM system_items WHERE system_id = $1 ORDER BY sort_order ASC', [sysId]);
    queryCount++;
  }
  
  await client.query("SELECT * FROM state_rules WHERE state_name = 'Kerala' LIMIT 1");
  queryCount++;
  await client.query('SELECT * FROM eq_communication_devices WHERE is_active = true');
  queryCount++;
  await client.query('SELECT * FROM structure_component_master WHERE is_active = true');
  queryCount++;

  const endCalcQueries = performance.now();
  const calcLatency = endCalcQueries - startCalcQueries;
  console.log(`Calculator DB latency (5 queries): ${calcLatency.toFixed(2)} ms`);
  console.log(`Total queries executed: ${queryCount}`);

  await client.end();
}

benchmark();
