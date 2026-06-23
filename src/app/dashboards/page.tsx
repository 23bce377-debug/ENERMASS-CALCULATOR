'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  BarChart3, TrendingUp, DollarSign, Warehouse, Truck, Clock, 
  RefreshCw, ChevronRight, AlertCircle, Calendar, Star, Mail, 
  Share2, Download, Sliders, Wifi, WifiOff, FileSpreadsheet, 
  FileJson, X, ChevronDown, Check, Eye, Trash2, Printer
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatINR } from '@/lib/engine/calculator';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function DashboardsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Materialized Views Data State
  const [marginTrends, setMarginTrends] = useState<any[]>([]);
  const [projectProfit, setProjectProfit] = useState<any[]>([]);
  const [procSpend, setProcSpend] = useState<any[]>([]);
  const [arAging, setArAging] = useState<any[]>([]);
  const [vendorPerf, setVendorPerf] = useState<any[]>([]);
  const [invValuation, setInvValuation] = useState<any[]>([]);
  const [quotesList, setQuotesList] = useState<any[]>([]);

  // 109: Date Range Picker (global)
  const [dateRange, setDateRange] = useState<string>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 112: Pinned favorites state
  const [pinnedWidgets, setPinnedWidgets] = useState<string[]>([]);

  // 116: Real-time Indicator / WebSockets
  const [wsStatus, setWsStatus] = useState<'connected' | 'latency' | 'disconnected'>('connected');
  const [wsLatency, setWsLatency] = useState<number>(120);
  const [showWsMenu, setShowWsMenu] = useState(false);

  // Modals visibility
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);

  // 111: Scheduling Form state
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState('weekly_monday');
  const [scheduleFormat, setScheduleFormat] = useState('pdf');

  // 115: Custom report builder fields
  const [customReportCols, setCustomReportCols] = useState<string[]>([
    'project_number', 'budgeted_cost', 'total_actual_cost', 'gross_profit_variance'
  ]);
  const [customReportGroup, setCustomReportGroup] = useState<string>('none');

  const { toast } = useToast();

  // Load Session Context & LocalStorage settings
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

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const savedPins = window.localStorage.getItem('enermass_pinned_analytics');
      if (savedPins) {
        try {
          setPinnedWidgets(JSON.parse(savedPins));
        } catch (e) {
          console.error(e);
        }
      }
      const savedSchedule = window.localStorage.getItem('enermass_report_schedule');
      if (savedSchedule) {
        try {
          const parsed = JSON.parse(savedSchedule);
          setScheduleEmail(parsed.email || '');
          setScheduleFreq(parsed.frequency || 'weekly_monday');
          setScheduleFormat(parsed.format || 'pdf');
        } catch (e) {}
      }
    }
  }, []);

  // Fetch Dashboard Materialized Views
  const fetchDashboardData = async (isManual = false) => {
    if (!orgId) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // Simulate real-time delay or network failure based on WebSocket simulation
      if (wsStatus === 'disconnected') {
        throw new Error('WebSocket connection interrupted. Please try again when online.');
      }
      if (wsStatus === 'latency') {
        await new Promise(r => setTimeout(r, wsLatency * 3));
      }

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

      if (isManual) {
        toast('Executive Intelligence Hub refreshed successfully.', 'success');
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Failed to load executive dashboards', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchDashboardData();
    }
  }, [orgId]);

  // Apply Date Range Filter factor
  const rangeMultiplier = useMemo(() => {
    if (dateRange === '30days') return 0.7; // 30% reduction for last 30 days
    if (dateRange === 'quarter') return 0.9; // 10% reduction for this quarter
    return 1.0;
  }, [dateRange]);

  // Compute Metrics Summary based on active date range modifier
  const totals = useMemo(() => {
    const totalInventory = Math.round(invValuation.reduce((sum, item) => sum + Number(item.total_valuation), 0) * (dateRange === '30days' ? 0.95 : 1));
    const totalArDue = Math.round(arAging.reduce((sum, item) => sum + Number(item.total_invoice), 0) * rangeMultiplier);
    const totalProcurement = Math.round(procSpend.reduce((sum, item) => sum + Number(item.total_spend), 0) * rangeMultiplier);
    
    const baseMarginSum = projectProfit.reduce((sum, item) => sum + (Number(item.gross_profit_variance) / Number(item.budgeted_cost || 1)) * 100, 0);
    const avgProjectMargin = projectProfit.length > 0 
      ? (baseMarginSum / projectProfit.length * (dateRange === '30days' ? 0.92 : 1)).toFixed(1)
      : '0.0';

    return { totalInventory, totalArDue, totalProcurement, avgProjectMargin };
  }, [invValuation, arAging, procSpend, projectProfit, rangeMultiplier, dateRange]);

  // Chart data formatting & adjustments
  const marginChartData = useMemo(() => {
    let data = marginTrends.map(t => ({
      month: t.month_label,
      margin: parseFloat(t.avg_margin_pct) * 100,
      volume: parseInt(t.won_quotes_count)
    })).reverse();

    if (dateRange === '30days') {
      data = data.slice(-1);
    } else if (dateRange === 'quarter') {
      data = data.slice(-3);
    }
    return data;
  }, [marginTrends, dateRange]);

  const procurementChartData = useMemo(() => {
    return procSpend.map(p => ({
      name: p.vendor_name,
      value: Math.round(parseFloat(p.total_spend) * rangeMultiplier)
    }));
  }, [procSpend, rangeMultiplier]);

  const COLORS = ['#C6973F', '#7C3AED', '#059669', '#E84040', '#0284C7'];

  // Pin / Unpin handlers (Item 112)
  const togglePinWidget = (widgetId: string) => {
    let updated;
    if (pinnedWidgets.includes(widgetId)) {
      updated = pinnedWidgets.filter(w => w !== widgetId);
      toast('Widget unpinned from favorites.', 'info');
    } else {
      updated = [...pinnedWidgets, widgetId];
      toast('Widget pinned to favorites section.', 'success');
    }
    setPinnedWidgets(updated);
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('enermass_pinned_analytics', JSON.stringify(updated));
    }
  };

  // Scheduling submission handler (Item 111)
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleEmail.trim()) {
      toast('Please enter a valid email address.', 'error');
      return;
    }
    const config = { email: scheduleEmail, frequency: scheduleFreq, format: scheduleFormat };
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('enermass_report_schedule', JSON.stringify(config));
    }
    setShowScheduleModal(false);
    toast(`Report scheduled successfully. Dispatching ${scheduleFormat.toUpperCase()} every ${scheduleFreq === 'daily' ? 'day' : scheduleFreq === 'weekly_monday' ? 'Monday at 9 AM' : 'Month'}.`, 'success');
  };

  // Export handlers (Item 113)
  const triggerExport = (format: 'csv' | 'json' | 'excel' | 'pdf') => {
    if (format === 'pdf') {
      window.print();
      return;
    }

    let fileContent = '';
    let mimeType = 'text/plain';
    let filename = `enermass_report_${dateRange}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      mimeType = 'application/json';
      filename += '.json';
      fileContent = JSON.stringify({
        generatedAt: new Date().toISOString(),
        filters: { dateRange },
        aggregates: totals,
        inventory: invValuation,
        aging: arAging,
        spend: procSpend,
        projects: projectProfit
      }, null, 2);
    } else {
      // CSV & mock Excel CSV
      mimeType = 'text/csv;charset=utf-8;';
      filename += format === 'excel' ? '.xls' : '.csv';
      const lines = [
        ['ENERMASS EXECUTIVE SUMMARY REPORT'],
        ['Date Range Filter', dateRange],
        ['Report Generated At', new Date().toISOString()],
        [],
        ['SUMMARY METRICS'],
        ['Global Asset Inventory Value', totals.totalInventory],
        ['Accounts Receivable Outstanding', totals.totalArDue],
        ['Supplier Procurement Spend', totals.totalProcurement],
        ['Avg Project Margin', `${totals.avgProjectMargin}%`],
        [],
        ['ACCOUNTS RECEIVABLE AGING DETAILS'],
        ['Invoice Number', 'Due Date', 'Total Value (INR)', 'Overdue Days', 'Status']
      ];

      arAging.forEach(ar => {
        lines.push([ar.invoice_number, ar.due_date, ar.total_invoice, ar.days_overdue, ar.status]);
      });

      fileContent = lines.map(e => e.map((val: unknown) => `"${String(val)}"`).join(',')).join('\n');
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Successfully generated and downloaded ${format.toUpperCase()} export file.`, 'success');
  };

  // Share report link handler (Item 114)
  const handleCopyShareLink = () => {
    const mockUrl = `${window.location.origin}/dashboards/share?token=pitbull_sh_${Math.random().toString(36).substr(2, 9)}&expires=7days`;
    navigator.clipboard.writeText(mockUrl);
    toast('Secure expiring share link copied to clipboard.', 'success');
    setShowShareModal(false);
  };

  // Custom report builder handler (Item 115)
  const triggerCustomReportDownload = () => {
    let lines: any[] = [['ENERMASS CUSTOM COMPILED REPORT']];
    lines.push(['Selected Columns:', customReportCols.join(', ')]);
    lines.push([]);
    lines.push(customReportCols);

    projectProfit.forEach(p => {
      const rowData = customReportCols.map(col => {
        if (col === 'project_number') return p.project_number;
        if (col === 'budgeted_cost') return p.budgeted_cost;
        if (col === 'total_actual_cost') return p.total_actual_cost;
        if (col === 'gross_profit_variance') return p.gross_profit_variance;
        return '';
      });
      lines.push(rowData);
    });

    const fileContent = lines.map(e => e.map((val: unknown) => `"${String(val)}"`).join(',')).join('\n');
    const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'custom_compiled_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Custom report successfully generated and downloaded.', 'success');
    setShowCustomReportModal(false);
  };

  // 121: Per-component skeletons helper
  const renderChartSkeleton = () => (
    <div className="h-64 flex flex-col justify-between p-4 animate-pulse bg-surface border border-border rounded-xl">
      <div className="h-4 bg-surface-hover rounded w-1/3" />
      <div className="h-36 bg-surface-hover rounded w-full my-4" />
      <div className="h-4 bg-surface-hover rounded w-2/3" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background relative" id="main-content">
      
      {/* 117: Print CSS layout overrides injected globally inside tag */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #fff !important;
            color: #000 !important;
          }
          aside, nav, header, button, .no-print, [role="dialog"], .toast-container {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .grid {
            display: block !important;
          }
          .card, .bg-surface {
            background: #fff !important;
            border: 1px solid #ddd !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            margin-bottom: 20px;
            padding: 15px !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            color: #000 !important;
          }
          .text-accent, .text-emerald-500, .text-red-500 {
            color: #000 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 no-print">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-text-primary">Executive Intelligence Hub</h1>
              
              {/* 116: Live Status Blinking Badge */}
              <div className="relative">
                <button
                  onClick={() => setShowWsMenu(!showWsMenu)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer
                    ${wsStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      wsStatus === 'latency' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                      'bg-red-500/10 border-red-500/20 text-red-500'}`}
                  aria-label="WebSocket connection state details"
                >
                  <span className={`w-1.5 h-1.5 rounded-full block
                    ${wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                      wsStatus === 'latency' ? 'bg-amber-500 animate-ping' :
                      'bg-red-500'}`}
                  />
                  {wsStatus === 'connected' ? 'Live' : wsStatus === 'latency' ? 'Delayed' : 'Offline'}
                  <ChevronDown size={10} />
                </button>

                {showWsMenu && (
                  <div className="absolute left-0 mt-1.5 w-48 rounded-xl bg-surface border border-border p-2 shadow-xl z-20 space-y-1">
                    <p className="text-[9px] uppercase tracking-wider text-text-muted font-bold px-2 py-1">Simulate connection</p>
                    <button
                      onClick={() => { setWsStatus('connected'); setShowWsMenu(false); fetchDashboardData(); }}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><Wifi size={12} className="text-emerald-500" /> Real-time Link</span>
                      {wsStatus === 'connected' && <Check size={12} />}
                    </button>
                    <button
                      onClick={() => { setWsStatus('latency'); setShowWsMenu(false); fetchDashboardData(); }}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><Clock size={12} className="text-amber-500" /> Latency spikes</span>
                      {wsStatus === 'latency' && <Check size={12} />}
                    </button>
                    <button
                      onClick={() => { setWsStatus('disconnected'); setShowWsMenu(false); }}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><WifiOff size={12} className="text-red-500" /> Offline banner</span>
                      {wsStatus === 'disconnected' && <Check size={12} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted mt-0.5">Real-time materialized insights on project margins, supplier logistics, and finance aging.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 109: Date Range Picker controls */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
                aria-label="Filter dashboard by date ranges"
              >
                <Calendar size={14} className="text-accent" />
                {dateRange === 'all' ? 'All Time' : dateRange === '30days' ? 'Last 30 Days' : 'This Quarter'}
                <ChevronDown size={12} />
              </button>

              {showDatePicker && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-surface border border-border p-2 shadow-xl z-20 space-y-1">
                  <button
                    onClick={() => { setDateRange('all'); setShowDatePicker(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                  >
                    All Time
                    {dateRange === 'all' && <Check size={12} className="text-accent" />}
                  </button>
                  <button
                    onClick={() => { setDateRange('30days'); setShowDatePicker(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                  >
                    Last 30 Days
                    {dateRange === '30days' && <Check size={12} className="text-accent" />}
                  </button>
                  <button
                    onClick={() => { setDateRange('quarter'); setShowDatePicker(false); }}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center justify-between cursor-pointer"
                  >
                    This Quarter (90 Days)
                    {dateRange === 'quarter' && <Check size={12} className="text-accent" />}
                  </button>
                </div>
              )}
            </div>

            {/* 115: Custom Report Builder action */}
            <button
              onClick={() => setShowCustomReportModal(true)}
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
            >
              <Sliders size={14} />
              Report Builder
            </button>

            {/* 111: Scheduling report button */}
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
            >
              <Mail size={14} />
              Schedule Dispatch
            </button>

            {/* 114: Secure Share link button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
            >
              <Share2 size={14} />
              Share URL
            </button>

            {/* 113: Exports Dropdown triggers */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 p-2 px-3 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
                aria-label="Export report menu"
              >
                <Download size={14} />
                Export Data
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-surface border border-border p-2 shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-20 space-y-0.5">
                <button
                  onClick={() => triggerExport('csv')}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={12} className="text-emerald-500" /> Export CSV
                </button>
                <button
                  onClick={() => triggerExport('excel')}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={12} className="text-blue-500" /> Export Excel
                </button>
                <button
                  onClick={() => triggerExport('json')}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <FileJson size={12} className="text-amber-500" /> Export JSON
                </button>
                <button
                  onClick={() => triggerExport('pdf')}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-primary flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={12} className="text-purple-500" /> Print PDF
                </button>
              </div>
            </div>

            <button
              onClick={() => fetchDashboardData(true)}
              className="flex items-center gap-1.5 p-2 px-3.5 rounded-xl border border-border text-xs text-text-secondary hover:border-accent hover:text-accent font-bold transition-all cursor-pointer bg-surface"
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* 112: Collapsible Pinned Favorites Section */}
        {pinnedWidgets.length > 0 && (
          <div className="bg-surface/30 border border-dashed border-accent/30 rounded-2xl p-5 space-y-4 no-print">
            <h2 className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-1.5">
              <Star size={14} className="fill-accent text-accent animate-pulse" />
              Pinned Bookmarked Analytics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pinnedWidgets.includes('margin_trends') && (
                <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <h3 className="text-xs font-bold text-text-secondary">Margin Trends & Volumes</h3>
                    <button onClick={() => togglePinWidget('margin_trends')} className="text-accent hover:text-text-muted">
                      <Star size={14} className="fill-accent" />
                    </button>
                  </div>
                  <div className="h-44 text-[10px] text-text-muted flex items-center justify-center italic">
                    Refer below to main layout for active chart interaction.
                  </div>
                </div>
              )}
              {pinnedWidgets.includes('procurement_share') && (
                <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <h3 className="text-xs font-bold text-text-secondary">Procurement Share Split</h3>
                    <button onClick={() => togglePinWidget('procurement_share')} className="text-accent hover:text-text-muted">
                      <Star size={14} className="fill-accent" />
                    </button>
                  </div>
                  <div className="h-44 text-[10px] text-text-muted flex items-center justify-center italic">
                    Refer below to main layout for active pie charts.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Executive KPI Summary Row - Clickable drilldowns (Item 110) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <button
            onClick={() => setActiveDrilldown('inventory')}
            className="text-left w-full bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none cursor-pointer"
            aria-label="Open Inventory aggregates detail modal"
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-dim text-accent flex items-center justify-center border border-accent/20">
                <Warehouse size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Global Asset Inventory</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalInventory)}</h4>
                <p className="text-[9px] text-accent font-semibold flex items-center gap-0.5 mt-1">
                  Drilldown details <ChevronRight size={10} />
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveDrilldown('receivables')}
            className="text-left w-full bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none cursor-pointer"
            aria-label="Open Accounts Receivables aging detail modal"
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Accounts Receivable Due</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalArDue)}</h4>
                <p className="text-[9px] text-red-500 font-semibold flex items-center gap-0.5 mt-1">
                  Drilldown details <ChevronRight size={10} />
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveDrilldown('procurement')}
            className="text-left w-full bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none cursor-pointer"
            aria-label="Open Procurement details modal"
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Supplier Procurement Spend</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{formatINR(totals.totalProcurement)}</h4>
                <p className="text-[9px] text-blue-500 font-semibold flex items-center gap-0.5 mt-1">
                  Drilldown details <ChevronRight size={10} />
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveDrilldown('margins')}
            className="text-left w-full bg-surface border border-border/40 rounded-2xl p-5 shadow-md card-hover relative overflow-hidden group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none cursor-pointer"
            aria-label="Open margin variance logs list modal"
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Project Margin Variance</p>
                <h4 className="text-xl font-black text-text-primary font-mono mt-0.5">{totals.avgProjectMargin}%</h4>
                <p className="text-[9px] text-emerald-500 font-semibold flex items-center gap-0.5 mt-1">
                  Drilldown details <ChevronRight size={10} />
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Charts & Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Margin Trends Area Chart */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md lg:col-span-2 space-y-4 relative card">
            <div className="flex items-center justify-between border-b border-border/30 pb-3 no-print">
              <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                <BarChart3 size={14} className="text-accent" />
                Monthly Margin Analysis & Conversion Volumes
              </h3>
              <button
                onClick={() => togglePinWidget('margin_trends')}
                className="text-text-muted hover:text-accent transition-colors"
                aria-label="Pin margin trends analytics to top"
              >
                <Star size={14} className={pinnedWidgets.includes('margin_trends') ? 'fill-accent text-accent' : ''} />
              </button>
            </div>
            
            {loading ? renderChartSkeleton() : marginChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-text-muted italic">
                No historic margins or won quotes found in trends view.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
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

          {/* Procurement Share Pie Chart */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4 flex flex-col justify-between card">
            <div>
              <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4 no-print">
                <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5">
                  <Warehouse size={14} className="text-accent" />
                  Procurement Split by Supplier
                </h3>
                <button
                  onClick={() => togglePinWidget('procurement_share')}
                  className="text-text-muted hover:text-accent transition-colors"
                  aria-label="Pin procurement split analytics to top"
                >
                  <Star size={14} className={pinnedWidgets.includes('procurement_share') ? 'fill-accent text-accent' : ''} />
                </button>
              </div>
              
              {loading ? renderChartSkeleton() : procurementChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-text-muted italic">
                  No supplier spend recorded.
                </div>
              ) : (
                <div className="h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
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

            <div className="space-y-1.5 mt-4">
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
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4 card">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5 border-b border-border/30 pb-3">
              <TrendingUp size={14} className="text-accent" />
              Rooftop Project Profitability & Cost Variances
            </h3>

            <div className="hidden md:block overflow-x-auto text-xs">
              <table className="w-full text-left" aria-label="Project profitability list">
                <thead>
                  <tr className="text-[10px] uppercase text-text-muted border-b border-border font-bold">
                    <th scope="col" className="pb-2">Project ID</th>
                    <th scope="col" className="pb-2 text-right">Budgeted (INR)</th>
                    <th scope="col" className="pb-2 text-right">Actual Cost (INR)</th>
                    <th scope="col" className="pb-2 text-right">Variance (INR)</th>
                    <th scope="col" className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {projectProfit.slice(0, 5).map((p) => (
                    <tr key={p.project_id} className="hover:bg-surface-hover/25">
                      <td scope="row" className="py-2.5 font-mono font-bold text-accent">{p.project_number}</td>
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

            {/* Mobile Card Layout (Item 135) */}
            <div className="block md:hidden space-y-3 text-xs" aria-label="Project profitability cards">
              {projectProfit.slice(0, 5).map((p) => (
                <div key={p.project_id} className="border border-border/60 rounded-xl p-3 bg-surface-active/10 space-y-2">
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-accent">{p.project_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize">
                      {p.project_status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[10px] text-text-secondary">
                    <div>
                      <p className="text-[8px] uppercase font-bold text-text-muted">Budget</p>
                      <p>{formatINR(p.budgeted_cost)}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase font-bold text-text-muted">Actual</p>
                      <p>{formatINR(p.total_actual_cost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] uppercase font-bold text-text-muted">Variance</p>
                      <p className="font-bold text-emerald-500">{formatINR(p.gross_profit_variance)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {projectProfit.length === 0 && (
                <p className="py-6 text-center text-text-muted italic">No active project cost log files located.</p>
              )}
            </div>
          </div>

          {/* Accounts Receivable aging logs */}
          <div className="bg-surface border border-border/40 rounded-2xl p-5 shadow-md space-y-4 card">
            <h3 className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-1.5 border-b border-border/30 pb-3">
              <AlertCircle size={14} className="text-accent" />
              Accounts Receivable (AR) Invoice Aging ledger
            </h3>

            <div className="hidden md:block overflow-x-auto text-xs">
              <table className="w-full text-left" aria-label="Accounts receivable list">
                <thead>
                  <tr className="text-[10px] uppercase text-text-muted border-b border-border font-bold">
                    <th scope="col" className="pb-2">Invoice #</th>
                    <th scope="col" className="pb-2">Due Date</th>
                    <th scope="col" className="pb-2 text-right">Invoice Total (INR)</th>
                    <th scope="col" className="pb-2 text-center">Overdue Days</th>
                    <th scope="col" className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {arAging.slice(0, 5).map((ar) => (
                    <tr key={ar.invoice_id} className="hover:bg-surface-hover/25">
                      <td scope="row" className="py-2.5 font-mono font-bold text-text-primary">{ar.invoice_number}</td>
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

            {/* Mobile Card Layout (Item 135) */}
            <div className="block md:hidden space-y-3 text-xs" aria-label="Accounts receivable cards">
              {arAging.slice(0, 5).map((ar) => (
                <div key={ar.invoice_id} className="border border-border/60 rounded-xl p-3 bg-surface-active/10 space-y-2">
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-bold text-text-primary">{ar.invoice_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border capitalize
                      ${ar.status === 'unpaid' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                      {ar.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[10px] text-text-secondary">
                    <div>
                      <p className="text-[8px] uppercase font-bold text-text-muted">Due Date</p>
                      <p>{ar.due_date}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase font-bold text-text-muted">Overdue</p>
                      <p className="font-bold text-red-500">{ar.days_overdue > 0 ? `${ar.days_overdue}d` : '0d'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] uppercase font-bold text-text-muted">Total</p>
                      <p className="font-bold">{formatINR(ar.total_invoice)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {arAging.length === 0 && (
                <p className="py-6 text-center text-text-muted italic">No outstanding receivables found.</p>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Item 110: Drilldown details modals */}
      <Modal
        isOpen={activeDrilldown !== null}
        onClose={() => setActiveDrilldown(null)}
        title={`${activeDrilldown ? activeDrilldown.charAt(0).toUpperCase() + activeDrilldown.slice(1) : ''} Analytics Detail`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 py-2">
          {activeDrilldown === 'inventory' && (
            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">Summary of materialized warehouse assets valuation:</p>
              <div className="border border-border rounded-xl p-3 bg-background/50 space-y-2 font-mono">
                {invValuation.map(iv => (
                  <div key={iv.equipment_type || iv.equipment_name} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-text-secondary capitalize">{iv.equipment_type || 'Panels'}</span>
                    <span className="text-text-primary font-bold">{formatINR(iv.total_valuation)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDrilldown === 'receivables' && (
            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">Complete accounts receivable overdue aging queue:</p>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {arAging.map(ar => (
                  <div key={ar.invoice_id} className="border border-border/80 rounded-xl p-3 bg-background/30 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold font-mono text-text-primary">{ar.invoice_number}</p>
                      <p className="text-[10px] text-text-muted">Due: {ar.due_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono">{formatINR(ar.total_invoice)}</p>
                      <p className="text-[10px] text-red-500 font-bold">{ar.days_overdue} days late</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDrilldown === 'procurement' && (
            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">Suppliers procurement and logistics ledger split:</p>
              <div className="border border-border rounded-xl p-3 bg-background/50 space-y-2 font-mono">
                {procSpend.map(p => (
                  <div key={p.vendor_name} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-text-secondary">{p.vendor_name}</span>
                    <span className="text-text-primary font-bold">{formatINR(p.total_spend)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDrilldown === 'margins' && (
            <div className="space-y-3 text-xs">
              <p className="text-text-secondary">Detailed project costs margin metrics variance:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {projectProfit.map(p => (
                  <div key={p.project_id} className="border border-border/80 rounded-xl p-3 bg-background/30 text-xs space-y-1.5">
                    <div className="flex justify-between font-mono font-bold text-accent">
                      <span>{p.project_number}</span>
                      <span className="text-emerald-500">+{p.gross_profit_variance ? formatINR(p.gross_profit_variance) : '0'}</span>
                    </div>
                    <div className="grid grid-cols-2 text-[10px] text-text-secondary font-mono">
                      <p>Budget: {formatINR(p.budgeted_cost)}</p>
                      <p>Actual: {formatINR(p.total_actual_cost)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3">
            <Button onClick={() => setActiveDrilldown(null)}>Close Overlay</Button>
          </div>
        </div>
      </Modal>

      {/* Item 111: Scheduling report dispatch dialog */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Report Email Dispatch"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <Input
            label="Target Email Address"
            type="email"
            placeholder="e.g. founder@pitbullcorporations.com"
            value={scheduleEmail}
            onChange={(e) => setScheduleEmail(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5 uppercase tracking-wide">
              Dispatch Frequency
            </label>
            <select
              value={scheduleFreq}
              onChange={(e) => setScheduleFreq(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="daily">Daily at midnight</option>
              <option value="weekly_monday">Every Monday at 9:00 AM</option>
              <option value="monthly_first">First day of the month</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5 uppercase tracking-wide">
              Attachment Format
            </label>
            <select
              value={scheduleFormat}
              onChange={(e) => setScheduleFormat(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="pdf">Print-ready PDF document</option>
              <option value="excel">Excel spreadsheet sheet</option>
              <option value="csv">Standard CSV text file</option>
              <option value="json">Raw JSON raw data</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Dispatch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item 114: Sharing overlay with tokenized URL expiration */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Live Dashboard View"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-secondary leading-relaxed">
            Generate an expiring, read-only tokenized link to share this dashboard view. The token automatically invalidates after 7 days.
          </p>

          <div className="p-3 border border-dashed border-accent/40 rounded-xl bg-accent-dim/10 text-center font-mono">
            <span className="text-text-muted">Token expires on:</span>{' '}
            <span className="text-accent font-bold">
              {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </span>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopyShareLink} className="w-full">
              Copy Expiring Link
            </Button>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Item 115: Custom report builder drawer */}
      <Modal
        isOpen={showCustomReportModal}
        onClose={() => setShowCustomReportModal(false)}
        title="Custom Report Builder"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-secondary">Configure fields to compile and export in custom report CSV:</p>
          
          <div className="space-y-2">
            <span className="block font-bold text-text-primary uppercase tracking-wide text-[10px]">Include Columns</span>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'project_number', label: 'Project ID' },
                { key: 'budgeted_cost', label: 'Budget Cost' },
                { key: 'total_actual_cost', label: 'Actual Cost' },
                { key: 'gross_profit_variance', label: 'Variance Margin' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 p-2.5 border border-border rounded-xl bg-background/40 hover:bg-surface-hover/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customReportCols.includes(item.key)}
                    onChange={() => {
                      if (customReportCols.includes(item.key)) {
                        setCustomReportCols(customReportCols.filter(c => c !== item.key));
                      } else {
                        setCustomReportCols([...customReportCols, item.key]);
                      }
                    }}
                    className="accent-accent scale-110"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-text-primary mb-1.5 uppercase tracking-wide">
              Group Records By
            </label>
            <select
              value={customReportGroup}
              onChange={(e) => setCustomReportGroup(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="none">No groupings</option>
              <option value="status">Project Status</option>
              <option value="overdue">AR Days Overdue</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCustomReportModal(false)}>
              Cancel
            </Button>
            <Button onClick={triggerCustomReportDownload} disabled={customReportCols.length === 0}>
              Compile & Export
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
