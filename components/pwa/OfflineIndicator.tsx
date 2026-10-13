import React, { useState, useEffect } from 'react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline || dismissed) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs z-50">
      <div className="flex items-center space-x-2">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        <span>
          <strong>Offline Mode Active:</strong> You can continue viewing, recording actuals, and managing KPIs. All data is saved locally and will sync to Firestore once reconnected.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-100 hover:text-white text-xs px-2 py-0.5 rounded-sm hover:bg-amber-600 transition"
      >
        Dismiss
      </button>
    </div>
  );
};
