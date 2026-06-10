const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const tables = ['eq_mounting_structures', 'eq_bom_items', 'vendors', 'calculation_schemes'];
  for (const table of tables) {
    const rls = await client.query(`
      SELECT relrowsecurity FROM pg_class WHERE relname = $1
    `, [table]);
    const policies = await client.query(`
      SELECT * FROM pg_policy WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = $1)
    `, [table]);

    console.log(`=== Table: ${table} ===`);
    console.log(`RLS Enabled: ${rls.rows[0]?.relrowsecurity ? 'YES' : 'NO'}`);
    console.log(`Policies:`, policies.rows.map(p => ({
      name: p.polname,
      cmd: p.polcmd === 'r' ? 'SELECT' : p.polcmd
    })));
  }

  await client.end();
}

run().catch(console.error);
