const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- ALL AUTH / ORG HELPER FUNCTIONS ---');
  const funcs = await client.query(`
    SELECT routine_name, routine_type, data_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND (routine_name LIKE '%org%' OR routine_name LIKE '%auth%' OR routine_name LIKE '%role%' OR routine_name LIKE '%admin%');
  `);
  console.log(funcs.rows);

  for (const fn of ['auth_org_id', 'current_org_id', 'user_role', 'is_org_admin', 'is_superadmin']) {
    try {
      const def = await client.query(`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '${fn}' LIMIT 1;`);
      if (def.rows.length > 0) {
        console.log(`\n--- Function Definition: ${fn} ---`);
        console.log(def.rows[0].pg_get_functiondef);
      }
    } catch (e) {
      console.log(`Error getting ${fn}:`, e.message);
    }
  }

  const tables = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const policies = await client.query(`
    SELECT tablename, count(*) as count 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    GROUP BY tablename;
  `);
  const policyCount = Object.fromEntries(policies.rows.map(r => [r.tablename, parseInt(r.count)]));

  console.log('\n--- SUMMARY ---');
  const disabled = [];
  const noPolicies = [];
  const enabledWithPolicies = [];

  for (const t of tables.rows) {
    if (!t.rowsecurity) {
      disabled.push(t.tablename);
    } else if (!policyCount[t.tablename] || policyCount[t.tablename] === 0) {
      noPolicies.push(t.tablename);
    } else {
      enabledWithPolicies.push({ name: t.tablename, policies: policyCount[t.tablename] });
    }
  }

  console.log(`\nRLS DISABLED (${disabled.length} tables):`);
  console.log(disabled);

  console.log(`\nRLS ENABLED BUT NO POLICIES (LOCKED OUT) (${noPolicies.length} tables):`);
  console.log(noPolicies);

  console.log(`\nRLS ENABLED WITH POLICIES (${enabledWithPolicies.length} tables):`);
  console.log(enabledWithPolicies.map(t => `${t.name} (${t.policies})`));

  await client.end();
}

analyze().catch(console.error);
