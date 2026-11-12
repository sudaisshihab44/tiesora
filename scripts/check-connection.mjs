/**
 * Tiesora Supabase connectivity check.
 *
 * Read-only. Loads `.env`, checks the Auth endpoint, then makes one RLS-scoped
 * query. As an anonymous caller, `families` should return 0 rows (not an
 * error) because the SELECT policy is restricted to authenticated members.
 *
 * Run: node scripts/check-connection.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

let host = '(invalid URL)';
try {
  host = new URL(url).host;
} catch {
  console.error('VITE_SUPABASE_URL is not a valid URL');
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Supabase host: ${host}`);

const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError) {
  console.error(`Auth endpoint: ERROR — ${sessionError.message}`);
  process.exit(1);
}
console.log('Auth endpoint: reachable');
console.log(`Current session: ${sessionData.session ? 'signed in' : 'anonymous'}`);

const { data, error } = await supabase.from('families').select('id').limit(1);
if (error) {
  console.error(`families query: ERROR ${error.code ?? ''} — ${error.message}`);
  process.exit(1);
}
console.log(
  `families query: reachable (${data?.length ?? 0} row(s) visible to anon; 0 is expected)`,
);
console.log('Connectivity check passed.');
