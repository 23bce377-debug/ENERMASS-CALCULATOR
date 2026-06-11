const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to Supabase PostgreSQL database.");

  const report = {};

  // Helper helper to query safely
  async function querySafe(label, sql, params = []) {
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } catch (err) {
      console.warn(`⚠️ Query failed [${label}]: ${err.message}`);
      return { error: err.message };
    }
  }

  try {
    // 1. Table Counts
    console.log("Auditing table counts...");
    const tables = [
      'organisations', 'profiles', 'state_rules', 'calculation_schemes', 'scheme_slabs',
      'eq_panels', 'eq_inverters', 'eq_batteries', 'eq_meters', 'eq_lightning_arresters',
      'eq_mounting_structures', 'structure_weight_lookup', 'structure_material_rates',
      'structure_templates', 'structure_template_items', 'walkway_templates', 'ladder_templates',
      'eq_bom_items', 'eq_communication_devices', 'rate_master', 'systems', 'system_items',
      'category_margins', 'quotes', 'quote_financials', 'quote_items', 'quote_additional_costs',
      'quote_status_history', 'quote_variants', 'quote_format_templates', 'app_settings',
      'vendors', 'field_amc_contracts', 'field_service_tickets', 'proc_warranty_claims'
    ];
    report.table_counts = {};
    for (const t of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM ${t}`);
        report.table_counts[t] = parseInt(res.rows[0].count);
      } catch (err) {
        report.table_counts[t] = 'MISSING/ERROR: ' + err.message;
      }
    }

    // 2. Duplicate Equipment
    console.log("Auditing duplicate equipment...");
    report.duplicates = {};

    report.duplicates.eq_panels = await querySafe('eq_panels dps', `
      SELECT brand, model, wattage_w, COUNT(*) as count 
      FROM eq_panels 
      GROUP BY brand, model, wattage_w 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.eq_inverters = await querySafe('eq_inverters dps', `
      SELECT brand, model, capacity_kw, COUNT(*) as count 
      FROM eq_inverters 
      GROUP BY brand, model, capacity_kw 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.eq_batteries = await querySafe('eq_batteries dps', `
      SELECT brand, model, capacity_kwh, COUNT(*) as count 
      FROM eq_batteries 
      GROUP BY brand, model, capacity_kwh 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.eq_meters = await querySafe('eq_meters dps', `
      SELECT meter_type, brand, model, phases, COUNT(*) as count 
      FROM eq_meters 
      GROUP BY meter_type, brand, model, phases 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.eq_lightning_arresters = await querySafe('eq_lightning_arresters dps', `
      SELECT la_type, brand, model, COUNT(*) as count 
      FROM eq_lightning_arresters 
      GROUP BY la_type, brand, model 
      HAVING COUNT(*) > 1
    `);

    // 3. Duplicate Vendors
    console.log("Auditing duplicate vendors...");
    report.duplicates.vendors_exact = await querySafe('vendors exact dps', `
      SELECT name, COUNT(*) as count 
      FROM vendors 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.vendors_fuzzy = await querySafe('vendors fuzzy dps', `
      SELECT LOWER(TRIM(name)) as cleaned_name, COUNT(*) as count, ARRAY_AGG(name) as original_names
      FROM vendors 
      GROUP BY LOWER(TRIM(name)) 
      HAVING COUNT(*) > 1
    `);

    // 4. Duplicate BOM Items
    console.log("Auditing duplicate BOM items...");
    report.duplicates.eq_bom_items_exact = await querySafe('eq_bom_items exact dps', `
      SELECT section, sub_type, description, COUNT(*) as count 
      FROM eq_bom_items 
      GROUP BY section, sub_type, description 
      HAVING COUNT(*) > 1
    `);

    report.duplicates.eq_bom_items_fuzzy = await querySafe('eq_bom_items fuzzy dps', `
      SELECT LOWER(REGEXP_REPLACE(description, '[^a-zA-Z0-9]', '', 'g')) as cleaned_desc, COUNT(*) as count, ARRAY_AGG(description) as original_descriptions
      FROM eq_bom_items 
      GROUP BY LOWER(REGEXP_REPLACE(description, '[^a-zA-Z0-9]', '', 'g')) 
      HAVING COUNT(*) > 1
    `);

    // 5. Duplicate Templates
    console.log("Auditing duplicate templates...");
    report.duplicates.systems = await querySafe('systems dps', `
      SELECT name, capacity_kw, COUNT(*) as count 
      FROM systems 
      GROUP BY name, capacity_kw 
      HAVING COUNT(*) > 1
    `);

    // 6. Duplicate Pricing Records
    console.log("Auditing duplicate pricing records...");
    report.duplicates.rate_master = await querySafe('rate_master dps', `
      SELECT org_id, item_name, COUNT(*) as count 
      FROM rate_master 
      GROUP BY org_id, item_name 
      HAVING COUNT(*) > 1
    `);

    // 7. Distinct Units and check for inconsistent casing/formatting
    console.log("Auditing unit consistency...");
    const unitsBOM = await querySafe('bom units', `SELECT DISTINCT unit FROM eq_bom_items`);
    report.units_eq_bom_items = Array.isArray(unitsBOM) ? unitsBOM.map(r => r.unit) : unitsBOM;

    const unitsAccessory = await querySafe('accessory units', `SELECT DISTINCT unit FROM structure_accessory_rates`);
    report.units_structure_accessory_rates = Array.isArray(unitsAccessory) ? unitsAccessory.map(r => r.unit) : unitsAccessory;

    // 8. Categories
    console.log("Auditing categories...");
    const catsSystems = await querySafe('system cats', `SELECT DISTINCT category FROM systems`);
    report.categories_systems = Array.isArray(catsSystems) ? catsSystems.map(r => r.category) : catsSystems;

    const panelTypes = await querySafe('panel types', `SELECT DISTINCT panel_type FROM eq_panels`);
    report.panel_types = Array.isArray(panelTypes) ? panelTypes.map(r => r.panel_type) : panelTypes;

    // 9. Referential Integrity Audit (Orphan References)
    console.log("Auditing orphan references...");
    report.orphans = {};

    const sysItemsOrphanSys = await querySafe('si to systems', `
      SELECT COUNT(*) as count FROM system_items WHERE system_id NOT IN (SELECT id FROM systems)
    `);
    report.orphans.system_items_to_systems = sysItemsOrphanSys.error ? sysItemsOrphanSys.error : parseInt(sysItemsOrphanSys[0].count);

    const sysItemsOrphanPanels = await querySafe('si to panels', `
      SELECT COUNT(*) as count FROM system_items WHERE panel_id IS NOT NULL AND panel_id NOT IN (SELECT id FROM eq_panels)
    `);
    report.orphans.system_items_to_panels = sysItemsOrphanPanels.error ? sysItemsOrphanPanels.error : parseInt(sysItemsOrphanPanels[0].count);

    const sysItemsOrphanInverters = await querySafe('si to inverters', `
      SELECT COUNT(*) as count FROM system_items WHERE inverter_id IS NOT NULL AND inverter_id NOT IN (SELECT id FROM eq_inverters)
    `);
    report.orphans.system_items_to_inverters = sysItemsOrphanInverters.error ? sysItemsOrphanInverters.error : parseInt(sysItemsOrphanInverters[0].count);

    const sysItemsOrphanBatteries = await querySafe('si to batteries', `
      SELECT COUNT(*) as count FROM system_items WHERE battery_id IS NOT NULL AND battery_id NOT IN (SELECT id FROM eq_batteries)
    `);
    report.orphans.system_items_to_batteries = sysItemsOrphanBatteries.error ? sysItemsOrphanBatteries.error : parseInt(sysItemsOrphanBatteries[0].count);

    const sysItemsOrphanMeters = await querySafe('si to solar meters', `
      SELECT COUNT(*) as count FROM system_items WHERE solar_meter_id IS NOT NULL AND solar_meter_id NOT IN (SELECT id FROM eq_meters)
    `);
    report.orphans.system_items_to_solar_meters = sysItemsOrphanMeters.error ? sysItemsOrphanMeters.error : parseInt(sysItemsOrphanMeters[0].count);

    const sysItemsOrphanNetMeters = await querySafe('si to net meters', `
      SELECT COUNT(*) as count FROM system_items WHERE net_meter_id IS NOT NULL AND net_meter_id NOT IN (SELECT id FROM eq_meters)
    `);
    report.orphans.system_items_to_net_meters = sysItemsOrphanNetMeters.error ? sysItemsOrphanNetMeters.error : parseInt(sysItemsOrphanNetMeters[0].count);

    const sysItemsOrphanLA = await querySafe('si to la', `
      SELECT COUNT(*) as count FROM system_items WHERE la_id IS NOT NULL AND la_id NOT IN (SELECT id FROM eq_lightning_arresters)
    `);
    report.orphans.system_items_to_la = sysItemsOrphanLA.error ? sysItemsOrphanLA.error : parseInt(sysItemsOrphanLA[0].count);

    const sysItemsOrphanStructures = await querySafe('si to structures', `
      SELECT COUNT(*) as count FROM system_items WHERE structure_id IS NOT NULL AND structure_id NOT IN (SELECT id FROM eq_mounting_structures)
    `);
    report.orphans.system_items_to_structures = sysItemsOrphanStructures.error ? sysItemsOrphanStructures.error : parseInt(sysItemsOrphanStructures[0].count);

    const sysItemsOrphanBOM = await querySafe('si to bom', `
      SELECT COUNT(*) as count FROM system_items WHERE bom_item_id IS NOT NULL AND bom_item_id NOT IN (SELECT id FROM eq_bom_items)
    `);
    report.orphans.system_items_to_bom_items = sysItemsOrphanBOM.error ? sysItemsOrphanBOM.error : parseInt(sysItemsOrphanBOM[0].count);

    const sysItemsOrphanCommDevices = await querySafe('si to comm', `
      SELECT COUNT(*) as count FROM system_items WHERE comm_device_id IS NOT NULL AND comm_device_id NOT IN (SELECT id FROM eq_communication_devices)
    `);
    report.orphans.system_items_to_comm_devices = sysItemsOrphanCommDevices.error ? sysItemsOrphanCommDevices.error : parseInt(sysItemsOrphanCommDevices[0].count);

    const sysItemsOrphanCompMaster = await querySafe('si to comp master', `
      SELECT COUNT(*) as count FROM system_items WHERE structure_component_id IS NOT NULL AND structure_component_id NOT IN (SELECT id FROM structure_component_master)
    `);
    report.orphans.system_items_to_structure_components = sysItemsOrphanCompMaster.error ? sysItemsOrphanCompMaster.error : parseInt(sysItemsOrphanCompMaster[0].count);

    const weightLookupOrphanStructures = await querySafe('wl to struct', `
      SELECT COUNT(*) as count FROM structure_weight_lookup WHERE structure_id NOT IN (SELECT id FROM eq_mounting_structures)
    `);
    report.orphans.weight_lookup_to_structures = weightLookupOrphanStructures.error ? weightLookupOrphanStructures.error : parseInt(weightLookupOrphanStructures[0].count);

    const templateItemsOrphanTemplates = await querySafe('ti to templates', `
      SELECT COUNT(*) as count FROM structure_template_items WHERE template_id NOT IN (SELECT id FROM structure_templates)
    `);
    report.orphans.template_items_to_templates = templateItemsOrphanTemplates.error ? templateItemsOrphanTemplates.error : parseInt(templateItemsOrphanTemplates[0].count);

    const templateItemsOrphanVendors = await querySafe('ti to vendors', `
      SELECT COUNT(*) as count FROM structure_template_items WHERE vendor_id IS NOT NULL AND vendor_id NOT IN (SELECT id FROM vendors)
    `);
    report.orphans.template_items_to_vendors = templateItemsOrphanVendors.error ? templateItemsOrphanVendors.error : parseInt(templateItemsOrphanVendors[0].count);

    const matRatesOrphanVendors = await querySafe('mr to vendors', `
      SELECT COUNT(*) as count FROM structure_material_rates WHERE vendor_id NOT IN (SELECT id FROM vendors)
    `);
    report.orphans.material_rates_to_vendors = matRatesOrphanVendors.error ? matRatesOrphanVendors.error : parseInt(matRatesOrphanVendors[0].count);

    const rateMasterOrphanBOM = await querySafe('rm to bom', `
      SELECT COUNT(*) as count FROM rate_master WHERE bom_item_id IS NOT NULL AND bom_item_id NOT IN (SELECT id FROM eq_bom_items)
    `);
    report.orphans.rate_master_to_bom_items = rateMasterOrphanBOM.error ? rateMasterOrphanBOM.error : parseInt(rateMasterOrphanBOM[0].count);

    // 10. Pricing Anomalies
    console.log("Auditing pricing anomalies...");
    report.pricing_anomalies = {};

    report.pricing_anomalies.eq_panels = await querySafe('panels pricing', `
      SELECT id, brand, model, wattage_w, buy_price, selling_price FROM eq_panels 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_inverters = await querySafe('inverters pricing', `
      SELECT id, brand, model, capacity_kw, buy_price, selling_price FROM eq_inverters 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_batteries = await querySafe('batteries pricing', `
      SELECT id, brand, model, capacity_kwh, buy_price, selling_price FROM eq_batteries 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_meters = await querySafe('meters pricing', `
      SELECT id, model, buy_price, selling_price FROM eq_meters 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_lightning_arresters = await querySafe('la pricing', `
      SELECT id, model, buy_price, selling_price FROM eq_lightning_arresters 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_bom_items = await querySafe('bom pricing', `
      SELECT id, description, buy_price, selling_price FROM eq_bom_items 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    report.pricing_anomalies.eq_communication_devices = await querySafe('comm pricing', `
      SELECT id, model, buy_price, selling_price FROM eq_communication_devices 
      WHERE buy_price <= 0 OR selling_price <= 0 OR buy_price > selling_price
    `);

    // 11. GST Validation
    console.log("Auditing GST configurations...");
    report.gst_anomalies = {};
    
    const panelsGst = await querySafe('panels gst', `SELECT DISTINCT gst_pct FROM eq_panels`);
    report.gst_anomalies.eq_panels = Array.isArray(panelsGst) ? panelsGst.map(r => Number(r.gst_pct)) : panelsGst;

    const invertersGst = await querySafe('inverters gst', `SELECT DISTINCT gst_pct FROM eq_inverters`);
    report.gst_anomalies.eq_inverters = Array.isArray(invertersGst) ? invertersGst.map(r => Number(r.gst_pct)) : invertersGst;

    const batteriesGst = await querySafe('batteries gst', `SELECT DISTINCT gst_pct FROM eq_batteries`);
    report.gst_anomalies.eq_batteries = Array.isArray(batteriesGst) ? batteriesGst.map(r => Number(r.gst_pct)) : batteriesGst;

    const metersGst = await querySafe('meters gst', `SELECT DISTINCT gst_pct FROM eq_meters`);
    report.gst_anomalies.eq_meters = Array.isArray(metersGst) ? metersGst.map(r => Number(r.gst_pct)) : metersGst;

    const laGst = await querySafe('la gst', `SELECT DISTINCT gst_pct FROM eq_lightning_arresters`);
    report.gst_anomalies.eq_lightning_arresters = Array.isArray(laGst) ? laGst.map(r => Number(r.gst_pct)) : laGst;

    const bomGst = await querySafe('bom gst', `SELECT DISTINCT gst_pct FROM eq_bom_items`);
    report.gst_anomalies.eq_bom_items = Array.isArray(bomGst) ? bomGst.map(r => Number(r.gst_pct)) : bomGst;

    // Get any items where GST is NULL or not in [0.0, 0.05, 0.12, 0.18, 0.28]
    report.gst_anomalies.invalid_gst_bom_items = await querySafe('invalid bom gst', `
      SELECT id, description, gst_pct FROM eq_bom_items
      WHERE gst_pct NOT IN (0.0, 0.05, 0.12, 0.18, 0.28)
    `);

    // 12. Broken System Templates (e.g. systems that have zero items)
    console.log("Auditing broken templates...");
    report.broken_templates = {};

    report.broken_templates.empty_systems = await querySafe('empty systems', `
      SELECT id, name, category, capacity_kw 
      FROM systems 
      WHERE id NOT IN (SELECT DISTINCT system_id FROM system_items)
    `);

    // Find any systems where sum of panels capacity is way different from systems capacity_kw
    report.broken_templates.capacity_mismatches = await querySafe('capacity mismatches', `
      SELECT s.id, s.name, s.capacity_kw, SUM(p.wattage_w * si.default_qty) / 1000.0 as computed_kw
      FROM systems s
      JOIN system_items si ON si.system_id = s.id
      JOIN eq_panels p ON si.panel_id = p.id
      GROUP BY s.id, s.name, s.capacity_kw
      HAVING ABS(s.capacity_kw - (SUM(p.wattage_w * si.default_qty) / 1000.0)) > 0.1
    `);

    // Save report to file
    const targetFile = path.resolve(process.cwd(), 'scratch/data_audit_results.json');
    fs.writeFileSync(targetFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✅ Audit results saved to ${targetFile}`);

  } catch (err) {
    console.error("❌ Audit script failed:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
