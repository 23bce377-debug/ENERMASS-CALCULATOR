'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  BarChart3, TrendingUp, DollarSign, Package, Users, 
  Warehouse, Truck, Clock, RefreshCw, ChevronRight, 
  ArrowUpRight, AlertCircle, FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatINR } from '@/lib/engine/calculator';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';

export default function DashboardsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Materialized Views Data State
  const [marginTrends, setMarginTrends] = useState<any[]>([]);
  const [projectProfit, setProjectProfit] = useState<any[]>([]);
  const [procSpend, setProcSpend] = useState<any[]>([]);
  const [arAging, setArAging] = useState<any[]>([]);
  const [vendorPerf, setVendorPerf] = useState<any[]>([]);
  const [invValuation, setInvValuation] = useState<any[]>([]);
  const [quotesList, setQuotesList] = useState<any[]>([]);

  const { toast } = useToast();

  // Load Session Context
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', session.user.id)
          .single();
        if (profile?.org_id) {
          setOrgId(profile.org_id);
        }
      }
    });
  }, []);

  // Fetch Dashboard Materialized Views
  const fetchDashboardData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Margin Trends
      const { data: mtData } = await supabase
        .from('v_margin_trends')
        .select('*')
        .eq('org_id', orgId);
      setMarginTrends(mtData || []);

      // 2. Project Profitability
      const { data: ppData } = await supabase
        .from('v_project_profitability')
        .select('*')
        .eq('org_id', orgId)
        .limit(10);
      setProjectProfit(ppData || []);

      // 3. Procurement Spend
      const { data: psData } = await supabase
        .from('v_procurement_spend')
        .select('*')
        .eq('org_id', orgId);
      setProcSpend(psData || []);

      // 4. AR Aging
      const { data: arData } = await supabase
        .from('v_ar_aging')
        .select('*')
        .eq('org_id', orgId)
        .order('days_overdue', { ascending: false });
      setArAging(arData || []);

      // 5. Vendor Performance
      const { data: vpData } = await supabase
        .from('v_vendor_performance')
        .select('*')
        .eq('org_id', orgId);
      setVendorPerf(vpData || []);

      // 6. Inventory Valuation
      const { data: ivData } = await supabase
        .from('v_inventory_valuation')
        .select('*')
        .eq('org_id', orgId);
      setInvValuation(ivData || []);

      // 7. Recent Quotes from v_quote_summary
      const { data: quotesData } = await supabase
        .from('v_quote_summary')
        .select('*')
        .limit(5);
      setQuotesList(quotesData || []);

    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Failed to load executive dashboards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchDashboardData();
    }
  }, [orgId]);

  // Compute Metrics Summary
  const totals = useMemo(() => {
    const totalInventory = invValuation.reduce((sum, item) => sum + Number(item.total_valuation), 0);
    const totalArDue = arAging.reduce((sum, item) => sum + Number(item.total_invoice), 0);
    const totalProcurement = procSpend.reduce((sum, item) => sum + Number(item.total_spend), 0);
    const avgProjectMargin = projectProfit.length > 0 
      ? (projectProfit.reduce((sum, item) => sum + (Number(item.gross_profit_variance) / Number(item.budgeted_cost || 1)) * 100, 0) / projectProfit.length).toFixed(1)
      : '0.0';

    return { totalInventory, totalArDue, totalProcurement, avgProjectMargin };
  }, [invValuation, arAging, procSpend, projectProfit]);

  // Chart data formatting
  const marginChartData = useMemo(() => {
    return marginTrends.map(t => ({
      month: t.month_label,
      margin: parseFloat(t.avg_margin_pct) * 100,
      volume: parseInt(t.won_quotes_count)
    })).reverse();
  }, [marginTrends]);

  const procurementChartData = useMemo(() => {
    return procSpend.map(p => ({
      name: p.vendor_name,
      value: parseFloat(p.total_spend)
    }));
  }, [procSpend]);

  const COLORS = ['#C6973F', '#7C3AED', '#059669', '#E84040', '#0284C7'];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Executive Intelligence Hub</h1>
            <p className="text-sm text-text-muted mt-0.5">Real-time materialized insights on project margins, supplier logistics, and finance aging.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 p-2 px-3.5 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Intelligence
          </button>
        </div>

        {/* Executive KPI Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-dim text-accent flex items-center justify-center border border-accent/20">
                <Warehouse size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Global Asset Inventory</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalInventory)}</h4>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Accounts Receivable Due</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalArDue)}</h4>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Supplier Procurement Spend</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalProcurement)}</h4>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Project Margin Variance</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{totals.avgProjectMargin}%</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Charts & Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* margin Trends Area Chart (Left 2 cols) */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                <BarChart3 size={14} className="text-accent" />
                Monthly Margin Analysis & Conversion Volumes
              </h3>
            </div>
            
            {loading ? (
              <div className="h-64 flex items-center justify-center text-xs text-text-muted font-mono animate-pulse uppercase tracking-wider">
                Loading Charts...
              </div>
            ) : marginChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-text-muted italic">
                No historic margins or won quotes found in trends view.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={marginChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C6973F" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#C6973F" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
                    <Area type="monotone" dataKey="margin" stroke="#C6973F" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMargin)" name="Avg Margin %" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Procurement Share Pie Chart (Right 1 col) */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5 border-b border-border/30 pb-3 mb-4">
                <Warehouse size={14} className="text-accent" />
                Procurement Split by Supplier
              </h3>
              
              {loading ? (
                <div className="h-48 flex items-center justify-center text-xs text-text-muted font-mono animate-pulse uppercase tracking-wider">
                  Loading Share...
                </div>
              ) : procurementChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-text-muted italic">
                  No supplier spend recorded.
                </div>
              ) : (
                <div className="h-48 relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={procurementChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {procurementChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatINR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {procurementChartData.slice(0, 3).map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                    <span className="text-text-secondary truncate">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-text-primary shrink-0">{formatINR(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Materialized ledger grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Project Profitability variances */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5 border-b border-border/30 pb-3">
              <TrendingUp size={14} className="text-accent" />
              Rooftop Project Profitability & Cost Variances
            </h3>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-text-muted border-b border-border font-bold">
                    <th className="pb-2">Project ID</th>
                    <th className="pb-2 text-right">Budgeted (INR)</th>
                    <th className="pb-2 text-right">Actual Cost (INR)</th>
                    <th className="pb-2 text-right">variance (INR)</th>
                    <th className="pb-2 text-right">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {projectProfit.slice(0, 5).map((p) => (
                    <tr key={p.project_id} className="hover:bg-surface-hover/25">
                      <td className="py-2.5 font-mono font-bold text-accent">{p.project_number}</td>
                      <td className="py-2.5 text-right font-mono">{formatINR(p.budgeted_cost)}</td>
                      <td className="py-2.5 text-right font-mono">{formatINR(p.total_actual_cost)}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-500">
                        {formatINR(p.gross_profit_variance)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize">
                          {p.project_status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {projectProfit.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted italic">
                        No active project cost log files located.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Accounts Receivable aging logs */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5 border-b border-border/30 pb-3">
              <AlertCircle size={14} className="text-accent" />
              Accounts Receivable (AR) Invoice Aging ledger
            </h3>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-text-muted border-b border-border font-bold">
                    <th className="pb-2">Invoice #</th>
                    <th className="pb-2">Due Date</th>
                    <th className="pb-2 text-right">Invoice Total (INR)</th>
                    <th className="pb-2 text-center">Overdue Days</th>
                    <th className="pb-2 text-right">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {arAging.slice(0, 5).map((ar) => (
                    <tr key={ar.invoice_id} className="hover:bg-surface-hover/25">
                      <td className="py-2.5 font-mono font-bold text-text-primary">{ar.invoice_number}</td>
                      <td className="py-2.5 text-text-secondary">{ar.due_date}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{formatINR(ar.total_invoice)}</td>
                      <td className="py-2.5 text-center font-mono font-bold text-red-500">
                        {ar.days_overdue > 0 ? `${ar.days_overdue} days` : '0 days'}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border capitalize
                          ${ar.status === 'unpaid' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          {ar.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {arAging.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted italic">
                        No outstanding receivables found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
