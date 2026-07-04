/**
 * Creates the Supabase Storage buckets used by the app.
 *
 * Required env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run once: node scripts/create_storage_bucket.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const buckets = [
  {
    name: 'documents',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  {
    name: 'quotes',
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: null,
  },
];

async function setup() {
  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket.name);

    if (existing) {
      const { error } = await supabase.storage.updateBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: bucket.allowedMimeTypes,
        fileSizeLimit: bucket.fileSizeLimit,
      });
      if (error) throw error;
      console.log(`Updated bucket: ${bucket.name}`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
      fileSizeLimit: bucket.fileSizeLimit,
    });
    if (error) throw error;
    console.log(`Created bucket: ${bucket.name}`);
  }
}

setup().catch((error) => {
  console.error(error);
  process.exit(1);
});
