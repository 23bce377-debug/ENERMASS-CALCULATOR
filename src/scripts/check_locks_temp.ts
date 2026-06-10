import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- Current Active Queries ---');
    const res = await client.query(`
      SELECT pid, state, query, age(clock_timestamp(), query_start) as duration
      FROM pg_stat_activity
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `);
    console.log(res.rows);

    console.log('\n--- Locks ---');
    const locks = await client.query(`
      SELECT blocked_locks.pid     AS blocked_pid,
             blocked_activity.query    AS blocked_statement,
             blocking_locks.pid    AS blocking_pid,
             blocking_activity.query   AS blocking_statement
      FROM  pg_catalog.pg_locks         blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks         blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted;
    `);
    console.log(locks.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
