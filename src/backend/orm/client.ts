import { supabase as defaultBrowserClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

let defaultOverrideClient: any = null;

/**
 * Sets a contextual default client for ORM operations (e.g. during server requests or testing).
 */
export function setDefaultOrmClient(client: SupabaseClient | any) {
  defaultOverrideClient = client;
}

/**
 * Resolves the Supabase client to use for ORM queries.
 * Priority:
 * 1. Explicitly passed `client` argument
 * 2. `defaultOverrideClient` if set
 * 3. Default browser client
 */
export function getOrmClient(client?: SupabaseClient | any): any {
  if (client) return client;
  if (defaultOverrideClient) return defaultOverrideClient;
  return defaultBrowserClient;
}
