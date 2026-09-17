const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspect() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log('=== CHECKING FUNCTIONS ===');
  const funcsRes = await client.query(`
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('current_org_id', 'auth_org_id', 'get_current_org_id');
  `);
  console.log('Functions found:', funcsRes.rows);

  console.log('\n=== CHECKING TABLES AND RLS STATUS ===');
  const tablesRes = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  
  console.log(`Total public tables: ${tablesRes.rows.length}`);
  const rlsEnabled = tablesRes.rows.filter(r => r.rowsecurity);
  const rlsDisabled = tablesRes.rows.filter(r => !r.rowsecurity);
  console.log(`RLS Enabled (${rlsEnabled.length}):`, rlsEnabled.map(r => r.tablename));
  console.log(`RLS Disabled (${rlsDisabled.length}):`, rlsDisabled.map(r => r.tablename));

  console.log('\n=== CHECKING EXISTING POLICIES ===');
  const policiesRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log(`Total policies found: ${policiesRes.rows.length}`);
  const tablePolicyMap = {};
  for (const pol of policiesRes.rows) {
    if (!tablePolicyMap[pol.tablename]) tablePolicyMap[pol.tablename] = [];
    tablePolicyMap[pol.tablename].push({
      name: pol.policyname,
      cmd: pol.cmd,
      roles: pol.roles,
      qual: pol.qual
    });
  }
  console.log(JSON.stringify(tablePolicyMap, null, 2));

  await client.end();
}

inspect().catch(console.error);
