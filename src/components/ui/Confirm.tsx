'use client';

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from 'react';
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';

// --- Types ------------------------------------------------------------------

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const DEFAULT_OPTIONS: ConfirmOptions = {
  title: 'Confirmation Required',
  message: 'Are you sure you want to proceed?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  type: 'info',
};

// --- Icon config ------------------------------------------------------------

const ICON_CONFIG = {
  danger:  { icon: ShieldAlert,     bg: 'bg-[#EF4444]/10', color: 'text-[#EF4444]' },
  warning: { icon: AlertTriangle,   bg: 'bg-[#F59E0B]/10', color: 'text-[#F59E0B]' },
  info:    { icon: Info,            bg: 'bg-accent/10',    color: 'text-accent'     },
};

const BTN_CONFIG = {
  danger:  'bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-sm shadow-[#EF4444]/20',
  warning: 'bg-[#F59E0B] hover:bg-[#D97706] text-white shadow-sm shadow-[#F59E0B]/20',
  info:    'bg-accent hover:bg-accent-hover text-background font-bold shadow-sm shadow-accent/20',
};

// --- Provider ---------------------------------------------------------------

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        options: { ...DEFAULT_OPTIONS, ...options },
        resolve,
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  }, [state]);

  const handleConfirm = useCallback(() => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  }, [state]);

  useEffect(() => {
    if (!state?.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter') handleConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.isOpen, handleCancel, handleConfirm]);

  const type = state?.options.type ?? 'info';
  const iconCfg = ICON_CONFIG[type];
  const btnCls  = BTN_CONFIG[type];
  const IconComponent = iconCfg.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state?.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={handleCancel}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
          />

          {/* Dialog */}
          <div className="relative w-full max-w-[400px] animate-scale-in">
            <div
              className="bg-surface-2 border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
              style={{ boxShadow: '0 24px 64px -12px rgba(0,0,0,0.3), 0 0 0 1px var(--bdr)' }}
            >
              {/* Top accent line per type */}
              <div className={`h-[2px] w-full ${
                type === 'danger'  ? 'bg-[#EF4444]' :
                type === 'warning' ? 'bg-[#F59E0B]' :
                'bg-accent'
              }`} />

              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${iconCfg.bg} ${iconCfg.color}`}>
                    <IconComponent size={20} strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-[15px] font-bold text-text-primary leading-snug">
                      {state.options.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                      {state.options.message}
                    </p>
                  </div>

                  <button
                    onClick={handleCancel}
                    className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-border">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
                  >
                    {state.options.cancelLabel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 ${btnCls}`}
                  >
                    {state.options.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
