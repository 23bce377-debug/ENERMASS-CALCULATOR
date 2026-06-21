import { createClient } from '@supabase/supabase-js';

const url = 'https://xjdqpwmizmfkcdcgcxqv.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, key);

async function setupBuckets() {
  const bucketsToCreate = ['documents', 'quotes'];

  for (const bucketName of bucketsToCreate) {
    console.log(`Checking bucket: ${bucketName}`);
    const { data, error } = await supabase.storage.getBucket(bucketName);
    
    if (error && (error as any).message.includes('not found') || !data) {
      console.log(`Bucket ${bucketName} not found. Creating...`);
      const { data: createData, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: null,
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (createError) {
        console.error(`Failed to create ${bucketName}:`, (createError as any).message);
      } else {
        console.log(`Created bucket ${bucketName} successfully!`);
      }
    } else if (error) {
      console.error(`Error checking ${bucketName}:`, (error as any).message);
    } else {
      console.log(`Bucket ${bucketName} already exists. Updating to public...`);
      const { data: updateData, error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true
      });
      if (updateError) {
        console.error(`Failed to update ${bucketName}:`, (updateError as any).message);
      } else {
        console.log(`Updated bucket ${bucketName} successfully!`);
      }
    }
  }
}

setupBuckets().catch(console.error);
