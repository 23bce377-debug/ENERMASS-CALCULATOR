'use client';

import { useEffect } from 'react';
import { useToast } from '../ui/Toast';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const PWA_INSTALL_READY_EVENT = 'enermass:pwa-install-ready';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function isPwaStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export function hasPwaInstallPrompt() {
  return Boolean(deferredPrompt);
}

export async function requestPwaInstallShortcut() {
  if (isPwaStandalone()) {
    return { status: 'installed' as const };
  }

  if (!deferredPrompt) {
    return { status: 'unavailable' as const };
  }

  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return { status: choice.outcome === 'accepted' ? 'accepted' as const : 'dismissed' as const };
}

export function PwaPrompt() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(PWA_INSTALL_READY_EVENT));

      const hintShown = window.sessionStorage.getItem('enermass-shortcut-hint-shown');
      if (!hintShown && !isPwaStandalone()) {
        window.sessionStorage.setItem('enermass-shortcut-hint-shown', '1');
        toast('App shortcut is available from Settings.', 'info');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [toast]);

  return null;
}
