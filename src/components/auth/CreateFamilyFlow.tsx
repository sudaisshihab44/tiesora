import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Home,
  MapPin,
  FileText
} from 'lucide-react';
import { TiesoraLogo } from '../common/TiesoraLogo';
import { signUp, resendConfirmation } from '../../services/auth';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import type { UserProfile } from '../../types';

interface CreateFamilyFlowProps {
  onSuccess: (user: UserProfile) => void;
  onCancel: () => void;
}

type FlowStep = 'register' | 'verify-email' | 'create-family' | 'success';

export const CreateFamilyFlow: React.FC<CreateFamilyFlowProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<FlowStep>('register');
  
  // Registration state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Family creation state
  const [familyName, setFamilyName] = useState('');
  const [familyDescription, setFamilyDescription] = useState('');
  const [familyOrigin, setFamilyOrigin] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  const validateRegistration = (): string | null => {
    if (!fullName.trim()) return 'Please enter your full name';
    if (fullName.trim().length < 2) return 'Name must be at least 2 characters';
    
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

  const handleRegister = async () => {
    setError('');
    
    const validationError = validateRegistration();
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
          // Email confirmation is ON — user must verify email
          setStep('verify-email');
        } else {
          // Email confirmation is OFF — proceed directly to family creation
          setStep('create-family');
        }
      } else {
        // Demo mode — skip verification
        setStep('create-family');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: EMAIL VERIFICATION
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
  // STEP 3: CREATE FAMILY
  // ═══════════════════════════════════════════════════════════════════════════

  const validateFamilyCreation = (): string | null => {
    if (!familyName.trim()) return 'Please enter a family name';
    if (familyName.trim().length < 2) return 'Family name must be at least 2 characters';
    return null;
  };

  const handleCreateFamily = async () => {
    setError('');
    
    const validationError = validateFamilyCreation();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode: use storage
        const { storage } = await import('../../services/storage');
        const currentUser = storage.getCurrentUser();
        if (!currentUser) {
          setError('No user session found');
          return;
        }
        
        const familyId = crypto.randomUUID();
        
        storage.createFamily({
          name: familyName.trim(),
          description: familyDescription.trim(),
          owner_id: pendingUser?.id || currentUser.id,
        });
        
        onSuccess(pendingUser || currentUser);
        return;
      }

      // Production mode: create family with admin membership
      const familyId = crypto.randomUUID();
      
      const { error: familyError } = await supabase.rpc('create_family_with_admin', {
        p_family_id: familyId,
        p_name: familyName.trim(),
        p_description: familyDescription.trim() || null,
        p_privacy_settings: {
          hideLivingDates: false,
          hideLivingBiographies: false,
          hidePrivateMemories: false,
          requireAdminApprovalForEdits: true,
          isPubliclySearchable: false
        }
      });

      if (familyError) {
        throw new Error(familyError.message);
      }

      // Success! User is now admin of their family
      setStep('success');
      
      // Redirect to app after brief success message
      setTimeout(() => {
        if (pendingUser) {
          onSuccess(pendingUser);
        }
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create family. Please try again.');
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER STEP CONTENT
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStep = () => {
    switch (step) {
      case 'register':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Create Your Account
              </h2>
              <p className="text-sm text-stone-600">
                Start building your family tree in minutes
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Full Name */}
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
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

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
                    placeholder="john@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
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
                    className="w-full pl-10 pr-12 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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
                <p className="text-xs text-stone-500 mt-1">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
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
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-800 border-stone-300 rounded focus:ring-emerald-500"
                  disabled={loading}
                />
                <label htmlFor="terms" className="text-sm text-stone-700 leading-snug">
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
                onClick={handleRegister}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              
              <button
                onClick={onCancel}
                disabled={loading}
                className="w-full px-6 py-3 text-stone-700 hover:text-stone-900 font-medium transition-colors disabled:opacity-50"
              >
                Back to Landing
              </button>
            </div>
          </div>
        );

      case 'verify-email':
        return (
          <div className="space-y-6 text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8" />
            </div>

            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Verify Your Email
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                We've sent a verification email to:
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
                  <span>Check your inbox for an email from Tiesora</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-emerald-800">2.</span>
                  <span>Click the verification link in the email</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-emerald-800">3.</span>
                  <span>Return here to continue creating your family</span>
                </li>
              </ol>
            </div>

            {/* Resend Button */}
            <div className="space-y-2">
              <p className="text-sm text-stone-600">
                Didn't receive the email?
              </p>
              <button
                onClick={handleResendVerification}
                disabled={loading || resendCooldown > 0}
                className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : loading
                  ? 'Sending...'
                  : 'Resend Verification Email'}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Back Button */}
            <button
              onClick={onCancel}
              className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
            >
              Back to Landing
            </button>
          </div>
        );

      case 'create-family':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">
                Create Your Family
              </h2>
              <p className="text-sm text-stone-600">
                Give your family tree a name and get started
              </p>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Family Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Family Name <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="The Smith Family"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  This is how your family tree will be displayed
                </p>
              </div>

              {/* Family Description (Optional) */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Description <span className="text-stone-400">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-stone-400" />
                  <textarea
                    value={familyDescription}
                    onChange={(e) => setFamilyDescription(e.target.value)}
                    placeholder="A brief description of your family heritage..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Family Origin (Optional) */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Family Origin <span className="text-stone-400">(Optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={familyOrigin}
                    onChange={(e) => setFamilyOrigin(e.target.value)}
                    placeholder="Boston, Massachusetts"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Where your family's roots began
                </p>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-900">
                  <p className="font-medium">You'll become the family administrator</p>
                  <p className="text-emerald-800 mt-1">
                    You can add family members, manage the tree, and invite relatives to view or collaborate.
                  </p>
                </div>
              </div>
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
                onClick={handleCreateFamily}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Family...</span>
                  </>
                ) : (
                  <>
                    <span>Create Family & Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-900">
                Family Created Successfully!
              </h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Your family tree <span className="font-semibold text-emerald-800">{familyName}</span> is ready.
                Redirecting to your dashboard...
              </p>
            </div>

            {/* Loading Spinner */}
            <Loader2 className="w-8 h-8 animate-spin text-emerald-800 mx-auto" />
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
          <TiesoraLogo size="sm" />
          
          {/* Progress Indicator */}
          {step !== 'success' && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${step === 'register' ? 'bg-emerald-800' : 'bg-stone-300'}`} />
              <div className={`w-2 h-2 rounded-full ${step === 'verify-email' ? 'bg-emerald-800' : 'bg-stone-300'}`} />
              <div className={`w-2 h-2 rounded-full ${step === 'create-family' ? 'bg-emerald-800' : 'bg-stone-300'}`} />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
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
