const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const catalog = {
    panels: (await client.query("SELECT * FROM eq_panels")).rows,
    inverters: (await client.query("SELECT * FROM eq_inverters")).rows,
    batteries: (await client.query("SELECT * FROM eq_batteries")).rows,
    meters: (await client.query("SELECT * FROM eq_meters")).rows,
    las: (await client.query("SELECT * FROM eq_lightning_arresters")).rows,
    bom_items: (await client.query("SELECT * FROM eq_bom_items")).rows,
    structures: (await client.query("SELECT * FROM eq_mounting_structures")).rows,
    components: (await client.query("SELECT * FROM structure_component_master")).rows
  };

  fs.writeFileSync('scratch/catalog.json', JSON.stringify(catalog, null, 2));
  console.log('✅ Dumped catalog to scratch/catalog.json');
  await client.end();
}

main().catch(console.error);
