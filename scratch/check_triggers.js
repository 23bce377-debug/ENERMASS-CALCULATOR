const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
  });
  await client.connect();
  console.log("Connected to DB!");

  // Triggers on eq_bom_items
  const trigRes = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'eq_bom_items'
  `);
  console.log("\n=== TRIGGERS ON eq_bom_items ===");
  console.log(trigRes.rows);

  // Check table inheritance/parent
  const inhRes = await client.query(`
    SELECT p.relname AS parent
    FROM pg_inherits i
    JOIN pg_class c ON i.inhrelid = c.oid
    JOIN pg_class p ON i.inhparent = p.oid
    WHERE c.relname = 'eq_bom_items'
  `);
  console.log("\n=== INHERITANCE ===");
  console.log(inhRes.rows);

  // Check definition of catalog_items
  const catRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items'
  `);
  console.log("\n=== COLUMNS FOR catalog_items ===");
  console.log(catRes.rows);

  // Check RLS policies on catalog_items
  const polRes = await client.query(`
    SELECT policyname, cmd, roles, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'catalog_items'
  `);
  console.log("\n=== POLICIES FOR catalog_items ===");
  console.log(polRes.rows);

  await client.end();
}

run().catch(console.error);
