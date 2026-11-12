import React, { useState } from 'react';
import { storage } from '../../services/storage';
import { signIn, signUp, sendPasswordReset } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { UserProfile } from '../../types';
import { X, Mail, Lock, User, ShieldCheck, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  onStartOnboarding: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onStartOnboarding,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) { setError('Please enter your email.'); return; }
        const result = await sendPasswordReset(email.trim());
        if (!result.ok) { setError(result.error ?? 'Failed to send reset email.'); return; }
        setResetSent(true);
        return;
      }

      if (mode === 'signup') {
        if (!name.trim() || !email.trim() || !password.trim()) {
          setError('Please fill out all fields.');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }
        const result = await signUp(email.trim(), password, name.trim());
        if (!result.ok) { setError(result.error); return; }
        onSuccess(result.user);
        onClose();
        onStartOnboarding();
        return;
      }

      // Sign in
      if (!email.trim() || !password.trim()) {
        setError('Please provide email and password.');
        return;
      }
      const result = await signIn(email.trim(), password);
      if (!result.ok) { setError(result.error); return; }
      onSuccess(result.user);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Demo quick-logins (localStorage only)
  const demoUsers = [
    { name: 'Thomas Montgomery', role: 'Owner',       email: 'thomas.montgomery@example.com' },
    { name: 'Diana Vance',       role: 'Admin',        email: 'diana.vance@example.com' },
    { name: 'Julian Chen',       role: 'Editor',       email: 'julian.chen@example.com' },
    { name: 'Sarah Montgomery',  role: 'Contributor',  email: 'sarah.m@example.com' },
    { name: 'Chloe Vance',       role: 'Viewer',       email: 'chloe.vance@example.com' },
  ];

  const handleDemoLogin = (demo: (typeof demoUsers)[0]) => {
    const updated = storage.updateCurrentUser({ display_name: demo.name, email: demo.email });
    onSuccess(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-stone-200 shadow-xl max-w-md w-full overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/70">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              {mode === 'signin' ? 'Sign in to Tiesora' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isSupabaseConfigured ? 'Secure family tree platform' : 'Demo mode — any credentials work'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh] sm:max-h-none">
          {/* Error */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 leading-relaxed">
              {error}
            </div>
          )}

          {/* Reset sent */}
          {resetSent ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-700 mx-auto" />
              <p className="font-bold text-emerald-950">Reset Link Sent</p>
              <p className="text-stone-600">
                Check your inbox at <strong>{email}</strong> for a password reset link.
              </p>
              <button
                onClick={() => { setResetSent(false); setMode('signin'); }}
                className="mt-2 text-xs font-semibold text-emerald-800 hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Thomas Montgomery"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-sm"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-sm"
                    disabled={loading}
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-stone-700">Password</label>
                    {mode === 'signin' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-[11px] text-emerald-800 hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-sm"
                      disabled={loading}
                    />
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[10px] text-stone-400 mt-1">Minimum 6 characters.</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {/* Toggle mode */}
          <div className="text-center border-t border-stone-100 pt-3 text-stone-600">
            {mode === 'signin' ? (
              <p>
                No account?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="font-bold text-emerald-800 hover:underline">
                  Create one
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); setResetSent(false); }} className="font-bold text-emerald-800 hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </div>

          {/* Demo quick-logins (always available) */}
          <div className="border-t border-stone-100 pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase text-stone-400 tracking-wider">
              Quick Demo Logins:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {demoUsers.map(u => (
                <button
                  key={u.role}
                  type="button"
                  onClick={() => handleDemoLogin(u)}
                  className="p-2 bg-stone-50 hover:bg-emerald-50 text-stone-700 hover:text-emerald-900 border border-stone-200 rounded-lg text-left truncate transition-colors"
                >
                  <p className="font-bold text-[11px] truncate">{u.name}</p>
                  <p className="text-[10px] text-stone-400">{u.role}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
