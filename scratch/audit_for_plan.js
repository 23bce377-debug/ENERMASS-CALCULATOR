const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
  const fn = await client.query("SELECT proname FROM pg_proc WHERE proname = 'auth_org_id'");
  console.log('auth_org_id exists:', fn.rows.length > 0);

  const t1 = await client.query("SELECT COUNT(*) FROM quote_history").catch(e => ({ rows: [{ count: 'MISSING: ' + e.message.substring(0, 60) }] }));
  console.log('quote_history:', t1.rows[0].count);

  const t2 = await client.query("SELECT COUNT(*) FROM quote_status_history").catch(e => ({ rows: [{ count: 'MISSING: ' + e.message.substring(0, 60) }] }));
  console.log('quote_status_history:', t2.rows[0].count);

  const triggers = await client.query("SELECT tgname FROM pg_trigger WHERE tgname LIKE '%quote%'");
  console.log('Quote triggers:', triggers.rows.map(r => r.tgname));

  const acq = await client.query("SELECT COUNT(*) FROM acquisitions").catch(e => ({ rows: [{ count: 'MISSING' }] }));
  console.log('acquisitions:', acq.rows[0].count);

  const bp = await client.query("SELECT COUNT(*) FROM bundle_presets").catch(e => ({ rows: [{ count: 'MISSING' }] }));
  console.log('bundle_presets:', bp.rows[0].count);

  const wc = await client.query("SELECT COUNT(*) FROM proc_warranty_claims").catch(e => ({ rows: [{ count: 'MISSING' }] }));
  console.log('proc_warranty_claims:', wc.rows[0].count);

  const amc = await client.query("SELECT COUNT(*) FROM field_amc_contracts").catch(e => ({ rows: [{ count: 'MISSING' }] }));
  console.log('field_amc_contracts:', amc.rows[0].count);

  const leads = await client.query("SELECT COUNT(*) FROM crm_leads").catch(e => ({ rows: [{ count: 'MISSING' }] }));
  console.log('crm_leads:', leads.rows[0].count);

  const rpcs = await client.query("SELECT proname FROM pg_proc WHERE proname IN ('create_acquisition_atomic','create_bundle_preset_atomic','update_bundle_preset_atomic','mark_acquisition_as_received','get_structure_rate','calculate_subsidy','fn_generate_quote_number','auth_org_id','fn_log_quote_history')");
  console.log('Existing RPCs:', rpcs.rows.map(r => r.proname));

  const rlsTables = await client.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('eq_panels','eq_inverters','quotes','quote_items','rate_master','systems','system_items','structure_accessory_rates') ORDER BY tablename");
  console.log('RLS status:', rlsTables.rows.map(r => r.tablename + ':' + r.rowsecurity));

  await client.end();
}).catch(console.error);
