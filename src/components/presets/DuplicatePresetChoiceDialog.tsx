'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Edit3, Save, X } from 'lucide-react';

export type DuplicatePresetChoice = 'edit-now' | 'edit-later';

interface DuplicatePresetChoiceDialogProps {
  open: boolean;
  presetName: string;
  saving?: boolean;
  onChoose: (choice: DuplicatePresetChoice) => void;
  onClose: () => void;
}

export function DuplicatePresetChoiceDialog({
  open,
  presetName,
  saving = false,
  onChoose,
  onClose,
}: DuplicatePresetChoiceDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Close duplicate preset dialog"
        onClick={saving ? undefined : onClose}
      />

      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="border-b border-border bg-background/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                <Copy size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Create Duplicate</h2>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Copy every preset detail from <span className="font-semibold text-text-secondary">{presetName}</span>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cancel duplicate"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-text-secondary">
            The duplicate will be saved immediately with a unique name like <span className="font-semibold text-text-primary">{presetName} (1)</span>.
            Choose whether to open it for edits now or keep it ready for later.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChoose('edit-now')}
              disabled={saving}
              className="rounded-xl border border-accent/40 bg-accent px-4 py-4 text-left text-background transition-all hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
            >
              <Edit3 size={18} />
              <span className="mt-3 block text-sm font-bold">Edit Now</span>
              <span className="mt-1 block text-xs opacity-80">Open the copied preset in the staged editor.</span>
            </button>

            <button
              type="button"
              onClick={() => onChoose('edit-later')}
              disabled={saving}
              className="rounded-xl border border-border bg-background/60 px-4 py-4 text-left text-text-primary transition-all hover:border-accent/40 hover:bg-surface-hover disabled:cursor-wait disabled:opacity-70"
            >
              <Save size={18} className="text-accent" />
              <span className="mt-3 block text-sm font-bold">Edit Later</span>
              <span className="mt-1 block text-xs text-text-muted">Save the duplicate and stay on this list.</span>
            </button>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
