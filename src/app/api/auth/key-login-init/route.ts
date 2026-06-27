import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { hashActivationKey, normaliseActivationKey, isValidKeyFormat } from '@/lib/saas/services/activationKeyCrypto';

export async function POST(request: Request) {
  try {
    const { rawKey } = await request.json();
    if (!rawKey || typeof rawKey !== 'string') {
      return NextResponse.json({ error: 'License key is required.' }, { status: 400 });
    }

    const normalized = normaliseActivationKey(rawKey);
    if (!isValidKeyFormat(normalized)) {
      return NextResponse.json({ error: 'Invalid license key format. Expected EMSOL-XXXX-XXXX-XXXX-XXXX' }, { status: 400 });
    }

    const hash = hashActivationKey(normalized);
    const supabase = createAdminClient();

    // 1. Look up the key
    const { data: key, error: keyError } = await supabase
      .from('activation_keys')
      .select('*')
      .eq('key_hash', hash)
      .maybeSingle();

    if (keyError || !key) {
      return NextResponse.json({ error: 'License key not found.' }, { status: 404 });
    }

    if (key.status === 'revoked') {
      return NextResponse.json({ error: 'This license key has been revoked.' }, { status: 403 });
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This license key has expired.' }, { status: 403 });
    }

    let userId = key.activated_by;

    // For backwards compatibility: if the key is unused and not associated with any user yet,
    // we activate it on first login by creating the Supabase user, profile, and org member.
    if (key.status === 'unused' || !userId) {
      const email = `key-${key.id}@enermass.local`;
      const password = normalized; // the raw key

      // Check if user already exists
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find(u => u.email === email);
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create auth user
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: `Key User ${key.key_prefix}`,
            org_id: key.org_id,
            key_id: key.id,
          }
        });

        if (userError || !userData?.user) {
          console.error('[KeyLoginInit] User creation failed:', userError);
          return NextResponse.json({ error: 'Failed to initialize account for key.' }, { status: 500 });
        }

        userId = userData.user.id;

        // Create profile
        await supabase.from('profiles').insert({
          id: userId,
          org_id: key.org_id,
          full_name: `Key User ${key.key_prefix}`,
          role: 'staff',
          is_active: true,
        });

        // Create org member
        await supabase.from('org_members').insert({
          org_id: key.org_id,
          user_id: userId,
          role: 'staff',
          status: 'active',
        });
      }

      // Mark key as activated
      await supabase
        .from('activation_keys')
        .update({
          status: 'activated',
          activated_by: userId,
          activated_at: new Date().toISOString(),
        })
        .eq('id', key.id);
    }

    // 2. Count active devices/sessions for this user
    const { count, error: countError } = await supabase
      .from('user_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (countError) {
      console.error('[KeyLoginInit] Device count failed:', countError);
      return NextResponse.json({ error: 'Failed to verify active sessions.' }, { status: 500 });
    }

    const maxUses = key.max_uses ?? 5;

    // Check if the current browser already has a valid active device session
    let deviceToken = '';
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)enermass_device_token=([^;]*)/);
      if (match) {
        deviceToken = match[1];
      }
    }
    
    let isThisDeviceActive = false;
    if (deviceToken) {
      const secretHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
      const { data: matchedDevice } = await supabase
        .from('user_devices')
        .select('id')
        .eq('user_id', userId)
        .eq('device_secret_hash', secretHash)
        .eq('status', 'active')
        .maybeSingle();
      if (matchedDevice) {
        isThisDeviceActive = true;
      }
    }

    if (!isThisDeviceActive && (count ?? 0) >= maxUses) {
      return NextResponse.json({
        error: 'DeviceLimitReached',
        message: 'Concurrent login limit reached for this license key. Please log out from another device.',
        redirectTo: `/device-blocked?reason=device_limit_reached`
      }, { status: 428 });
    }

    return NextResponse.json({
      success: true,
      email: `key-${key.id}@enermass.local`
    });

  } catch (error) {
    console.error('[KeyLoginInit] Unhandled error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
