import React, { useState } from 'react';
import { signIn, sendPasswordReset, getRoleFromDB } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../services/storage';
import { UserProfile, Role } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import { GoogleAuthButton } from './GoogleAuthButton';
import {
  Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle,
  Shield, Users, ArrowRight, ChevronLeft, CheckCircle2,
} from 'lucide-react';

/**
 * The "intended" role is what the user *chose* on the selector screen.
 * After sign-in we always re-verify the ACTUAL role from the database.
 * If they don't match we show a mismatch screen and let them continue
 * with their real role — no access is ever elevated by the client choice.
 */
type IntendedRole = 'admin' | 'viewer';
type Stage =
  | 'select'    // Role-selector cards (landing of this page)
  | 'form'      // Email + password form
  | 'forgot'    // Forgot-password form
  | 'mismatch'; // Actual DB role ≠ intended role

interface SignInPageProps {
  /** Called after successful sign-in AND role verification. Carries the verified role. */
  onSuccess: (user: UserProfile, verifiedRole: Role, familyId: string) => void;
  /** Called when a freshly-authenticated user has no family yet — send to onboarding. */
  onNeedOnboarding: (user: UserProfile) => void;
  onGoSignUp: () => void;
  onGoLanding: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({
  onSuccess,
  onNeedOnboarding,
  onGoSignUp,
  onGoLanding,
}) => {
  const [stage, setStage] = useState<Stage>('select');
  const [intended, setIntended] = useState<IntendedRole>('viewer');

  // Form fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Mismatch state — stored after DB verification
  const [mismatchUser, setMismatchUser]     = useState<UserProfile | null>(null);
  const [mismatchActual, setMismatchActual] = useState<Role>('viewer');
  const [mismatchFamilyId, setMismatchFamilyId] = useState('');

  // ── Helpers ────────────────────────────────────────────────────────────────
  const reset = () => {
    setError(null);
    setEmail('');
    setPassword('');
    setShowPw(false);
    setResetSent(false);
  };

  const handleSelectRole = (role: IntendedRole) => {
    setIntended(role);
    reset();
    setStage('form');
  };

  // ── Demo quick-logins (only shown when Supabase is NOT configured) ─────────
  const demoUsers = [
    { name: 'Thomas Montgomery', role: 'admin'  as Role, email: 'thomas.montgomery@example.com' },
    { name: 'Diana Vance',       role: 'admin'  as Role, email: 'diana.vance@example.com' },
    { name: 'Sarah Montgomery',  role: 'viewer' as Role, email: 'sarah.m@example.com' },
    { name: 'Chloe Vance',       role: 'viewer' as Role, email: 'chloe.vance@example.com' },
  ];

  const handleDemoLogin = (demo: (typeof demoUsers)[0]) => {
    const updated = storage.updateCurrentUser({ display_name: demo.name, email: demo.email });
    const fam = storage.getCurrentFamily();
    onSuccess(updated, demo.role, fam.id);
  };

  // ── Sign-in submit ─────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password)     { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      // Step 1 — authenticate
      const result = await signIn(email.trim(), password);
      if (!result.ok) { setError(result.error); return; }

      const user = result.user;

      // Step 2 — verify role from DB (never from client/localStorage)
      const dbRole = await getRoleFromDB(user.id);

      if (!dbRole) {
        // Authenticated but no active family membership.
        // This is normal for brand-new users — send them to onboarding
        // so they can create their first family (which will write the
        // admin membership row to Supabase via ensureAdminMembership).
        onNeedOnboarding(user);
        return;
      }

      // Step 3 — check for mismatch between intended and actual role
      if (dbRole.role !== intended) {
        setMismatchUser(user);
        setMismatchActual(dbRole.role);
        setMismatchFamilyId(dbRole.familyId);
        setStage('mismatch');
        return;
      }

      // Roles match — proceed
      onSuccess(user, dbRole.role, dbRole.familyId);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot-password submit ─────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const result = await sendPasswordReset(email.trim());
      if (!result.ok) { setError(result.error ?? 'Failed to send reset email.'); return; }
      setResetSent(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Shared field classes ───────────────────────────────────────────────────
  const inputCls =
    'w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none ' +
    'focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors';

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: select — two role-choice cards
  // ══════════════════════════════════════════════════════════════════════════
  if (stage === 'select') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between">
          <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
            <TiesoraLogo size="sm" />
          </button>
          <span className="text-xs text-stone-500">
            No account?{' '}
            <button onClick={onGoSignUp} className="font-semibold text-emerald-800 hover:underline">
              Sign up free
            </button>
          </span>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-xl space-y-6">
            {/* Heading */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                Welcome back to Tiesora
              </h1>
              <p className="text-sm text-stone-500">
                Choose how you'd like to sign in.
              </p>
            </div>

            {/* Two role cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ── Admin card ── */}
              <button
                onClick={() => handleSelectRole('admin')}
                className="group relative text-left p-6 bg-white border-2 border-stone-200 hover:border-emerald-700 rounded-2xl shadow-xs hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-stone-900 mb-0.5">Admin Login</h2>
                <p className="text-xs font-medium text-emerald-800 mb-3">Manage your family.</p>
                <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                  Family administration and authorized editing features. Add members, manage
                  relationships, invite users, and control access.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 group-hover:gap-2.5 transition-all">
                  Admin Login
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
                {/* Active border accent */}
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </button>

              {/* ── User / Viewer card ── */}
              <button
                onClick={() => handleSelectRole('viewer')}
                className="group relative text-left p-6 bg-white border-2 border-stone-200 hover:border-stone-400 rounded-2xl shadow-xs hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-stone-400/30"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-stone-900 mb-0.5">User Login</h2>
                <p className="text-xs font-medium text-stone-600 mb-3">Explore your family.</p>
                <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                  Read-only family information. Browse the interactive tree, explore relationships,
                  and view family memories and events.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 group-hover:gap-2.5 transition-all">
                  User Login
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-500 rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </button>
            </div>

            {/* Security note */}
            <p className="text-center text-[11px] text-stone-400 leading-relaxed">
              Your actual permissions are always verified from the database after sign-in.
              <br />
              Selecting Admin Login does not grant admin access unless you are an authorized admin.
            </p>

            {/* Demo logins */}
            {!isSupabaseConfigured && (
              <div className="border-t border-stone-200 pt-5 space-y-2">
                <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider text-center">
                  Demo quick-access
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {demoUsers.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => handleDemoLogin(u)}
                      className="p-2.5 bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-200 rounded-xl text-left transition-colors"
                    >
                      <p className="font-bold text-[11px] text-stone-800 truncate">{u.name.split(' ')[0]}</p>
                      <p className="text-[10px] text-stone-400 capitalize">{u.role}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: mismatch — actual DB role ≠ what the user selected
  // ══════════════════════════════════════════════════════════════════════════
  if (stage === 'mismatch') {
    const wantedAdmin  = intended === 'admin';
    const actualAdmin  = mismatchActual === 'admin';

    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center">
          <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
            <TiesoraLogo size="sm" />
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
              {/* Amber banner */}
              <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Role mismatch</p>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    You selected <strong>{wantedAdmin ? 'Admin' : 'User'} Login</strong>, but your
                    account has <strong>{actualAdmin ? 'Admin' : 'Viewer'}</strong> access.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {wantedAdmin && !actualAdmin && (
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 leading-relaxed space-y-1">
                    <p className="font-semibold text-stone-900">Admin access not granted</p>
                    <p>
                      Your database role is <span className="font-semibold">Viewer</span>. You
                      cannot gain admin privileges by selecting Admin Login. If you need admin
                      access, ask a family administrator to update your role.
                    </p>
                  </div>
                )}

                {!wantedAdmin && actualAdmin && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-stone-700 leading-relaxed space-y-1">
                    <p className="font-semibold text-stone-900">You have Admin access</p>
                    <p>
                      Your database role is <span className="font-semibold">Admin</span>. You can
                      continue with full admin access — your permissions are not reduced by choosing
                      User Login.
                    </p>
                  </div>
                )}

                {/* CTA — continue with actual role */}
                <button
                  onClick={() => {
                    if (mismatchUser) {
                      onSuccess(mismatchUser, mismatchActual, mismatchFamilyId);
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Continue as {mismatchActual === 'admin' ? 'Admin' : 'Viewer'}
                </button>

                <button
                  onClick={() => { reset(); setStage('select'); }}
                  className="w-full py-2 text-xs text-stone-500 hover:text-stone-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to role selection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAGE: form / forgot — credential entry
  // ══════════════════════════════════════════════════════════════════════════
  const isAdminIntended = intended === 'admin';
  const accentCls = isAdminIntended
    ? 'border-emerald-700 bg-emerald-800 hover:bg-emerald-900'
    : 'border-stone-400  bg-stone-700   hover:bg-stone-800';
  const focusCls = isAdminIntended
    ? 'focus:border-emerald-700 focus:ring-emerald-700/20'
    : 'focus:border-stone-500   focus:ring-stone-400/20';

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between">
        <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
          <TiesoraLogo size="sm" />
        </button>
        <button
          onClick={() => { reset(); setStage('select'); }}
          className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Change login type
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Role badge */}
          <div className="flex justify-center">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white ${isAdminIntended ? 'bg-emerald-800' : 'bg-stone-700'}`}>
              {isAdminIntended
                ? <><Shield className="w-3.5 h-3.5" /> Admin Login</>
                : <><Users className="w-3.5 h-3.5" /> User Login</>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className={`px-6 py-5 border-b ${isAdminIntended ? 'bg-emerald-900/5 border-emerald-900/10' : 'bg-stone-50/60 border-stone-100'}`}>
              <h1 className="text-lg font-bold text-stone-900">
                {stage === 'forgot'
                  ? 'Reset your password'
                  : isAdminIntended
                  ? 'Sign in — Admin'
                  : 'Sign in — Viewer'}
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                {stage === 'forgot'
                  ? "We'll send a reset link to your email."
                  : isSupabaseConfigured
                  ? isAdminIntended
                    ? 'Manage your family. Access verified from the database.'
                    : 'Explore your family. Read-only access.'
                  : 'Demo mode — any credentials work.'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Reset sent ── */}
              {resetSent ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                  <ShieldCheck className="w-9 h-9 text-emerald-700 mx-auto" />
                  <p className="font-bold text-emerald-950 text-sm">Check your inbox</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    A reset link was sent to <strong>{email}</strong>. Check spam if it doesn't
                    arrive within a minute.
                  </p>
                  <button
                    onClick={() => { setResetSent(false); setStage('form'); setError(null); }}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>

              ) : stage === 'form' ? (
                /* ── Sign-in form ── */
                <div className="space-y-3">
                <form onSubmit={handleSignIn} className="space-y-3" noValidate>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        disabled={loading}
                        className={`${inputCls} ${focusCls} pl-9 pr-3`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-stone-700">Password</label>
                      <button
                        type="button"
                        onClick={() => { setStage('forgot'); setError(null); }}
                        className="text-[11px] text-emerald-800 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={loading}
                        className={`${inputCls} ${focusCls} pl-9 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        tabIndex={-1}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-1 disabled:opacity-60 ${accentCls}`}
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                      : <><ArrowRight className="w-4 h-4" /> {isAdminIntended ? 'Admin Login' : 'User Login'}</>}
                  </button>
                </form>

                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">or</span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
                <GoogleAuthButton disabled={loading} />

                </div>
              ) : (
                /* ── Forgot-password form ── */
                <form onSubmit={handleForgot} className="space-y-3" noValidate>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Enter the email address for your account and we'll send a reset link.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        disabled={loading}
                        className={`${inputCls} ${focusCls} pl-9 pr-3`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setStage('form'); setError(null); }}
                      className="flex-1 py-2.5 border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold rounded-xl transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex-1 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${accentCls}`}
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send Reset Link
                    </button>
                  </div>
                </form>
              )}

              {/* Sign-up link */}
              {!resetSent && (
                <p className="text-center text-xs text-stone-500 pt-1 border-t border-stone-100">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={onGoSignUp}
                    className="font-bold text-emerald-800 hover:underline"
                  >
                    Sign up free
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
