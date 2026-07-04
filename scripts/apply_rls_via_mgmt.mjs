/**
 * Apply storage RLS policies via Supabase Management API.
 *
 * Required env:
 * - SUPABASE_PROJECT_REF
 * - SUPABASE_ACCESS_TOKEN
 * - SUPABASE_SERVICE_ROLE_KEY
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Run: node scripts/apply_rls_via_mgmt.mjs
 */
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!PROJECT_REF || !SUPABASE_ACCESS_TOKEN || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
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
    label: 'SELECT - public read access',
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

async function runManagementQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function main() {
  console.log('Applying storage RLS policies via Supabase Management API...');

  for (const policy of POLICIES) {
    const result = await runManagementQuery(policy.sql);
    console.log(`${policy.label}: ${result.ok ? 'OK' : `FAILED (${result.status}) ${result.text.slice(0, 120)}`}`);
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const testPath = `test/anon_test_${Date.now()}.pdf`;
  const { error: uploadError } = await anonClient.storage
    .from('documents')
    .upload(testPath, Buffer.from('%PDF-1.4 anon test'), { contentType: 'application/pdf' });

  if (uploadError) {
    console.log(`Anon upload test failed: ${uploadError.message}`);
    return;
  }

  await supabase.storage.from('documents').remove([testPath]);
  console.log('Anon upload test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
