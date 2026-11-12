import React, { useState } from 'react';
import { updatePassword } from '../../services/auth';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  Lock, Eye, EyeOff, Check, ShieldCheck, Loader2, AlertCircle,
} from 'lucide-react';

interface ResetPasswordPageProps {
  onSuccess: () => void;
  onGoSignIn: () => void;
  onGoLanding: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onSuccess,
  onGoSignIn,
  onGoLanding,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber    = /[0-9]/.test(password);

  const StrengthRow = ({ met, label }: { met: boolean; label: string }) => (
    <span className={`flex items-center gap-1 ${met ? 'text-emerald-700' : 'text-stone-400'}`}>
      <Check className={`w-3 h-3 ${met ? 'opacity-100' : 'opacity-30'}`} />
      {label}
    </span>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (!result.ok) { setError(result.error ?? 'Failed to update password.'); return; }
      setDone(true);
      // Auto-advance to dashboard after short delay
      setTimeout(() => onSuccess(), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center">
        <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
          <TiesoraLogo size="sm" />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/60">
              <h1 className="text-lg font-bold text-stone-900">Set a new password</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Choose a strong password to secure your account.
              </p>
            </div>

            <div className="p-6">
              {done ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-7 h-7 text-emerald-700" />
                  </div>
                  <h2 className="text-base font-bold text-stone-900">Password updated!</h2>
                  <p className="text-xs text-stone-600">
                    You're being signed in now. Hang tight…
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* New password */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">New password</label>
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
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px]">
                        <StrengthRow met={hasMinLength} label="8+ characters" />
                        <StrengthRow met={hasUppercase} label="uppercase letter" />
                        <StrengthRow met={hasNumber}    label="number" />
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Confirm password</label>
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
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                        tabIndex={-1}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
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
                    className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>

                  <button
                    type="button"
                    onClick={onGoSignIn}
                    className="w-full text-center text-xs text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
