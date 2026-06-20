'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import { SystemORM, SystemItemORM } from '@/backend/orm/system';
import { Select } from '@/components/ui/Select';

export function SavePresetModal({ isOpen, onClose, statePayload }: { isOpen: boolean; onClose: () => void; statePayload: any }) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('5');
  const [type, setType] = useState<'residential' | 'commercial' | 'industrial'>('residential');
  const [loading, setLoading] = useState(false);
  
  // Is this an existing DB Master System? (i.e. not starting with custom_)
  const isMasterPreset = statePayload?.selectedSystemId && !statePayload.selectedSystemId.startsWith('custom_') && !statePayload.selectedSystemId.startsWith('template_');
  const [overwriteMaster, setOverwriteMaster] = useState(false);

  const handleSave = async () => {
    if (!name.trim() && !overwriteMaster) return alert('Please enter a preset name');
    setLoading(true);
    try {
      const lines = statePayload?.calcResult?.lines || [];
      
      const metadata = {
        name: overwriteMaster ? statePayload.dbSystems?.find((s: any) => s.id === statePayload.selectedSystemId)?.name || name : name,
        capacity_kw: overwriteMaster ? statePayload.dbSystems?.find((s: any) => s.id === statePayload.selectedSystemId)?.capacityKW || Number(capacity) : Number(capacity),
        category: type,
        target_margin_pct: statePayload.targetMarginPct || 20,
        is_custom: !overwriteMaster, // true if creating a new custom system, false if overwriting master (but overwriting master doesn't change is_custom)
      };

      await SystemItemORM.saveFullSystem(
        metadata, 
        lines, 
        overwriteMaster ? statePayload.selectedSystemId : undefined
      );

      // Force refresh if we are overwriting
      if (overwriteMaster) {
        window.location.reload();
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save preset');
    }
    setLoading(false);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-active">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Save size={20} />
            </div>
            <h2 className="text-lg font-bold text-text-primary">Save as Preset</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Preset Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 5KW Premium Tata/Growatt"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:border-accent/50 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Capacity (kW)</label>
              <input 
                type="number" 
                value={capacity} 
                onChange={e => setCapacity(e.target.value)}
                disabled={overwriteMaster}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:border-accent/50 outline-none text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Category</label>
              <Select 
                value={type} 
                onChange={val => setType(val as any)}
                disabled={overwriteMaster}
                options={[
                  { value: 'residential', label: 'Residential' },
                  { value: 'commercial', label: 'Commercial' },
                  { value: 'industrial', label: 'Industrial' }
                ]}
                className="w-full"
              />
            </div>
          </div>
          
          {isMasterPreset && (
            <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={overwriteMaster} 
                  onChange={(e) => setOverwriteMaster(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <span className="block text-sm font-bold text-red-600 dark:text-red-400">
                    Overwrite Master DB Preset
                  </span>
                  <span className="block text-xs text-text-muted mt-1">
                    Instead of creating a new preset, overwrite the selected master preset in the database with the current BOM.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface-active flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-hover">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-background hover:opacity-90 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
