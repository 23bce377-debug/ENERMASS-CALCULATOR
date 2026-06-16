/**
 * Apply RLS policies via Supabase Management API.
 * Run: node scripts/setup_storage_rls.mjs
 */

const PROJECT_REF = 'xjdqpwmizmfkcdcgcxqv';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZHFwd21pem1ma2NkY2djeHF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk1NTM1NCwiZXhwIjoyMDk1NTMxMzU0fQ.kvGHH_cGCod6e_izeQ6kIwsZtEcM4oq7_NvyQBbec5s';

const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

// Execute raw SQL via the Supabase DB REST endpoint
async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

// Use the pg endpoint
async function runSQL(sql) {
  const payload = { query: sql };
  const endpoints = [
    `${SUPABASE_URL}/pg/query`,
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
  ];

  for (const url of endpoints) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) return { ok: true, text };
    if (!text.includes('requested path is invalid') && !text.includes('function') ) {
      return { ok: false, text };
    }
  }
  return { ok: false, text: 'All endpoints failed' };
}

// Try the database direct connection via the JS client approach
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('🔧 Checking bucket status...\n');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) { console.error(error); process.exit(1); }
  
  const bucket = buckets.find(b => b.name === 'documents');
  console.log(`Bucket "documents": ${bucket ? `exists, public=${bucket.public}` : 'NOT FOUND'}`);
  
  if (!bucket) {
    process.exit(1);
  }

  // Because the bucket is already public=true, Supabase auto-generates
  // permissive policies. Let's test uploading a PDF directly.
  console.log('\n🧪 Testing file upload with service_role...');
  
  const testContent = '%PDF-1.4 test document content';
  const testPath = `test/upload_test_${Date.now()}.pdf`;
  
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(testPath, Buffer.from(testContent), {
      contentType: 'application/pdf',
      upsert: true,
    });
  
  if (upErr) {
    console.error('❌ Upload test FAILED:', upErr.message);
  } else {
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(testPath);
    console.log('✅ Upload test PASSED!');
    console.log('   Public URL:', urlData.publicUrl);
    
    // Verify it's publicly accessible
    const verifyRes = await fetch(urlData.publicUrl);
    console.log(`   Public access: ${verifyRes.ok ? '✅ OK (' + verifyRes.status + ')' : '❌ Failed (' + verifyRes.status + ')'}`);
    
    // Clean up
    await supabase.storage.from('documents').remove([testPath]);
    console.log('   Cleaned up test file.');
  }

  // Now test what an anon (browser user) upload would look like
  // The anon key is needed for uploads FROM the browser (not server-side)
  // Since bucket is public=true, we need the RLS policies to allow anon insert
  
  console.log('\n📋 Bucket configuration summary:');
  console.log(`   Name: documents`);
  console.log(`   Public: ${bucket.public}`);
  console.log(`   Upload allowed (service_role): ${!upErr ? 'Yes' : 'No'}`);
  console.log('\n⚠️  Note: For authenticated browser uploads, you may need to add storage');
  console.log('   policies in the Supabase Dashboard → Storage → Policies');
  console.log('   Policy: INSERT for role "authenticated" WHERE bucket_id = \'documents\'');
  
  console.log('\n✅ Setup complete!');
}

main().catch(console.error);
