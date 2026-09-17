const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tablesRes = await client.query(`
    SELECT t.table_name,
           json_agg(c.column_name ORDER BY c.ordinal_position) as columns
    FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = 'public'
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    ORDER BY t.table_name;
  `);

  console.log(`Total BASE TABLES in public schema: ${tablesRes.rows.length}`);

  const hasOrgId = [];
  const hasOrganizationId = [];
  const hasUserIdNoOrg = [];
  const noOrgOrUser = [];

  for (const row of tablesRes.rows) {
    const cols = row.columns;
    if (cols.includes('org_id')) {
      hasOrgId.push(row.table_name);
    } else if (cols.includes('organization_id')) {
      hasOrganizationId.push(row.table_name);
    } else if (cols.includes('user_id') || cols.includes('profile_id') || cols.includes('created_by')) {
      hasUserIdNoOrg.push(row.table_name);
    } else {
      noOrgOrUser.push(row.table_name);
    }
  }

  console.log(`\nTables with 'org_id' (${hasOrgId.length}):`);
  console.log(hasOrgId);

  console.log(`\nTables with 'organization_id' (${hasOrganizationId.length}):`);
  console.log(hasOrganizationId);

  console.log(`\nTables with 'user_id' / 'created_by' but NO org column (${hasUserIdNoOrg.length}):`);
  console.log(hasUserIdNoOrg);

  console.log(`\nTables with NO org and NO user column (${noOrgOrUser.length}):`);
  console.log(noOrgOrUser);

  await client.end();
}

run().catch(console.error);
