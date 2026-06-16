const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fix() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  console.log("Adding RLS policies to net_metering_applications...");

  // Create policies matching epc_project_milestones_via_project
  await client.query(`
    -- Make sure RLS is enabled
    ALTER TABLE public.net_metering_applications ENABLE ROW LEVEL SECURITY;

    -- Drop policy if it exists to replace it
    DROP POLICY IF EXISTS "net_metering_applications_via_project" ON public.net_metering_applications;

    -- Create ALL policy linking through epc_projects
    CREATE POLICY "net_metering_applications_via_project" 
    ON public.net_metering_applications 
    FOR ALL 
    USING (
      project_id IN (
        SELECT id FROM public.epc_projects WHERE org_id = current_org_id()
      )
    );
  `);

  console.log("Policies added successfully.");
  await client.end();
}

fix().catch(console.error);
