'use client';

import { useEffect, useState } from 'react';
import { PresetORM, type PresetRow } from '@/backend/orm/presets';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';
import { deleteSystemPreset, getPresetStates, type PresetStateOption } from '@/lib/actions/presets';
import type { LineItem } from '@/lib/actions/presets';
import {
  Settings2, Plus, Box, Zap, Search,
  ToggleLeft, ToggleRight, Edit3, Trash2, MapPin, PlayCircle, Copy
} from 'lucide-react';

function categoryFromBomDescription(description: string) {
  const value = description.toLowerCase();
  if (value.includes('panel') || value.includes('module')) return 'panel';
  if (value.includes('inverter') || value.includes('communication')) return 'inverter';
  if (value.includes('battery')) return 'battery';
  if (value.includes('structure') || value.includes('mount')) return 'structure';
  if (value.includes('dcdb') || value.includes('dc protection') || value.includes('isolator') || value.includes('lightning') || value.includes('l/a')) return 'dc_protection';
  if (value.includes('acdb') || value.includes('ac protection') || value.includes('meter box')) return 'ac_protection';
  if (value.includes('cable') || value.includes('mc4') || value.includes('copper') || value.includes('wiring pipe')) return 'cable';
  if (value.includes('earth') || value.includes('gi strip') || value.includes('chamber')) return 'earthing';
  if (value.includes('civil') || value.includes('foundation') || value.includes('concrete')) return 'civil';
  if (value.includes('logistic') || value.includes('transport') || value.includes('freight')) return 'logistics';
  if (value.includes('accessor') || value.includes('meter') || value.includes('wifi') || value.includes('monitor')) return 'accessory';
  return 'other';
}

function validSystemType(value: string | null | undefined) {
  const normalized = String(value ?? '').replace(/-/g, '_');
  return ['on_grid', '3_phase', 'hybrid', 'micro_inverter', 'commercial', 'upgrade'].includes(normalized)
    ? normalized
    : 'on_grid';
}

function legacyPresetToEditorData(preset: PresetRow) {
  const state = preset.calculator_state ?? {};
  const items = Array.isArray(state.items) ? state.items : [];

  return {
    id: preset.id,
    name: preset.name,
    system_type: validSystemType(state.systemType ?? state.category ?? preset.type),
    capacity_kw: Number(preset.capacity_kw || state.capacityKW || 0),
    state_id: preset.state_id ?? state.stateId ?? null,
    lineItems: items.map((item: any, index: number): LineItem => ({
      id: `${preset.id}_${index}`,
      category: item.category ?? categoryFromBomDescription(item.description ?? ''),
      catalogItemId: item.catalogItemId,
      catalogType: item.catalogType ?? 'custom',
      skuCode: item.skuCode ?? '',
      description: item.description ?? 'Custom item',
      brand: item.brand ?? '',
      model: item.model ?? '',
      specificationDetails: item.specificationDetails ?? item.specification_details ?? item.notes ?? '',
      unit: item.unit ?? 'Nos',
      quantity: Number(item.qty ?? item.quantity ?? 0),
      unitRate: Number(item.ratePerUnit ?? item.unitRate ?? 0),
      gstPct: item.gstPct,
      isIncluded: item.isIncluded ?? true,
      isSurveyDependent: item.isSurveyDependent ?? false,
      sortOrder: index,
    })),
  };
}

function editorLineItemToBomItem(item: LineItem) {
  return {
    description: item.description,
    unit: item.unit || 'Nos',
    qty: Number(item.quantity || 0),
    ratePerUnit: Number(item.unitRate || 0),
    gstPct: item.gstPct ?? 0.18,
    category: item.category,
    catalogItemId: item.catalogItemId,
    catalogType: item.catalogType,
    skuCode: item.skuCode,
    brand: item.brand,
    model: item.model,
    specificationDetails: item.specificationDetails,
  };
}

export default function SystemPresetsPage() {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [states, setStates] = useState<PresetStateOption[]>([]);
  const [stateFilter, setStateFilter] = useState('all');
  
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSystemId, setComposerSystemId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const activeComposerPreset = presets.find((preset) => preset.id === composerSystemId) ?? null;
  const legacyComposerPreset = activeComposerPreset?.source === 'custom_presets' ? activeComposerPreset : null;
  const selectedFilterState = states.find((state) => state.id === stateFilter) ?? null;
  const createInitialData = !composerSystemId && selectedFilterState
    ? {
        id: '',
        name: '',
        system_type: 'on_grid',
        capacity_kw: 0,
        state_id: selectedFilterState.id,
        lineItems: [],
      }
    : undefined;
  const duplicateInitialData = composerMode === 'duplicate' && legacyComposerPreset
    ? legacyPresetToEditorData(legacyComposerPreset)
    : undefined;
  const editInitialData = composerMode === 'edit' && legacyComposerPreset
    ? legacyPresetToEditorData(legacyComposerPreset)
    : undefined;

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
    getPresetStates().then(setStates).catch((err) => {
      console.error('Failed to load states:', err);
      setStates([]);
    });
  }, []);

  const filteredPresets = presets.filter((preset) => {
    if (stateFilter === 'global' && preset.state_id) return false;
    if (stateFilter !== 'all' && stateFilter !== 'global' && preset.state_id !== stateFilter) return false;
    const haystack = [
      preset.name,
      preset.capacity_kw,
      preset.type,
      preset.state_name || 'global',
    ].join(' ').toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });
  const stateFilteredCount = presets.filter((preset) => {
    if (stateFilter === 'global') return !preset.state_id;
    if (stateFilter === 'all') return true;
    return preset.state_id === stateFilter;
  }).length;

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        const preset = presets.find((row) => row.id === id);
        if (preset?.source === 'custom_presets') {
          await PresetORM.delete(id);
        } else {
          await deleteSystemPreset(id);
        }
        fetchPresets();
      } catch (err: any) {
        alert('Failed to delete: ' + err.message);
      }
    }
  };

  const handleUsePreset = (preset: PresetRow) => {
    window.sessionStorage.setItem('enermass-preset-to-load', JSON.stringify({
      id: preset.id,
      source: preset.source,
      stateId: preset.state_id ?? null,
      stateName: preset.state_name ?? null,
      calculatorState: preset.calculator_state ?? null,
    }));
    window.location.href = '/calculator';
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
            setComposerMode('create');
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
        <div className="p-4 border-b border-border bg-background/60 space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Box size={16} className="text-text-muted"/> Available Presets
              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] text-text-muted">
                {filteredPresets.length} shown / {stateFilteredCount} in scope
              </span>
            </h2>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <label className="relative w-full md:w-[240px]">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <select
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="all">All states</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.state_name}
                    </option>
                  ))}
                </select>
              </label>
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
                      {preset.source === 'custom_presets' && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">Legacy</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center text-text-secondary">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-xs font-semibold">
                        <MapPin size={12} />
                        {preset.state_name || 'State not assigned'}
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
                        onClick={() => handleUsePreset(preset)}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-dim rounded transition-colors"
                        title="Use Preset in Calculator"
                      >
                        <PlayCircle size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setComposerSystemId(preset.id);
                          setComposerMode('duplicate');
                          setComposerOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-dim rounded transition-colors"
                        title="Create Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setComposerSystemId(preset.id);
                          setComposerMode('edit');
                          setComposerOpen(true);
                        }}
                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent-dim rounded transition-colors"
                        title="Edit Preset"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id, preset.name)}
                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title={preset.is_org_template ? 'Hide Built-In Preset' : 'Delete Preset'}
                      >
                        <Trash2 size={16} />
                      </button>
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
            setComposerMode('create');
          }}
          onSaved={(id, name) => {
            fetchPresets();
            setComposerOpen(false);
            setComposerSystemId(null);
            setComposerMode('create');
          }}
          mode={composerMode}
          initialData={duplicateInitialData ?? editInitialData ?? createInitialData}
          onSaveLocal={composerMode === 'edit' && legacyComposerPreset ? async (updates) => {
            const nextItems = updates.lineItems
              .filter((item) => item.isIncluded)
              .map(editorLineItemToBomItem);
            await PresetORM.update(legacyComposerPreset.id, {
              name: updates.name,
              capacity_kw: updates.capacityKw,
              state_id: updates.stateId ?? null,
              calculator_state: {
                ...(legacyComposerPreset.calculator_state ?? {}),
                systemType: updates.systemType,
                stateId: updates.stateId ?? null,
                items: nextItems,
              },
            });
          } : undefined}
        />
      )}
    </div>
  );
}
