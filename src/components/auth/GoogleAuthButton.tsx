import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';
import { signInWithGoogle } from '../../services/auth';

interface GoogleAuthButtonProps {
  disabled?: boolean;
  label?: string;
}

/**
 * Renders only when the Supabase project has the Google provider enabled.
 * The check uses the public GoTrue settings endpoint; no secret is exposed.
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  disabled = false,
  label = 'Continue with Google',
}) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) return;

    let cancelled = false;
    fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (!cancelled) setEnabled(Boolean(settings?.external?.google));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.ok) {
        setError(result.error ?? 'Google sign-in could not start.');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full py-2.5 bg-white hover:bg-stone-50 disabled:opacity-60 border border-stone-300 text-stone-800 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        {label}
      </button>
      {error && (
        <p className="text-[11px] text-rose-600 text-center leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
};
