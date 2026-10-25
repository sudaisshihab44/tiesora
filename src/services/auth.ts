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
import type { UserProfile } from '../types';

export type AuthResult =
  | { ok: true; user: UserProfile }
  | { ok: false; error: string };

// ─── Sign Up ─────────────────────────────────────────────────────────────────
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — just mutate localStorage
    const user = storage.updateCurrentUser({ display_name: displayName, email });
    return { ok: true, user };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Sign-up failed — no user returned.' };

  // Upsert profile row (trigger handles it, but we do it explicitly for safety)
  await supabase.from('profiles').upsert({
    id: data.user.id,
    email: data.user.email ?? email,
    display_name: displayName,
  });

  const profile = await fetchProfile(data.user.id);
  return { ok: true, user: profile };
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

// ─── Password Reset ───────────────────────────────────────────────────────────
export async function sendPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode — pretend it worked
    return { ok: true };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
  callback: (user: UserProfile | null) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: call once with the current mock user and return a no-op
    callback(storage.getCurrentUser());
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      // Sync to localStorage so storage.getCurrentUser() is always up-to-date
      storage.updateCurrentUser(profile);
      callback(profile);
    } else {
      callback(null);
    }
  });

  return () => data.subscription.unsubscribe();
}

// ─── Internal: fetch profile row ─────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<UserProfile> {
  if (!supabase) return storage.getCurrentUser();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!data) return storage.getCurrentUser();

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
