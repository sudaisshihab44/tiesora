import React, { useState } from 'react';
import {
  UserPlus,
  Key,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Users,
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User
} from 'lucide-react';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  validateInvitationByCode,
  acceptInvitationByCode,
  signUp,
  signIn,
  resendConfirmation
} from '../../services/auth';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import type { UserProfile } from '../../types';

interface JoinFamilyFlowProps {
  onSuccess: (user: UserProfile) => void;
  onCancel: () => void;
  prefillCode?: string;
}

type FlowStep = 
  | 'enter-code' 
  | 'code-validated' 
  | 'auth-choice' 
  | 'signup' 
  | 'signin'
  | 'verify-email' 
  | 'accepting' 
  | 'success';

export const JoinFamilyFlow: React.FC<JoinFamilyFlowProps> = ({
  onSuccess,
  onCancel,
  prefillCode = '',
}) => {
  const [step, setStep] = useState<FlowStep>('enter-code');
  
  // Code validation state
  const [invitationCode, setInvitationCode] = useState(prefillCode);
  const [validatedInvitation, setValidatedInvitation] = useState<{
    familyId: string;
    familyName: string;
    role: string;
    expiresAt?: string;
  } | null>(null);
  
  // Auth state
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: ENTER & VALIDATE INVITATION CODE
  // ═══════════════════════════════════════════════════════════════════════════

  const formatInvitationCode = (value: string): string => {
    // Remove all non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Auto-add TIESORA- prefix if not present
    if (cleaned.length > 0 && !cleaned.startsWith('TIESORA')) {
      return 'TIESORA-' + cleaned.slice(0, 6);
    }
    
    // Format as TIESORA-XXXXXX
    if (cleaned.startsWith('TIESORA')) {
      const suffix = cleaned.slice(7, 13); // After "TIESORA"
      return 'TIESORA-' + suffix;
    }
    
    return cleaned;
  };

  const handleCodeChange = (value: string) => {
    const formatted = formatInvitationCode(value);
    setInvitationCode(formatted);
  };

  const handleValidateCode = async () => {
    setError('');
    
    if (!invitationCode || invitationCode.length < 14) {
      setError('Please enter a complete invitation code');
      return;
    }

    setLoading(true);

    try {
      const result = await validateInvitationByCode(invitationCode);
      
      if (!result.ok) {
        setError(result.error || 'Invalid invitation code');
        setLoading(false);
        return;
      }

      setValidatedInvitation({
        familyId: result.familyId!,
        familyName: result.familyName!,
        role: result.role!,
        expiresAt: result.expiresAt
      });
      
      setStep('code-validated');
    } catch (err: any) {
      setError(err.message || 'Failed to validate invitation code');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: CHOOSE SIGNUP OR SIGNIN
  // ═══════════════════════════════════════════════════════════════════════════

  const handleChooseSignUp = () => {
    setAuthMode('signup');
    setStep('signup');
  };

  const handleChooseSignIn = () => {
    setAuthMode('signin');
    setStep('signin');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3A: SIGN UP
  // ═══════════════════════════════════════════════════════════════════════════

  const validateSignUp = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return 'Please enter your full name';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    
    if (!agreeToTerms) {
      return 'Please accept the Terms of Service and Privacy Policy';
    }
    
    return null;
  };

  const handleSignUp = async () => {
    setError('');
    
    const validationError = validateSignUp();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(email, password, fullName);
      
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setPendingUser(result.user);

      // Check if email confirmation is required
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Email confirmation is ON
          setStep('verify-email');
        } else {
          // Email confirmation is OFF — proceed to accept invitation
          await handleAcceptInvitation(result.user);
        }
      } else {
        // Demo mode
        await handleAcceptInvitation(result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3B: SIGN IN
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSignIn = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email, password);
      
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Proceed to accept invitation
      await handleAcceptInvitation(result.user);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: EMAIL VERIFICATION (IF NEEDED)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    
    setError('');
    setLoading(true);

    try {
      const result = await resendConfirmation(email);
      
      if (!result.ok) {
        setError(result.error || 'Failed to resend email');
      } else {
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: ACCEPT INVITATION
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAcceptInvitation = async (user: UserProfile) => {
    if (!validatedInvitation) {
      setError('Invitation data is missing');
      return;
    }

    setStep('accepting');
    setLoading(true);

    try {
      const result = await acceptInvitationByCode(
        invitationCode,
        user.id,
        user.display_name
      );
      
      if (!result.ok) {
        setError(result.error || 'Failed to accept invitation');
        setStep('signin');
        setLoading(false);
        return;
      }

      // Success!
      setStep('success');
      
      // Redirect after brief success message
      setTimeout(() => {
        onSuccess(user);
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || 'Failed to join family');
      setStep('signin');
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER STEP CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStep = () => {
    switch (step) {
      case 'enter-code':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Key className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">
                Join Your Family
              </h2>
              <p className="text-sm text-stone-600">
                Enter the invitation code shared by your family administrator
              </p>
            </div>

            {/* Code Input */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Invitation Code
              </label>
              <input
                type="text"
                value={invitationCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="TIESORA-XXXXXX"
                className="w-full px-4 py-4 text-center text-lg font-mono tracking-widest uppercase border-2 border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                maxLength={14}
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-stone-500 mt-2 text-center">
                Example: TIESORA-8KX29P
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleValidateCode}
                disabled={loading || invitationCode.length < 14}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Invitation</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              
              <button
                onClick={onCancel}
                disabled={loading}
                className="w-full px-6 py-3 text-stone-700 hover:text-stone-900 font-medium transition-colors"
              >
                Back to Landing
              </button>
            </div>
          </div>
        );

      case 'code-validated':
        return (
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Invitation Valid!
              </h2>
              <p className="text-sm text-stone-600">
                You've been invited to join:
              </p>
            </div>

            {/* Family Preview */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900">
                    {validatedInvitation?.familyName}
                  </h3>
                  <p className="text-sm text-stone-600">
                    Role: <span className="font-semibold text-emerald-800 capitalize">{validatedInvitation?.role}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Auth Choice */}
            <div className="space-y-3">
              <button
                onClick={handleChooseSignUp}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <UserPlus className="w-5 h-5" />
                <span>Create Account</span>
              </button>
              
              <button
                onClick={handleChooseSignIn}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-stone-50 border-2 border-stone-300 hover:border-emerald-800 text-stone-900 font-semibold rounded-xl transition-all"
              >
                <span>Already Have an Account? Sign In</span>
              </button>
            </div>
          </div>
        );

      case 'signup':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-stone-900">
                Create Your Account
              </h2>
              <p className="text-sm text-stone-600">
                Joining: <span className="font-semibold text-emerald-800">{validatedInvitation?.familyName}</span>
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

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
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-12 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms-join"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-800 border-stone-300 rounded focus:ring-emerald-500"
                  disabled={loading}
                />
                <label htmlFor="terms-join" className="text-sm text-stone-700">
                  I agree to the{' '}
                  <a href="#" className="text-emerald-800 hover:underline font-medium">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-emerald-800 hover:underline font-medium">
                    Privacy Policy
                  </a>
                </label>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Join</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={() => setStep('code-validated')}
              disabled={loading}
              className="w-full px-6 py-3 text-stone-700 hover:text-stone-900 font-medium transition-colors"
            >
              Back
            </button>
          </div>
        );

      case 'signin':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-stone-900">
                Sign In to Continue
              </h2>
              <p className="text-sm text-stone-600">
                Joining: <span className="font-semibold text-emerald-800">{validatedInvitation?.familyName}</span>
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
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
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In & Join Family</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={() => setStep('code-validated')}
              disabled={loading}
              className="w-full px-6 py-3 text-stone-700 hover:text-stone-900 font-medium transition-colors"
            >
              Back
            </button>
          </div>
        );

      case 'verify-email':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Verify Your Email
              </h2>
              <p className="text-sm text-stone-600">
                Check your inbox at <span className="font-semibold text-emerald-800">{email}</span>
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-left space-y-3">
              <p className="text-sm font-medium text-stone-900">Next steps:</p>
              <ol className="space-y-2 text-sm text-stone-700">
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-800">1.</span>
                  <span>Click the verification link in your email</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-800">2.</span>
                  <span>Return here to complete joining the family</span>
                </li>
              </ol>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
              className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 hover:underline disabled:opacity-50"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : loading
                ? 'Sending...'
                : 'Resend Verification Email'}
            </button>
          </div>
        );

      case 'accepting':
        return (
          <div className="space-y-6 text-center">
            <Loader2 className="w-16 h-16 animate-spin text-emerald-800 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Joining Family...
              </h2>
              <p className="text-sm text-stone-600">
                Creating your membership in {validatedInvitation?.familyName}
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Welcome to the Family!
              </h2>
              <p className="text-sm text-stone-600">
                You've successfully joined{' '}
                <span className="font-semibold text-emerald-800">{validatedInvitation?.familyName}</span>
              </p>
            </div>

            <Loader2 className="w-8 h-8 animate-spin text-emerald-800 mx-auto" />
            <p className="text-xs text-stone-500">Redirecting to dashboard...</p>
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
      <header className="w-full border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <TiesoraLogo size="sm" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xl p-8">
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
};
