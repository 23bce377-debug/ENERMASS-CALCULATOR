const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // 1. Check actual rate_master columns
    console.log('\n=== rate_master COLUMNS ===');
    const rmCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'rate_master'
      ORDER BY ordinal_position
    `);
    rmCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

    // 2. Check rate_master unique constraints
    console.log('\n=== rate_master CONSTRAINTS ===');
    const rmConst = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'rate_master'::regclass
    `);
    rmConst.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

    // 3. Check structure_vendors table still exists (should be deprecated)
    console.log('\n=== structure_vendors table existence ===');
    const svExists = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'structure_vendors'
    `);
    console.log(svExists.rows.length > 0 ? '  STILL EXISTS (not deprecated)' : '  GONE (deprecated successfully)');

    // 4. Check structure_vendors_deprecated
    console.log('\n=== structure_vendors_deprecated table existence ===');
    const svdExists = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'structure_vendors_deprecated'
    `);
    console.log(svdExists.rows.length > 0 ? '  EXISTS' : '  MISSING');

    // 5. Check eq_panels has selling_price (not rate_per_watt only)
    console.log('\n=== eq_panels: rate_per_watt vs selling_price ===');
    const panelCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'eq_panels' AND column_name IN ('rate_per_watt', 'selling_price', 'buy_price', 'rate_per_panel')
    `);
    panelCols.rows.forEach(r => console.log(`  EXISTS: ${r.column_name}`));

    // 6. Check eq_inverters has selling_price (not just 'rate')
    console.log('\n=== eq_inverters: rate vs selling_price ===');
    const invCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'eq_inverters' AND column_name IN ('rate', 'selling_price', 'buy_price')
    `);
    invCols.rows.forEach(r => console.log(`  EXISTS: ${r.column_name}`));

    // 7. Check epc_projects columns
    console.log('\n=== epc_projects COLUMNS ===');
    const epcCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'epc_projects' ORDER BY ordinal_position
    `);
    epcCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // 8. Check proc_warranty_claims columns
    console.log('\n=== proc_warranty_claims COLUMNS ===');
    const wCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'proc_warranty_claims' ORDER BY ordinal_position
    `);
    wCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // 9. Check vendors table columns
    console.log('\n=== vendors TABLE COLUMNS ===');
    const vCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'vendors' ORDER BY ordinal_position
    `);
    vCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // 10. Check rate_master actual data
    console.log('\n=== rate_master SAMPLE DATA ===');
    const rmData = await client.query(`SELECT id, org_id, bom_item_id, override_rate, is_active FROM rate_master LIMIT 5`);
    rmData.rows.forEach(r => console.log(`  bom_item_id=${r.bom_item_id}, rate=${r.override_rate}, active=${r.is_active}`));

    // 11. Check if create_acquisition_atomic RPC exists
    console.log('\n=== create_acquisition_atomic RPC ===');
    const rpcCheck = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name IN ('create_acquisition_atomic', 'create_bundle_preset_atomic', 'update_bundle_preset_atomic')
    `);
    rpcCheck.rows.forEach(r => console.log(`  EXISTS: ${r.routine_name}`));

    // 12. Check quote_history vs quote_status_history
    console.log('\n=== quote_history vs quote_status_history ===');
    const qhCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('quote_history', 'quote_status_history')
    `);
    qhCheck.rows.forEach(r => console.log(`  EXISTS: ${r.table_name}`));

    // 13. Check fn_trigger_create_project_on_win trigger
    console.log('\n=== fn_trigger_create_project_on_win trigger ===');
    const trig = await client.query(`
      SELECT tgname, tgrelid::regclass as table_name 
      FROM pg_trigger 
      WHERE tgfoid = 'fn_trigger_create_project_on_win'::regproc
    `);
    trig.rows.forEach(r => console.log(`  trigger: ${r.tgname} on ${r.table_name}`));

    // 14. Check field_amc_contracts columns
    console.log('\n=== field_amc_contracts COLUMNS ===');
    const amcCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'field_amc_contracts' ORDER BY ordinal_position
    `);
    amcCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // 15. Check field_service_tickets columns
    console.log('\n=== field_service_tickets COLUMNS ===');
    const ticketCols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'field_service_tickets' ORDER BY ordinal_position
    `);
    ticketCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
