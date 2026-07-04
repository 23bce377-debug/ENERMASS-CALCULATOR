/**
 * Apply RLS policies to storage.objects for the documents bucket.
 *
 * Required env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node scripts/apply_storage_policies.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SQL_STATEMENTS = [
  `DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow public read" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;`,
  `DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;`,
  `CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (bucket_id = 'documents');`,
  `CREATE POLICY "Allow public read"
   ON storage.objects FOR SELECT TO public
   USING (bucket_id = 'documents');`,
  `CREATE POLICY "Allow authenticated delete"
   ON storage.objects FOR DELETE TO authenticated
   USING (bucket_id = 'documents');`,
  `CREATE POLICY "Allow authenticated update"
   ON storage.objects FOR UPDATE TO authenticated
   USING (bucket_id = 'documents');`,
];

async function runSql(sql) {
  const endpoints = ['/rest/v1/rpc/query', '/pg/query'];

  for (const endpoint of endpoints) {
    const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) return { ok: true, text: '' };
    const text = await response.text();
    if (!text.includes('requested path is invalid') && !text.includes('function')) {
      return { ok: false, text };
    }
  }

  return { ok: false, text: 'No SQL execution endpoint accepted the request.' };
}

async function applyPolicies() {
  console.log('Applying RLS policies for documents bucket...');

  for (const sql of SQL_STATEMENTS) {
    const preview = sql.trim().replace(/\s+/g, ' ').slice(0, 80);
    const result = await runSql(sql);
    console.log(`${preview}... -> ${result.ok ? 'OK' : `FAILED ${result.text.slice(0, 120)}`}`);
  }

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucket = buckets?.find((item) => item.name === 'documents');
  console.log(`Bucket documents: public=${bucket?.public ?? 'unknown'}`);
}

applyPolicies().catch((error) => {
  console.error(error);
  process.exit(1);
});
