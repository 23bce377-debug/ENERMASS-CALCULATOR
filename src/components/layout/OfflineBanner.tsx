'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!window.navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div 
        role="status"
        aria-live="assertive"
        className="fixed bottom-4 left-4 z-toast flex items-center gap-3 px-4 py-3 bg-red-600 border border-red-500 rounded-xl text-white shadow-2xl animate-bounce-short no-print max-w-sm"
      >
        <WifiOff size={18} className="shrink-0 animate-pulse" />
        <div className="text-xs space-y-0.5">
          <p className="font-bold">Offline Mode Active</p>
          <p className="opacity-90">Local modifications are buffered and will sync when connection returns.</p>
        </div>
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 z-toast flex items-center gap-3 px-4 py-3 bg-emerald-600 border border-emerald-500 rounded-xl text-white shadow-2xl animate-fade-in no-print max-w-sm"
      >
        <Wifi size={18} className="shrink-0" />
        <div className="text-xs space-y-0.5">
          <p className="font-bold">Back Online</p>
          <p className="opacity-90 flex items-center gap-1.5">
            <RefreshCw size={11} className="animate-spin" />
            Synchronizing data with servers...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
