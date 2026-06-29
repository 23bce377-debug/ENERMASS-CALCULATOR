'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, BarChart3, Calculator, Settings, ShieldCheck,
  UserPlus, Laptop, Database, X, Sparkles, AlertCircle, FileText,
  Cpu, CreditCard, Wrench, TrendingUp
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define global command items
  const items: CommandItem[] = useMemo(() => [
    {
      id: 'dashboard',
      title: 'Go to Executive Intelligence Hub',
      subtitle: 'Analyze project margins, warehouse assets, and aging accounts',
      category: 'Navigation',
      icon: <BarChart3 size={15} />,
      action: () => { router.push('/dashboards'); onClose(); }
    },
    {
      id: 'calculator',
      title: 'Go to Solar Pricing Calculator',
      subtitle: 'Build solar designs, compute BOM totals, and generate quotes',
      category: 'Navigation',
      icon: <Calculator size={15} />,
      action: () => { router.push('/calculator'); onClose(); }
    },
    {
      id: 'quotes',
      title: 'Go to Quotes',
      subtitle: 'Search, revise, share, and download saved quotations',
      category: 'Navigation',
      icon: <FileText size={15} />,
      action: () => { router.push('/quotes'); onClose(); }
    },
    {
      id: 'systems',
      title: 'Go to Systems',
      subtitle: 'Manage system presets and engineering assumptions',
      category: 'Navigation',
      icon: <Cpu size={15} />,
      action: () => { router.push('/systems'); onClose(); }
    },
    {
      id: 'master-dashboard',
      title: 'Go to Price Masters Dashboard',
      subtitle: 'Open all editable pricing and master data sections',
      category: 'Price Masters',
      icon: <Database size={15} />,
      action: () => { router.push('/master'); onClose(); }
    },
    {
      id: 'master-panels',
      title: 'Go to Solar Panels Directory',
      subtitle: 'Manage PV module catalogs, wattages, and master inventories',
      category: 'Price Masters',
      icon: <Database size={15} />,
      action: () => { router.push('/master/panels'); onClose(); }
    },
    {
      id: 'master-terms',
      title: 'Go to Terms & Conditions Master',
      subtitle: 'Edit global and state-wise quotation terms for generated PDFs',
      category: 'Price Masters',
      icon: <FileText size={15} />,
      action: () => { router.push('/master/terms'); onClose(); }
    },
    {
      id: 'master-rate-overrides',
      title: 'Go to Rate Overrides',
      subtitle: 'Edit audited BOM item override rates',
      category: 'Price Masters',
      icon: <TrendingUp size={15} />,
      action: () => { router.push('/master/rate-master'); onClose(); }
    },
    {
      id: 'settings',
      title: 'Go to Organization Settings',
      subtitle: 'Modify default margin percentages, tariffs, and region rates',
      category: 'Administration',
      icon: <Settings size={15} />,
      action: () => { router.push('/settings'); onClose(); }
    },
    {
      id: 'settings-presets',
      title: 'Go to Presets Settings',
      subtitle: 'Manage saved bundles and reusable system configurations',
      category: 'Administration',
      icon: <Wrench size={15} />,
      action: () => { router.push('/settings/presets'); onClose(); }
    },
    {
      id: 'billing',
      title: 'Go to Billing Settings',
      subtitle: 'Review subscription, plan limits, and billing state',
      category: 'Administration',
      icon: <CreditCard size={15} />,
      action: () => { router.push('/settings/billing'); onClose(); }
    },
    {
      id: 'team',
      title: 'Go to Team Management',
      subtitle: 'Manage administrative roles, invite members, and audit seats',
      category: 'Administration',
      icon: <UserPlus size={15} />,
      action: () => { router.push('/settings/team'); onClose(); }
    },
    {
      id: 'devices',
      title: 'Go to Device Security & Fingerprints',
      subtitle: 'Audit cryptographically bound workstations and active logs',
      category: 'Security',
      icon: <Laptop size={15} />,
      action: () => { router.push('/settings/devices'); onClose(); }
    },
    {
      id: 'security-keys',
      title: 'Go to Passkeys & Multifactor Setup',
      subtitle: 'Renaming biometrics keys and generating recovery invalidation sheets',
      category: 'Security',
      icon: <ShieldCheck size={15} />,
      action: () => { router.push('/settings/security'); onClose(); }
    },
    {
      id: 'clear-local-cache',
      title: 'Clear Local Application Cache',
      subtitle: 'Invalidate all cached directories and sync fresh from database',
      category: 'System Diagnostics',
      icon: <Sparkles size={15} className="text-accent" />,
      action: () => {
        if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
          window.localStorage.removeItem('enermass_pinned_analytics');
          window.localStorage.removeItem('enermass_master_data_cache');
        }
        toast('Local application cache cleared successfully.', 'info');
        onClose();
      }
    },
    {
      id: 'system-offline-toggle',
      title: 'Simulate Offline Connectivity Mode',
      subtitle: 'Manually toggle offline banners and localized edits queue testing',
      category: 'System Diagnostics',
      icon: <AlertCircle size={15} className="text-red-500" />,
      action: () => {
        window.dispatchEvent(new Event('offline'));
        toast('Connection simulation updated: client offline.', 'warning');
        onClose();
      }
    }
  ], [router, onClose, toast]);

  // Filter commands by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter(
      item => 
        item.title.toLowerCase().includes(s) || 
        item.subtitle.toLowerCase().includes(s) ||
        item.category.toLowerCase().includes(s)
    );
  }, [search, items]);

  useEffect(() => {
    if (filtered.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [activeIndex, filtered.length]);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close and keyboard navigate listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length === 0) return;
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filtered, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal-backdrop flex items-start justify-center p-4 pt-[15vh] bg-background/80 backdrop-blur-sm animate-fade-in no-print">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmd-palette-title"
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[50vh] overflow-hidden"
      >
        <span id="cmd-palette-title" className="sr-only">Command Palette</span>
        
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60 shrink-0">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or destination route..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-0 border-0 p-0"
            aria-label="Search command menu"
          />
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close command palette"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer focus-visible:outline-none
                ${idx === activeIndex ? 'bg-surface-hover/80 border border-accent/20' : 'border border-transparent'}`}
            >
              <div className={`p-2 rounded-lg shrink-0
                ${idx === activeIndex ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-background text-text-muted border border-border/40'}`}>
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-text-primary truncate">{item.title}</p>
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold px-1.5 py-0.5 bg-background rounded-md border border-border/40 shrink-0 select-none">
                    {item.category}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted truncate mt-0.5 leading-normal">{item.subtitle}</p>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-text-muted italic space-y-1">
              <p>No matching commands found.</p>
              <p className="text-[10px] opacity-80">Refine search values or type ? for cheat sheets.</p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-surface-active/50 border-t border-border/60 text-[9px] text-text-muted flex justify-between select-none">
          <div className="flex gap-3">
            <span><kbd className="font-mono bg-background border border-border px-1 rounded">↑↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-background border border-border px-1 rounded">Enter</kbd> to select</span>
          </div>
          <div>
            <span><kbd className="font-mono bg-background border border-border px-1 rounded">esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
