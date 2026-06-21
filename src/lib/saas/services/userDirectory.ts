import 'server-only';

import { createAdminClient } from '@/lib/supabase/server';

export interface ProfileSummary {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
}

function uniqueIds(userIds: string[]) {
  return [...new Set(userIds.filter(Boolean))];
}

export async function profilesByUserId(userIds: string[]) {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return new Map<string, ProfileSummary>();

  const { data, error } = await (createAdminClient() as any)
    .from('profiles')
    .select('id, full_name, phone, role, is_active')
    .in('id', ids);

  if (error) throw new Error(`Failed to load profiles: ${error.message}`);

  return new Map<string, ProfileSummary>(
    ((data ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile])
  );
}

export async function userEmailsById(userIds: string[]) {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return new Map<string, string | null>();

  const client = createAdminClient();
  const entries: [string, string | null][] = [];
  const chunkSize = 25;

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const results = await Promise.allSettled(
      chunk.map(async (id): Promise<[string, string | null]> => {
        const { data, error } = await client.auth.admin.getUserById(id);
        if (error) return [id, null];
        return [id, data.user?.email ?? null];
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') entries.push(result.value);
    }
  }

  return new Map<string, string | null>(entries);
}
