'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Zap } from 'lucide-react';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { useSettings } from '@/lib/hooks/useSettings';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SystemSelectorProps {
  value: string | null;
  onChange: (id: string) => void;
}

type Category = SolarSystem['category'];

// ─── Category Config ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; dotClass: string; badgeClass: string }> = {
  'on-grid':        { label: 'On-Grid',        color: '#22C55E', dotClass: 'bg-cat-on-grid',  badgeClass: 'badge-on-grid' },
  '3-phase':        { label: '3-Phase',         color: '#3B82F6', dotClass: 'bg-cat-3-phase',  badgeClass: 'badge-3-phase' },
  'micro-inverter': { label: 'Micro-Inverter',  color: '#A855F7', dotClass: 'bg-cat-micro',    badgeClass: 'badge-micro-inverter' },
  'hybrid':         { label: 'Hybrid',          color: '#F59E0B', dotClass: 'bg-cat-hybrid',   badgeClass: 'badge-hybrid' },
  'upgrade':        { label: 'Upgrade',         color: '#64748B', dotClass: 'bg-cat-upgrade',  badgeClass: 'badge-upgrade' },
  'commercial':     { label: 'Commercial',      color: '#EF4444', dotClass: 'bg-cat-commercial', badgeClass: 'badge-commercial' },
};

const CATEGORY_ORDER: Category[] = ['on-grid', '3-phase', 'micro-inverter', 'hybrid', 'upgrade', 'commercial'];

// ─── Component ──────────────────────────────────────────────────────────────────

export function SystemSelector({ value, onChange }: SystemSelectorProps) {
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const allSystems = useMemo(
    () => [...SYSTEMS, ...(settings.customSystems ?? [])],
    [settings.customSystems],
  );

  // Get selected system
  const selectedSystem = useMemo(
    () => allSystems.find((s) => s.id === value) ?? null,
    [allSystems, value],
  );

  // Filter & group systems
  const groupedSystems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? allSystems.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            s.capacityKW.toString().includes(q),
        )
      : allSystems;

    const groups: Record<string, SolarSystem[]> = {};
    for (const sys of filtered) {
      if (!groups[sys.category]) groups[sys.category] = [];
      groups[sys.category].push(sys);
    }

    return CATEGORY_ORDER
      .filter((cat) => groups[cat]?.length)
      .map((cat) => ({
        category: cat,
        config: CATEGORY_CONFIG[cat],
        systems: groups[cat],
      }));
  }, [allSystems, searchQuery]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative" id="system-selector">
      {/* Label */}
      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Solar System
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-3
          rounded-xl border transition-all duration-200 text-left
          ${isOpen
            ? 'border-accent/40 bg-surface-active shadow-lg shadow-accent/5'
            : 'border-border bg-surface hover:border-border-light hover:bg-surface-hover'
          }`}
      >
        {selectedSystem ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_CONFIG[selectedSystem.category].color }}
            />
            <span className="text-sm font-medium text-text-primary truncate">
              {selectedSystem.name}
            </span>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-dim text-accent">
              {selectedSystem.capacityKW} kW
            </span>
          </div>
        ) : (
          <span className="text-sm text-text-muted">Select a system…</span>
        )}
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-border
          bg-surface shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
          {/* Search bar */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search systems…"
                className="w-full pl-8 pr-8 py-2 rounded-lg bg-background border border-border
                  text-sm text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Grouped options */}
          <div className="max-h-[320px] overflow-y-auto py-1">
            {groupedSystems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-text-muted">
                No systems found
              </div>
            ) : (
              groupedSystems.map((group) => (
                <div key={group.category}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 py-2 mt-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: group.config.color }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      {group.config.label}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      ({group.systems.length})
                    </span>
                  </div>

                  {/* System options */}
                  {group.systems.map((sys) => {
                    const isSelected = sys.id === value;
                    return (
                      <button
                        key={sys.id}
                        onClick={() => handleSelect(sys.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left
                          transition-all duration-150
                          ${isSelected
                            ? 'bg-accent-dim'
                            : 'hover:bg-surface-hover'
                          }`}
                      >
                        <Zap
                          size={14}
                          className={isSelected ? 'text-accent' : 'text-text-muted'}
                        />
                        <span className={`text-sm flex-1 truncate ${isSelected ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                          {sys.name}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${group.config.badgeClass}`}>
                          {sys.capacityKW} kW
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
