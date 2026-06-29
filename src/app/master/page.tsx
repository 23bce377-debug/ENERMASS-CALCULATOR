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
  UserCheck,
  FileText
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { getOrgContext } from '@/lib/hooks/useMasters';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { UpgradePrompt } from '@/components/saas/UpgradePrompt';

// Master data card specifications
const CARDS = [
  {
    href: '/master/panels',
    label: 'Panels Master',
    desc: 'Manage solar PV panel specifications, wattage values, panel types, and rates.',
    icon: <Sun size={24} className="text-amber-500" />,
    entity: 'panels',
    table: 'eq_panels',
    hoverBorder: 'hover:border-amber-500/30 group-hover:border-amber-500/30',
    glow: 'bg-amber-500/5',
    iconBgHover: 'group-hover:bg-amber-500/10',
  },
  {
    href: '/master/inverters',
    label: 'Inverters Master',
    desc: 'Configure power electronics, inverter capacities, phase types, and purchase costs.',
    icon: <Cpu size={24} className="text-emerald-500" />,
    entity: 'inverters',
    table: 'eq_inverters',
    hoverBorder: 'hover:border-emerald-500/30 group-hover:border-emerald-500/30',
    glow: 'bg-emerald-500/5',
    iconBgHover: 'group-hover:bg-emerald-500/10',
  },
  {
    href: '/master/batteries',
    label: 'Batteries Master',
    desc: 'Define backup chemistry details, LFP capacity ratings, and unit voltages.',
    icon: <Battery size={24} className="text-purple-500" />,
    entity: 'batteries',
    table: 'eq_batteries',
    hoverBorder: 'hover:border-purple-500/30 group-hover:border-purple-500/30',
    glow: 'bg-purple-500/5',
    iconBgHover: 'group-hover:bg-purple-500/10',
  },
  {
    href: '/master/pricing',
    label: 'Pricing Master',
    desc: 'View unified equipment catalog rates and set baseline override parameters.',
    icon: <Tag size={24} className="text-rose-500" />,
    entity: 'pricing',
    table: 'rate_master',
    hoverBorder: 'hover:border-rose-500/30 group-hover:border-rose-500/30',
    glow: 'bg-rose-500/5',
    iconBgHover: 'group-hover:bg-rose-500/10',
  },
  {
    href: '/master/structures',
    label: 'Structures Master',
    desc: 'Set mounting structure weight lookup values and metal raw material rates.',
    icon: <Wrench size={24} className="text-indigo-500" />,
    entity: 'structures',
    table: 'eq_mounting_structures',
    hoverBorder: 'hover:border-indigo-500/30 group-hover:border-indigo-500/30',
    glow: 'bg-indigo-500/5',
    iconBgHover: 'group-hover:bg-indigo-500/10',
  },
  {
    href: '/master/accessories',
    label: 'Accessories Master',
    desc: 'Standardize ACDB, DCDB boxes, earthing rods, solar cabling, and transport logs.',
    icon: <Package size={24} className="text-sky-500" />,
    entity: 'accessories',
    table: 'bom_template_items',
    hoverBorder: 'hover:border-sky-500/30 group-hover:border-sky-500/30',
    glow: 'bg-sky-500/5',
    iconBgHover: 'group-hover:bg-sky-500/10',
  },
  {
    href: '/master/vendors',
    label: 'Vendors Master',
    desc: 'Directory of approved solar engineering manufacturers, address files, and GSTNs.',
    icon: <Truck size={24} className="text-blue-500" />,
    entity: 'vendors',
    table: 'vendors',
    hoverBorder: 'hover:border-blue-500/30 group-hover:border-blue-500/30',
    glow: 'bg-blue-500/5',
    iconBgHover: 'group-hover:bg-blue-500/10',
  },
  {
    href: '/master/subsidy',
    label: 'Subsidy Master',
    desc: 'Maintain PM Surya Ghar slabs, piecewise calculations, and state subsidy values.',
    icon: <Percent size={24} className="text-teal-500" />,
    entity: 'subsidy',
    table: 'calculation_schemes',
    hoverBorder: 'hover:border-teal-500/30 group-hover:border-teal-500/30',
    glow: 'bg-teal-500/5',
    iconBgHover: 'group-hover:bg-teal-500/10',
  },
  {
    href: '/master/terms',
    label: 'Terms Master',
    desc: 'Edit global and state-wise quotation terms printed in proposal PDFs.',
    icon: <FileText size={24} className="text-orange-500" />,
    entity: 'terms',
    table: 'state_terms_templates',
    hoverBorder: 'hover:border-orange-500/30 group-hover:border-orange-500/30',
    glow: 'bg-orange-500/5',
    iconBgHover: 'group-hover:bg-orange-500/10',
  },
];

export default function MastersDashboardPage() {
  const { isFeatureEnabled, isLoading } = useSubscription();

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
        fetchCount('bom_template_items').then(c => countsMap.accessories = c),
        fetchCount('vendors', true).then(c => countsMap.vendors = c),
        fetchCount('rate_master', true).then(c => countsMap.pricing = c),
        fetchCount('calculation_schemes').then(c => countsMap.subsidy = c),
        fetchCount('state_terms_templates').then(c => countsMap.terms = c),
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

  if (isLoading) return null;
  if (!isFeatureEnabled('master_data')) {
    return <UpgradePrompt featureName="Master Data Directory" />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          Price Masters Dashboard
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
              className={`group card card-hover p-6 flex flex-col justify-between h-48 border border-border relative overflow-hidden transition-all duration-300 ${card.hoverBorder}`}
            >
              {/* Decorative Glow */}
              <div className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full ${card.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl`} />

              <div>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg bg-surface-hover ${card.iconBgHover} transition-colors duration-300`}>
                    {card.icon}
                  </div>
                  <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-text-primary transition-colors group-hover:border-accent/30 group-hover:text-accent">
                    {itemCount} {card.entity === 'vendors' ? 'vendors' : card.entity === 'subsidy' ? 'schemes' : card.entity === 'pricing' ? 'overrides' : card.entity === 'terms' ? 'templates' : 'items'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-text-primary mt-4 group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {card.label}
                  <ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </h3>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
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
