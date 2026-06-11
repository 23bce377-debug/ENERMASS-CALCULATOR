const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const systems = [
    { name: 'Rajasthan 3KW', id: '3aa25c73-d916-4d62-bdc1-9076406b1645' },
    { name: 'Rajasthan 5KW', id: '76519ba7-a721-4abb-8d37-fbb31c476964' },
    { name: 'Rajasthan 6KW', id: '872c841c-45af-47d5-bcd1-d2c40e90586d' }
  ];

  const results = {};

  for (const sys of systems) {
    const items = await client.query(`
      SELECT 
        id, section, description, unit, default_qty, 
        panel_id, inverter_id, battery_id, solar_meter_id, net_meter_id, 
        la_id, structure_id, bom_item_id, comm_device_id, structure_component_id 
      FROM system_items 
      WHERE system_id = $1
      ORDER BY sort_order, description
    `, [sys.id]);
    results[sys.name] = items.rows;
  }

  fs.writeFileSync('scratch/populated_systems_items.json', JSON.stringify(results, null, 2));
  console.log('✅ Dumped populated systems items to scratch/populated_systems_items.json');
  await client.end();
}

main().catch(console.error);
