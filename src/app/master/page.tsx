'use client';

import Link from 'next/link';
import {
  Sun,
  Cpu,
  Battery,
  Wrench,
  Package,
  Truck,
  Tag,
  Percent,
  Clock,
  History,
  ArrowRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { getOrgContext } from '@/lib/hooks/useMasters';

// Master data card specifications
const CARDS = [
  {
    href: '/master/panels',
    label: 'Panels Master',
    desc: 'Manage solar PV panel specifications, wattage values, panel types, and rates.',
    icon: <Sun size={24} className="text-amber-500" />,
    entity: 'panels',
    table: 'eq_panels',
  },
  {
    href: '/master/inverters',
    label: 'Inverters Master',
    desc: 'Configure power electronics, inverter capacities, phase types, and purchase costs.',
    icon: <Cpu size={24} className="text-emerald-500" />,
    entity: 'inverters',
    table: 'eq_inverters',
  },
  {
    href: '/master/batteries',
    label: 'Batteries Master',
    desc: 'Define backup chemistry details, LFP capacity ratings, and unit voltages.',
    icon: <Battery size={24} className="text-purple-500" />,
    entity: 'batteries',
    table: 'eq_batteries',
  },
  {
    href: '/master/structures',
    label: 'Structures Master',
    desc: 'Set mounting structure weight lookup values and metal raw material rates.',
    icon: <Wrench size={24} className="text-indigo-500" />,
    entity: 'structures',
    table: 'eq_mounting_structures',
  },
  {
    href: '/master/accessories',
    label: 'Accessories Master',
    desc: 'Standardize ACDB, DCDB boxes, earthing rods, solar cabling, and transport logs.',
    icon: <Package size={24} className="text-sky-500" />,
    entity: 'accessories',
    table: 'eq_bom_items',
  },
  {
    href: '/master/vendors',
    label: 'Vendors Master',
    desc: 'Directory of approved solar engineering manufacturers, address files, and GSTNs.',
    icon: <Truck size={24} className="text-blue-500" />,
    entity: 'vendors',
    table: 'vendors',
  },
  {
    href: '/master/pricing',
    label: 'Pricing Master',
    desc: 'View unified equipment catalog rates and set baseline override parameters.',
    icon: <Tag size={24} className="text-rose-500" />,
    entity: 'pricing',
    table: 'eq_bom_items',
  },
  {
    href: '/master/subsidy',
    label: 'Subsidy Master',
    desc: 'Maintain PM Surya Ghar slabs, piecewise calculations, and state subsidy values.',
    icon: <Percent size={24} className="text-teal-500" />,
    entity: 'subsidy',
    table: 'calculation_schemes',
  },
];

export default function MastersDashboardPage() {
  // 1. Fetch counts for dashboard indicators
  const { data: counts } = useQuery({
    queryKey: ['masters', 'dashboard', 'counts'],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      
      const countsMap: Record<string, number> = {};
      
      const fetchCount = async (table: string, orgIsolation: boolean = false) => {
        let q = supabase.from(table as any).select('id', { count: 'exact', head: true });
        if (table !== 'calculation_schemes') {
          if (orgIsolation) {
            if (orgId) {
              q = q.eq('org_id', orgId);
            } else {
              q = q.is('org_id', null);
            }
          } else {
            if (orgId) {
              q = q.or(`org_id.eq.${orgId},org_id.is.null`);
            } else {
              q = q.is('org_id', null);
            }
          }
        }
        if (table !== 'vendors') {
          q = q.eq('is_active', true);
        }
        const { count, error } = await q;
        return error ? 0 : count || 0;
      };

      await Promise.all([
        fetchCount('eq_panels').then(c => countsMap.panels = c),
        fetchCount('eq_inverters').then(c => countsMap.inverters = c),
        fetchCount('eq_batteries').then(c => countsMap.batteries = c),
        fetchCount('eq_mounting_structures').then(c => countsMap.structures = c),
        fetchCount('eq_bom_items').then(c => countsMap.accessories = c),
        fetchCount('vendors', true).then(c => countsMap.vendors = c),
        fetchCount('eq_bom_items', true).then(c => countsMap.pricing = c),
        fetchCount('calculation_schemes').then(c => countsMap.subsidy = c),
      ]);

      return countsMap;
    }
  });

  // 2. Fetch recent change logs
  const { data: recentChanges } = useQuery({
    queryKey: ['masters', 'dashboard', 'recent-changes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_data_changes_log')
        .select('*')
        .order('logged_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Fetch recent audit logs
  const { data: recentAudits } = useQuery({
    queryKey: ['masters', 'dashboard', 'recent-audits'],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      const { data, error } = await supabase
        .from('sys_audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          ERP Masters Dashboard
        </h1>
        <p className="text-xs text-text-muted mt-0.5">
          Central directory panel to standardize equipment specifications, installer references, and subsidy grids.
        </p>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((card) => {
          const itemCount = counts?.[card.entity] ?? 0;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group card card-hover p-5 flex flex-col justify-between h-48 border border-border relative overflow-hidden"
            >
              {/* Decorative Glow */}
              <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />

              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/10 transition-colors">
                    {card.icon}
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-secondary">
                    {itemCount} {card.entity === 'vendors' ? 'vendors' : card.entity === 'subsidy' ? 'schemes' : card.entity === 'pricing' ? 'overrides' : 'items'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-text-primary mt-4 group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {card.label}
                  <ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
                <p className="text-[11px] text-text-muted mt-1 leading-normal">
                  {card.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Log Feed Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Revision Logs */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 mb-4">
            <History size={14} className="text-accent" />
            Revision History (Import / DB Changes)
          </h2>
          {recentChanges && recentChanges.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {recentChanges.map((log: any) => (
                <div key={log.id} className="p-3 rounded-lg bg-background border border-border/40 text-xs flex justify-between items-start gap-4">
                  <div>
                    <span className="font-semibold text-text-primary capitalize block">
                      {log.entity_type.replace('eq_', '').replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      ID: {log.entity_id.split('-')[0]}... · Action: <strong className="text-accent">{log.change_type}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted text-right">
                    {new Date(log.logged_at).toLocaleDateString()}
                    <span className="block text-[9px]">{new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted py-8 text-center italic">No recent changes logged.</p>
          )}
        </div>

        {/* Audit Logs */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 mb-4">
            <Clock size={14} className="text-accent" />
            Active Audit Logs (Platform Actions)
          </h2>
          {recentAudits && recentAudits.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {recentAudits.map((log: any) => (
                <div key={log.id} className="p-3 rounded-lg bg-background border border-border/40 text-xs flex justify-between items-start gap-4">
                  <div>
                    <span className="font-semibold text-text-primary capitalize block">
                      {log.action.replace('_', ' ')}: {log.entity_type.replace('eq_', '').replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                      <UserCheck size={11} className="text-accent/80" />
                      {log.actor?.full_name || 'Admin'}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted text-right">
                    {new Date(log.created_at).toLocaleDateString()}
                    <span className="block text-[9px]">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted py-8 text-center italic">No platform actions audited.</p>
          )}
        </div>
      </div>
    </div>
  );
}
