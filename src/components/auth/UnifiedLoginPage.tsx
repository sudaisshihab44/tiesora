import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { TiesoraLogo } from '../common/TiesoraLogo';
import { signIn, sendPasswordReset, getRoleFromDB } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../services/storage';
import type { UserProfile, Role } from '../../types';

interface UnifiedLoginPageProps {
  onSuccess: (user: UserProfile, verifiedRole: Role, familyId: string) => void;
  onNeedOnboarding: (user: UserProfile) => void;
  onGoSignUp: () => void;
  onGoLanding: () => void;
}

type ViewMode = 'signin' | 'forgot-password' | 'reset-sent';

export const UnifiedLoginPage: React.FC<UnifiedLoginPageProps> = ({
  onSuccess,
  onNeedOnboarding,
  onGoSignUp,
  onGoLanding,
}) => {
  const [mode, setMode] = useState<ViewMode>('signin');
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGN IN
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Authenticate user
      const result = await signIn(email.trim(), password);
      
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const user = result.user;

      // Step 2: Get role from database (NEVER from client)
      const dbRole = await getRoleFromDB(user.id);

      if (!dbRole) {
        // User authenticated but has no family membership
        // Send to onboarding to create or join a family
        onNeedOnboarding(user);
        return;
      }

      // Step 3: Success — role verified from database
      onSuccess(user, dbRole.role, dbRole.familyId);
      
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const result = await sendPasswordReset(email.trim());
      
      if (!result.ok) {
        setError(result.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }

      setMode('reset-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO MODE QUICK LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  const demoUsers = [
    { name: 'Thomas Montgomery', role: 'admin' as Role, email: 'thomas@demo.com' },
    { name: 'Sarah Montgomery', role: 'viewer' as Role, email: 'sarah@demo.com' },
  ];

  const handleDemoLogin = (demo: typeof demoUsers[0]) => {
    const currentUser = storage.getCurrentUser();
    const userId = currentUser?.id || `usr_demo_${Date.now()}`;
    const updated = storage.updateCurrentUser({
      id: userId,
      display_name: demo.name,
      email: demo.email,
    });
    const fam = storage.getCurrentFamily();
    if (fam) {
      onSuccess(updated, demo.role, fam.id);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const renderContent = () => {
    switch (mode) {
      case 'signin':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Welcome Back
              </h2>
              <p className="text-sm text-stone-600">
                Sign in to access your family tree
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-stone-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot-password')}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 border-stone-300 rounded focus:ring-emerald-500"
                  disabled={loading}
                />
                <label htmlFor="remember" className="text-sm text-stone-700">
                  Remember me
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Demo Mode Quick Login */}
            {!isSupabaseConfigured && (
              <div className="pt-4 border-t border-stone-200">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
                  Demo Mode - Quick Login
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {demoUsers.map((demo) => (
                    <button
                      key={demo.email}
                      onClick={() => handleDemoLogin(demo)}
                      className="flex items-center justify-between px-4 py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-900">{demo.name}</p>
                        <p className="text-xs text-stone-500">{demo.email}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-800 capitalize">
                        {demo.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sign Up Link */}
            <div className="text-center pt-4 border-t border-stone-200">
              <p className="text-sm text-stone-600">
                Don't have an account?{' '}
                <button
                  onClick={onGoSignUp}
                  className="font-semibold text-emerald-800 hover:text-emerald-900 hover:underline transition-colors"
                >
                  Sign Up Free
                </button>
              </p>
            </div>
          </div>
        );

      case 'forgot-password':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">
                Reset Your Password
              </h2>
              <p className="text-sm text-stone-600">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Back Button */}
            <button
              onClick={() => setMode('signin')}
              disabled={loading}
              className="w-full px-6 py-3 text-stone-700 hover:text-stone-900 font-medium transition-colors disabled:opacity-50"
            >
              Back to Sign In
            </button>
          </div>
        );

      case 'reset-sent':
        return (
          <div className="space-y-6 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Check Your Email
              </h2>
              <p className="text-sm text-stone-600 max-w-sm mx-auto">
                We've sent a password reset link to:
              </p>
              <p className="text-base font-semibold text-emerald-800">
                {email}
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-left space-y-3">
              <p className="text-sm font-medium text-stone-900">
                What's next?
              </p>
              <ol className="space-y-2 text-sm text-stone-700">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-emerald-800">1.</span>
                  <span>Check your inbox for our email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-emerald-800">2.</span>
                  <span>Click the reset link in the email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-emerald-800">3.</span>
                  <span>Enter your new password</span>
                </li>
              </ol>
            </div>

            {/* Back Button */}
            <button
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className="w-full px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              Back to Sign In
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onGoLanding}
            className="hover:opacity-80 transition-opacity"
          >
            <TiesoraLogo size="sm" />
          </button>
          
          {mode === 'signin' && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-600">
                New to Tiesora?
              </span>
              <button
                onClick={onGoSignUp}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
              >
                Sign Up Free
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Security Badge */}
          {mode === 'signin' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <Shield className="w-4 h-4 text-emerald-700" />
              <span className="text-xs text-stone-600">
                Secure authentication powered by Supabase
              </span>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xl p-8">
            {renderContent()}
          </div>

          {/* Additional Links */}
          {mode === 'signin' && (
            <div className="mt-6 text-center">
              <button
                onClick={onGoLanding}
                className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
              >
                ← Back to Landing
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
