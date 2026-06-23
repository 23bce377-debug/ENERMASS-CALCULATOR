'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

interface OfflineConflict {
  field: string;
  localValue: string;
  serverValue: string;
}

export function SyncConflictResolver() {
  const [isOpen, setIsOpen] = useState(false);
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Check local storage for simulated or actual offline edits
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

    const handleOnline = () => {
      // Simulate checking offline queue for conflicts
      const queue = window.localStorage.getItem('enermass_offline_edits');
      if (queue) {
        try {
          const parsed = JSON.parse(queue);
          if (parsed && parsed.length > 0) {
            setConflicts(parsed);
            setIsOpen(true);
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    // Also trigger on mount if we start online with items in queue
    if (window.navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleResolve = (action: 'overwrite' | 'discard') => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem('enermass_offline_edits');
    }
    setIsOpen(false);
    
    if (action === 'overwrite') {
      toast('Server database updated with offline changes.', 'success');
    } else {
      toast('Offline changes discarded. Synced with server master database.', 'info');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Resolve Offline Sync Conflicts"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-warning/30 bg-warning/10 text-amber-500">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Conflicts Detected</p>
            <p className="text-text-muted leading-relaxed">
              Your device made modifications while offline. Server values changed in the meantime. Choose which version to keep.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Conflict Log</p>
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
            {conflicts.map((c, idx) => (
              <div key={idx} className="p-3 bg-background/40 font-mono space-y-1.5">
                <p className="text-[10px] font-bold text-accent capitalize">{c.field.replace(/_/g, ' ')}</p>
                <div className="flex justify-between items-center gap-2">
                  <div className="text-left bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 text-[10px]">
                    Server: {c.serverValue}
                  </div>
                  <ArrowRight size={12} className="text-text-muted shrink-0" />
                  <div className="text-right bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                    Offline: {c.localValue}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button 
            onClick={() => handleResolve('overwrite')}
            className="w-full text-xs py-2"
          >
            Overwrite Server
          </Button>
          <Button 
            variant="outline"
            onClick={() => handleResolve('discard')}
            className="w-full text-xs py-2"
          >
            Keep Server Data
          </Button>
        </div>
      </div>
    </Modal>
  );
}
