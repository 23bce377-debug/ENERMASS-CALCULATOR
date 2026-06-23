'use client';

import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, X, Laptop } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

export function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is already running as standalone standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast('Thank you for installing EnerMass Solar Calculator!', 'success');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div 
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-toast flex flex-col p-4 bg-surface border border-accent/30 rounded-2xl shadow-2xl max-w-sm w-full space-y-3.5 animate-toast-in no-print"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-accent-dim text-accent rounded-lg border border-accent/20 shrink-0">
          <Laptop size={18} />
        </div>
        <div className="flex-1 text-xs space-y-0.5 pr-4">
          <h4 className="font-bold text-text-primary">Install EnerMass App</h4>
          <p className="text-text-muted leading-relaxed">
            Install this terminal on your workspace homescreen for offline resilience, native performance, and quick access.
          </p>
        </div>
        <button 
          onClick={() => setShowPrompt(false)}
          className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleInstall} 
          className="w-full text-xs py-2 flex items-center justify-center gap-1"
          icon={<ArrowDownToLine size={13} />}
        >
          Install Shortcut
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowPrompt(false)} 
          className="w-full text-xs py-2"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
