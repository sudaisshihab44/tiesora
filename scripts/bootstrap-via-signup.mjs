/**
 * Bootstrap admin + viewer through the public sign-up flow.
 *
 * Use this when you do not have the service_role key. It creates two real
 * Supabase Auth users, a test family, and an admin/viewer membership.
 *
 * Requires in `.env`:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * If email confirmation is ON in Supabase Auth, sign-up returns no session and
 * this script cannot continue. In that case either confirm the emails in the
 * dashboard or use scripts/bootstrap-users.mjs with the service_role key.
 *
 * Run: node scripts/bootstrap-via-signup.mjs
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@tiesora.test')
  .trim()
  .toLowerCase();
const viewerEmail = (process.env.BOOTSTRAP_VIEWER_EMAIL || 'viewer@tiesora.test')
  .trim()
  .toLowerCase();
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const viewerPassword = process.env.BOOTSTRAP_VIEWER_PASSWORD;

if (!adminPassword || !viewerPassword) {
  console.error(
    'Set BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_VIEWER_PASSWORD in .env (local only).',
  );
  process.exit(1);
}

const adminClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const viewerClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signUpOrIn(client, email, password, displayName) {
  const signUp = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (signUp.error) {
    // The account may already exist from a previous run.
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) {
      throw new Error(
        `Could not create or sign in ${email}: ${signUp.error.message} / ${signIn.error.message}`,
      );
    }
    return signIn.data.user;
  }

  if (!signUp.data.session) {
    throw new Error(
      `Sign-up for ${email} succeeded but returned no session. ` +
        'Email confirmation is enabled. Confirm the user in Supabase Dashboard -> Authentication -> Users, then run this script again.',
    );
  }

  return signUp.data.user;
}

async function main() {
  console.log('Creating bootstrap users through public sign-up...');

  const adminUser = await signUpOrIn(
    adminClient,
    adminEmail,
    adminPassword,
    'Bootstrap Admin',
  );
  const viewerUser = await signUpOrIn(
    viewerClient,
    viewerEmail,
    viewerPassword,
    'Bootstrap Viewer',
  );

  // Reuse the bootstrap family if this script was run before.
  const { data: existingFamilies, error: familyLookupError } = await adminClient
    .from('families')
    .select('id, name')
    .eq('name', 'Bootstrap Test Family')
    .limit(1);

  if (familyLookupError) {
    throw new Error(`Family lookup failed: ${familyLookupError.message}`);
  }

  let familyId = existingFamilies?.[0]?.id;

  if (!familyId) {
    familyId = crypto.randomUUID();
    const { error } = await adminClient.rpc('create_family_with_admin', {
      p_family_id: familyId,
      p_name: 'Bootstrap Test Family',
      p_description: 'Local bootstrap family for admin/viewer testing.',
      p_privacy_settings: {
        hideLivingDates: false,
        hideLivingBiographies: false,
        hidePrivateMemories: false,
        requireAdminApprovalForEdits: true,
        isPubliclySearchable: false,
      },
    });
    if (error) {
      throw new Error(`Family creation failed: ${error.message}`);
    }
  }

  // Add the viewer membership if it does not exist.
  const { data: existingMembership, error: membershipLookupError } =
    await adminClient
      .from('family_memberships')
      .select('id, role, status')
      .eq('family_id', familyId)
      .eq('user_id', viewerUser.id)
      .limit(1);

  if (membershipLookupError) {
    throw new Error(`Membership lookup failed: ${membershipLookupError.message}`);
  }

  if (!existingMembership || existingMembership.length === 0) {
    try {
      const { data: invitationRows, error: inviteError } = await adminClient.rpc(
        'create_invitation',
        {
          p_family_id: familyId,
          p_email: viewerEmail,
          p_role: 'viewer',
          p_expires_in_days: 7,
        },
      );

      if (inviteError) {
        throw new Error(`Invitation creation failed: ${inviteError.message}`);
      }

      const token = Array.isArray(invitationRows)
        ? invitationRows[0]?.token
        : invitationRows?.token;
      if (!token) {
        throw new Error('Invitation created but no token was returned.');
      }

      const { error: acceptError } = await viewerClient.rpc(
        'accept_invitation',
        {
          p_token: token,
          p_user_id: viewerUser.id,
          p_email: viewerEmail,
          p_user_name: 'Bootstrap Viewer',
        },
      );

      if (acceptError) {
        throw new Error(`Invitation acceptance failed: ${acceptError.message}`);
      }
    } catch (inviteFlowError) {
      // The live accept_invitation RPC currently has an ambiguous-column bug.
      // For local bootstrap testing, an admin can insert the membership
      // directly under the "Admins can insert memberships" RLS policy.
      console.warn(
        `Invitation flow failed (${inviteFlowError.message}). ` +
          'Adding the viewer membership directly as admin.',
      );

      const { error: insertError } = await adminClient
        .from('family_memberships')
        .insert({
          family_id: familyId,
          user_id: viewerUser.id,
          user_email: viewerEmail,
          user_name: 'Bootstrap Viewer',
          role: 'viewer',
          status: 'active',
        });

      if (insertError) {
        throw new Error(
          `Direct viewer membership insert failed: ${insertError.message}`,
        );
      }
    }
  }

  console.log('\n============================================================');
  console.log('Bootstrap login ready');
  console.log('============================================================');
  console.log(`Family:  Bootstrap Test Family (${familyId})`);
  console.log(`Admin:   ${adminEmail}`);
  console.log(`         Password: ${adminPassword}`);
  console.log(`Viewer:  ${viewerEmail}`);
  console.log(`         Password: ${viewerPassword}`);
  console.log('============================================================');
  console.log('Sign in at http://localhost:3000');
  console.log('These accounts are for local testing only. Delete them before production.');
}

main().catch((error) => {
  console.error('\nBootstrap failed:', error.message);
  process.exit(1);
});
