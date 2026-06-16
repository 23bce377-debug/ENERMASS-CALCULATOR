'use client';

import { useEffect, useState } from 'react';
import { PresetORM, type PresetRow } from '@/backend/orm/presets';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';
import { 
  Settings2, Plus, Box, Zap, Search, 
  ToggleLeft, ToggleRight, Edit3, Trash2 
} from 'lucide-react';

export default function SystemPresetsPage() {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f0a500]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#f0a500]/20 flex items-center justify-center text-[#f0a500]">
            <Settings2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Presets & Bundles</h1>
            <p className="text-sm text-[#888] mt-1">Configure predefined solar packages for quick quoting</p>
          </div>
        </div>

        <button 
          onClick={() => {
            setComposerSystemId(null);
            setComposerOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0a500] text-black hover:bg-[#f0a500]/90 transition-colors text-sm font-bold shadow-[0_0_15px_rgba(240,165,0,0.3)]"
        >
          <Plus size={16} /> Create Bundle
        </button>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-lg overflow-hidden">
        <div className="p-4 border-b border-[#2a2a2a] bg-[#111] flex flex-col md:flex-row justify-between gap-4 items-center">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Box size={16} className="text-[#888]"/> Available Bundles
          </h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input 
              type="text" 
              placeholder="Search bundles..." 
              className="pl-9 pr-3 py-2 bg-[#0d0d0d] border border-[#333] rounded-lg text-xs text-white outline-none focus:border-[#f0a500] min-w-[250px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#151515] text-[#888]">
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a]">Bundle Name</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Capacity</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Type</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-center">Pricing Mode</th>
                <th className="px-5 py-3 font-medium border-b border-[#2a2a2a] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {presets.map((preset) => {
                const isDynamic = preset.calculator_state?.useDynamicPricing !== false;
                
                return (
                  <tr key={preset.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                    <td className="px-5 py-4 text-white font-medium flex items-center gap-2">
                      <Zap size={14} className="text-[#f0a500]" />
                      {preset.name}
                      {preset.is_org_template && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">Built-in</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-[#888]">
                      {preset.capacity_kw} kW
                    </td>
                    <td className="px-5 py-4 text-center text-[#888] capitalize">
                      {preset.type.replace('-', ' ')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d0d0d] border border-[#333] text-xs">
                        {isDynamic ? (
                          <><ToggleRight size={14} className="text-green-400" /> <span className="text-green-400 font-medium">Dynamic ERP Rates</span></>
                        ) : (
                          <><ToggleLeft size={14} className="text-[#666]" /> <span className="text-[#888]">Fixed Flat Rate</span></>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          setComposerSystemId(preset.id);
                          setComposerOpen(true);
                        }}
                        className="p-1.5 text-[#888] hover:text-[#f0a500] hover:bg-[#f0a500]/10 rounded transition-colors" 
                        title="Edit Bundle"
                      >
                        <Edit3 size={16} />
                      </button>
                      {!preset.is_org_template && (
                        <button 
                          onClick={() => handleDelete(preset.id, preset.name)}
                          className="p-1.5 text-[#888] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" 
                          title="Delete Bundle"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {presets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#555]">
                    No presets configured.
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
