import React, { useState, useEffect, useRef } from 'react';
import { resendConfirmation } from '../../services/auth';
import { TiesoraLogo } from '../common/TiesoraLogo';
import { MailCheck, RefreshCw, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

interface VerifyEmailPageProps {
  email: string;
  onGoSignIn: () => void;
  onGoLanding: () => void;
}

const COOLDOWN_SECONDS = 60;

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  email,
  onGoSignIn,
  onGoLanding,
}) => {
  const [resending, setResending]       = useState(false);
  const [resent, setResent]             = useState(false);
  const [resendError, setResendError]   = useState<string | null>(null);
  const [cooldown, setCooldown]         = useState(0); // seconds remaining
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setResendError(null);
    setResent(false);
    try {
      const result = await resendConfirmation(email);
      if (!result.ok) {
        // Surface the exact Supabase error — could be "Email rate limit exceeded"
        setResendError(result.error ?? 'Could not resend. Please try again later.');
        return;
      }
      setResent(true);
      startCooldown(); // prevent spam — enforce 60-second wait
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center shrink-0">
        <button onClick={onGoLanding} className="hover:opacity-80 transition-opacity">
          <TiesoraLogo size="sm" />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl p-8 text-center space-y-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <MailCheck className="w-8 h-8 text-emerald-700" />
            </div>

            {/* Heading */}
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-stone-900">Verify your email</h1>
              <p className="text-sm text-stone-600 leading-relaxed">
                We sent a confirmation link to{' '}
                <strong className="text-stone-900 break-all">{email}</strong>.
                <br />
                Click the link in that email to activate your account.
              </p>
            </div>

            {/* Steps */}
            <ol className="text-left space-y-2.5 bg-stone-50 rounded-xl border border-stone-200 p-4 text-xs text-stone-700">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                Open your inbox (or spam folder) for an email from Tiesora.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                Click <strong>"Confirm email address"</strong> in that email.
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                You'll be signed in automatically and taken to set up your family.
              </li>
            </ol>

            {/* Resend error */}
            {resendError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resendError}</span>
              </div>
            )}

            {/* Resend success */}
            {resent && !resendError && (
              <p className="text-xs font-semibold text-emerald-700">
                ✓ Another confirmation email is on its way.
              </p>
            )}

            {/* Resend button with cooldown */}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-xs font-semibold text-emerald-800 hover:underline flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              {resending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                : cooldown > 0
                ? <><RefreshCw className="w-3.5 h-3.5" /> Resend in {cooldown}s</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Resend confirmation email</>}
            </button>

            {/* Back to sign in */}
            <button
              onClick={onGoSignIn}
              className="flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
