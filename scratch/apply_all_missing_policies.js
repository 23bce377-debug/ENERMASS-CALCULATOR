const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  const policies = [
    // catalog_items
    {
      table: 'catalog_items',
      name: 'catalog_items_visibility',
      sql: `CREATE POLICY catalog_items_visibility ON catalog_items FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`
    },
    {
      table: 'catalog_items',
      name: 'catalog_items_write',
      sql: `CREATE POLICY catalog_items_write ON catalog_items FOR ALL TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());`
    },
    // eq_orientation_multipliers (has org_id)
    {
      table: 'eq_orientation_multipliers',
      name: 'eq_orientation_multipliers_visibility',
      sql: `CREATE POLICY eq_orientation_multipliers_visibility ON eq_orientation_multipliers FOR SELECT USING ((org_id IS NULL) OR (org_id = auth_org_id()));`
    },
    {
      table: 'eq_orientation_multipliers',
      name: 'eq_orientation_multipliers_write',
      sql: `CREATE POLICY eq_orientation_multipliers_write ON eq_orientation_multipliers FOR ALL TO authenticated USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());`
    },
    // Others (no org_id, public read)
    {
      table: 'engineering_rules_metadata',
      name: 'engineering_rules_metadata_visibility',
      sql: `CREATE POLICY engineering_rules_metadata_visibility ON engineering_rules_metadata FOR SELECT USING (true);`
    },
    {
      table: 'gst_master',
      name: 'gst_master_visibility',
      sql: `CREATE POLICY gst_master_visibility ON gst_master FOR SELECT USING (true);`
    },
    {
      table: 'master_data_changes_log',
      name: 'master_data_changes_log_visibility',
      sql: `CREATE POLICY master_data_changes_log_visibility ON master_data_changes_log FOR SELECT USING (true);`
    },
    {
      table: 'master_data_imports',
      name: 'master_data_imports_visibility',
      sql: `CREATE POLICY master_data_imports_visibility ON master_data_imports FOR SELECT USING (true);`
    },
    {
      table: 'pricing_reference',
      name: 'pricing_reference_visibility',
      sql: `CREATE POLICY pricing_reference_visibility ON pricing_reference FOR SELECT USING (true);`
    },
    {
      table: 'quote_history',
      name: 'quote_history_visibility',
      sql: `CREATE POLICY quote_history_visibility ON quote_history FOR SELECT USING (true);`
    },
    {
      table: 'state_rules',
      name: 'state_rules_visibility',
      sql: `CREATE POLICY state_rules_visibility ON state_rules FOR SELECT USING (true);`
    },
    {
      table: 'state_scheme_overrides',
      name: 'state_scheme_overrides_visibility',
      sql: `CREATE POLICY state_scheme_overrides_visibility ON state_scheme_overrides FOR SELECT USING (true);`
    },
    {
      table: 'structure_weight_lookup',
      name: 'structure_weight_lookup_visibility',
      sql: `CREATE POLICY structure_weight_lookup_visibility ON structure_weight_lookup FOR SELECT USING (true);`
    },
    {
      table: 'sys_approval_history',
      name: 'sys_approval_history_visibility',
      sql: `CREATE POLICY sys_approval_history_visibility ON sys_approval_history FOR SELECT USING (true);`
    },
    {
      table: 'sys_approval_steps',
      name: 'sys_approval_steps_visibility',
      sql: `CREATE POLICY sys_approval_steps_visibility ON sys_approval_steps FOR SELECT USING (true);`
    },
    {
      table: 'sys_approval_workflow_rules',
      name: 'sys_approval_workflow_rules_visibility',
      sql: `CREATE POLICY sys_approval_workflow_rules_visibility ON sys_approval_workflow_rules FOR SELECT USING (true);`
    },
    {
      table: 'sys_role_permissions',
      name: 'sys_role_permissions_visibility',
      sql: `CREATE POLICY sys_role_permissions_visibility ON sys_role_permissions FOR SELECT USING (true);`
    }
  ];

  for (const p of policies) {
    try {
      // Check if policy already exists to avoid errors
      const checkRes = await client.query(`
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND policyname = $1
      `, [p.name]);

      if (checkRes.rowCount > 0) {
        console.log(`Policy ${p.name} on ${p.table} already exists. Dropping and re-creating...`);
        await client.query(`DROP POLICY ${p.name} ON ${p.table};`);
      }

      await client.query(p.sql);
      console.log(`Applied policy: ${p.name} on ${p.table}`);
    } catch (err) {
      console.error(`Error applying policy ${p.name} on ${p.table}:`, err.message);
    }
  }

  await client.end();
}

run().catch(console.error);
