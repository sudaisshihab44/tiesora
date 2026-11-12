/**
 * JoinFamilyPage
 *
 * Shown when a new user selects "Join a Family" from OnboardingChoicePage.
 * The user enters the invitation token they received from a family admin.
 *
 * Flow:
 *  1. User pastes invitation token (or it is pre-filled from the URL hash)
 *  2. validateInvitation(token) — checks DB for a valid, unexpired, unclaimed invitation
 *  3. acceptInvitation(token, userId)  — creates a viewer membership row
 *  4. onSuccess() — App.tsx re-verifies role from DB and routes to ViewerDashboard
 *
 * Security:
 *  - The token is validated server-side via a SECURITY DEFINER RPC
 *  - The client never decides which role to grant — the DB function does
 *  - Invalid / expired / already-used tokens are rejected with a clear message
 */
import React, { useState, useEffect } from 'react';
import { validateInvitation, acceptInvitation } from '../../services/auth';
import { UserProfile } from '../../types';
import { TiesoraLogo } from '../common/TiesoraLogo';
import {
  Key, ArrowRight, Loader2, AlertCircle, CheckCircle2, ChevronLeft,
} from 'lucide-react';

interface JoinFamilyPageProps {
  currentUser: UserProfile;
  /** Pre-filled token from URL hash (e.g. #invite=TOKEN) */
  prefillToken?: string;
  onSuccess: () => void;
  onBack: () => void;
  onSignOut: () => void;
}

export const JoinFamilyPage: React.FC<JoinFamilyPageProps> = ({
  currentUser,
  prefillToken,
  onSuccess,
  onBack,
  onSignOut,
}) => {
  const [token, setToken]       = useState(prefillToken ?? '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null); // confirmed family name

  // Auto-validate when a pre-fill token arrives
  useEffect(() => {
    if (prefillToken && prefillToken !== token) {
      setToken(prefillToken);
    }
  }, [prefillToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Extract the raw token whether the user pasted the full link or just the token.
    // Full link example: http://localhost:3000/#invite=abc-def123
    // Token only:        abc-def123
    let rawInput = token.trim();
    let trimToken = rawInput;

    // If it looks like a URL, extract the token from the fragment
    if (rawInput.includes('#invite=')) {
      const match = rawInput.match(/[#&]invite=([^&\s]+)/);
      trimToken = match ? match[1] : rawInput;
    } else if (rawInput.includes('invite=')) {
      // query-string style (unlikely but handle it)
      const match = rawInput.match(/invite=([^&\s]+)/);
      trimToken = match ? match[1] : rawInput;
    }

    if (!trimToken || loading) return;

    setError(null);
    setLoading(true);
    try {
      // ── Step 1: validate token ─────────────────────────────────────────────
      const validation = await validateInvitation(trimToken);
      if (!validation.ok) {
        setError(validation.error ?? 'Invalid or expired invitation. Ask the family admin to resend it.');
        return;
      }

      setFamilyName(validation.familyName ?? null);

      // ── Step 2: accept (creates viewer membership) ─────────────────────────
      const acceptance = await acceptInvitation(trimToken, currentUser.id, currentUser.display_name);
      if (!acceptance.ok) {
        setError(acceptance.error ?? 'Could not join the family. Please try again.');
        return;
      }

      // ── Step 3: hand back to App.tsx to re-verify role from DB ─────────────
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between shrink-0">
        <TiesoraLogo size="sm" />
        <button
          onClick={onSignOut}
          className="text-xs text-stone-500 hover:text-stone-800 transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Back link */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to options
          </button>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-700 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-stone-900">Enter your invitation</h1>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Paste the code or link a family admin sent you.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Invitation code or link
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Paste your invitation code here"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      disabled={loading}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-stone-300 rounded-xl outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 disabled:opacity-60 transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                    If you received a link like <span className="font-mono">…/#invite=abc123</span>,
                    paste the whole link — the code will be extracted automatically.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !token.trim()}
                  className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Validating…</>
                    : <><ArrowRight className="w-4 h-4" /> Join Family</>}
                </button>
              </form>

              {/* Confirmed family name */}
              {familyName && !error && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Joining <strong>{familyName}</strong>…
                </div>
              )}

              {/* Help text */}
              <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                Don't have an invitation? Ask a family admin to send you one from their
                User Management page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
