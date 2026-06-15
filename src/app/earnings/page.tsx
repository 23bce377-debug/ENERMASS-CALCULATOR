'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVendorsQuery, useBundlePresetsQuery } from '@/lib/hooks/useAcquisitions';
import { useSalesStatsQuery, useProcurementAnalyticsQuery } from '@/lib/hooks/useDashboard';
import { 
  BarChart3, TrendingUp, DollarSign, PieChart, ArrowUpRight, 
  ArrowDownRight, Briefcase, Layers, Users, Calendar, 
  AlertTriangle, Info, HelpCircle, Activity, ShoppingCart 
} from 'lucide-react';
import { formatINR } from '@/lib/engine/calculator';
import { Select } from '@/components/ui/Select';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Cell, AreaChart, Area, CartesianGrid, LineChart, Line, Legend 
} from 'recharts';

export default function EarningsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'procurement'>('sales');
  const [orgId, setOrgId] = useState<string | null>(null);

  // Procurement Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterVendorId, setFilterVendorId] = useState('');
  const [filterPresetId, setFilterPresetId] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from('profiles').select('org_id').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.org_id) {
              setOrgId(data.org_id);
            }
          });
      }
    });
  }, []);

  // Queries
  const { data: stats = { totalRevenue: 0, totalCost: 0, grossProfit: 0, marginPct: 0, wonQuotes: 0, pendingValue: 0 }, isLoading: salesLoading } = useSalesStatsQuery(orgId);
  
  const { data: procStats = null, isLoading: procLoading } = useProcurementAnalyticsQuery(
    { startDate: filterStartDate, endDate: filterEndDate, vendorId: filterVendorId, presetId: filterPresetId },
    !!orgId && activeTab === 'procurement'
  );

  const { data: vendorsList = [] } = useVendorsQuery(orgId);
  const { data: presetsList = [] } = useBundlePresetsQuery(orgId);

  const chartData = [
    { name: 'Revenue', value: stats.totalRevenue, color: '#C6973F' },
    { name: 'Cost', value: stats.totalCost, color: '#4B5563' },
    { name: 'Profit', value: stats.grossProfit, color: '#10B981' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-surface/50 border border-border/50 rounded-xl shadow-lg backdrop-blur-sm w-fit">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
              ${activeTab === 'sales' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
          >
            <TrendingUp size={16} />
            Sales Performance
          </button>
          <button
            onClick={() => setActiveTab('procurement')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
              ${activeTab === 'procurement' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-muted hover:text-text-secondary'}`}
          >
            <ShoppingCart size={16} />
            Procurement & Bundles
          </button>
        </div>

        {/* ─── SALES PERFORMANCE VIEW ────────────────────────────────────────── */}
        {activeTab === 'sales' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Revenue" 
                value={formatINR(stats.totalRevenue)} 
                icon={<DollarSign className="text-accent" />}
                trend="+12.5%" 
                trendUp={true}
              />
              <StatCard 
                title="Gross Profit" 
                value={formatINR(stats.grossProfit)} 
                icon={<TrendingUp className="text-success" />}
                trend={`${stats.marginPct.toFixed(1)}% margin`}
                trendUp={true}
              />
              <StatCard 
                title="Won Projects" 
                value={stats.wonQuotes.toString()} 
                icon={<Briefcase className="text-blue-500" />}
                trend="Active leads"
              />
              <StatCard 
                title="Pipeline Value" 
                value={formatINR(stats.pendingValue)} 
                icon={<PieChart className="text-purple-500" />}
                trend="Potential revenue"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue vs Cost Chart */}
              <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-md card-hover">
                <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                  <BarChart3 size={18} className="text-accent" />
                  Financial Overview
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: 'rgba(198, 151, 63, 0.05)'}}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-surface border border-border p-3 rounded-xl shadow-xl">
                                <p className="text-xs font-bold text-text-muted uppercase mb-1">{payload[0].payload.name}</p>
                                <p className="text-sm font-bold text-text-primary">{formatINR(payload[0].value as number)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Profit Breakdown */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-md card-hover flex flex-col">
                <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                  <PieChart size={18} className="text-accent" />
                  Margin Analysis
                </h3>
                <div className="flex-1 flex flex-col justify-center space-y-6">
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center w-32 h-32">
                      <div className="absolute inset-0 rounded-full border-8 border-accent/20 border-t-accent -rotate-90" />
                      <span className="text-2xl font-bold text-text-primary z-10">{stats.marginPct.toFixed(0)}%</span>
                    </div>
                    <p className="mt-4 text-sm text-text-muted">Average Net Margin</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-secondary">Direct Costs</span>
                      <span className="font-mono text-text-primary">{formatINR(stats.totalCost)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${100 - stats.marginPct}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-text-secondary">Gross Profit</span>
                      <span className="font-mono text-success font-bold">{formatINR(stats.grossProfit)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${stats.marginPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── PROCUREMENT & BUNDLES VIEW ────────────────────────────────────── */}
        {activeTab === 'procurement' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Filters Bar */}
            <div className="bg-surface border border-border rounded-2xl p-4 shadow-md flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center flex-1">
                <div className="flex items-center gap-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs">
                  <Calendar size={14} className="text-text-muted mr-1" />
                  <input 
                    type="date" 
                    value={filterStartDate} 
                    onChange={e => setFilterStartDate(e.target.value)} 
                    className="bg-transparent border-none text-text-primary outline-none focus:ring-0 w-28"
                  />
                  <span className="text-text-muted mx-1">to</span>
                  <input 
                    type="date" 
                    value={filterEndDate} 
                    onChange={e => setFilterEndDate(e.target.value)} 
                    className="bg-transparent border-none text-text-primary outline-none focus:ring-0 w-28"
                  />
                </div>

                <Select
                  value={filterVendorId}
                  onChange={setFilterVendorId}
                  placeholder="All Vendors"
                  options={[
                    { value: '', label: 'All Vendors' },
                    ...vendorsList.map((v: any) => ({ value: v.id, label: v.name }))
                  ]}
                  className="min-w-[160px]"
                />

                <Select
                  value={filterPresetId}
                  onChange={setFilterPresetId}
                  placeholder="All Bundle Presets"
                  options={[
                    { value: '', label: 'All Bundle Presets' },
                    ...presetsList.map((p: any) => ({ value: p.id, label: p.name }))
                  ]}
                  className="min-w-[180px] max-w-xs"
                />
              </div>

              {(filterStartDate || filterEndDate || filterVendorId || filterPresetId) && (
                <button
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterVendorId('');
                    setFilterPresetId('');
                  }}
                  className="text-xs font-bold text-accent hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {procLoading ? (
              <div className="py-24 text-center text-text-muted font-mono uppercase tracking-wider animate-pulse border border-border/40 rounded-2xl bg-surface">
                Loading procurement metrics...
              </div>
            ) : !procStats ? (
              <div className="py-24 text-center text-text-muted border border-border/40 rounded-2xl bg-surface">
                No procurement database history found to analyze.
              </div>
            ) : (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    title="Procurement Spend" 
                    value={formatINR(procStats.totalProcurementSpend)} 
                    icon={<ShoppingCart className="text-accent" />}
                    trend="Standalone & Bundles"
                  />
                  <StatCard 
                    title="Bundle spend" 
                    value={formatINR(procStats.totalBundleSpend)} 
                    icon={<Layers className="text-blue-500" />}
                    trend={`${Math.round(procStats.totalProcurementSpend > 0 ? (procStats.totalBundleProcureVal / procStats.totalProcurementSpend) * 100 : 0)}% of total PO spend`}
                    trendUp={true}
                  />
                  <StatCard 
                    title="Procurement Savings" 
                    value={formatINR(procStats.totalSavings)} 
                    icon={<TrendingUp className="text-success" />}
                    trend="Vs separate items cost"
                    trendUp={true}
                  />
                  <StatCard 
                    title="Bundle Adoption" 
                    value={`${Math.round(procStats.adoptionRate * 100)}%`} 
                    icon={<Activity className="text-purple-500" />}
                    trend="PO usage frequency"
                  />
                </div>

                {/* Alerts Widget */}
                {procStats.alerts && procStats.alerts.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
                    <AlertTriangle className="text-warning shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1.5 flex-1">
                      <h4 className="text-xs font-bold text-warning uppercase tracking-wider">Procurement & Margin Warnings</h4>
                      <ul className="text-xs text-text-secondary list-disc pl-4 space-y-1">
                        {procStats.alerts.map((alert: any, idx: number) => (
                          <li key={idx}>{alert.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Spend Trend Chart */}
                  <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-md card-hover">
                    <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-accent" />
                        Spend over time
                      </span>
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Last 6 Months (Incl. GST)</span>
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={procStats.trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2D333A" opacity={0.1} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-surface border border-border p-3 rounded-xl shadow-xl font-mono text-xs">
                                    <p className="font-bold text-text-muted uppercase mb-1.5">{payload[0].payload.month}</p>
                                    <p className="text-text-primary">Standard: {formatINR(payload[0].value as number)}</p>
                                    <p className="text-accent">Bundles: {formatINR(payload[1].value as number)}</p>
                                    <p className="font-bold text-text-primary border-t border-border mt-1 pt-1">
                                      Total: {formatINR(payload[0].payload.total)}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{fontSize: 12, paddingBottom: 10}} />
                          <Area type="monotone" dataKey="standard" name="Standard PO Items" stroke="#4B5563" fillOpacity={0.06} fill="#4B5563" />
                          <Area type="monotone" dataKey="bundle" name="Applied Bundles" stroke="#C6973F" fillOpacity={0.12} fill="#C6973F" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Margin Impact Won Quotes Trend */}
                  <div className="bg-surface border border-border rounded-2xl p-6 shadow-md card-hover flex flex-col">
                    <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                      <TrendingUp size={18} className="text-accent" />
                      Margin Trend (Won Quotes)
                    </h3>
                    {procStats.marginTrend && procStats.marginTrend.length > 0 ? (
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={procStats.marginTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2D333A" opacity={0.1} />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 10}} />
                              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 10}} unit="%" />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-surface border border-border px-3 py-2 rounded-xl shadow-xl text-xs">
                                        <p className="font-bold text-text-muted">{payload[0].payload.month}</p>
                                        <p className="font-bold text-accent font-mono mt-0.5">Margin: {payload[0].value}%</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line type="monotone" dataKey="margin" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="border-t border-border/20 pt-3 text-xs text-text-secondary leading-relaxed">
                          Shows average target net margin achieved in won customer quotes. Bundle volume discounts increase direct project profitability.
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                        No won projects history to show margin trends.
                      </div>
                    )}
                  </div>

                  {/* Left Bottom Category Cost Breakdown */}
                  <div className="bg-surface border border-border rounded-2xl p-6 shadow-md card-hover lg:col-span-2">
                    <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                      <PieChart size={18} className="text-accent" />
                      Category Breakdown (Bundles)
                    </h3>
                    {procStats.categoryBreakdown && procStats.categoryBreakdown.length > 0 ? (
                      <div className="space-y-4">
                        {procStats.categoryBreakdown.map((c: any) => {
                          const maxSpend = Math.max(...procStats.categoryBreakdown.map((x: any) => x.totalSpend), 1);
                          const pct = (c.totalSpend / maxSpend) * 100;
                          return (
                            <div key={c.category} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-text-primary uppercase tracking-wide">{c.category}</span>
                                <span className="font-mono text-text-secondary">
                                  {formatINR(c.totalSpend)} <span className="text-text-muted ml-1.5">(Avg: {formatINR(c.avgRate)}/unit)</span>
                                </span>
                              </div>
                              <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-text-muted">
                        No bundle items found in purchase orders.
                      </div>
                    )}
                  </div>

                  {/* Right Bottom Top Vendors & Presets */}
                  <div className="bg-surface border border-border rounded-2xl p-6 shadow-md card-hover flex flex-col space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <Users size={16} className="text-accent" />
                        Top Vendors by Bundle Spend
                      </h3>
                      <div className="space-y-2 text-xs">
                        {procStats.spendByVendor && procStats.spendByVendor.length > 0 ? (
                          procStats.spendByVendor.map((v: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                              <span className="font-semibold text-text-primary">{v.name}</span>
                              <span className="font-mono font-bold text-accent">{formatINR(v.value)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-text-muted">No vendor transactions found.</div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border/20 pt-4">
                      <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <Layers size={16} className="text-accent" />
                        Top Presets by Spend
                      </h3>
                      <div className="space-y-2 text-xs">
                        {procStats.spendByPreset && procStats.spendByPreset.length > 0 ? (
                          procStats.spendByPreset.map((p: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-0">
                              <span className="font-semibold text-text-primary truncate max-w-[180px]">{p.name}</span>
                              <span className="font-mono font-bold text-text-secondary">{formatINR(p.value)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-text-muted">No presets applied.</div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border/20 pt-4 flex justify-between items-center text-xs">
                      <span className="text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={14} className="text-accent" />
                        Net Inventory Addition:
                      </span>
                      <span className="font-mono font-black text-success text-sm">{formatINR(procStats.inventoryMovement)}</span>
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendUp }: { title: string; value: string; icon: React.ReactNode; trend?: string; trendUp?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:border-accent/30 transition-all group card-hover inner-glow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 rounded-xl bg-background border border-border group-hover:border-accent/20 group-hover:bg-accent-dim transition-all duration-300">
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-background border border-border ${trendUp ? 'text-success border-success/20' : 'text-text-muted'}`}>
            {trendUp ? <ArrowUpRight size={12} /> : null}
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">{title}</p>
        <h3 className="text-2xl font-extrabold text-text-primary font-mono tracking-tight group-hover:text-accent transition-colors">
          {value}
        </h3>
      </div>
    </div>
  );
}
