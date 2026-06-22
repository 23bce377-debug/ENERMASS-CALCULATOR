const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function clearKeysAndLogs() {
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL database.');

    // 1. Get all public tables
    const resTables = await pgClient.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const existingTables = new Set(resTables.rows.map(r => r.tablename));
    console.log('Existing tables in public schema:', Array.from(existingTables));

    const targetTables = [
      'activation_keys',
      'sys_audit_logs',
      'license_events',
      'rate_master_audit_logs',
      'rate_master_audit_log',
      'quote_status_history',
      'device_reset_requests',
      'master_data_changes_log',
      'preset_usage_history',
      'sys_notification_queue',
      'sys_event_bus'
    ];

    const tablesToClean = targetTables.filter(t => existingTables.has(t));
    console.log('Tables to clean:', tablesToClean);

    // Disable triggers for existing target tables
    console.log('Disabling triggers...');
    for (const table of tablesToClean) {
      await pgClient.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
    }

    try {
      for (const table of tablesToClean) {
        console.log(`Clearing table ${table}...`);
        const res = await pgClient.query(`DELETE FROM public.${table}`);
        console.log(`Cleared ${table}. Rows affected: ${res.rowCount}`);
      }
    } finally {
      // Re-enable triggers
      console.log('Re-enabling triggers...');
      for (const table of tablesToClean) {
        await pgClient.query(`ALTER TABLE public.${table} ENABLE TRIGGER USER`);
      }
    }

    console.log('Successfully completed key removal and log clearing!');
  } catch (err) {
    console.error('Error occurred during cleanup:', err);
  } finally {
    await pgClient.end();
    console.log('Disconnected from PostgreSQL database.');
  }
}

clearKeysAndLogs();
