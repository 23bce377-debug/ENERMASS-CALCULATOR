import { useEffect, useRef } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';

interface CompareModalProps {
  v1: any;
  v2: any;
  onClose: () => void;
}

export function QuoteCompareModal({ v1, v2, onClose }: CompareModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key and Focus trap handler
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

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Auto focus the close button or first element
    setTimeout(() => {
      if (modalRef.current) {
        const closeBtn = modalRef.current.querySelector('button') as HTMLElement;
        if (closeBtn) closeBtn.focus();
        else modalRef.current.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // Build a map of items for comparison safely
  const v1Items = v1?.quote_items || [];
  const v2Items = v2?.quote_items || [];

  const allDescriptions = new Set<string>();
  v1Items.forEach((i: any) => allDescriptions.add(i.description.toUpperCase()));
  v2Items.forEach((i: any) => allDescriptions.add(i.description.toUpperCase()));

  const items = Array.from(allDescriptions).map(desc => {
    const item1 = v1Items.find((i: any) => i.description.toUpperCase() === desc);
    const item2 = v2Items.find((i: any) => i.description.toUpperCase() === desc);
    
    return {
      description: item1?.description || item2?.description || desc,
      unit: item1?.unit || item2?.unit || '',
      qty1: item1?.qty || 0,
      qty2: item2?.qty || 0,
      rate1: item1?.rate_per_unit || 0,
      rate2: item2?.rate_per_unit || 0,
      total1: item1?.line_total || 0,
      total2: item2?.line_total || 0,
      changed: (item1?.qty || 0) !== (item2?.qty || 0) || (item1?.rate_per_unit || 0) !== (item2?.rate_per_unit || 0)
    };
  });

  const hasItems = items.length > 0;

  return (
    <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div ref={modalRef} tabIndex={-1} className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh] outline-none">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-active">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <Search size={18} className="text-accent" /> Compare Version {v1?.version} vs {v2?.version}
          </h3>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 bg-surface-hover flex justify-between border-b border-border/40 text-sm">
          <div>
            <span className="text-text-muted">v{v1?.version} Total:</span> <span className="font-bold text-text-primary">{formatINR(Number(v1?.final_customer_price || 0))}</span>
          </div>
          <div>
            <span className="text-text-muted">v{v2?.version} Total:</span> <span className="font-bold text-text-primary">{formatINR(Number(v2?.final_customer_price || 0))}</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {!hasItems ? (
            <div className="py-12 flex flex-col items-center justify-center text-text-muted space-y-2">
              <p className="font-medium text-sm text-text-primary">No items found to compare in these quote versions.</p>
              <p className="text-xs">It seems these versions do not contain any component breakdown list.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-text-muted">
                  <th className="pb-2 font-semibold">Item Description</th>
                  <th className="pb-2 font-semibold text-right">v{v1?.version} Qty</th>
                  <th className="pb-2 font-semibold text-right">v{v2?.version} Qty</th>
                  <th className="pb-2 font-semibold text-right">v{v1?.version} Total</th>
                  <th className="pb-2 font-semibold text-right">v{v2?.version} Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {items.map((it, idx) => (
                  <tr key={idx} className={it.changed ? 'bg-accent/5' : ''}>
                    <td className="py-3 text-text-primary">{it.description}</td>
                    
                    <td className="py-3 text-right">
                      {it.qty1 > 0 ? `${it.qty1} ${it.unit}` : '-'}
                    </td>
                    
                    <td className={`py-3 text-right font-medium ${it.changed && it.qty1 !== it.qty2 ? 'text-accent' : 'text-text-primary'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {it.changed && it.qty1 !== it.qty2 && <ArrowRight size={12} className="text-text-muted opacity-50" />}
                        {it.qty2 > 0 ? `${it.qty2} ${it.unit}` : '-'}
                      </div>
                    </td>

                    <td className="py-3 text-right text-text-secondary">
                      {it.total1 > 0 ? formatINR(it.total1) : '-'}
                    </td>
                    
                    <td className={`py-3 text-right font-medium ${it.changed && it.total1 !== it.total2 ? 'text-accent' : 'text-text-primary'}`}>
                      {it.total2 > 0 ? formatINR(it.total2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
