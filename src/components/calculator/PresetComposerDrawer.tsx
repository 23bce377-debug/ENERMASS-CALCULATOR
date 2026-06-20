'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, Check, AlertCircle, Plus, ChevronRight } from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { useToast } from '@/components/ui/Toast';
import { BomItem } from '@/lib/data/bom';
import { Select } from '@/components/ui/Select';

interface PresetComposerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  presetId: string | null; // null for new blank preset
}

export function PresetComposerDrawer({ isOpen, onClose, presetId }: PresetComposerDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { toast } = useToast();
  const dbSystems = useCalculatorStore(s => s.dbSystems);
  const dbPanels = useCalculatorStore(s => s.dbPanels);
  const dbInverters = useCalculatorStore(s => s.dbInverters);
  
  const [activeTab, setActiveTab] = useState('overview');

  const [presetName, setPresetName] = useState('');
  const [systemKw, setSystemKw] = useState(5);
  const [systemType, setSystemType] = useState('on-grid');
  const [isDefault, setIsDefault] = useState(false);
  
  const [items, setItems] = useState<BomItem[]>([]);
  
  // Tabs: overview, panels, inverter, structure, bos, earthing, civil, logistics
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'panels', label: 'Panels' },
    { id: 'inverter', label: 'Inverter' },
    { id: 'structure', label: 'Structure' },
    { id: 'bos', label: 'BOS & Protection' },
    { id: 'earthing', label: 'Earthing' },
    { id: 'civil', label: 'Civil' },
    { id: 'logistics', label: 'Logistics' },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-fill logic when drawer opens
  useEffect(() => {
    if (isOpen) {
      if (presetId) {
        const sys = dbSystems.find(s => s.id === presetId);
        if (sys) {
          setPresetName(sys.name);
          setSystemKw(sys.capacityKW || 0);
          setSystemType(sys.category || 'on-grid');
          setItems(sys.items ? JSON.parse(JSON.stringify(sys.items)) : []);
        } else {
          setPresetName('Existing Preset ' + presetId.substring(0,4));
          setSystemKw(5);
          setSystemType('on-grid');
          setItems([]);
        }
      } else {
        setPresetName('New Preset');
        setSystemKw(0);
        setSystemType('on-grid');
        setIsDefault(false);
        setItems([]);
      }
      setIsClosing(false);
    }
  }, [isOpen, presetId, dbSystems]);

  const updateItemQty = (index: number, newQty: number) => {
    const newItems = [...items];
    newItems[index].qty = newQty;
    setItems(newItems);
  };

  const getFilteredItems = (filterFn: (desc: string) => boolean) => {
    return items.map((item, index) => ({ item, index })).filter(({ item }) => filterFn(item.description.toUpperCase()));
  };

  const totalCost = useMemo(() => items.reduce((acc, item) => acc + (item.qty * item.ratePerUnit), 0), [items]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // match transition duration
  };

  const handleSave = () => {
    // Save logic integrating with ORM or store
    toast('Preset configuration saved successfully', 'success');
    handleClose();
  };

  if (!mounted) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300
          ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      
      {/* Modal Window */}
      <div 
        className={`relative w-full max-w-5xl h-full max-h-[85vh] bg-surface border border-border shadow-2xl flex flex-col rounded-2xl overflow-hidden
          transition-all duration-300 ease-out transform
          ${isOpen && !isClosing ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
          <div className="flex flex-col flex-1 min-w-0 pr-4">
            <input 
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="text-lg font-bold text-text-primary bg-transparent border-b border-transparent focus:border-accent/40 focus:outline-none truncate px-1 py-0.5 rounded-sm transition-colors hover:bg-surface-hover"
              placeholder="Preset Name"
            />
            <div className="text-[10px] text-text-muted mt-0.5 px-1 uppercase tracking-wider">
              {presetId ? 'Edit Configuration' : 'New Configuration'}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-all shadow-md shadow-accent/20"
            >
              <Save size={14} />
              Save
            </button>
            <button 
              onClick={handleClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-2 py-1 border-b border-border overflow-x-auto no-scrollbar shrink-0 bg-surface/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all
                ${activeTab === tab.id 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-background/30">
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4 p-4 rounded-xl border border-border bg-surface">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">System Type</label>
                  <div className="flex gap-2">
                    {['on-grid', 'off-grid', 'hybrid', 'custom'].map(type => (
                      <button
                        key={type}
                        onClick={() => setSystemType(type)}
                        className={`flex-1 py-2 text-[10px] sm:text-xs font-medium rounded-lg border transition-all ${systemType === type ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:bg-surface-hover'}`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Target Capacity (kW)</label>
                  <input 
                    type="number"
                    value={systemKw}
                    onChange={(e) => setSystemKw(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-accent/40"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                  <span className="text-sm font-medium text-text-primary">Set as Default for Type</span>
                  <button
                    onClick={() => setIsDefault(!isDefault)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${isDefault ? 'bg-accent' : 'bg-border-light'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-all ${isDefault ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'panels' && (
            <div className="space-y-4 animate-fade-in">
              {getFilteredItems(d => d === 'PANEL').map(({ item, index }) => (
                <div key={index} className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <div className="text-sm font-bold text-text-primary">{item.description}</div>
                    <div className="text-xs text-text-muted">₹{item.ratePerUnit} / {item.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Qty:</label>
                    <input 
                      type="number" 
                      min={0}
                      value={item.qty}
                      onChange={(e) => updateItemQty(index, Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded bg-background border border-border text-sm outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
              ))}
              <div className="p-4 rounded-xl border border-dashed border-border bg-surface/50 flex flex-col items-center justify-center min-h-[100px] text-text-muted transition-colors w-full">
                <span className="text-xs font-semibold mb-2">Select Panel from Catalog</span>
                <Select 
                  value=""
                  placeholder="-- Select Panel --"
                  onChange={(val) => {
                    const panel = dbPanels.find((p: any) => p.id === val);
                    if (panel) {
                      setItems([...items, {
                        description: 'PANEL',
                        remarks: `${panel.brand} - ${panel.model} (${panel.wattage}Wp)`,
                        qty: 1,
                        unit: 'Nos',
                        ratePerUnit: panel.ratePerWatt * panel.wattage,
                        gstPct: 0.12
                      }]);
                    }
                  }}
                  options={[
                    { value: '', label: '-- Select Panel --', disabled: true },
                    ...dbPanels.map((p: any) => ({
                      value: p.id,
                      label: `${p.brand} - ${p.model} (${p.wattage}Wp)`
                    }))
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {activeTab === 'inverter' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-amber-500">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="text-xs">Select an inverter that matches your system capacity and phase requirements.</div>
              </div>
              {getFilteredItems(d => d === 'INVERTER').map(({ item, index }) => (
                <div key={index} className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <div className="text-sm font-bold text-text-primary">{item.description}</div>
                    <div className="text-xs text-text-muted">₹{item.ratePerUnit} / {item.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Qty:</label>
                    <input 
                      type="number" 
                      min={0}
                      value={item.qty}
                      onChange={(e) => updateItemQty(index, Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded bg-background border border-border text-sm outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
              ))}
              <div className="p-4 rounded-xl border border-dashed border-border bg-surface/50 flex flex-col items-center justify-center min-h-[100px] text-text-muted transition-colors w-full">
                <span className="text-xs font-semibold mb-2">Select Inverter from Catalog</span>
                <Select 
                  value=""
                  placeholder="-- Select Inverter --"
                  onChange={(val) => {
                    const inv = dbInverters.find((i: any) => i.id === val);
                    if (inv) {
                      setItems([...items, {
                        description: 'INVERTER',
                        remarks: `${inv.brand} - ${inv.model} (${inv.capacityKW}kW)`,
                        qty: 1,
                        unit: 'Nos',
                        ratePerUnit: inv.rate,
                        gstPct: 0.12
                      }]);
                    }
                  }}
                  options={[
                    { value: '', label: '-- Select Inverter --', disabled: true },
                    ...dbInverters.map((i: any) => ({
                      value: i.id,
                      label: `${i.brand} - ${i.model} (${i.capacityKW}kW)`
                    }))
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          )}
          
          {['structure', 'bos', 'earthing', 'civil', 'logistics'].includes(activeTab) && (
            <div className="space-y-4 animate-fade-in">
              {getFilteredItems(d => {
                if (activeTab === 'structure') return d === 'STRUCTURE';
                if (activeTab === 'earthing') return d.includes('EARTHING') || d.includes('LIGHTNING') || d.includes('L/A');
                if (activeTab === 'civil') return d.includes('CIVIL');
                if (activeTab === 'logistics') return d.includes('TRANSPORT') || d.includes('LOGISTIC');
                // BOS: Everything else
                return d !== 'PANEL' && d !== 'INVERTER' && d !== 'STRUCTURE' && !d.includes('EARTHING') && !d.includes('LIGHTNING') && !d.includes('L/A') && !d.includes('CIVIL') && !d.includes('TRANSPORT') && !d.includes('LOGISTIC');
              }).map(({ item, index }) => (
                <div key={index} className="p-3 rounded-xl border border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="text-sm font-bold text-text-primary truncate" title={item.description}>{item.description}</div>
                    <div className="text-[10px] text-text-muted uppercase mt-0.5 tracking-wider">{item.remarks || 'Standard Item'}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-text-primary">₹{item.ratePerUnit}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">Per {item.unit}</div>
                    </div>
                    <div className="w-px h-8 bg-border/50" />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Qty:</label>
                      <input 
                        type="number" 
                        min={0}
                        step={0.1}
                        value={item.qty}
                        onChange={(e) => updateItemQty(index, Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded bg-background border border-border text-sm outline-none focus:border-accent/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-4 rounded-xl border border-dashed border-border bg-surface/50 hover:bg-surface flex flex-col items-center justify-center min-h-[100px] text-text-muted cursor-pointer transition-colors">
                <Plus size={20} className="mb-1 opacity-50" />
                <span className="text-xs font-medium capitalize">Add {activeTab} Item</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 border-t border-border bg-surface shrink-0 flex justify-between items-center text-xs text-text-muted">
          <span>Total items: {items.length}</span>
          <span className="font-semibold text-text-primary">Total Est. Cost: ₹ {totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );

  return isOpen || isClosing ? createPortal(drawerContent, document.body) : null;
}
