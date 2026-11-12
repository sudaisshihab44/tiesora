/**
 * OnboardingChoicePage
 *
 * Shown immediately after a successful signup (or after email confirmation
 * when that feature is enabled).  The user picks one of two paths:
 *
 *   "Create a Family"  → opens the OnboardingWizard to set up a new family
 *                         and securely assign the user as admin via a
 *                         SECURITY DEFINER database function.
 *
 *   "Join a Family"    → navigates to JoinFamilyPage where the user enters
 *                         an invitation code sent by an existing admin.
 *
 * Security: this page does NOT assign any role. The role is always determined
 * by the database after the relevant flow completes.
 */
import React from 'react';
import { UserProfile } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import { GitFork, Users, ArrowRight, LogOut } from 'lucide-react';

interface OnboardingChoicePageProps {
  currentUser: UserProfile;
  onCreateFamily: () => void;
  onJoinFamily: () => void;
  onSignOut: () => void;
}

export const OnboardingChoicePage: React.FC<OnboardingChoicePageProps> = ({
  currentUser,
  onCreateFamily,
  onJoinFamily,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between shrink-0">
        <TiesoraLogo size="sm" />
        <button
          onClick={onSignOut}
          className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-6">
          {/* Welcome */}
          <div className="text-center space-y-1.5">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Welcome, {currentUser.display_name.split(' ')[0]}
            </p>
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
              How would you like to get started?
            </h1>
            <p className="text-sm text-stone-500">
              Choose your path — you can always change this later.
            </p>
          </div>

          {/* Two choice cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── Create a Family ── */}
            <button
              onClick={onCreateFamily}
              className="group text-left p-6 bg-white border-2 border-stone-200 hover:border-emerald-700 rounded-2xl shadow-xs hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-emerald-800 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <GitFork className="w-5 h-5 text-white" />
              </div>

              {/* Label */}
              <h2 className="text-base font-bold text-stone-900 mb-0.5">Create a Family</h2>
              <p className="text-xs font-medium text-emerald-800 mb-3">Start building your tree.</p>

              {/* Description */}
              <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                Set up a new family workspace. You'll be the <strong className="text-stone-700">Admin</strong> —
                you can add family members, manage relationships, upload memories, and invite relatives.
              </p>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 group-hover:gap-2.5 transition-all">
                Create my family
                <ArrowRight className="w-3.5 h-3.5" />
              </span>

              {/* Bottom accent bar */}
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>

            {/* ── Join a Family ── */}
            <button
              onClick={onJoinFamily}
              className="group text-left p-6 bg-white border-2 border-stone-200 hover:border-stone-500 rounded-2xl shadow-xs hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-stone-400/30"
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-stone-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5 text-white" />
              </div>

              {/* Label */}
              <h2 className="text-base font-bold text-stone-900 mb-0.5">Join a Family</h2>
              <p className="text-xs font-medium text-stone-600 mb-3">You have an invitation.</p>

              {/* Description */}
              <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                A family administrator has sent you an invitation code or link. Enter it here to join
                the family as a <strong className="text-stone-700">Viewer</strong> and browse the tree.
              </p>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 group-hover:gap-2.5 transition-all">
                Enter invitation code
                <ArrowRight className="w-3.5 h-3.5" />
              </span>

              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-500 rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
          </div>

          {/* Security note */}
          <p className="text-center text-[11px] text-stone-400 leading-relaxed px-4">
            Your role is always determined by the database after you complete the selected flow.
            Choosing "Create a Family" does not grant admin access until the family is created and
            verified on the server.
          </p>
        </div>
      </div>
    </div>
  );
};
