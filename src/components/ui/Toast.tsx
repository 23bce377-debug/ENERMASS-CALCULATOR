'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// --- Types ------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// --- Config -----------------------------------------------------------------

const TOAST_CONFIG: Record<ToastType, {
  icon: ReactNode;
  accent: string;
  iconColor: string;
}> = {
  success: {
    icon: <CheckCircle2 size={15} strokeWidth={2} />,
    accent: 'border-l-[3px] border-l-[#22C55E]',
    iconColor: 'text-[#22C55E]',
  },
  error: {
    icon: <XCircle size={15} strokeWidth={2} />,
    accent: 'border-l-[3px] border-l-[#EF4444]',
    iconColor: 'text-[#EF4444]',
  },
  warning: {
    icon: <AlertTriangle size={15} strokeWidth={2} />,
    accent: 'border-l-[3px] border-l-[#F59E0B]',
    iconColor: 'text-[#F59E0B]',
  },
  info: {
    icon: <Info size={15} strokeWidth={2} />,
    accent: 'border-l-[3px] border-l-[#3B82F6]',
    iconColor: 'text-[#3B82F6]',
  },
};

// --- Provider ---------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 8);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast Stack */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[300] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => {
          const cfg = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={[
                'pointer-events-auto',
                'flex items-center gap-3',
                'pl-3.5 pr-3 py-3',
                'rounded-xl',
                'border border-border',
                'bg-surface',
                'shadow-xl shadow-black/12',
                'max-w-[340px] min-w-[240px]',
                'animate-toast-in',
                cfg.accent,
              ].join(' ')}
            >
              {/* Icon */}
              <span className={`shrink-0 ${cfg.iconColor}`}>
                {cfg.icon}
              </span>

              {/* Message */}
              <span className="text-sm text-text-primary flex-1 leading-snug font-medium">
                {t.message}
              </span>

              {/* Dismiss */}
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded ml-1"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
