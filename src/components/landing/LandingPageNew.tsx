import React from 'react';
import { 
  Users, 
  UserPlus, 
  ArrowRight, 
  Shield, 
  Heart,
  Sparkles,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { TiesoraLogo } from '../common/TiesoraLogo';

interface LandingPageNewProps {
  onCreateFamily: () => void;
  onJoinFamily: () => void;
  onSignIn: () => void;
}

export const LandingPageNew: React.FC<LandingPageNewProps> = ({
  onCreateFamily,
  onJoinFamily,
  onSignIn,
}) => {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col">
      {/* Minimal Header */}
      <header className="w-full border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <TiesoraLogo size="sm" />
          <button
            onClick={onSignIn}
            className="text-sm font-medium text-stone-700 hover:text-emerald-900 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-5xl mx-auto space-y-12">
          
          {/* Welcome Section */}
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">
                Welcome to Tiesora
              </span>
            </div>

            {/* Hero Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 tracking-tight leading-tight">
              Every family. <br />
              Every connection. <br />
              <span className="text-emerald-800">Every story.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto">
              Your family's story deserves a place of its own.
            </p>

            {/* Value Props */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>Private & Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-emerald-700" />
                <span>Easy to Use</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Built for Families</span>
              </div>
            </div>
          </div>

          {/* Two-Card Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            
            {/* Card 1: Create a Family */}
            <div className="group relative bg-white rounded-3xl border-2 border-stone-200 hover:border-emerald-600 hover:shadow-2xl transition-all duration-300 overflow-hidden">
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Content */}
              <div className="relative p-8 space-y-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-800 group-hover:text-white transition-colors duration-300">
                  <Users className="w-8 h-8" />
                </div>

                {/* Heading */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-stone-900">
                    Create a Family
                  </h2>
                  <p className="text-base text-stone-600 leading-relaxed">
                    Start your family tree, preserve your heritage, and invite your loved ones.
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      Build your family tree from scratch
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      Become the family administrator
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      Invite relatives to collaborate
                    </span>
                  </li>
                </ul>

                {/* CTA Button */}
                <button
                  onClick={onCreateFamily}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                >
                  <span>Create My Family</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Card 2: Join a Family */}
            <div className="group relative bg-white rounded-3xl border-2 border-stone-200 hover:border-emerald-600 hover:shadow-2xl transition-all duration-300 overflow-hidden">
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Content */}
              <div className="relative p-8 space-y-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-800 group-hover:text-white transition-colors duration-300">
                  <UserPlus className="w-8 h-8" />
                </div>

                {/* Heading */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-stone-900">
                    Join a Family
                  </h2>
                  <p className="text-base text-stone-600 leading-relaxed">
                    Have an invitation code? Join your family's private space.
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      Enter your invitation code
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      View your family's tree
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">
                      Explore shared memories
                    </span>
                  </li>
                </ul>

                {/* CTA Button */}
                <button
                  onClick={onJoinFamily}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-stone-50 border-2 border-stone-300 hover:border-emerald-800 text-stone-900 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                >
                  <span>Join With Invitation Code</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>

          {/* Already have an account */}
          <div className="text-center pt-4">
            <p className="text-sm text-stone-600">
              Already have an account?{' '}
              <button
                onClick={onSignIn}
                className="font-semibold text-emerald-800 hover:text-emerald-900 hover:underline transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="max-w-4xl mx-auto pt-12 pb-8">
            <div className="bg-white rounded-2xl border border-stone-200 p-8">
              <div className="flex items-center justify-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-emerald-700" />
                <h3 className="text-lg font-bold text-stone-900">
                  Privacy and Security
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                    <Shield className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h4 className="font-semibold text-sm text-stone-900">
                    Secure Authentication
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Email verification and encrypted passwords protect your account.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h4 className="font-semibold text-sm text-stone-900">
                    Private by Default
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Only invited family members can access your tree.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h4 className="font-semibold text-sm text-stone-900">
                    Family Controlled
                  </h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Administrators manage who can view and edit your family tree.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <TiesoraLogo size="xs" />
            <span className="hidden sm:inline">·</span>
            <span className="text-xs">© 2026 Tiesora. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-stone-600">
            <a href="#" className="hover:text-emerald-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-emerald-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
