const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  const schemes = await client.query("SELECT * FROM calculation_schemes");
  console.log("SCHEMES:", JSON.stringify(schemes.rows, null, 2));

  const slabs = await client.query("SELECT * FROM scheme_slabs ORDER BY scheme_id, slab_index");
  console.log("SLABS:", JSON.stringify(slabs.rows, null, 2));

  // Also query the calculate_subsidy function definition if possible, to see the exact formula!
  const funcDef = await client.query(`
    SELECT pg_get_functiondef(p.oid) 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'calculate_subsidy'
  `);
  if (funcDef.rows.length > 0) {
    console.log("CALCULATE_SUBSIDY FUNCTION DEF:", funcDef.rows[0].pg_get_functiondef);
  } else {
    console.log("calculate_subsidy function definition not found");
  }

  await client.end();
}

run().catch(console.error);
