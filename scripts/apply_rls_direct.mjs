/**
 * Apply storage RLS policies using direct DB connection (pg).
 * Run: node scripts/apply_rls_direct.mjs
 */
import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgresql://postgres.xjdqpwmizmfkcdcgcxqv:9BTkCoHcgWtYvE36@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const POLICIES_SQL = `
-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;

-- CREATE policies
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Public can view documents"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');
`;

async function main() {
  console.log('🔧 Connecting to Supabase DB to apply storage RLS...\n');
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to database.');

    await client.query(POLICIES_SQL);
    console.log('✅ All 4 RLS policies applied successfully!\n');

    // List existing policies
    const { rows } = await client.query(`
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      ORDER BY policyname;
    `);
    
    console.log(`📋 Current policies on storage.objects (${rows.length} total):`);
    rows.forEach(r => console.log(`   - "${r.policyname}" (${r.cmd}) → roles: ${r.roles}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
    console.log('\n✅ Done!');
  }
}

main();
