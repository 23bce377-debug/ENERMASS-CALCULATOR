const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  try {
    console.log('--- FIND ENERMASS ORGANISATION ---');
    
    // Find the organisation named 'Enermass' (case-insensitive)
    const orgRes = await client.query(
      "SELECT * FROM organisations WHERE name ILIKE '%enermass%'"
    );
    console.log('Organisations found:', orgRes.rows);

    if (orgRes.rows.length === 0) {
      console.log('No organisation found with name matching Enermass.');
      return;
    }

    const orgIds = orgRes.rows.map(row => row.id);
    const orgIdsString = orgIds.map(id => `'${id}'`).join(',');

    // Find all tables that have a foreign key references or a column named org_id / organisation_id
    const columnsRes = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name IN ('org_id', 'organisation_id') AND table_schema = 'public'
    `);

    console.log('\n--- SEARCHING RELATED TABLES FOR DELETION AND DEACTIVATION ---');
    for (const row of columnsRes.rows) {
      const tableName = row.table_name;
      const columnName = row.column_name;
      
      const countRes = await client.query(`
        SELECT COUNT(*) as count FROM "${tableName}" WHERE "${columnName}" IN (${orgIdsString})
      `);
      const count = parseInt(countRes.rows[0].count, 10);
      if (count > 0) {
        console.log(`Table "${tableName}" has ${count} records with ${columnName} in [${orgIdsString}]`);
        // If it's a small table, let's view the rows
        if (count <= 10) {
          const rowsRes = await client.query(`
            SELECT * FROM "${tableName}" WHERE "${columnName}" IN (${orgIdsString})
          `);
          console.log(rowsRes.rows);
        }
      }
    }

    // Also look for other mentions of "Enermass" in the DB.
    // For example, in profiles, invites, user_devices, etc.
    const textColumnsRes = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE data_type IN ('character varying', 'text') AND table_schema = 'public'
    `);
    
    console.log('\n--- SEARCHING TEXT COLUMNS FOR "ENERMASS" ---');
    for (const row of textColumnsRes.rows) {
      const tableName = row.table_name;
      const columnName = row.column_name;
      
      try {
        const countRes = await client.query(`
          SELECT COUNT(*) as count FROM "${tableName}" WHERE "${columnName}" ILIKE '%enermass%'
        `);
        const count = parseInt(countRes.rows[0].count, 10);
        if (count > 0) {
          console.log(`Table "${tableName}" column "${columnName}" has ${count} rows matching '%enermass%'`);
          const rowsRes = await client.query(`
            SELECT * FROM "${tableName}" WHERE "${columnName}" ILIKE '%enermass%' LIMIT 5
          `);
          console.log(rowsRes.rows);
        }
      } catch (e) {
        // Skip errors (e.g. system tables or views that don't support ILIKE)
      }
    }

  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await client.end();
  }
}

run();
