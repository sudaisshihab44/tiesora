/**
 * auth.ts — Tiesora auth service
 *
 * When Supabase is configured (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set):
 *   → Uses Supabase Auth for real sign-up / sign-in / sign-out / reset.
 *   → Persists session in localStorage via Supabase's built-in mechanism.
 *
 * When NOT configured (demo / offline mode):
 *   → Falls back to the existing TiesoraStorage mock flow.
 *   → Any email/password "works" — same as before.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './storage';
import { recordAudit } from './db/auditLogs';
import { normalizeRole, type UserProfile } from '../types';

export type AuthResult =
  | { ok: true; user: UserProfile; needsConfirmation?: boolean }
  | { ok: false; error: string };

// ─── Sign Up ─────────────────────────────────────────────────────────────────
/**
 * Creates a Supabase Auth account for the given email.
 *
 * Security notes:
 *  - The `intendedRole` parameter is stored ONLY in Supabase user metadata
 *    so it survives the email-confirmation redirect.  It is used as a UI hint
 *    to decide which onboarding path to show — it is NEVER used as
 *    authorisation.  The actual role is always written by a SECURITY DEFINER
 *    database function or an RLS-controlled insert, not by the client.
 *  - We always call `supabase.auth.signUp()` with the trimmed email the user
 *    typed — never with a hardcoded or fallback address.
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  intendedRole: 'admin' | 'viewer' = 'viewer',
): Promise<AuthResult> {
  // Defensive: trim and validate here so no caller can accidentally pass
  // a stale or whitespace-padded address.
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — just mutate localStorage
    const user = storage.updateCurrentUser({ display_name: displayName, email: cleanEmail });
    return { ok: true, user, needsConfirmation: false };
  }

  const { data, error } = await supabase.auth.signUp({
    email:    cleanEmail,       // ← always the trimmed user-entered value
    password,
    options: {
      data: {
        display_name:  displayName,
        intended_role: intendedRole,  // persisted through email confirmation
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Sign-up failed — no user returned.' };

  const needsConfirmation = !data.session;

  // With email confirmation enabled there is no authenticated session yet, so
  // the profile row must be created by the database trigger. Only upsert here
  // when the user is already signed in.
  if (data.session) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id:           data.user.id,
      email:        data.user.email ?? cleanEmail,
      display_name: displayName,
    });
    if (profileError) {
      console.warn('[auth] profile upsert after sign-up failed:', profileError.message);
    }
  }

  const profile: UserProfile = {
    id: data.user.id,
    email: data.user.email ?? cleanEmail,
    display_name: displayName,
    preferred_language: 'en',
    created_at: data.user.created_at ?? new Date().toISOString(),
  };

  return { ok: true, user: profile, needsConfirmation };
}

// ─── Resend confirmation email ────────────────────────────────────────────────
/**
 * Uses the Supabase `resend` API (OTP type "signup") to re-send the
 * confirmation email.  This is the correct API — not sendPasswordReset.
 *
 * Rate limiting: Supabase enforces server-side limits. This function returns
 * the exact error message so the UI can display it accurately.  The UI layer
 * must enforce its own cooldown to avoid spamming the button.
 */
export async function resendConfirmation(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isSupabaseConfigured || !supabase) return { ok: true }; // demo no-op

  const { error } = await supabase.auth.resend({
    type:  'signup',
    email: cleanEmail,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode
    const user = storage.getCurrentUser();
    return { ok: true, user };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Sign-in failed.' };

  const profile = await fetchProfile(data.user.id);
  return { ok: true, user: profile };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  // In demo mode, sign-out just returns to landing — App.tsx handles the view state.
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
/**
 * Starts the Google OAuth redirect. The provider must be enabled in Supabase
 * Dashboard → Authentication → Providers → Google. The button component hides
 * itself when the public auth settings report Google as disabled.
 */
export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Google sign-in requires Supabase to be configured.' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Password Reset ───────────────────────────────────────────────────────────
export async function sendPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — pretend it worked
    return { ok: true };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#reset-password`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Update password (after reset-password redirect) ─────────────────────────
export async function updatePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true }; // demo mode — no-op
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Get intended role from session metadata (UI hint only) ──────────────────
/**
 * Reads the `intended_role` stored in the user's JWT metadata at signup.
 * Used ONLY as a UI routing hint — never as authorisation.
 * Returns 'viewer' as the safe default if the field is missing.
 */
export async function getIntendedRoleFromSession(): Promise<'admin' | 'viewer'> {
  if (!isSupabaseConfigured || !supabase) return 'admin'; // demo: always admin
  const { data } = await supabase.auth.getUser();
  const meta = data?.user?.user_metadata;
  if (meta?.intended_role === 'admin') return 'admin';
  return 'viewer';
}

// ─── Get current session user (for app boot) ─────────────────────────────────
export async function getSessionUser(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) {
    return storage.getCurrentUser();
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return fetchProfile(data.user.id);
}

// ─── Subscribe to auth state changes ─────────────────────────────────────────
export function onAuthStateChange(
  callback: (user: UserProfile | null, event?: string) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: call once with the current mock user and return a no-op
    callback(storage.getCurrentUser(), 'INITIAL_SESSION');
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      // Sync to localStorage so storage.getCurrentUser() is always up-to-date
      storage.updateCurrentUser(profile);
      callback(profile, event);
    } else {
      callback(null, event);
    }
  });

  return () => data.subscription.unsubscribe();
}

// ─── Get role from DB (never trusts client state) ────────────────────────────
/**
 * Reads the authenticated user's role and active family directly from
 * Supabase `family_memberships`. Never reads from localStorage, sessionStorage,
 * URL params, or any client-controlled field.
 *
 * Returns null when:
 *  - No active membership exists for this user
 *  - The membership has been revoked / suspended
 *  - Supabase is not configured (falls back to localStorage for demo mode)
 *
 * Fixes applied:
 *  - Removed the `families(name)` FK join — it was fragile and caused silent
 *    errors when the PostgREST schema cache hadn't registered the relationship.
 *  - Changed .single() → .maybeSingle() so zero rows returns null (not an
 *    error), preventing the "PGRST116 no rows" error from propagating.
 */
export async function getRoleFromDB(userId: string): Promise<{
  role: import('../types').Role;
  familyId: string;
  familyName: string;
} | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — read from localStorage (acceptable for local dev only)
    const fam = storage.getCurrentFamily();
    const role = storage.getUserRoleInFamily(userId, fam.id);
    return { role, familyId: fam.id, familyName: fam.name };
  }

  // Query only ACTIVE memberships — revoked/suspended are automatically excluded.
  // NOTE: we do NOT join families(name) here because the FK relationship may not
  //       be registered in Supabase's PostgREST schema cache, causing silent failures.
  const { data, error } = await supabase
    .from('family_memberships')
    .select('role, family_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();           // returns null (not error) when 0 rows found

  if (error) {
    console.warn('[getRoleFromDB] query error:', error.message, error.code);
    return null;
  }
  if (!data) return null;     // no active membership

  const role = normalizeRole(data.role);

  return { role, familyId: data.family_id, familyName: '' };
}

// ─── Ensure a Supabase family_memberships row exists for the family creator ──
/**
 * Called after a new family is created in Supabase.
 *
 * Strategy (in order):
 *  1. Try the SECURITY DEFINER bootstrap RPC — bypasses RLS when the caller
 *     is the family owner.
 *  2. Fall back to a direct client INSERT — works when the "Family owner can
 *     bootstrap first membership" RLS policy is live (20261027 migration).
 *  3. Log clearly if both fail — never silently swallow errors.
 */
export async function ensureAdminMembership(
  familyId: string,
  userId: string,
  email: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: true }; // demo mode

  // ── Attempt 1: SECURITY DEFINER RPC (bypasses RLS) ─────────────────────────
  const { error: rpcError } = await supabase.rpc('bootstrap_family_admin', {
    p_family_id: familyId,
    p_user_id:   userId,
    p_email:     email,
    p_name:      name,
  });

  if (!rpcError) {
    console.log('[ensureAdminMembership] RPC succeeded');
    return { ok: true };
  }

  console.warn('[ensureAdminMembership] RPC failed:', rpcError.message, '— trying direct insert');

  // ── Attempt 2: Direct client INSERT (requires bootstrap RLS policy) ─────────
  // This path works once the 20261027 migration has been applied and the
  // "Family owner can bootstrap first membership" policy is live.
  const { error: insertError } = await supabase
    .from('family_memberships')
    .upsert(
      {
        family_id:  familyId,
        user_id:    userId,
        user_email: email,
        user_name:  name,
        role:       'admin',
        status:     'active',
      },
      { onConflict: 'family_id,user_id' },
    );

  if (!insertError) {
    console.log('[ensureAdminMembership] direct insert succeeded');
    return { ok: true };
  }

  console.error('[ensureAdminMembership] both paths failed. RPC:', rpcError.message, '| INSERT:', insertError.message);
  return {
    ok: false,
    error: `Could not create admin membership. RPC: ${rpcError.message} | INSERT: ${insertError.message}`,
  };
}

// ─── Create invitation (admin only — writes to Supabase invitations table) ────
/**
 * Calls the `create_invitation` SECURITY DEFINER RPC.
 * Only succeeds if the caller is an active admin of the family.
 * The token is generated server-side with pgcrypto — never from the client.
 *
 * Returns { ok, token } on success.
 * In demo mode falls back to localStorage (token generated client-side).
 */
export async function createInvitation(
  familyId: string,
  email: string,
  role: 'admin' | 'viewer',
  expiresInDays: number = 7,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — generate client-side token and store in localStorage
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 14)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    const user = storage.getCurrentUser();
    storage.addInvitation({
      family_id: familyId,
      email,
      role,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    });
    return { ok: true, token };
  }

  const { data, error } = await supabase.rpc('create_invitation', {
    p_family_id:       familyId,
    p_email:           email,
    p_role:            role,
    p_expires_in_days: expiresInDays,
  });

  if (error) return { ok: false, error: error.message };

  // RPC returns TABLE — PostgREST returns an array
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) return { ok: false, error: 'Invitation created but token was not returned.' };

  return { ok: true, token: row.token };
}

// ─── Validate invitation token (read-only check) ─────────────────────────────
/**
 * Calls the `validate_invitation` SECURITY DEFINER RPC to check whether a
 * token is valid, unexpired, and unused.
 *
 * Returns the family name so the UI can show a confirmation before accepting.
 * Does NOT create a membership row — that is acceptInvitation()'s job.
 */
export async function validateInvitation(token: string): Promise<{
  ok: boolean;
  familyName?: string;
  role?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: use localStorage invitation system
    const inv = storage.validateInvitation(token);
    if (!inv) return { ok: false, error: 'Invalid or expired invitation.' };
    const fam = storage.getFamilies().find(f => f.id === inv.family_id);
    return { ok: true, familyName: fam?.name ?? 'Your Family', role: inv.role };
  }

  const { data, error } = await supabase
    .rpc('validate_invitation', { p_token: token });

  if (error) {
    // P0001 = our custom "invalid invitation" error from the RPC
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Invalid, expired, or already-used invitation.' };
  }

  const row = data[0];
  return { ok: true, familyName: row.family_name, role: row.role };
}

// ─── Accept invitation (creates viewer membership) ───────────────────────────
/**
 * Calls the `accept_invitation` SECURITY DEFINER RPC to:
 *  1. Re-validate the token (atomic — prevents TOCTOU race)
 *  2. Create a family_memberships row with the role from the invitation
 *  3. Mark the invitation as accepted
 *
 * The client NEVER specifies a role — the DB function reads it from the
 * invitations table, so a viewer cannot promote themselves to admin.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userName: string,
): Promise<{ ok: boolean; familyId?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: use localStorage
    const result = storage.acceptInvitation(token, userId, userName);
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, familyId: result.familyId };
  }

  const { data, error } = await supabase
    .rpc('accept_invitation', {
      p_token:     token,
      p_user_id:   userId,
      p_user_name: userName,
    });

  if (error) return { ok: false, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const familyId = row?.family_id as string | undefined;

  if (familyId) {
    try {
      await recordAudit({
        family_id: familyId,
        action: 'accepted invitation',
        target_type: 'invitation',
        target_name: userName,
        details: 'Accepted an invitation and joined the family.',
      });
    } catch (auditError) {
      console.warn('[auth] invitation accepted, audit write failed:', auditError);
    }
  }

  return { ok: true, familyId };
}

// ─── Internal: fetch profile row ─────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<UserProfile> {
  if (!supabase) return storage.getCurrentUser();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!data) {
    // The profile trigger may not have committed yet, or the caller may be
    // unauthenticated. Never fall back to localStorage — that could surface a
    // different account's identity.
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (authUser?.id === userId) {
      const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
      return {
        id: userId,
        email: authUser.email ?? '',
        display_name:
          (typeof metadata?.display_name === 'string' && metadata.display_name) ||
          authUser.email?.split('@')[0] ||
          'Family member',
        preferred_language: 'en',
        created_at: authUser.created_at ?? new Date().toISOString(),
      };
    }
    throw new Error('Could not load your profile. Please sign in again.');
  }

  const profile: UserProfile = {
    id: data.id,
    email: data.email,
    display_name: data.display_name,
    avatar_path: data.avatar_path ?? undefined,
    preferred_language: data.preferred_language ?? 'en',
    created_at: data.created_at,
  };

  // Keep localStorage in sync
  storage.updateCurrentUser(profile);
  return profile;
}
