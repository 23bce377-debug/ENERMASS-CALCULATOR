import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface SystemRow {
  id: string;
  org_id: string | null;
  name: string;
  category: string;
  capacity_kw: string;
  panel_wattage_w: number | null;
  panel_qty: number | null;
  is_active: boolean;
  is_custom: boolean;
  item_count: number;
  quote_count: number;
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'on_grid': return 'On-Grid';
    case '3_phase': return '3-Phase';
    case 'micro_inverter': return 'Micro-Inverter';
    case 'hybrid': return 'Hybrid';
    case 'upgrade': return 'Upgrade';
    case 'commercial': return 'Commercial';
    default: return category;
  }
}

function formatCapacity(capStr: string): string {
  const num = parseFloat(capStr);
  return Number(num.toFixed(2)).toString(); // e.g. 4.960 -> 4.96, 3.100 -> 3.1
}

function isGenericName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return (
    n === 'solar plant' ||
    n.includes('plant capacity') ||
    n.includes('sheet') ||
    n.includes('reference') ||
    n === '1.5kw' ||
    n === '2kw' ||
    n === 'hibrid 3 kw'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');

  console.log('═══ ENERMASS DATABASE CLEANUP ENGINE: SYSTEMS & PRESETS ═══');
  console.log(`Execution Mode: ${commit ? 'COMMIT (WRITE TO DB)' : 'DRY-RUN (READ-ONLY)'}\n`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Fetch all systems
    const systemsRes = await client.query<SystemRow>(`
      SELECT s.id, s.org_id, s.name, s.category, s.capacity_kw, s.panel_wattage_w, s.panel_qty, s.is_active, s.is_custom,
             (SELECT COUNT(*) FROM quotes q WHERE q.system_id = s.id) as quote_count,
             (SELECT COUNT(*) FROM system_items si WHERE si.system_id = s.id) as item_count
      FROM systems s
      ORDER BY s.category, s.capacity_kw, s.name;
    `);
    const systems = systemsRes.rows;

    console.log(`Loaded ${systems.length} systems from database.`);

    // Group systems by (category, capacity_kw)
    const groups = new Map<string, SystemRow[]>();
    for (const s of systems) {
      const capKey = parseFloat(s.capacity_kw).toFixed(3);
      const key = `${s.category}|${capKey}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(s);
    }

    const systemsToDelete: string[] = [];
    const quoteUpdates: { oldId: string; newId: string }[] = [];
    const systemRenames: { id: string; oldName: string; newName: string }[] = [];

    console.log('\n--- Analyzing groups ---');

    for (const [key, groupSystems] of groups.entries()) {
      const [cat, cap] = key.split('|');
      const categoryLabel = getCategoryLabel(cat);
      const cleanCap = formatCapacity(cap);

      // Score each system in the group to find the best one to keep
      const scoreSystem = (sys: SystemRow) => {
        let score = 0;
        
        // Prefer systems with descriptive/clean names
        if (!isGenericName(sys.name)) {
          score += 150;
        }

        // Prefer systems with items in systems_items (valid BOM template)
        score += sys.item_count * 2;

        // Prefer systems referenced by quotes (major weight to avoid breaking references)
        score += sys.quote_count * 1000;

        // Prefer global templates over org-specific ones if they are presets
        if (sys.org_id === null) {
          score += 20;
        }

        return score;
      };

      const sortedSystems = [...groupSystems].sort((a, b) => scoreSystem(b) - scoreSystem(a));
      const keepSystem = sortedSystems[0];
      const duplicates = sortedSystems.slice(1);

      // Check if the kept system needs renaming
      if (isGenericName(keepSystem.name)) {
        const newName = `${cleanCap} KWp ${categoryLabel}`;
        systemRenames.push({ id: keepSystem.id, oldName: keepSystem.name, newName });
      }

      if (duplicates.length > 0) {
        console.log(`\nGroup [${cat} - ${cap} kW]:`);
        console.log(`  KEEP -> ID: ${keepSystem.id} | Name: "${keepSystem.name}" | Score: ${scoreSystem(keepSystem)} | Items: ${keepSystem.item_count} | Quotes: ${keepSystem.quote_count}`);
        
        for (const dup of duplicates) {
          console.log(`  MERGE/DELETE -> ID: ${dup.id} | Name: "${dup.name}" | Score: ${scoreSystem(dup)} | Items: ${dup.item_count} | Quotes: ${dup.quote_count}`);
          systemsToDelete.push(dup.id);
          if (dup.quote_count > 0) {
            quoteUpdates.push({ oldId: dup.id, newId: keepSystem.id });
          }
        }
      }
    }

    console.log('\n--- Cleanup Action Plan ---');
    console.log(`Systems to delete: ${systemsToDelete.length}`);
    console.log(`Quotes to update: ${quoteUpdates.length}`);
    console.log(`Systems to rename: ${systemRenames.length}`);

    if (systemRenames.length > 0) {
      console.log('\nPlanned Renames:');
      for (const r of systemRenames) {
        console.log(`  - ID: ${r.id} | "${r.oldName}" -> "${r.newName}"`);
      }
    }

    if (systemsToDelete.length === 0 && systemRenames.length === 0) {
      console.log('\n✅ Database is already fully clean and unique!');
      return;
    }

    if (commit) {
      console.log('\nStarting database mutation inside a transaction...');
      await client.query('BEGIN');

      // 1. Update quotes to point to the kept system IDs
      for (const update of quoteUpdates) {
        console.log(`Updating quotes referencing system ${update.oldId} to reference ${update.newId}...`);
        const res = await client.query('UPDATE quotes SET system_id = $1 WHERE system_id = $2', [update.newId, update.oldId]);
        console.log(`  Updated ${res.rowCount} quotes.`);
      }

      // 2. Rename systems that had generic names
      for (const rename of systemRenames) {
        console.log(`Renaming system ${rename.id}: "${rename.oldName}" -> "${rename.newName}"...`);
        await client.query('UPDATE systems SET name = $1 WHERE id = $2', [rename.newName, rename.id]);
      }

      // 3. Delete duplicates from systems (this will cascade delete system_items)
      if (systemsToDelete.length > 0) {
        console.log(`Deleting ${systemsToDelete.length} duplicate systems...`);
        const deleteRes = await client.query('DELETE FROM systems WHERE id = ANY($1)', [systemsToDelete]);
        console.log(`  Deleted ${deleteRes.rowCount} systems.`);
      }

      await client.query('COMMIT');
      console.log('\n✅ Database cleanup completed successfully!');
    } else {
      console.log('\nDry run finished. Run with --commit to apply changes to the database.');
    }

  } catch (err) {
    if (commit) {
      console.log('Rolling back transaction due to error...');
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Failed to rollback:', rbErr);
      }
    }
    console.error('Failed to clean database:', err);
  } finally {
    await client.end();
  }
}

main();
