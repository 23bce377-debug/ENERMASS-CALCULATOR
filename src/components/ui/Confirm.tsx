'use client';

import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from 'react';
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Provider ───────────────────────────────────────────────────────────────────

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

  // Handle Escape key
  useEffect(() => {
    if (!state?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state?.isOpen, handleCancel]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {state?.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            onClick={handleCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 p-6 overflow-hidden animate-scale-in">
            {/* Header / Icon */}
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  state.options.type === 'danger'
                    ? 'bg-error/10 text-error'
                    : state.options.type === 'warning'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-accent/10 text-accent'
                }`}
              >
                {state.options.type === 'danger' && <ShieldAlert size={24} />}
                {state.options.type === 'warning' && <AlertTriangle size={24} />}
                {state.options.type === 'info' && <Info size={24} />}
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <h3 className="text-base font-bold text-text-primary truncate">
                  {state.options.title || (state.options.type === 'danger' ? 'Delete Permanently?' : 'Are you sure?')}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed break-words">
                  {state.options.message}
                </p>
              </div>

              <button
                onClick={handleCancel}
                className="text-text-muted hover:text-text-secondary transition-colors p-1 rounded-lg hover:bg-surface-hover shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border/50">
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all duration-200 cursor-pointer"
              >
                {state.options.cancelLabel || 'Cancel'}
              </button>

              <button
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                  state.options.type === 'danger'
                    ? 'bg-error hover:bg-error/90 shadow-error/15 text-white'
                    : state.options.type === 'warning'
                    ? 'bg-warning hover:bg-warning/90 shadow-warning/15 text-white'
                    : 'bg-accent hover:bg-accent-hover shadow-accent/15 text-background font-bold'
                }`}
              >
                {state.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
