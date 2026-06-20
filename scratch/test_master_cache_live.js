const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Loading master data datasets exactly as in masterCache ===");

  const queries = {
    panels: "SELECT id, brand, model, wattage_w, rate_per_watt, gst_pct, is_active FROM eq_panels WHERE is_active = true",
    inverters: "SELECT id, brand, model, capacity_kw, phase, rate, gst_pct, is_active FROM eq_inverters WHERE is_active = true",
    batteries: "SELECT id, brand, model, capacity_kwh, voltage_v, rate, gst_pct, is_active FROM eq_batteries WHERE is_active = true",
    stateRules: "SELECT id, state_code, state_name, is_active FROM state_rules WHERE is_active = true",
    slabs: "SELECT id, scheme_id, slab_index, start_kw, end_kw, rate_per_kw, is_fixed_amount, fixed_amount FROM scheme_slabs",
    schemes: "SELECT id, name, max_capacity_kw, applies_to FROM calculation_schemes WHERE is_active = true",
    schemeOverrides: "SELECT id, scheme_id, state_id, max_absolute_override, additional_state_subsidy FROM state_scheme_overrides WHERE is_active = true",
    bomCategories: "SELECT id, org_id, name, display_order, is_optional FROM bom_categories ORDER BY display_order",
    bomTemplateItems: "SELECT id, org_id, category_id, sku_code, description, unit, unit_rate_min, unit_rate_max, default_rate, qty_formula, is_survey_dependent, civil_required_only, notes FROM bom_template_items",
    meters: "SELECT id, brand, model, rate, gst_pct, meter_type, description FROM eq_meters",
    lightningArresters: "SELECT id, brand, model, rate, gst_pct, description, max_capacity_kw FROM eq_lightning_arresters",
    mountingStructures: "SELECT id, name, material, roof_mount_type, flat_rate, per_watt_rate, gst_pct, raw_material_rate, fabrication_rate, galvanizing_rate, base_weight_kg, wastage_pct, fastener_weight_pct, rate_per_kg FROM eq_mounting_structures",
    weightLookups: "SELECT id, structure_id, capacity_kw_min, capacity_kw_max, total_weight_kg FROM structure_weight_lookup",
    orientationMultipliers: "SELECT orientation, multiplier FROM eq_orientation_multipliers",
    structureVendors: "SELECT id, name FROM vendors WHERE is_structure_vendor = true",
    structureMaterialRates: "SELECT id, vendor_id, material_type, rate_per_kg FROM structure_material_rates",
    structureTemplates: "SELECT id, structure_type, capacity_kw FROM structure_templates",
    structureTemplateItems: "SELECT id, template_id, vendor_id, item, qty, weight FROM structure_template_items",
    walkwayTemplates: "SELECT id, template, cost_per_meter FROM walkway_templates",
    ladderTemplates: "SELECT id, template, cost_per_meter FROM ladder_templates",
    structureAccessoryRates: "SELECT id, item_name, unit, rate FROM structure_accessory_rates WHERE is_active = true",
    rateMaster: "SELECT item_name, override_rate, is_active FROM rate_master WHERE org_id = '00000000-0000-0000-0000-000000000001' AND is_active = true",
    categoryMargins: "SELECT category, default_margin_pct FROM category_margins WHERE org_id = '00000000-0000-0000-0000-000000000001'",
    appSettings: "SELECT default_grid_tariff_inr, default_validity_days, electricity_inflation_pct, orientation_factor FROM app_settings WHERE org_id = '00000000-0000-0000-0000-000000000001' LIMIT 1"
  };

  const results = {};
  for (const [key, sql] of Object.entries(queries)) {
    try {
      const res = await client.query(sql);
      results[key] = { status: "SUCCESS", count: res.rowCount };
    } catch (err) {
      results[key] = { status: "FAIL", error: err.message };
    }
  }

  console.log(JSON.stringify(results, null, 2));

  await client.end();
}

verify();
