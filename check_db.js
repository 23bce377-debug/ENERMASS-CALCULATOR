const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("--- COLUMNS ---");
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'net_metering_applications';
  `);
  console.log(res.rows);

  console.log("\n--- POLICIES ---");
  const res2 = await client.query(`
    SELECT polname, polcmd, polqual, polwithcheck
    FROM pg_policy
    WHERE polrelid = 'epc_project_milestones'::regclass;
  `);
  console.log(res2.rows);

  await client.end();
}

check().catch(console.error);
