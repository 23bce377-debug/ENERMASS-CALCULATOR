'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Plus, Save, Edit3, Zap, MapPin, Globe2 } from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SolarSystem } from '@/lib/data/bom';
import { PresetEditorDialog } from '@/components/presets/PresetEditorDialog';

interface SystemPresetDropdownProps {
  onSaveConfig: () => void;
}

export function SystemPresetDropdown({ onSaveConfig }: SystemPresetDropdownProps) {
  const selectedSystemId = useCalculatorStore((s) => s.selectedSystemId);
  const selectSystem = useCalculatorStore((s) => s.selectSystem);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const selectedState = useCalculatorStore((s) => s.selectedState);
  const dbSystemStateMap = useCalculatorStore((s) => s.dbSystemStateMap);
  const fetchMasterData = useCalculatorStore((s) => s.fetchMasterData);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAllStates, setShowAllStates] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSystemId, setComposerSystemId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const systems = useMemo(() => {
    if (dbLoaded && dbSystems.length > 0) return dbSystems;
    return [];
  }, [dbSystems, dbLoaded]);

  const activeSystem = useMemo(() => systems.find(s => s.id === selectedSystemId), [systems, selectedSystemId]);

  // A preset is shown for the selected state when it is either global (no state
  // mapping) or explicitly mapped to that state. This keeps the list relevant and
  // is fully data-driven — assigning a preset to states needs no code change.
  const isVisibleForState = (systemId: string) => {
    if (showAllStates) return true;
    const states = dbSystemStateMap[systemId];
    if (!states || states.length === 0) return true; // global preset
    return !selectedState || states.includes(selectedState);
  };

  const filteredSystems = useMemo(() => {
    return systems.filter(sys => {
      if (!isVisibleForState(sys.id)) return false;
      if (filterType !== 'all' && sys.category !== filterType) return false;
      if (searchQuery && !sys.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systems, filterType, searchQuery, selectedState, dbSystemStateMap, showAllStates]);

  const recentSystems = useMemo(() => {
    return filteredSystems.slice(0, 5); // Recently used, scoped to the selected state
  }, [filteredSystems]);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'on-grid', label: 'On-Grid' },
    { id: '3-phase', label: '3-Phase' },
    { id: 'micro-inverter', label: 'Micro' },
    { id: 'hybrid', label: 'Hybrid' },
    { id: 'commercial', label: 'Commercial' },
    { id: 'upgrade', label: 'Upgrade' },
  ];

  const handleEditClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setComposerSystemId(id);
    setComposerOpen(true);
    setIsOpen(false);
  };

  const handleNewBlank = () => {
    setComposerSystemId(null);
    setComposerOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="preset-listbox"
          aria-haspopup="listbox"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-2 px-3 py-2
            rounded-lg border transition-all duration-200 text-left w-full
            ${isOpen
              ? 'border-accent/40 bg-surface-active shadow-md shadow-accent/5'
              : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={14} className="shrink-0 text-accent" />
            <span className="text-sm font-semibold text-text-primary truncate">
              {activeSystem?.name || 'Select Preset'}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={`shrink-0 text-text-muted transition-transform duration-200
              ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Content */}
        {isOpen && (
          <div 
            id="preset-listbox"
            role="listbox"
            className="absolute z-50 mt-2 w-[320px] lg:w-[400px] left-0 rounded-xl border border-border
            bg-surface shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[80vh]">
            
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search presets..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border
                    text-sm text-text-primary placeholder:text-text-muted
                    focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="border-b border-border">
              <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterType(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                      ${filterType === cat.id
                        ? 'bg-accent text-background'
                        : 'bg-surface-hover text-text-muted hover:text-text-primary'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => setShowAllStates((value) => !value)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    showAllStates
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border bg-background text-text-secondary hover:border-border-light'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showAllStates ? <Globe2 size={14} /> : <MapPin size={14} />}
                    {showAllStates ? 'Showing presets from all states' : `Showing presets for ${selectedState || 'selected state'}`}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider">
                    {showAllStates ? 'All states' : 'State-wise'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Recently Used (if not searching/filtering) */}
              {filterType === 'all' && !searchQuery && recentSystems.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Recently Used {showAllStates ? '(All States)' : selectedState ? `(${selectedState})` : ''}
                  </div>
                  {recentSystems.map(sys => (
                    <div
                      key={`recent-${sys.id}`}
                      role="option"
                      aria-selected={selectedSystemId === sys.id}
                      onClick={() => { selectSystem(sys.id); setIsOpen(false); }}
                      className="group w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-text-primary truncate">{sys.name}</span>
                        <span className="text-[10px] text-text-muted uppercase">
                          {sys.stateName || 'State not assigned'} · {sys.capacityKW} kW
                        </span>
                      </div>
                      <button 
                        onClick={(e) => handleEditClick(e, sys.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-active rounded-md transition-all"
                      >
                        <Edit3 size={12} className="text-text-muted hover:text-accent" />
                      </button>
                    </div>
                  ))}
                  <div className="mx-4 my-2 h-px bg-border/50" />
                </div>
              )}

              {/* Grouped List */}
              <div className="py-2">
                <div className="px-4 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  {showAllStates ? 'All State Presets' : selectedState ? `${selectedState} Presets` : 'All Presets'}
                </div>
                {filteredSystems.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-text-muted">No presets found.</div>
                ) : (
                  filteredSystems.map(sys => (
                    <div
                      key={sys.id}
                      role="option"
                      aria-selected={selectedSystemId === sys.id}
                      onClick={() => { selectSystem(sys.id); setIsOpen(false); }}
                      className={`group w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover cursor-pointer ${selectedSystemId === sys.id ? 'bg-accent/5' : ''}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm truncate font-medium ${selectedSystemId === sys.id ? 'text-accent' : 'text-text-primary'}`}>
                          {sys.name}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase">
                          {sys.category} · {sys.capacityKW} kW · {sys.stateName || 'State not assigned'}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => handleEditClick(e, sys.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-active rounded-md transition-all"
                      >
                        <Edit3 size={14} className="text-text-muted hover:text-accent" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="p-3 border-t border-border bg-surface flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                onClick={handleNewBlank}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                  bg-surface-hover hover:bg-surface-active text-text-primary text-xs font-semibold transition-colors"
              >
                <Plus size={14} />
                New Blank Preset
              </button>
              <button
                onClick={() => {
                  onSaveConfig();
                  setIsOpen(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                  border border-accent text-accent hover:bg-accent/5 text-xs font-semibold transition-colors"
              >
                <Save size={14} />
                Save Current Config
              </button>
            </div>
          </div>
        )}
      </div>

      {composerOpen && (
        <PresetEditorDialog
          open={composerOpen}
          presetId={composerSystemId || ''}
          mode={composerSystemId ? 'edit' : 'create'}
          onClose={() => {
            setComposerOpen(false);
            setComposerSystemId(null);
          }}
          onSaved={async (id, name) => {
            setComposerOpen(false);
            setComposerSystemId(null);
            await fetchMasterData();
          }}
        />
      )}
    </>
  );
}
