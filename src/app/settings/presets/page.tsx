'use client';

import { useEffect, useState } from 'react';
import { PresetORM, type PresetRow } from '@/backend/orm/presets';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';
import {
  Settings2, Plus, Box, Zap, Search,
  ToggleLeft, ToggleRight, Edit3, Trash2, MapPin
} from 'lucide-react';

export default function SystemPresetsPage() {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSystemId, setComposerSystemId] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const data = await PresetORM.getAll();
      setPresets(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const filteredPresets = presets.filter((preset) => {
    const haystack = [
      preset.name,
      preset.capacity_kw,
      preset.type,
      preset.state_name || 'global',
    ].join(' ').toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await PresetORM.delete(id);
        fetchPresets();
      } catch (err: any) {
        alert('Failed to delete: ' + err.message);
      }
    }
  };

  if (loading && presets.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-accent-dim flex items-center justify-center text-accent">
            <Settings2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">State-Wise Quote Presets</h1>
            <p className="text-sm text-text-muted mt-1">Configure standard solar packages for quick quotations</p>
          </div>
        </div>

        <button 
          onClick={() => {
            setComposerSystemId(null);
            setComposerOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background hover:bg-accent-hover transition-colors text-sm font-bold shadow-sm"
        >
          <Plus size={16} /> Create Preset
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-background/60 flex flex-col md:flex-row justify-between gap-4 items-center">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Box size={16} className="text-text-muted"/> Available Presets
          </h2>
          <div className="relative w-full md:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search presets, state, size..." 
              className="w-full md:min-w-[280px] pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-background/80 text-text-muted">
                <th className="px-5 py-3 font-medium border-b border-border">Preset Name</th>
                <th className="px-5 py-3 font-medium border-b border-border text-center">State</th>
                <th className="px-5 py-3 font-medium border-b border-border text-center">Capacity</th>
                <th className="px-5 py-3 font-medium border-b border-border text-center">Type</th>
                <th className="px-5 py-3 font-medium border-b border-border text-center">Pricing Mode</th>
                <th className="px-5 py-3 font-medium border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPresets.map((preset) => {
                const isDynamic = preset.calculator_state?.useDynamicPricing !== false;
                
                return (
                  <tr key={preset.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-4 text-text-primary font-medium flex items-center gap-2">
                      <Zap size={14} className="text-accent" />
                      {preset.name}
                      {preset.is_org_template && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 border border-blue-500/20 uppercase tracking-wider">Built-in</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center text-text-secondary">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-semibold">
                        <MapPin size={12} />
                        {preset.state_name || 'Global'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-text-secondary">
                      {preset.capacity_kw} kW
                    </td>
                    <td className="px-5 py-4 text-center text-text-secondary capitalize">
                      {preset.type.replace(/[_-]/g, ' ')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-hover border border-border text-xs">
                        {isDynamic ? (
                          <><ToggleRight size={14} className="text-green-600" /> <span className="text-green-600 font-medium">Dynamic ERP Rates</span></>
                        ) : (
                          <><ToggleLeft size={14} className="text-text-muted" /> <span className="text-text-muted">Fixed Flat Rate</span></>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          setComposerSystemId(preset.id);
                          setComposerOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-dim rounded transition-colors" 
                        title="Edit Preset"
                      >
                        <Edit3 size={16} />
                      </button>
                      {!preset.is_org_template && (
                        <button 
                          onClick={() => handleDelete(preset.id, preset.name)}
                          className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" 
                          title="Delete Preset"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPresets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-text-muted">
                    No presets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {composerOpen && (
        <PresetEditorDialog
          open={composerOpen}
          presetId={composerSystemId || ''}
          onClose={() => {
            setComposerOpen(false);
            setComposerSystemId(null);
          }}
          onSaved={(id, name) => {
            fetchPresets();
            setComposerOpen(false);
            setComposerSystemId(null);
          }}
        />
      )}
    </div>
  );
}
