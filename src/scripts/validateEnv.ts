import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const REQUIRED_SECRETS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'JWT_SECRET'
];

export function validateEnv() {
  console.log('--- Environment Verification ---');
  let missing = false;
  const isProduction = process.env.NODE_ENV === 'production';

  for (const secret of REQUIRED_SECRETS) {
    const value = process.env[secret];
    const isRedisSecret = secret.startsWith('UPSTASH_REDIS');
    const isInvalid = !value || (isRedisSecret && (value.includes('your-database-name') || value === 'your-rest-token'));

    if (isInvalid) {
      if (isRedisSecret && !isProduction) {
        console.warn(`⚠️ Warning: ${secret} is not fully configured. Rate limiting will fall back to in-memory.`);
      } else {
        console.error(`❌ Invalid or missing required environment variable: ${secret}`);
        missing = true;
      }
    } else {
      // Print masked secret
      const masked = value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` 
        : '***';
      console.log(`✅ ${secret}: Verified (${masked})`);
    }
  }

  if (missing) {
    throw new Error('Environment validation failed: Missing or invalid required secrets.');
  }
  console.log('✅ All required environment secrets are present.');
}

/**
 * guardProduction
 * Enforces safety guardrails so developer scripts do not wipe or reset production databases.
 */
export function guardProduction(scriptName: string) {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProdDb = dbUrl.includes('supabase.com') || dbUrl.includes('pooler.supabase.com');
  const forceProd = process.env.FORCE_PROD === 'true';

  if (isProdDb) {
    console.warn(`⚠️  WARNING: Target database appears to be a PRODUCTION database hosted on Supabase.`);
    if (!forceProd) {
      console.error(`❌ ERROR: Blocked execution of dangerous script "${scriptName}" on production database.`);
      console.error(`To bypass this guardrail, set FORCE_PROD=true in your environment.`);
      process.exit(1);
    } else {
      console.warn(`⚠️  BYPASS: FORCE_PROD=true is active. Executing script on production database in 3 seconds...`);
      // Simulating a delay for human safety check
      const start = Date.now();
      while (Date.now() - start < 3000) {}
    }
  }
}

// Allow direct execution of this file to audit the env
if (require.main === module) {
  try {
    validateEnv();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
