/**
 * Tiesora bootstrap test users (LOCAL DEVELOPMENT ONLY)
 * =====================================================
 *
 * Creates two confirmed Supabase Auth users and a test family:
 *   - admin  -> family admin membership
 *   - viewer -> family viewer membership
 *
 * Requirements in `.env`:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...        <-- never prefix with VITE_
 *
 * Optional:
 *   BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD
 *   BOOTSTRAP_VIEWER_EMAIL / BOOTSTRAP_VIEWER_PASSWORD
 *
 * Run:
 *   node scripts/bootstrap-users.mjs
 *
 * The service_role key bypasses RLS. It must never be used in frontend code,
 * never be committed, and should be removed from `.env` after bootstrapping.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
      'Add the service_role key from Supabase Dashboard -> Project Settings -> API.',
  );
  process.exit(1);
}

const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@tiesora.test').trim().toLowerCase();
const viewerEmail = (process.env.BOOTSTRAP_VIEWER_EMAIL || 'viewer@tiesora.test').trim().toLowerCase();
const adminPassword =
  process.env.BOOTSTRAP_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
const viewerPassword =
  process.env.BOOTSTRAP_VIEWER_PASSWORD || crypto.randomBytes(18).toString('base64url');

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PRIVACY = {
  hideLivingDates: false,
  hideLivingBiographies: false,
  hidePrivateMemories: false,
  requireAdminApprovalForEdits: true,
  isPubliclySearchable: false,
};

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find(
      (u) => (u.email || '').toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUser(email, password, displayName) {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) throw new Error(`updateUserById(${email}) failed: ${error.message}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user;
}

async function ensureProfile(user, displayName) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      display_name: displayName,
      full_name: displayName,
      email_verified: true,
      preferred_language: 'en',
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`profile upsert failed: ${error.message}`);
}

async function ensureFamily(adminUserId) {
  const familyName = 'Bootstrap Test Family';

  const { data: existing, error: findError } = await admin
    .from('families')
    .select('id, name')
    .eq('name', familyName)
    .eq('owner_id', adminUserId)
    .limit(1);
  if (findError) throw new Error(`family lookup failed: ${findError.message}`);
  if (existing && existing.length > 0) return existing[0];

  const { data, error } = await admin
    .from('families')
    .insert({
      name: familyName,
      description: 'Local bootstrap family for admin/viewer testing.',
      owner_id: adminUserId,
      privacy_settings: DEFAULT_PRIVACY,
    })
    .select('id, name')
    .single();
  if (error) throw new Error(`family insert failed: ${error.message}`);
  return data;
}

async function ensureMembership(familyId, user, role) {
  const { error } = await admin.from('family_memberships').upsert(
    {
      family_id: familyId,
      user_id: user.id,
      user_email: user.email || '',
      user_name: user.user_metadata?.display_name || (user.email || '').split('@')[0],
      role,
      status: 'active',
    },
    { onConflict: 'family_id,user_id' },
  );
  if (error) throw new Error(`membership upsert failed for ${role}: ${error.message}`);
}

async function main() {
  console.log('Creating bootstrap users...');

  const adminUser = await ensureUser(adminEmail, adminPassword, 'Bootstrap Admin');
  const viewerUser = await ensureUser(viewerEmail, viewerPassword, 'Bootstrap Viewer');

  await ensureProfile(adminUser, 'Bootstrap Admin');
  await ensureProfile(viewerUser, 'Bootstrap Viewer');

  const family = await ensureFamily(adminUser.id);
  await ensureMembership(family.id, adminUser, 'admin');
  await ensureMembership(family.id, viewerUser, 'viewer');

  console.log('\n============================================================');
  console.log('Bootstrap login ready');
  console.log('============================================================');
  console.log(`Family:  ${family.name} (${family.id})`);
  console.log(`Admin:   ${adminEmail}`);
  console.log(`         Password: ${adminPassword}`);
  console.log(`Viewer:  ${viewerEmail}`);
  console.log(`         Password: ${viewerPassword}`);
  console.log('============================================================');
  console.log('Save these credentials now. If you left the password env vars');
  console.log('empty, the passwords above were randomly generated.');
  console.log('Remove SUPABASE_SERVICE_ROLE_KEY from .env after bootstrapping.');
  console.log('These accounts are for local testing only. Delete them before production.');
}

main().catch((error) => {
  console.error('\nBootstrap failed:', error.message);
  process.exit(1);
});
