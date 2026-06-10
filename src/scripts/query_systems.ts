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

    // Query all systems with capacity 4.96 and category on_grid
    const res = await client.query(`
      SELECT id, name, category, capacity_kw, panel_qty, panel_wattage_w, is_active, is_custom, created_at
      FROM systems
      WHERE ABS(capacity_kw - 4.960) < 0.001 AND category = 'on_grid'
      ORDER BY name;
    `);

    console.log('--- SYSTEMS AT 4.96 kW ON-GRID ---');
    for (const r of res.rows) {
      console.log(`\nID: ${r.id} | Name: "${r.name}" | Panels: ${r.panel_qty} x ${r.panel_wattage_w}W`);
      
      const items = await client.query(`
        SELECT section, description, default_qty, unit
        FROM system_items
        WHERE system_id = $1
        ORDER BY section, description;
      `, [r.id]);

      console.log(`  Items (${items.rows.length}):`);
      for (const item of items.rows.slice(0, 10)) {
        console.log(`    - ${item.section}: ${item.description} (qty: ${item.default_qty} ${item.unit})`);
      }
      if (items.rows.length > 10) {
        console.log(`    ... and ${items.rows.length - 10} more items`);
      }
    }

  } catch (err) {
    console.error('Failed to query database:', err);
  } finally {
    await client.end();
  }
}

main();
