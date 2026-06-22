const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const email = 'hrushib.2501@gmail.com';
  const password = 'TestPassword123!';

  console.log(`Signing in as ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in failed:', error);
    return;
  }

  const session = data.session;
  console.log('Sign in successful! Session access_token:', session.access_token);

  // Construct the @supabase/ssr cookie value
  // Format is URL encoded JSON array: [access_token, refresh_token, null, null, null]
  const cookieValue = encodeURIComponent(JSON.stringify([
    session.access_token,
    session.refresh_token,
    null,
    null,
    null
  ]));

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieHeader = `${cookieName}=${cookieValue}`;

  console.log('Sending request to /api/devices/verify...');
  try {
    const res = await fetch('http://localhost:3000/api/devices/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        device_name: 'Diagnostic Device',
        browser: 'Node.js',
        os: 'Windows',
        fingerprint_hash: 'diagnostic_fingerprint_123',
        public_key: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' }),
        challenge_str: JSON.stringify({ timestamp: Date.now(), random: 'diagnostic_random' }),
        signature: 'diagnostic_signature',
      })
    });

    console.log('Response Status:', res.status);
    const bodyText = await res.text();
    console.log('Response Body:', bodyText);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
