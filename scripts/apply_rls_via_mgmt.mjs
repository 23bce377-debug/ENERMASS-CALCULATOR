/**
 * Apply storage RLS policies via Supabase Management API.
 * Run: node scripts/apply_rls_via_mgmt.mjs
 */

const PROJECT_REF = 'xjdqpwmizmfkcdcgcxqv';
// Personal Access Token — use service role as fallback for management API
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NTM1NCwiZXhwIjoyMDk1NTMxMzU0fQ.kvGHH_cGCod6e_izeQ6kIwsZtEcM4oq7_NvyQBbec5s';

const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// Use the Supabase client with service role — this bypasses RLS for DB ops
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
});

const POLICIES = [
  {
    label: 'INSERT - authenticated users can upload',
    sql: `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = ''documents'')';
  END IF;
END $$;
    `.trim(),
  },
  {
    label: 'SELECT - public read access for all files',
    sql: `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view documents"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = ''documents'')';
  END IF;
END $$;
    `.trim(),
  },
  {
    label: 'DELETE - authenticated users can remove files',
    sql: `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete documents"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = ''documents'')';
  END IF;
END $$;
    `.trim(),
  },
  {
    label: 'UPDATE - authenticated users can replace files',
    sql: `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update documents'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update documents"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = ''documents'')';
  END IF;
END $$;
    `.trim(),
  },
];

async function main() {
  console.log('🔧 Applying RLS policies via Management API...\n');

  for (const policy of POLICIES) {
    // Try Supabase Management REST API
    const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: policy.sql }),
    });

    const text = await res.text();
    console.log(`${policy.label}: ${res.ok ? '✅' : `⚠️  (${res.status}) ${text.slice(0, 80)}`}`);
  }

  // Alternative: since the bucket is public=true, Supabase Storage API handles
  // public downloads automatically. For uploads from the browser (anon key),
  // we need to test directly.
  
  console.log('\n🔍 Checking existing policies on storage.objects...');
  const { data: policiesData, error: pErr } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'storage')
    .eq('tablename', 'objects')
    .catch(() => ({ data: null, error: 'table not accessible' }));
  
  if (pErr || !policiesData) {
    console.log('   Cannot read pg_policies directly (expected for anon role).');
  } else {
    console.log(`   Found ${policiesData.length} policies.`);
    policiesData.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`));
  }

  // Test anon upload (simulates what the browser does)
  console.log('\n🧪 Testing anon key upload (browser simulation)...');
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTUzNTQsImV4cCI6MjA5NTUzMTM1NH0.HtvjO-Ry3m3Rd1gTYhZ8KIisGouRU47-iwGzOW_pGtk';
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  
  const pdfContent = Buffer.from('%PDF-1.4 anon test');
  const testPath = `test/anon_test_${Date.now()}.pdf`;
  
  const { error: anonUpErr } = await anonClient.storage
    .from('documents')
    .upload(testPath, pdfContent, { contentType: 'application/pdf' });
  
  if (anonUpErr) {
    console.log(`   Anon upload: ❌ ${anonUpErr.message}`);
    console.log('\n   → RLS policy for INSERT not yet applied on storage.objects.');
    console.log('   → Please apply via Supabase Dashboard (instructions below).');
  } else {
    console.log('   Anon upload: ✅ Succeeded!');
    await anonClient.storage.from('documents').remove([testPath]);
  }

  console.log('\n📌 MANUAL STEPS (if anon upload failed):');
  console.log('   1. Go to: https://supabase.com/dashboard/project/' + PROJECT_REF + '/storage/policies');
  console.log('   2. Click "New policy" on the storage.objects table');
  console.log('   3. Add these 4 policies for bucket "documents":');
  console.log('      - INSERT: authenticated, WITH CHECK: bucket_id = \'documents\'');
  console.log('      - SELECT: public, USING: bucket_id = \'documents\'');
  console.log('      - UPDATE: authenticated, USING: bucket_id = \'documents\'');
  console.log('      - DELETE: authenticated, USING: bucket_id = \'documents\'');
}

main().catch(console.error);
