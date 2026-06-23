'use client';

import React from 'react';
import { X, Keyboard, Hash } from 'lucide-react';
import { Button } from '../ui/Button';

export function KeyboardHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Global Hotkeys',
      keys: [
        { combination: ['Ctrl + K', '⌘ + K'], action: 'Toggle Command Palette search overlay' },
        { combination: ['?'], action: 'Open this keyboard shortcuts help modal' },
        { combination: ['Esc'], action: 'Dismiss active modal / cancel inline edits' }
      ]
    },
    {
      title: 'ERP Masters Directories',
      keys: [
        { combination: ['/'], action: 'Focus text search field' },
        { combination: ['N'], action: 'Create a new catalog item' },
        { combination: ['E'], action: 'Inline edit the selected item row' },
        { combination: ['Del'], action: 'Delete the selected row catalog item' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-fade-in no-print">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-help-title"
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2 text-text-primary">
            <Keyboard size={18} className="text-accent" />
            <h2 id="kbd-help-title" className="text-sm font-bold tracking-wide uppercase">Keyboard Shortcuts Guide</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close shortcuts guide"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {sections.map(section => (
            <div key={section.title} className="space-y-2.5">
              <h3 className="font-bold text-[10px] text-text-muted uppercase tracking-wider border-b border-border/30 pb-1 flex items-center gap-1">
                <Hash size={10} className="text-accent" />
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.keys.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-text-secondary">{item.action}</span>
                    <div className="flex gap-1 shrink-0 select-none">
                      {item.combination.map((key, kIdx) => (
                        <span key={kIdx} className="font-mono text-[9px] font-bold bg-background border border-border px-1.5 py-0.5 rounded shadow-sm text-text-primary">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-surface-active/30 shrink-0 flex justify-end">
          <Button onClick={onClose} className="text-xs font-bold py-1.5 px-3">
            Dismiss Guide
          </Button>
        </div>
      </div>
    </div>
  );
}
