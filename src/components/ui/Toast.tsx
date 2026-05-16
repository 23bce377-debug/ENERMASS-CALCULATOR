'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Check, AlertTriangle, X, Info } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Icons & Colors ─────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: ReactNode; bg: string; border: string; text: string }> = {
  success: { icon: <Check size={16} />, bg: 'bg-success/10', border: 'border-success/30', text: 'text-success' },
  error: { icon: <AlertTriangle size={16} />, bg: 'bg-error/10', border: 'border-error/30', text: 'text-error' },
  warning: { icon: <AlertTriangle size={16} />, bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning' },
  info: { icon: <Info size={16} />, bg: 'bg-info/10', border: 'border-info/30', text: 'text-info' },
};

// ─── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 8);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cfg = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl shadow-black/30
                backdrop-blur-xl animate-fade-in max-w-sm ${cfg.bg} ${cfg.border}`}
            >
              <span className={cfg.text}>{cfg.icon}</span>
              <span className="text-sm text-text-primary flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="text-text-muted hover:text-text-secondary transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
