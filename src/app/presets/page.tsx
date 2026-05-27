'use client';

import { useState } from 'react';
import { useSettings } from '@/lib/hooks/useSettings';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { getActivePanelBrands, getActiveInverterBrands, getActiveBatteryBrands } from '@/lib/data/masters';
import { Bookmark, Settings as SettingsIcon, Trash2, Edit3, Plus, ArrowRight, Zap, Component } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/Confirm';

export default function PresetsPage() {
  const { settings, setSettings } = useSettings();
  const confirm = useConfirm();
  const [customSystemError, setCustomSystemError] = useState<string | null>(null);
  const [customSystemDraft, setCustomSystemDraft] = useState({
    name: '',
    baseSystemId: SYSTEMS[0]?.id ?? '',
    category: 'on-grid' as SolarSystem['category'],
    capacityKW: '',
    panelId: '',
    panelWattage: '',
    panelQty: '',
    inverterId: '',
    inverterQty: '1',
    batteryId: '',
    batteryQty: '1',
    targetMarginPct: '20',
  });

  const customSystems = settings.customSystems ?? [];

  const handleAddCustomSystem = () => {
    const name = customSystemDraft.name.trim();
    const capacityKW = parseFloat(customSystemDraft.capacityKW);
    const panelQty = parseInt(customSystemDraft.panelQty, 10);
    const targetMarginPct = parseFloat(customSystemDraft.targetMarginPct);
    const template = SYSTEMS.find((s) => s.id === customSystemDraft.baseSystemId);

    if (!name) return setCustomSystemError('System name is required.');
    if (!template) return setCustomSystemError('Please choose a valid base template.');
    if (!Number.isFinite(capacityKW) || capacityKW <= 0) return setCustomSystemError('Capacity must be greater than 0.');
    if (!Number.isFinite(panelQty) || panelQty <= 0) return setCustomSystemError('Panel quantity must be greater than 0.');
    if (!Number.isFinite(targetMarginPct) || targetMarginPct < 0) return setCustomSystemError('Target margin must be 0 or higher.');

    const panel = getActivePanelBrands(settings).find(p => p.id === customSystemDraft.panelId);
    const panelWattage = panel ? panel.wattage : parseInt(customSystemDraft.panelWattage, 10);
    if (!Number.isFinite(panelWattage) || panelWattage <= 0) return setCustomSystemError('Panel wattage must be greater than 0.');

    const items = template.items.map((item) =>
      item.description.toUpperCase() === 'PANEL'
        ? { ...item, qty: panelQty }
        : { ...item },
    );

    const defaultEquipment: SolarSystem['defaultEquipment'] = {};
    let hasEquipment = false;

    if (customSystemDraft.panelId) {
      defaultEquipment.panelMix = { [customSystemDraft.panelId]: panelQty };
      hasEquipment = true;
    }
    
    const iQty = parseInt(customSystemDraft.inverterQty, 10);
    if (customSystemDraft.inverterId && iQty > 0) {
      defaultEquipment.inverterMix = { [customSystemDraft.inverterId]: iQty };
      hasEquipment = true;
    }
    
    const bQty = parseInt(customSystemDraft.batteryQty, 10);
    if (customSystemDraft.batteryId && bQty > 0) {
      defaultEquipment.batteryMix = { [customSystemDraft.batteryId]: bQty };
      hasEquipment = true;
    }

    const customSystem: SolarSystem = {
      id: `custom_sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      category: customSystemDraft.category,
      capacityKW,
      panelWattage,
      panelQty,
      targetMarginPct: targetMarginPct / 100,
      items,
      ...(hasEquipment ? { defaultEquipment } : {}),
    };

    setSettings({ customSystems: [...customSystems, customSystem] });
    setCustomSystemError(null);
    setCustomSystemDraft({
      name: '',
      baseSystemId: SYSTEMS[0]?.id ?? '',
      category: 'on-grid',
      capacityKW: '',
      panelId: '',
      panelWattage: '',
      panelQty: '',
      inverterId: '',
      inverterQty: '1',
      batteryId: '',
      batteryQty: '1',
      targetMarginPct: '20',
    });
  };

  const removeCustomSystem = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Preset?',
      message: 'Are you sure you want to delete this custom system preset? This action is permanent and cannot be undone.',
      confirmLabel: 'Delete Preset',
      cancelLabel: 'Keep Preset',
      type: 'danger',
    });
    if (!confirmed) return;
    setSettings({ customSystems: customSystems.filter((sys) => sys.id !== id) });
  };

  const renamePreset = (id: string, oldName: string) => {
    const newName = prompt('Enter new name:', oldName);
    if (!newName?.trim() || newName === oldName) return;
    
    setSettings({
      customSystems: customSystems.map(sys => 
        sys.id === id ? { ...sys, name: newName.trim() } : sys
      )
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <Bookmark size={24} className="text-accent" />
          Manage Presets
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Create, edit, and organize custom solar systems for quick access in the Calculator.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Builder Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface rounded-xl border border-border p-5">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <Plus size={16} className="text-accent" />
              Build Basic Preset
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Create a preset from a BOM template.
            </p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">System Name</label>
                <input
                  type="text"
                  value={customSystemDraft.name}
                  onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                  placeholder="e.g. 7.5 KWp Rooftop"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">BOM Template</label>
                <select
                  value={customSystemDraft.baseSystemId}
                  onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, baseSystemId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                >
                  {SYSTEMS.map((sys) => (
                    <option key={sys.id} value={sys.id}>{sys.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Category</label>
                  <select
                    value={customSystemDraft.category}
                    onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, category: e.target.value as SolarSystem['category'] })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                  >
                    <option value="on-grid">On-Grid</option>
                    <option value="3-phase">3-Phase</option>
                    <option value="micro-inverter">Micro-Inverter</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="upgrade">Upgrade</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Capacity (kW)</label>
                  <input
                    type="number"
                    min={0} step={0.01}
                    value={customSystemDraft.capacityKW}
                    onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, capacityKW: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                    placeholder="7.50"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Specific Panel Model (Optional)</label>
                  <select
                    value={customSystemDraft.panelId}
                    onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                  >
                    <option value="">Generic (Use custom wattage below)</option>
                    {getActivePanelBrands(settings).map((p) => (
                      <option key={p.id} value={p.id}>{p.brand} {p.wattage}W {p.type}</option>
                    ))}
                  </select>
                </div>
                {!customSystemDraft.panelId && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Panel Wattage</label>
                    <input
                      type="number"
                      min={0} step={1}
                      value={customSystemDraft.panelWattage}
                      onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelWattage: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                      placeholder="620"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Panel Qty</label>
                  <input
                    type="number"
                    min={0} step={1}
                    value={customSystemDraft.panelQty}
                    onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, panelQty: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                    placeholder="12"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Target Margin (%)</label>
                  <input
                    type="number"
                    min={0} step={0.5}
                    value={customSystemDraft.targetMarginPct}
                    onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, targetMarginPct: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-border">
                <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Component size={12} className="text-accent" /> Extra Equipment (Optional)
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5 col-span-3">
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Inverter</label>
                    <select
                      value={customSystemDraft.inverterId}
                      onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, inverterId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                    >
                      <option value="">None / Default</option>
                      {getActiveInverterBrands(settings).map((i) => (
                        <option key={i.id} value={i.id}>{i.brand} {i.model}</option>
                      ))}
                    </select>
                  </div>
                  {customSystemDraft.inverterId ? (
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Qty</label>
                      <input
                        type="number" min={1} step={1}
                        value={customSystemDraft.inverterQty}
                        onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, inverterQty: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                      />
                    </div>
                  ) : <div className="col-span-1" />}

                  <div className="space-y-1.5 col-span-3">
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Battery</label>
                    <select
                      value={customSystemDraft.batteryId}
                      onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, batteryId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                    >
                      <option value="">None / Default</option>
                      {getActiveBatteryBrands(settings).map((b) => (
                        <option key={b.id} value={b.id}>{b.brand} {b.model}</option>
                      ))}
                    </select>
                  </div>
                  {customSystemDraft.batteryId ? (
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Qty</label>
                      <input
                        type="number" min={1} step={1}
                        value={customSystemDraft.batteryQty}
                        onChange={(e) => setCustomSystemDraft({ ...customSystemDraft, batteryQty: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-accent/50"
                      />
                    </div>
                  ) : <div className="col-span-1" />}
                </div>
              </div>
              
              {customSystemError && <p className="text-xs text-error">{customSystemError}</p>}
              
              <button
                onClick={handleAddCustomSystem}
                className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-background text-sm font-bold transition-colors"
              >
                Add Preset
              </button>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-dashed border-accent/30 bg-accent/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Zap size={16} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-accent mb-1">Detailed Hardware Presets</h3>
                <p className="text-xs text-text-muted mb-3">
                  Want to set exact panel, inverter, and battery brands for a preset? Build your exact system in the Calculator and use the <strong>"Save Configuration as Preset"</strong> button!
                </p>
                <Link href="/calculator" className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-primary hover:text-accent transition-colors">
                  Go to Calculator <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Preset List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface rounded-xl border border-border p-5 h-full min-h-125">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-4">
              <SettingsIcon size={16} className="text-accent" />
              Your Custom Presets
            </h2>

            {customSystems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-xl bg-background/50">
                <Bookmark size={32} className="text-text-muted/30 mb-3" />
                <p className="text-sm text-text-primary font-medium">No custom presets yet</p>
                <p className="text-xs text-text-muted mt-1 max-w-62.5">
                  Add a basic preset from the left, or save a detailed one from the calculator.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customSystems.map((sys) => (
                  <div key={sys.id} className="flex flex-col bg-background p-4 rounded-xl border border-border hover:border-border-light transition-colors group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 pr-2">
                        <h3 className="text-sm font-bold text-text-primary truncate" title={sys.name}>{sys.name}</h3>
                        <p className="text-xs text-text-muted mt-0.5">
                          {sys.capacityKW} kW · {sys.panelQty} × {sys.panelWattage}W
                        </p>
                      </div>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider badge-${sys.category} shrink-0`}>
                        {sys.category}
                      </span>
                    </div>

                    {sys.defaultEquipment && (
                      <div className="mb-4 px-2.5 py-2 rounded-lg bg-surface-hover/50 border border-border/50">
                        <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1.5">Explicit Equipment</p>
                        <ul className="text-xs text-text-muted space-y-1 font-mono">
                          {Object.entries(sys.defaultEquipment.panelMix ?? {}).map(([id, qty]) => (
                            <li key={id} className="truncate">• {qty}x {id}</li>
                          ))}
                          {Object.entries(sys.defaultEquipment.inverterMix ?? {}).map(([id, qty]) => (
                            <li key={id} className="truncate">• {qty}x {id}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => renamePreset(sys.id, sys.name)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Edit3 size={12} /> Rename
                      </button>
                      <button
                        onClick={() => removeCustomSystem(sys.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-error/10 border border-border hover:border-error/30 text-xs font-medium text-text-secondary hover:text-error transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
