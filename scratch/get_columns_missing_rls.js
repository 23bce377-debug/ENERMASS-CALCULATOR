const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();

  const tables = [
    'engineering_rules_metadata',
    'eq_orientation_multipliers',
    'gst_master',
    'master_data_changes_log',
    'master_data_imports',
    'pricing_reference',
    'quote_history',
    'state_rules',
    'state_scheme_overrides',
    'structure_weight_lookup',
    'sys_approval_history',
    'sys_approval_steps',
    'sys_approval_workflow_rules',
    'sys_role_permissions'
  ];

  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
    `, [table]);
    const columns = res.rows.map(r => r.column_name);
    console.log(`Table: ${table} | Has org_id: ${columns.includes('org_id') ? 'YES' : 'NO'}`);
  }

  await client.end();
}

run().catch(console.error);
