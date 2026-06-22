const crypto = require('crypto');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We require raw crypto calculations to insert the key first
const BASE32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function encodeBase32(bytes) {
  let bits = 0; let value = 0; let output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]; bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output.toUpperCase();
}
function generateRawActivationKey() {
  const bytes = crypto.randomBytes(10);
  const encoded = encodeBase32(bytes).padEnd(16, 'A').slice(0, 16);
  return `EMSOL-${encoded.slice(0, 4)}-${encoded.slice(4, 8)}-${encoded.slice(8, 12)}-${encoded.slice(12, 16)}`;
}
function hashActivationKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey.trim().toUpperCase()).digest('hex');
}
function encryptActivationKey(rawKey, secretHex) {
  const encKey = Buffer.from(secretHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

async function run() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  try {
    const rawKey = generateRawActivationKey();
    const hash = hashActivationKey(rawKey);
    const encrypted = encryptActivationKey(rawKey, process.env.ACTIVATION_KEY_ENCRYPTION_SECRET);
    const prefix = rawKey.split('-').slice(0, 2).join('-');

    const orgId = '5763b935-b4b0-4488-a386-2bbba0fa7fa1';
    const createdBy = '5e35b271-beba-429e-ad3f-49e553cc8782';
    const batchId = crypto.randomUUID();

    // Insert key
    await pgClient.query(`
      INSERT INTO public.activation_keys (org_id, key_hash, key_encrypted, key_prefix, status, batch_id, created_by, key_version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [orgId, hash, encrypted, prefix, 'unused', batchId, createdBy, 1]);

    console.log(`Generated Key: ${rawKey}`);

    // Call API to validate and redeem
    const validateRes = await fetch('http://localhost:3000/api/activation/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: rawKey })
    });
    const validateData = await validateRes.json();
    console.log('Validation Response:', validateData);

    const challenge = validateData.challenge;

    // Simulate WebAuthn registration response structure
    const webauthnRegistration = {
      id: 'mock-id-12345',
      rawId: Buffer.from('mock-id-12345').toString('base64url'),
      clientDataJSON: Buffer.from(JSON.stringify({ challenge, origin: 'http://localhost:3000' })).toString('base64url'),
      attestationObject: Buffer.from('mock-attestation-obj').toString('base64url'),
    };

    const redeemRes = await fetch('http://localhost:3000/api/activation/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: rawKey,
        full_name: 'Test Confirmed',
        email: 'testlogin@pitbullcorporations.com',
        password: 'TestPassword123!',
        phone: '9876543210',
        fingerprint_hash: 'mock_fingerprint',
        webauthn_registration: webauthnRegistration,
        device_name: 'Test Device',
        browser: 'Node.js',
        os: 'Windows'
      })
    });

    const redeemData = await redeemRes.json();
    console.log('Redeem Response:', redeemData);

    if (redeemData.success && redeemData.userId) {
      console.log('Confirming email in Supabase Auth...');
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      );
      const { data, error } = await adminClient.auth.admin.updateUserById(
        redeemData.userId,
        { email_confirm: true }
      );
      if (error) {
        console.error('Failed to confirm email:', error);
      } else {
        console.log('Email confirmed successfully! confirmed_at:', data.user.email_confirmed_at);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pgClient.end();
  }
}

run();
