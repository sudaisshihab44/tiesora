/**
 * AcceptInvitationPage
 * 
 * Dedicated page for accepting family invitations via URL link.
 * Route: /#invite=TOKEN or /accept-invitation?token=TOKEN
 * 
 * Flow:
 * 1. Extract token from URL
 * 2. Validate token server-side (check exists, not expired, not used)
 * 3. Show family name and role being granted
 * 4. If user not authenticated: show signup/signin options
 * 5. If authenticated: accept invitation immediately
 * 6. Create family membership with role from invitation
 * 7. Redirect to dashboard
 * 
 * Security:
 * - Token validated server-side via SECURITY DEFINER RPC
 * - Role comes from invitation (server-side), never from client
 * - Email must match invitation recipient (enforced by accept RPC)
 * - Single-use tokens (marked as accepted after first use)
 */

import React, { useState, useEffect } from 'react';
import { validateInvitation, acceptInvitation, signIn, signUp } from '../../services/auth';
import { getSessionUser } from '../../services/auth';
import { UserProfile } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  Shield, UserPlus, LogIn, Loader2, AlertCircle, CheckCircle2,
  Mail, Lock, Eye, EyeOff, ArrowRight, Users,
} from 'lucide-react';

interface AcceptInvitationPageProps {
  /** Token from URL hash or query param */
  token: string;
  /** Called after successful acceptance */
  onSuccess: () => void;
  /** Called to return to landing */
  onGoLanding: () => void;
}

type Stage = 'validating' | 'choose-auth' | 'signup' | 'signin' | 'accepting' | 'success' | 'error';

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({
  token,
  onSuccess,
  onGoLanding,
}) => {
  const [stage, setStage] = useState<Stage>('validating');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  // Invitation details
  const [familyName, setFamilyName] = useState<string>('');
  const [role, setRole] = useState<string>('viewer');
  
  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial validation
  useEffect(() => {
    let cancelled = false;

    async function validateToken() {
      try {
        // Check if user is already authenticated
        const user = await getSessionUser();
        if (user && !cancelled) {
          setCurrentUser(user);
        }

        // Validate the invitation token
        const validation = await validateInvitation(token);
        
        if (cancelled) return;

        if (!validation.ok) {
          setError(validation.error || 'This invitation link is invalid, expired, or has already been used.');
          setStage('error');
          return;
        }

        setFamilyName(validation.familyName || 'Unknown Family');
        setRole(validation.role || 'viewer');

        // If already authenticated, go straight to accepting
        if (user) {
          setStage('accepting');
          await acceptTheInvitation(user);
        } else {
          setStage('choose-auth');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to validate invitation.');
          setStage('error');
        }
      }
    }

    validateToken();
    return () => { cancelled = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptTheInvitation = async (user: UserProfile) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await acceptInvitation(token, user.id, user.display_name);
      
      if (!result.ok) {
        setError(result.error || 'Failed to accept invitation.');
        setStage('error');
        return;
      }

      setStage('success');
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, displayName.trim());
      
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Account created - now accept invitation
      setCurrentUser(result.user);
      setStage('accepting');
      await acceptTheInvitation(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Signed in - now accept invitation
      setCurrentUser(result.user);
      setStage('accepting');
      await acceptTheInvitation(result.user);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors';

  // ── Validating stage ─────────────────────────────────────────────────────────
  if (stage === 'validating') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-800 animate-spin mx-auto" />
          <p className="text-sm text-stone-600">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  // ── Error stage ──────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center">
          <TiesoraLogo size="sm" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h1 className="text-xl font-bold text-stone-900">Invalid Invitation</h1>
            <p className="text-sm text-stone-600 leading-relaxed">{error}</p>
            <button
              onClick={onGoLanding}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success stage ────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Welcome to {familyName}!</h1>
          <p className="text-sm text-stone-600">
            You've been added as a <strong className="capitalize">{role}</strong>.
            <br />Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ── Accepting stage ──────────────────────────────────────────────────────────
  if (stage === 'accepting') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-800 animate-spin mx-auto" />
          <p className="text-sm text-stone-600">Joining {familyName}...</p>
        </div>
      </div>
    );
  }

  // ── Choose auth method ───────────────────────────────────────────────────────
  if (stage === 'choose-auth') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center">
          <TiesoraLogo size="sm" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-w-md w-full">
            {/* Invitation preview */}
            <div className="px-6 py-5 border-b border-stone-100 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-stone-900">You're invited!</h1>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Join <strong>{familyName}</strong> as a <strong className="capitalize">{role}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => setStage('signup')}
                  className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create New Account
                </button>
                
                <button
                  onClick={() => setStage('signin')}
                  className="w-full py-3 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Existing Account
                </button>
              </div>

              <p className="text-xs text-stone-500 text-center leading-relaxed">
                You'll need an account to join this family tree.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign up form ─────────────────────────────────────────────────────────────
  if (stage === 'signup') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between">
          <TiesoraLogo size="sm" />
          <button
            onClick={() => setStage('choose-auth')}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Back
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-w-md w-full">
            <div className="px-6 py-5 border-b border-stone-100">
              <h1 className="text-lg font-bold text-stone-900">Create Your Account</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Join <strong>{familyName}</strong> as a <strong className="capitalize">{role}</strong>
              </p>
            </div>

            <form onSubmit={handleSignUp} className="p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={loading}
                  placeholder="Your full name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    placeholder="you@example.com"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    placeholder="At least 6 characters"
                    className={`${inputCls} pl-9 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Re-enter your password"
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Create Account & Join</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign in form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between">
        <TiesoraLogo size="sm" />
        <button
          onClick={() => setStage('choose-auth')}
          className="text-xs text-stone-500 hover:text-stone-800"
        >
          Back
        </button>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-w-md w-full">
          <div className="px-6 py-5 border-b border-stone-100">
            <h1 className="text-lg font-bold text-stone-900">Sign In</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Sign in to join <strong>{familyName}</strong>
            </p>
          </div>

          <form onSubmit={handleSignIn} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="you@example.com"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Your password"
                  className={`${inputCls} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing In...</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> Sign In & Join</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
