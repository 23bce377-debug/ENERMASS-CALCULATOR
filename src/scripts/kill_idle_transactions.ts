import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  try {
    await client.connect();

    // Show all active / idle-in-transaction sessions
    const active = await client.query(`
      SELECT pid, state, wait_event_type, wait_event, query_start,
             age(clock_timestamp(), query_start) AS duration, left(query, 120) AS query
      FROM pg_stat_activity
      WHERE pid != pg_backend_pid()
        AND state IN ('idle in transaction', 'active')
      ORDER BY query_start;
    `);
    console.log('Active / idle-in-transaction sessions:');
    console.table(active.rows);

    // Terminate any idle-in-transaction sessions older than 30 seconds
    const killed = await client.query(`
      SELECT pg_terminate_backend(pid), pid, query
      FROM pg_stat_activity
      WHERE state = 'idle in transaction'
        AND query_start < now() - interval '30 seconds'
        AND pid != pg_backend_pid();
    `);
    if (killed.rowCount && killed.rowCount > 0) {
      console.log(`\n✅ Terminated ${killed.rowCount} orphaned session(s):`);
      console.table(killed.rows);
    } else {
      console.log('\nℹ️  No orphaned idle-in-transaction sessions found (or they already expired).');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
