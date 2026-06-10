const { Client } = require('pg');
const { calculateSystemFromDb } = require('../src/lib/engine/dbCalculator');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  try {
    const sysRes = await client.query("SELECT id FROM systems WHERE name = 'Rajasthan 3KW'");
    if (sysRes.rowCount === 0) {
      throw new Error("System 'Rajasthan 3KW' not found!");
    }
    const systemId = sysRes.rows[0].id;
    
    const res = await calculateSystemFromDb(client, {
      systemId: systemId,
      state: 'Rajasthan',
      pricingContext: {
        projectType: 'residential',
        priceType: 'standard'
      }
    });
    console.log("res.subsidy:", res.subsidy);
    console.log("res.customerPrice:", res.customerPrice);
    console.log("res.energy:", res.energy);

  } catch (e) {
    console.error("Error:", e.stack);
  }

  await client.end();
}

run().catch(console.error);
