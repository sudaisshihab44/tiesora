import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 text-stone-500" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900">Install Tiesora on iPhone / iPad</h3>
                <button onClick={() => setShowIOSGuide(false)} className="p-1 text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in the Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                3. Tiesora will launch full-screen with offline support!
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
