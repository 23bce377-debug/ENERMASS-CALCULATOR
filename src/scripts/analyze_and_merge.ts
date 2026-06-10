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

    // Let's get all systems
    const systemsRes = await client.query(`
      SELECT s.id, s.org_id, s.name, s.category, s.capacity_kw, s.panel_qty, s.panel_wattage_w, s.is_active, s.is_custom,
             (SELECT COUNT(*) FROM quotes q WHERE q.system_id = s.id) as quote_count,
             (SELECT COUNT(*) FROM system_items si WHERE si.system_id = s.id) as item_count
      FROM systems s
      ORDER BY s.category, s.capacity_kw, s.name;
    `);

    const systems = systemsRes.rows;
    console.log(`Loaded ${systems.length} total systems.`);

    // Group systems by org_id (normalized), category, and capacity_kw
    const groups = new Map<string, typeof systems>();
    for (const s of systems) {
      const orgKey = s.org_id || 'global';
      // Format capacity to a standard decimal string to avoid slight floating-point differences
      const capKey = parseFloat(s.capacity_kw).toFixed(3);
      const key = `${orgKey}|${s.category}|${capKey}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(s);
    }

    console.log(`\n--- GROUPS OF SYSTEMS (grouped by Org, Category, and Capacity) ---`);
    let duplicateGroupsCount = 0;
    
    for (const [key, group] of groups.entries()) {
      if (group.length > 1) {
        duplicateGroupsCount++;
        console.log(`\nGroup key: ${key} (${group.length} systems)`);
        for (const s of group) {
          console.log(`  - ID: ${s.id} | Name: "${s.name}" | Panels: ${s.panel_qty} x ${s.panel_wattage_w}W | Items: ${s.item_count} | Quotes: ${s.quote_count} | Active: ${s.is_active} | Custom: ${s.is_custom}`);
        }
      }
    }

    console.log(`\nTotal duplicate groups found: ${duplicateGroupsCount}`);

  } catch (err) {
    console.error('Error during analysis:', err);
  } finally {
    await client.end();
  }
}

main();
