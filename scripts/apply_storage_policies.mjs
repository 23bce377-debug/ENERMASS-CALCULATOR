/**
 * Apply RLS policies to storage.objects for the 'documents' bucket.
 * Run: node scripts/apply_storage_policies.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xjdqpwmizmfkcdcgcxqv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NTM1NCwiZXhwIjoyMDk1NTMxMzU0fQ.kvGHH_cGCod6e_izeQ6kIwsZtEcM4oq7_NvyQBbec5s';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SQL_STATEMENTS = [
  // Drop old policies if they exist (idempotent)
  `DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow public read" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;`,

  // Authenticated users can upload
  `CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (bucket_id = 'documents');`,

  // Anyone (including anon) can read — needed for "View Document" links
  `CREATE POLICY "Allow public read"
   ON storage.objects FOR SELECT TO public
   USING (bucket_id = 'documents');`,

  // Authenticated users can delete files
  `CREATE POLICY "Allow authenticated delete"
   ON storage.objects FOR DELETE TO authenticated
   USING (bucket_id = 'documents');`,

  // Authenticated users can update (needed for upsert)
  `CREATE POLICY "Allow authenticated update"
   ON storage.objects FOR UPDATE TO authenticated
   USING (bucket_id = 'documents');`,
];

async function applyPolicies() {
  console.log('🔧 Applying RLS policies for "documents" bucket...\n');

  for (const sql of SQL_STATEMENTS) {
    const preview = sql.trim().replace(/\s+/g, ' ').slice(0, 60);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // Try the direct pg endpoint
      const response2 = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const text2 = await response2.text();
      console.log(`   ${preview}... → ${response2.ok ? '✅' : '⚠️ ' + text2.slice(0, 100)}`);
    } else {
      console.log(`   ${preview}... → ✅`);
    }
  }

  // Verify bucket is public
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucket = buckets?.find(b => b.name === 'documents');
  console.log(`\n✅ Bucket "documents": public=${bucket?.public}`);

  // Test a public URL
  const testPath = `test/ping_${Date.now()}.txt`;
  const { error: upErr } = await supabase.storage.from('documents').upload(testPath, Buffer.from('ping'), { contentType: 'text/plain' });
  if (!upErr) {
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(testPath);
    console.log(`✅ Upload test passed. Public URL: ${urlData.publicUrl}`);
    await supabase.storage.from('documents').remove([testPath]);
  } else {
    console.error('❌ Upload test failed:', upErr.message);
  }

  console.log('\n🎉 Done! Documents bucket is live with public read + authenticated write.');
}

applyPolicies().catch(console.error);
