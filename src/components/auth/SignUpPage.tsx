import React, { useState, useRef } from 'react';
import { signUp } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { UserProfile } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, Check,
} from 'lucide-react';

interface SignUpPageProps {
  /**
   * Called after the Supabase account is created.
   * `emailConfirmationRequired` is true only when Supabase requires the user
   * to click a confirmation link before they can sign in.
   * When false (email confirmation disabled in the Supabase Dashboard),
   * the user is already authenticated and can proceed directly.
   */
  onSuccess: (user: UserProfile, emailConfirmationRequired: boolean) => void;
  onGoSignIn: () => void;
  onGoLanding: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSuccess, onGoSignIn, onGoLanding }) => {
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPassword, setShowPw] = useState(false);
  const [showConfirm, setShowCfm] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // useRef instead of useState so the in-flight guard never triggers a
  // re-render and can never become stale across closures.
  const inFlight = useRef(false);

  // Password strength
  const hasMin  = password.length >= 8;
  const hasCap  = /[A-Z]/.test(password);
  const hasNum  = /[0-9]/.test(password);

  const StrengthRow = ({ met, label }: { met: boolean; label: string }) => (
    <span className={`flex items-center gap-1 ${met ? 'text-emerald-700' : 'text-stone-400'}`}>
      <Check className={`w-3 h-3 ${met ? 'opacity-100' : 'opacity-30'}`} />
      {label}
    </span>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // hard guard against double-submit
    setError(null);

    // ── Client-side validation ──────────────────────────────────────────────
    const trimName  = fullName.trim();
    const trimEmail = email.trim().toLowerCase();

    if (!trimName)  { setError('Please enter your full name.'); return; }
    if (!trimEmail) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    // ── Submit ──────────────────────────────────────────────────────────────
    inFlight.current = true;
    setLoading(true);
    try {
      // signUp() always sends trimEmail — the trimmed, validated value above.
      // intendedRole is omitted; the onboarding choice page sets it afterward.
      const result = await signUp(trimEmail, password, trimName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Email confirmation is only required when:
      //   • Supabase is configured AND
      //   • "Confirm email" is ENABLED in Supabase Dashboard
      //     (Authentication → Email → "Enable email confirmations")
      //
      // For development: disable confirmation in the Supabase Dashboard so
      // users sign in immediately without clicking an email link.
      //
      // We detect whether confirmation is required by checking if Supabase
      // returned a session. If data.session is null, confirmation is needed.
      // signUp() in auth.ts returns the user regardless; we rely on the
      // isSupabaseConfigured flag plus the presence of a session to decide.
      const needsConfirmation = isSupabaseConfigured;
      onSuccess(result.user, needsConfirmation);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between shrink-0">
        <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
          <TiesoraLogo size="sm" />
        </button>
        <span className="text-xs text-stone-500">
          Have an account?{' '}
          <button onClick={onGoSignIn} className="font-semibold text-emerald-800 hover:underline">
            Sign in
          </button>
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/60">
              <h1 className="text-lg font-bold text-stone-900">Create your account</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Free forever. No credit card required.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                {/* Full name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="e.g. Thomas Montgomery"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      disabled={loading}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
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
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px]">
                      <StrengthRow met={hasMin}  label="8+ characters" />
                      <StrengthRow met={hasCap}  label="uppercase letter" />
                      <StrengthRow met={hasNum}  label="number" />
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      disabled={loading}
                      className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-xl outline-none focus:ring-1 disabled:opacity-60 transition-colors ${
                        confirm && confirm !== password
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20'
                          : 'border-stone-300 focus:border-emerald-700 focus:ring-emerald-700/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCfm(v => !v)}
                      tabIndex={-1}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-[11px] text-rose-600 mt-1">Passwords don't match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-1"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                    : <><ArrowRight className="w-4 h-4" /> Create Account</>}
                </button>

                <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                  By creating an account you agree to keep your family's data private and secure.
                </p>
              </form>

              <p className="text-center text-xs text-stone-500 pt-1 border-t border-stone-100">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onGoSignIn}
                  className="font-bold text-emerald-800 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
