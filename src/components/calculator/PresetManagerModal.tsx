'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Star, Settings, LayoutGrid, List, Plus, Tag, Zap, Building2, User, ChevronRight } from 'lucide-react';
import { PresetORM, PresetRow, PresetTagRow } from '@/backend/orm/presets';
import { supabase } from '@/lib/supabase/client';

export function PresetManagerModal({ isOpen, onClose, onSelectPreset }: { isOpen: boolean; onClose: () => void; onSelectPreset: (state: any) => void }) {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [tags, setTags] = useState<PresetTagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'favorites' | 'org' | 'my'>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      fetchTags();
    }
  }, [isOpen, filter, userId]);

  const fetchPresets = async () => {
    setLoading(true);
    try {
      if (filter === 'recent' && userId) {
        const recent = await PresetORM.getRecent(userId);
        setPresets(recent);
      } else {
        const opts: any = {};
        if (filter === 'favorites' && userId) opts.isFavoriteFor = userId;
        if (filter === 'org') opts.isOrgTemplate = true;
        if (filter === 'my' && userId) opts.authorId = userId;
        
        const data = await PresetORM.getAll(opts);
        setPresets(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchTags = async () => {
    try {
      const data = await PresetORM.getTags();
      setTags(data);
    } catch (err) {}
  };

  const toggleFavorite = async (presetId: string, isFav: boolean) => {
    if (!userId) return;
    try {
      await PresetORM.toggleFavorite(presetId, userId, !isFav);
      fetchPresets();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPresets = useMemo(() => {
    return presets.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && 
            !p.type.toLowerCase().includes(q)) return false;
      }
      if (capacityFilter !== 'all') {
        const cap = Number(p.capacity_kw);
        if (capacityFilter === '1-3' && (cap < 1 || cap > 3)) return false;
        if (capacityFilter === '3-5' && (cap <= 3 || cap > 5)) return false;
        if (capacityFilter === '5-10' && (cap <= 5 || cap > 10)) return false;
        if (capacityFilter === '10-20' && (cap <= 10 || cap > 20)) return false;
        if (capacityFilter === '20+' && cap <= 20) return false;
      }
      return true;
    });
  }, [presets, searchQuery, capacityFilter]);

  const handleSelect = async (preset: PresetRow) => {
    onSelectPreset(preset.calculator_state || preset.id);
    
    // Track usage
    if (userId) {
       await PresetORM.trackUsage(preset.id, userId).catch(() => {});
    }
    onClose();
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
      <div className="flex flex-col w-full max-w-6xl h-full max-h-[85vh] bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-active">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">System Presets</h2>
              <p className="text-xs text-text-muted">Load or manage calculator configurations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-lg text-text-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Layout */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-64 border-r border-border bg-surface-active/30 flex flex-col p-4 gap-6 overflow-y-auto">
            {/* Views */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-2">Views</div>
              <FilterBtn icon={<LayoutGrid size={16}/>} label="All Presets" active={filter==='all'} onClick={()=>setFilter('all')} />
              <FilterBtn icon={<Zap size={16}/>} label="Recently Used" active={filter==='recent'} onClick={()=>setFilter('recent')} />
              <FilterBtn icon={<Star size={16}/>} label="Favorites" active={filter==='favorites'} onClick={()=>setFilter('favorites')} />
              <FilterBtn icon={<Building2 size={16}/>} label="Org Templates" active={filter==='org'} onClick={()=>setFilter('org')} />
              <FilterBtn icon={<User size={16}/>} label="My Presets" active={filter==='my'} onClick={()=>setFilter('my')} />
            </div>

            {/* Capacity Navigator */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-2">Capacity Navigator</div>
              <FilterBtn label="All Capacities" active={capacityFilter==='all'} onClick={()=>setCapacityFilter('all')} />
              <FilterBtn label="1 – 3 kW" active={capacityFilter==='1-3'} onClick={()=>setCapacityFilter('1-3')} />
              <FilterBtn label="3 – 5 kW" active={capacityFilter==='3-5'} onClick={()=>setCapacityFilter('3-5')} />
              <FilterBtn label="5 – 10 kW" active={capacityFilter==='5-10'} onClick={()=>setCapacityFilter('5-10')} />
              <FilterBtn label="10 – 20 kW" active={capacityFilter==='10-20'} onClick={()=>setCapacityFilter('10-20')} />
              <FilterBtn label="20+ kW" active={capacityFilter==='20+'} onClick={()=>setCapacityFilter('20+')} />
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col bg-background overflow-hidden">
            
            {/* Search Bar */}
            <div className="p-4 border-b border-border bg-surface flex items-center gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by name, tags, panels..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary focus:border-accent/50 outline-none"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-text-muted">Loading presets...</div>
              ) : filteredPresets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <div className="p-4 rounded-full bg-surface-active mb-4"><Search size={24} /></div>
                  <p>No presets found matching your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPresets.map(preset => {
                    const isFav = (preset as any).preset_favorites?.some((f: any) => f.user_id === userId);
                    return (
                      <div key={preset.id} className="group relative flex flex-col bg-surface rounded-xl border border-border p-5 hover:border-accent/40 transition-colors cursor-pointer hover:shadow-lg hover:shadow-accent/5" onClick={() => handleSelect(preset)}>
                        
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-text-primary text-base line-clamp-1 pr-8">{preset.name}</h3>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id, isFav); }}
                            className={`absolute top-4 right-4 p-1.5 rounded-md transition-colors ${isFav ? 'text-amber-400 bg-amber-400/10' : 'text-text-muted hover:bg-surface-hover opacity-0 group-hover:opacity-100'}`}
                          >
                            <Star size={16} fill={isFav ? "currentColor" : "none"} />
                          </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent-dim text-accent">{preset.capacity_kw} kW</span>
                          {preset.is_org_template && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-500">Org Template</span>}
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-active text-text-secondary capitalize">{preset.type}</span>
                        </div>

                        <div className="flex-1 space-y-2 mb-4 text-xs text-text-secondary">
                           <div className="flex justify-between border-b border-border pb-1">
                             <span>Structure:</span>
                             <span className="font-medium text-text-primary">{preset.calculator_state?.structureType || 'None'}</span>
                           </div>
                           <div className="flex justify-between border-b border-border pb-1">
                             <span>Pricing Mode:</span>
                             <span className="font-medium text-text-primary capitalize">{preset.calculator_state?.structurePricingMode || 'Auto'}</span>
                           </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Tag size={12} /> 
                            { (preset as any).preset_tags?.length ? (preset as any).preset_tags.map((t: any) => t.name).join(', ') : 'No tags'}
                          </div>
                          <div className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={16} />
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FilterBtn({ icon, label, active, onClick }: { icon?: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-accent text-background font-semibold shadow-md' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
    >
      {icon && <span className={`${active ? 'text-background' : 'text-text-muted'}`}>{icon}</span>}
      {label}
    </button>
  );
}
