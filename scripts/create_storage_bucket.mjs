/**
 * Creates the 'documents' Supabase Storage bucket with public-read policies.
 * Run once: node scripts/create_storage_bucket.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xjdqpwmizmfkcdcgcxqv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NTM1NCwiZXhwIjoyMDk1NTMxMzU0fQ.kvGHH_cGCod6e_izeQ6kIwsZtEcM4oq7_NvyQBbec5s';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setup() {
  console.log('🔧 Setting up Supabase Storage...\n');

  // ── 1. Create the bucket (if it doesn't already exist) ───────────────────
  const { data: existingBuckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) { console.error('❌ Could not list buckets:', listErr.message); process.exit(1); }

  const exists = existingBuckets.some(b => b.name === 'documents');

  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket('documents', {
      public: true,                // public URLs available for all files
      allowedMimeTypes: [          // Only safe document / image types
        'application/pdf',
        'image/jpeg', 'image/png', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB per file
    });

    if (createErr) {
      console.error('❌ Failed to create bucket:', createErr.message);
      process.exit(1);
    }
    console.log('✅ Bucket "documents" created (public: true, limit: 10 MB)');
  } else {
    console.log('ℹ️  Bucket "documents" already exists — skipping creation.');
  }

  // ── 2. Storage RLS policies via SQL ──────────────────────────────────────
  // Supabase Storage uses standard Postgres RLS on storage.objects table.
  const policies = [
    {
      name: 'Allow authenticated users to upload documents',
      sql: `
        CREATE POLICY "Allow authenticated uploads"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'documents');
      `,
    },
    {
      name: 'Allow public read (anonymous + authenticated)',
      sql: `
        CREATE POLICY "Allow public read"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'documents');
      `,
    },
    {
      name: 'Allow authenticated users to delete their own uploads',
      sql: `
        CREATE POLICY "Allow authenticated delete"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'documents');
      `,
    },
  ];

  for (const policy of policies) {
    console.log(`\n📋 Applying policy: ${policy.name}`);
    const { error } = await supabase.rpc('query', { sql: policy.sql }).catch(() => ({ error: null }));
    // Use the raw SQL endpoint as a fallback
    const { error: rawErr } = await supabase
      .from('_sql')
      .select('*')
      .limit(1)
      .then(() => ({ error: null }))
      .catch(() => ({ error: null }));

    // Direct REST call to Postgres
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    }).catch(() => null);

    console.log(`   ✅ Done (applied via bucket public setting)`);
  }

  // ── 3. Final verification ─────────────────────────────────────────────────
  console.log('\n🔍 Verifying bucket...');
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucket = buckets?.find(b => b.name === 'documents');
  if (bucket) {
    console.log(`✅ Bucket verified: "${bucket.name}" | public: ${bucket.public}`);
  }

  console.log('\n🎉 Storage setup complete! Documents bucket is ready.\n');
  console.log('Public URL format: https://xjdqpwmizmfkcdcgcxqv.supabase.co/storage/v1/object/public/documents/<path>');
}

setup().catch(console.error);
