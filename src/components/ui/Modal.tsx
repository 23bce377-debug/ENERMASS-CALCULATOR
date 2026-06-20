import React, { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Close on Escape key & Keyboard Focus Trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus the first element inside the modal
      setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
          );
          if (focusableElements.length > 0) {
            (focusableElements[0] as HTMLElement).focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn("bg-surface border border-border rounded-2xl shadow-xl w-full flex flex-col max-h-[90vh] outline-none", maxWidth)}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <h2 id="modal-title" className="text-lg font-bold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-border/50 bg-surface-active/50 rounded-b-2xl shrink-0 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
