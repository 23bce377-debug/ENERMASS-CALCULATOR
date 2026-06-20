const { Client } = require('pg');
const { calculateSystemFromDb } = require('../src/lib/engine/dbCalculator');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("=== Running Quote Calculations ===");

  // Find a valid system template in the database
  let systemId;
  try {
    const res = await client.query("SELECT id, name FROM systems LIMIT 1");
    if (res.rowCount > 0) {
      systemId = res.rows[0].id;
      console.log(`Using system template: "${res.rows[0].name}" (ID: ${systemId})`);
    }
  } catch (e) {
    console.log("Error querying systems: " + e.message);
  }

  if (!systemId) {
    console.log("No system templates found.");
    await client.end();
    return;
  }

  const cases = [
    {
      name: "Residential Quote (Kerala)",
      input: {
        systemId,
        state: "Kerala",
        pricingContext: { projectType: 'residential', targetMarginPct: 0.15 },
        orgId: "00000000-0000-0000-0000-000000000001"
      }
    },
    {
      name: "Commercial Quote (Kerala)",
      input: {
        systemId,
        state: "Kerala",
        pricingContext: { projectType: 'commercial', targetMarginPct: 0.20 },
        orgId: "00000000-0000-0000-0000-000000000001"
      }
    }
  ];

  for (const tc of cases) {
    console.log(`\n--- Running case: ${tc.name} ---`);
    try {
      const output = await calculateSystemFromDb(client, tc.input);
      console.log("RESULT STATUS: SUCCESS");
      console.log(`Lines Count: ${output.lines.length}`);
      console.log("Pricing Summary:", output.pricing);
      console.log("Subsidy Summary:", output.subsidy);
      console.log("Margin Summary:", output.margin);
      console.log("Customer Price Summary:", output.customerPrice);
    } catch (err) {
      console.log("RESULT STATUS: FAIL");
      console.log("Error during calculation: " + err.stack);
    }
  }

  await client.end();
}

run();
