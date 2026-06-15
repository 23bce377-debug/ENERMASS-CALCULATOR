import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../types/schema.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase environment variables are missing! " +
    "If you recently created or updated .env.local, please restart your Next.js development server (npm run dev)."
  );
}

// The <Database> generic strictly types all your Supabase queries (removed to prevent TS Map max size exceeded)
export const supabase = createBrowserClient<any>(
  supabaseUrl || 'https://missing-supabase-url.supabase.co',
  supabaseAnonKey || 'missing-anon-key'
)
