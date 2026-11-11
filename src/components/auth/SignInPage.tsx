import React, { useState } from 'react';
import { signIn, sendPasswordReset, getRoleFromDB } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../services/storage';
import { UserProfile, Role } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle,
  ArrowRight, ChevronLeft, CheckCircle2,
} from 'lucide-react';

type Stage = 'form' | 'forgot' | 'reset-sent';

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
  const [stage, setStage] = useState<Stage>('form');

  // Form fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const reset = () => {
    setError(null);
    setEmail('');
    setPassword('');
    setShowPw(false);
  };

  // ── Demo quick-logins (only shown when Supabase is NOT configured) ─────────
  const demoUsers = [
    { name: 'Thomas Montgomery', role: 'admin'  as Role, email: 'thomas.montgomery@example.com' },
    { name: 'Diana Vance',       role: 'admin'  as Role, email: 'diana.vance@example.com' },
    { name: 'Sarah Montgomery',  role: 'viewer' as Role, email: 'sarah.m@example.com' },
    { name: 'Chloe Vance',       role: 'viewer' as Role, email: 'chloe.vance@example.com' },
  ];

  const handleDemoLogin = (demo: (typeof demoUsers)[0]) => {
    const currentUser = storage.getCurrentUser();
    const userId = currentUser?.id || `usr_demo_${Date.now()}`;
    const updated = storage.updateCurrentUser({ 
      id: userId,
      display_name: demo.name, 
      email: demo.email 
    });
    const fam = storage.getCurrentFamily();
    if (fam) {
      onSuccess(updated, demo.role, fam.id);
    }
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
        // so they can create their first family or join via invitation.
        onNeedOnboarding(user);
        return;
      }

      // Role verified from database — proceed
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
      setStage('reset-sent');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared field classes ───────────────────────────────────────────────────
  const inputCls =
    'w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none ' +
    'focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors';

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
        <div className="w-full max-w-md space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-stone-100 bg-emerald-900/5">
              <h1 className="text-lg font-bold text-stone-900">
                {stage === 'forgot' ? 'Reset your password' : 'Welcome back'}
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                {stage === 'forgot'
                  ? "We'll send a reset link to your email."
                  : isSupabaseConfigured
                  ? 'Sign in to access your family tree.'
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

              {/* ── Reset sent confirmation ── */}
              {stage === 'reset-sent' ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                  <ShieldCheck className="w-9 h-9 text-emerald-700 mx-auto" />
                  <p className="font-bold text-emerald-950 text-sm">Check your inbox</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    A reset link was sent to <strong>{email}</strong>. Check spam if it doesn't
                    arrive within a minute.
                  </p>
                  <button
                    onClick={() => { reset(); setStage('form'); }}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>

              ) : stage === 'form' ? (
                /* ── Sign-in form ── */
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
                        className={inputCls}
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
                        className={`${inputCls} pr-10`}
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
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                      : <><ArrowRight className="w-4 h-4" /> Sign In</>}
                  </button>

                  <p className="text-[11px] text-stone-400 text-center leading-relaxed pt-1">
                    Your access level is automatically determined from your family membership.
                  </p>
                </form>

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
                        className={inputCls}
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
                      className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send Reset Link
                    </button>
                  </div>
                </form>
              )}

              {/* Sign-up link */}
              {stage !== 'reset-sent' && (
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

          {/* Demo logins */}
          {!isSupabaseConfigured && stage === 'form' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 space-y-2">
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
};
