const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT prosrc 
    FROM pg_proc 
    WHERE proname = 'fn_trigger_seed_project_milestones';
  `);
  if (res.rows.length > 0) {
    console.log(res.rows[0].prosrc);
  } else {
    console.log('Function fn_trigger_seed_project_milestones not found.');
  }

  await client.end();
}

run().catch(console.error);
