import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, installPWA } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed in standalone mode, do not show
  if (isInstalled) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      await installPWA();
    }
  };

  if (!isInstallable && !isIOS) return null;

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          title="Install Performance Tracker App"
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors ${className}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span>Install App</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
              <h3 className="text-base font-bold text-slate-800 mb-2">Install on iOS / Safari</h3>
              <p className="text-sm text-slate-600 mb-4">
                To install this app on your iPhone or iPad:
              </p>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 p-3 rounded-xl mb-4">
                <li>Tap the <strong>Share</strong> button in Safari's bottom toolbar.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> in the top right corner.</li>
              </ol>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl shadow-xs transition-colors ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-sky-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <span>Install PWA (Offline Ready)</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-2">Install on iOS Safari</h3>
            <p className="text-sm text-slate-600 mb-4">
              To install this offline app on your iPhone or iPad:
            </p>
            <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 p-3 rounded-xl mb-4">
              <li>Tap the <strong>Share</strong> button (square with arrow) in Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top right.</li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
