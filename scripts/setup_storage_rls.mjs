/**
 * Verifies storage bucket access for the documents bucket.
 *
 * Required env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node scripts/setup_storage_rls.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const bucket = buckets.find((item) => item.name === 'documents');
  if (!bucket) {
    throw new Error('Bucket "documents" was not found.');
  }

  const testPath = `test/upload_test_${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(testPath, Buffer.from('%PDF-1.4 test document content'), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(testPath);
  const verifyResponse = await fetch(urlData.publicUrl);
  await supabase.storage.from('documents').remove([testPath]);

  if (!verifyResponse.ok) {
    throw new Error(`Public access test failed with HTTP ${verifyResponse.status}.`);
  }

  console.log(`Bucket documents verified. Public: ${bucket.public}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
