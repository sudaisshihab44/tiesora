import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Environment detection ────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are both set to
 * non-placeholder values. When false the app runs entirely on localStorage
 * (demo / offline mode) and Supabase is never called.
 */
export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseUrl !== 'https://your-project-ref.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key-here';

// ─── Supabase client (lazy — only created when configured) ───────────────────
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'tiesora_auth_v1',
      },
    });
  }
  return _supabase;
}

// Convenience: the supabase client, or null when unconfigured
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? getSupabase()
  : null;
