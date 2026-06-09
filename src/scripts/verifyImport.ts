import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  console.log('═══ ENERMASS IMPORT VERIFICATION ENGINE ═══\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const rawUrl = connectionString.replace(/"/g, ''); // strip quotes
  const url = new URL(rawUrl);
  const password = decodeURIComponent(url.password);

  const configPooler = {
    host: url.hostname,
    port: parseInt(url.port || '6543'),
    database: url.pathname.substring(1),
    user: decodeURIComponent(url.username),
    password,
    ssl: { rejectUnauthorized: false }
  };

  const configDirect = {
    host: 'db.xjdqpwmizmfkcdcgcxqv.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false }
  };

  let client: Client;
  
  console.log('Attempting connection via direct host on port 5432...');
  try {
    client = new Client(configDirect);
    await client.connect();
    console.log('Connected successfully via direct connection!');
  } catch (directErr: any) {
    console.log(`⚠️ Direct connection failed: ${directErr.message}`);
    console.log('Attempting connection via pooler host on port 6543...');
    try {
      client = new Client(configPooler);
      await client.connect();
      console.log('Connected successfully via pooler connection!');
    } catch (poolerErr: any) {
      console.error('❌ Both direct and pooler connection attempts failed!');
      console.error(`Direct Error: ${directErr.message}`);
      console.error(`Pooler Error: ${poolerErr.message}`);
      process.exit(1);
    }
  }

  const results = {
    panelsCount: 0,
    invertersCount: 0,
    batteriesCount: 0,
    metersCount: 0,
    lasCount: 0,
    structuresCount: 0,
    bomItemsCount: 0,
    vendorsCount: 0,
    gstMasterCount: 0,
    pricingReferencesCount: 0,
    rulesCount: 0,
    systemsCount: 0,
    systemItemsCount: 0,
    checks: {
      canLoadEquipment: false,
      canBuildSystems: false,
      bomResolvesComponents: false,
      pricingResolvesRates: false,
      subsidyResolvesSchemes: false
    }
  };

  try {

    // 1. Fetch counts
    const panelsRes = await client.query('SELECT COUNT(*) FROM eq_panels');
    results.panelsCount = parseInt(panelsRes.rows[0].count);

    const invertersRes = await client.query('SELECT COUNT(*) FROM eq_inverters');
    results.invertersCount = parseInt(invertersRes.rows[0].count);

    const batteriesRes = await client.query('SELECT COUNT(*) FROM eq_batteries');
    results.batteriesCount = parseInt(batteriesRes.rows[0].count);

    const metersRes = await client.query('SELECT COUNT(*) FROM eq_meters');
    results.metersCount = parseInt(metersRes.rows[0].count);

    const lasRes = await client.query('SELECT COUNT(*) FROM eq_lightning_arresters');
    results.lasCount = parseInt(lasRes.rows[0].count);

    const structuresRes = await client.query('SELECT COUNT(*) FROM eq_mounting_structures');
    results.structuresCount = parseInt(structuresRes.rows[0].count);

    const bomItemsRes = await client.query('SELECT COUNT(*) FROM eq_bom_items');
    results.bomItemsCount = parseInt(bomItemsRes.rows[0].count);

    const vendorsRes = await client.query('SELECT COUNT(*) FROM vendors');
    results.vendorsCount = parseInt(vendorsRes.rows[0].count);

    const gstMasterRes = await client.query('SELECT COUNT(*) FROM gst_master');
    results.gstMasterCount = parseInt(gstMasterRes.rows[0].count);

    const pricingRefsRes = await client.query('SELECT COUNT(*) FROM pricing_reference');
    results.pricingReferencesCount = parseInt(pricingRefsRes.rows[0].count);

    const rulesRes = await client.query('SELECT COUNT(*) FROM engineering_rules_metadata');
    results.rulesCount = parseInt(rulesRes.rows[0].count);

    const systemsRes = await client.query('SELECT COUNT(*) FROM systems');
    results.systemsCount = parseInt(systemsRes.rows[0].count);

    const systemItemsRes = await client.query('SELECT COUNT(*) FROM system_items');
    results.systemItemsCount = parseInt(systemItemsRes.rows[0].count);

    console.log('--- DATABASE RECORD COUNTS ---');
    console.log(`Panels:                  ${results.panelsCount}`);
    console.log(`Inverters:               ${results.invertersCount}`);
    console.log(`Batteries:               ${results.batteriesCount}`);
    console.log(`Meters:                  ${results.metersCount}`);
    console.log(`Lightning Arresters:      ${results.lasCount}`);
    console.log(`Mounting Structures:     ${results.structuresCount}`);
    console.log(`BOM Items (Accessories): ${results.bomItemsCount}`);
    console.log(`Vendors:                 ${results.vendorsCount}`);
    console.log(`GST Master Slabs:        ${results.gstMasterCount}`);
    console.log(`Pricing References:      ${results.pricingReferencesCount}`);
    console.log(`Rules Metadata:          ${results.rulesCount}`);
    console.log(`Systems:                 ${results.systemsCount}`);
    console.log(`System Items (BOM):      ${results.systemItemsCount}`);
    console.log('');

    // Verification 1: Calculator can load equipment
    results.checks.canLoadEquipment = results.panelsCount > 0 && results.invertersCount > 0 && results.structuresCount > 0;
    console.log(`${results.checks.canLoadEquipment ? '✅' : '❌'} Check: Calculator can load equipment`);

    // Verification 2: Quote engine can build systems
    results.checks.canBuildSystems = results.systemsCount > 0;
    console.log(`${results.checks.canBuildSystems ? '✅' : '❌'} Check: Quote engine can load systems`);

    // Verification 3: BOM engine resolves components
    const unlinkedItems = await client.query(`
      SELECT COUNT(*) FROM system_items 
      WHERE panel_id IS NULL AND inverter_id IS NULL AND battery_id IS NULL 
        AND solar_meter_id IS NULL AND net_meter_id IS NULL AND la_id IS NULL 
        AND structure_id IS NULL AND bom_item_id IS NULL AND comm_device_id IS NULL
    `);
    const orphansCount = parseInt(unlinkedItems.rows[0].count);
    results.checks.bomResolvesComponents = orphansCount === 0;
    console.log(`${results.checks.bomResolvesComponents ? '✅' : '❌'} Check: BOM engine resolves all components (orphans: ${orphansCount})`);

    // Verification 4: Pricing engine resolves rates
    const zeroRatesRes = await client.query('SELECT COUNT(*) FROM eq_bom_items WHERE rate = 0 AND is_active = true');
    const zeroRates = parseInt(zeroRatesRes.rows[0].count);
    results.checks.pricingResolvesRates = zeroRates < results.bomItemsCount; // at least some rates resolved
    console.log(`${results.checks.pricingResolvesRates ? '✅' : '❌'} Check: Pricing engine resolves rates`);

    // Verification 5: Subsidy engine resolves schemes
    const schemesRes = await client.query('SELECT COUNT(*) FROM calculation_schemes WHERE is_active = true');
    const schemesCount = parseInt(schemesRes.rows[0].count);
    results.checks.subsidyResolvesSchemes = schemesCount > 0;
    console.log(`${results.checks.subsidyResolvesSchemes ? '✅' : '❌'} Check: Subsidy engine resolves active schemes`);

    console.log('\n--- VERIFICATION SUMMARY ---');
    const allPassed = Object.values(results.checks).every(v => v === true);
    if (allPassed) {
      console.log('🎉 ALL CHECKS PASSED SUCCESSFULLY!');
    } else {
      console.log('⚠️ SOME VERIFICATION CHECKS FAILED!');
    }

  } catch (err: any) {
    console.error('❌ Exception in verification process:', err.message);
  } finally {
    await client.end();
  }

  // Save verification report
  const reportPath = path.resolve(process.cwd(), 'verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`📄 Verification report saved to ${reportPath}`);
}

verify();
