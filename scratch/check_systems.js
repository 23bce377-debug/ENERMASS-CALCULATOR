const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  const systemsRes = await client.query("SELECT id, name, category, capacity_kw, panel_qty FROM systems");
  console.log("\n=== SYSTEMS ===");
  console.log(systemsRes.rows);

  for (const sys of systemsRes.rows) {
    const itemsRes = await client.query(
      `SELECT count(*), 
              sum(case when panel_id is not null then 1 else 0 end) as panels,
              sum(case when inverter_id is not null then 1 else 0 end) as inverters,
              sum(case when battery_id is not null then 1 else 0 end) as batteries,
              sum(case when solar_meter_id is not null then 1 else 0 end) as solar_meters,
              sum(case when net_meter_id is not null then 1 else 0 end) as net_meters,
              sum(case when la_id is not null then 1 else 0 end) as las,
              sum(case when structure_id is not null then 1 else 0 end) as structures,
              sum(case when bom_item_id is not null then 1 else 0 end) as bom_items,
              sum(case when comm_device_id is not null then 1 else 0 end) as comm_devices
       FROM system_items WHERE system_id = $1`,
      [sys.id]
    );
    console.log(`\nSystem: ${sys.name} (ID: ${sys.id})`);
    console.log(itemsRes.rows[0]);

    // Let's print some items
    const sampleItems = await client.query(
      `SELECT id, section, description, default_qty, unit FROM system_items WHERE system_id = $1 LIMIT 10`,
      [sys.id]
    );
    console.log("Sample items:", sampleItems.rows);
  }

  await client.end();
}

run().catch(console.error);
