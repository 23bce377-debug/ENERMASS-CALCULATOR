import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Check panels with null selling_price or buy_price
    const panels = await client.query(`
      SELECT id, brand, model, wattage_w, buy_price, selling_price
      FROM eq_panels
      WHERE selling_price IS NULL OR buy_price IS NULL;
    `);
    console.log(`--- PANELS WITH NULL RATES/PRICES (${panels.rows.length}) ---`);
    console.log(panels.rows);

    // Check inverters with null rates or prices
    const inverters = await client.query(`
      SELECT id, brand, model, buy_price, selling_price
      FROM eq_inverters
      WHERE buy_price IS NULL OR selling_price IS NULL;
    `);
    console.log(`--- INVERTERS WITH NULL RATES/PRICES (${inverters.rows.length}) ---`);
    console.log(inverters.rows);

    // Check batteries with null rates or prices
    const batteries = await client.query(`
      SELECT id, brand, model, buy_price, selling_price
      FROM eq_batteries
      WHERE buy_price IS NULL OR selling_price IS NULL;
    `);
    console.log(`--- BATTERIES WITH NULL RATES/PRICES (${batteries.rows.length}) ---`);
    console.log(batteries.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
