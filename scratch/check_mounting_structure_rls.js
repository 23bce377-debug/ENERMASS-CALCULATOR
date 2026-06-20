const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    const table = 'eq_mounting_structures';
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = $1;
    `, [table]);
    console.log(`Table: ${table} | RLS Enabled: ${rlsRes.rows[0].relrowsecurity}`);

    const policiesRes = await client.query(`
      SELECT policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = $1;
    `, [table]);
    console.log(`Policies:`);
    for (const policy of policiesRes.rows) {
      console.log(`  Policy: "${policy.policyname}" | Command: ${policy.cmd} | Roles: ${policy.roles}`);
      console.log(`    USING (QUAL): ${policy.qual}`);
      if (policy.with_check) {
        console.log(`    WITH CHECK: ${policy.with_check}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
