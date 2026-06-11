const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected!");

  try {
    const panels = await client.query("SELECT id, brand, model, wattage_w, buy_price, selling_price FROM eq_panels WHERE is_active = true");
    console.log("=== PANELS IN DB ===");
    console.log(panels.rows);
    
    const inverters = await client.query("SELECT id, brand, model, capacity_kw, buy_price, selling_price FROM eq_inverters WHERE is_active = true");
    console.log("=== INVERTERS IN DB ===");
    console.log(inverters.rows);
  } catch (e) {
    console.error("Error:", e);
  }

  await client.end();
}

run().catch(console.error);
