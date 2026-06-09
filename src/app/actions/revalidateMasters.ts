'use server';

import { revalidateTag } from 'next/cache';
import { CACHE_TAG } from '@/lib/cache/masterCache';
import { invalidateCacheKeys } from '@/lib/cache/redisCache';
import { createClient } from '@/lib/supabase/server';

/**
 * Invalidates both the Next.js cache and the server-side Redis cache keys.
 * Next request to GET /api/masters will fetch fresh data from Supabase.
 */
export async function revalidateMasterCache(): Promise<void> {
  // Invalidate Next.js cache tag
  revalidateTag(CACHE_TAG, 'default');
  
  // Invalidate Redis keys
  await invalidateCacheKeys(
    'eq:panels:active',
    'eq:inverters:active',
    'eq:batteries:active',
    'state_rules:all',
    'subsidy_schemes:active'
  );

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = (await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()) as any;
      if (profile?.org_id) {
        await invalidateCacheKeys(`erp:bootstrap:${profile.org_id}`);
      }
    }
  } catch (err) {
    console.error('Failed to invalidate user bootstrap cache:', err);
  }
}

