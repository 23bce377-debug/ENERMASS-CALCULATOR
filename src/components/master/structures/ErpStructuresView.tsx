import React from 'react';
import { Package2, Scale, Layers, Milestone, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export const ErpStructuresView = React.memo(function ErpStructuresView({
  erpSubTab,
  setErpSubTab
}: {
  erpSubTab: 'vendors' | 'templates' | 'addons';
  setErpSubTab: (tab: 'vendors' | 'templates' | 'addons') => void;
}) {
  const { data: erpVendors } = useQuery<any[]>({
    queryKey: ['erp-vendors'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('vendors').select('*').eq('is_structure_vendor', true).order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erpRates } = useQuery<any[]>({
    queryKey: ['erp-rates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('structure_material_rates').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erpTemplates } = useQuery<any[]>({
    queryKey: ['erp-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('structure_templates').select('*').order('capacity_kw');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erpTemplateItems } = useQuery<any[]>({
    queryKey: ['erp-template-items'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('structure_template_items').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erpWalkways } = useQuery<any[]>({
    queryKey: ['erp-walkways'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('walkway_templates').select('*').order('template');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: erpLadders } = useQuery<any[]>({
    queryKey: ['erp-ladders'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('ladder_templates').select('*').order('template');
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setErpSubTab('templates')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            erpSubTab === 'templates'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Capacity Templates
        </button>
        <button
          onClick={() => setErpSubTab('vendors')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            erpSubTab === 'vendors'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Vendors & Material Rates
        </button>
        <button
          onClick={() => setErpSubTab('addons')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            erpSubTab === 'addons'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Walkways & Ladders
        </button>
      </div>

      {erpSubTab === 'vendors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vendors List */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <Package2 size={16} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Vendors List</h3>
            </div>
            <div className="divide-y divide-border/60">
              {erpVendors?.map((v: any) => (
                <div key={v.id} className="px-5 py-3.5 flex items-center justify-between text-xs hover:bg-surface-hover/25">
                  <span className="font-semibold text-text-primary">{v.name}</span>
                  <span className="text-text-muted font-mono text-[10px]">ID: {v.id.substring(0, 8)}...</span>
                </div>
              ))}
              {(!erpVendors || erpVendors.length === 0) && (
                <div className="p-8 text-center text-text-muted italic">No vendors found.</div>
              )}
            </div>
          </div>

          {/* Material Rates */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <Scale size={16} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Vendor Material Rates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="bg-surface-hover/30 border-b border-border text-[10px] text-text-muted uppercase font-bold">
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Material Type</th>
                    <th className="py-2.5 px-4 text-right">Rate per kg</th>
                  </tr>
                </thead>
                <tbody>
                  {erpRates?.map((rate: any) => {
                    const vendor = erpVendors?.find((v: any) => v.id === rate.vendor_id);
                    return (
                      <tr key={rate.id} className="border-b border-border/40 hover:bg-surface-hover/20">
                        <td className="py-3 px-4 font-semibold text-text-primary">{vendor?.name || 'Unknown'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rate.material_type === 'GI' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {rate.material_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-accent font-bold">₹{Number(rate.rate_per_kg).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {(!erpRates || erpRates.length === 0) && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-text-muted italic font-sans">No material rates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {erpSubTab === 'templates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {erpTemplates?.map((template: any) => {
              const items = erpTemplateItems?.filter((i: any) => i.template_id === template.id);
              const primaryItems = items?.filter((i: any) => i.item.toLowerCase().includes('rafter') || i.item.toLowerCase().includes('purlin'));
              const accessories = items?.filter((i: any) => !i.item.toLowerCase().includes('rafter') && !i.item.toLowerCase().includes('purlin'));

              return (
                <div key={template.id} className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col">
                  <div className="px-5 py-4 bg-surface-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-accent" />
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        {template.capacity_kw}kW Template
                      </h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      template.structure_type === 'GI' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {template.structure_type} ({template.panel_count} Panels)
                    </span>
                  </div>

                  <div className="p-5 flex-1 space-y-4">
                    {/* Primary Steel Members */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                        Primary Steel Members
                      </span>
                      <div className="rounded-lg border border-border bg-background/50 divide-y divide-border/40 overflow-hidden">
                        {primaryItems?.map((item: any) => {
                          const itemVendor = erpVendors?.find((v: any) => v.id === item.vendor_id);
                          return (
                            <div key={item.id} className="px-4 py-2.5 flex items-center justify-between text-xs font-mono">
                              <div className="flex flex-col">
                                <span className="font-semibold text-text-primary font-sans">{item.item}</span>
                                {itemVendor && (
                                  <span className="text-[9px] text-accent uppercase font-bold mt-0.5">
                                    Vendor-specific: {itemVendor.name}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-text-secondary">{item.qty} Nos</span>
                                {item.weight && (
                                  <span className="text-[10px] text-text-muted block mt-0.5">
                                    {item.weight} kg/unit
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {(!primaryItems || primaryItems.length === 0) && (
                          <div className="p-4 text-center text-text-muted italic">No primary steel members defined.</div>
                        )}
                      </div>
                    </div>

                    {/* Accessories */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                        Accessory Items
                      </span>
                      <div className="rounded-lg border border-border bg-background/50 divide-y divide-border/40 overflow-hidden max-h-48 overflow-y-auto">
                        {accessories?.map((item: any) => (
                          <div key={item.id} className="px-4 py-2.5 flex items-center justify-between text-xs font-mono">
                            <span className="text-text-primary font-sans">{item.item}</span>
                            <span className="text-text-secondary font-bold">{item.qty} Qty</span>
                          </div>
                        ))}
                        {(!accessories || accessories.length === 0) && (
                          <div className="p-4 text-center text-text-muted italic">No accessories defined.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {erpSubTab === 'addons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Walkway Templates */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <Milestone size={16} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Walkway Templates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="bg-surface-hover/30 border-b border-border text-[10px] text-text-muted uppercase font-bold">
                    <th className="py-2.5 px-4">Template</th>
                    <th className="py-2.5 px-4 text-right">Length</th>
                    <th className="py-2.5 px-4 text-right">Total Cost</th>
                    <th className="py-2.5 px-4 text-right">Per Meter Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {erpWalkways?.map((w: any) => (
                    <tr key={w.id} className="border-b border-border/40 hover:bg-surface-hover/20">
                      <td className="py-3.5 px-4 font-semibold text-text-primary font-sans uppercase">{w.template.replace(/_/g, ' ')}</td>
                      <td className="py-3.5 px-4 text-right">{w.length_m} m</td>
                      <td className="py-3.5 px-4 text-right text-text-secondary">₹{Number(w.cost).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-right text-accent font-bold">₹{Number(w.cost_per_meter).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!erpWalkways || erpWalkways.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-muted italic font-sans">No walkway templates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ladder Templates */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">Ladder Templates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="bg-surface-hover/30 border-b border-border text-[10px] text-text-muted uppercase font-bold">
                    <th className="py-2.5 px-4">Template</th>
                    <th className="py-2.5 px-4 text-right">Height</th>
                    <th className="py-2.5 px-4 text-right">Total Cost</th>
                    <th className="py-2.5 px-4 text-right">Per Meter Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {erpLadders?.map((w: any) => (
                    <tr key={w.id} className="border-b border-border/40 hover:bg-surface-hover/20">
                      <td className="py-3.5 px-4 font-semibold text-text-primary font-sans uppercase">{w.template.replace(/_/g, ' ')}</td>
                      <td className="py-3.5 px-4 text-right">{w.length_m} m</td>
                      <td className="py-3.5 px-4 text-right text-text-secondary">₹{Number(w.cost).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-right text-accent font-bold">₹{Number(w.cost_per_meter).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!erpLadders || erpLadders.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-muted italic font-sans">No ladder templates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
