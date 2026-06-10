const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  // List of policies to create
  const policies = [
    // eq_mounting_structures SELECT policy
    `CREATE POLICY eq_mounting_structures_visibility ON eq_mounting_structures 
     FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`,

    // eq_bom_items SELECT policy
    `CREATE POLICY eq_bom_items_visibility ON eq_bom_items 
     FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`,

    // eq_meters SELECT policy
    `CREATE POLICY eq_meters_visibility ON eq_meters 
     FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`,

    // eq_lightning_arresters SELECT policy
    `CREATE POLICY eq_lightning_arresters_visibility ON eq_lightning_arresters 
     FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`,

    // eq_communication_devices SELECT policy
    `CREATE POLICY eq_communication_devices_visibility ON eq_communication_devices 
     FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`,

    // calculation_schemes SELECT policy
    `CREATE POLICY calculation_schemes_visibility ON calculation_schemes 
     FOR SELECT USING (true);`,

    // scheme_slabs SELECT policy
    `CREATE POLICY scheme_slabs_visibility ON scheme_slabs 
     FOR SELECT USING (true);`
  ];

  for (const policySql of policies) {
    const policyName = policySql.match(/CREATE POLICY (\w+)/)[1];
    try {
      // Check if policy already exists to avoid errors
      const checkRes = await client.query(`
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND policyname = $1
      `, [policyName]);

      if (checkRes.rowCount > 0) {
        console.log(`Policy ${policyName} already exists. Dropping and re-creating...`);
        const tableName = policySql.match(/ON (\w+)/)[1];
        await client.query(`DROP POLICY ${policyName} ON ${tableName};`);
      }

      await client.query(policySql);
      console.log(`Applied policy: ${policyName}`);
    } catch (err) {
      console.error(`Error applying policy ${policyName}:`, err.message);
    }
  }

  await client.end();
}

run().catch(console.error);
