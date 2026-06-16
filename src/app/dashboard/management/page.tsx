'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ManagementDashboardPage() {
  const [data, setData] = useState<{
    totalRevenue: number;
    avgMargin: number;
    activeProjectsCount: number;
    profitability: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard/management');
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 text-text-muted">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Management Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Project Profitability and Corporate KPIs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 text-accent rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-text-muted">Total Revenue (YTD)</p>
              <p className="text-xl font-bold text-text-primary">{data ? formatINR(data.totalRevenue) : '₹0'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 text-success rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-text-muted">Avg Margin</p>
              <p className="text-xl font-bold text-text-primary">{data ? formatPercent(data.avgMargin) : '0%'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 text-info rounded-lg">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-text-muted">Active Projects</p>
              <p className="text-xl font-bold text-text-primary">{data?.activeProjectsCount || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <BarChart3 size={18} /> Project Profitability (v_project_profitability)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Project</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Est. Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Actual Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data?.profitability && data.profitability.length > 0 ? (
                data.profitability.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover/30">
                    <td className="px-4 py-3 text-text-primary font-medium">{p.project_code} ({p.project_name})</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{formatINR(Number(p.estimated_cost))}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{formatINR(Number(p.actual_cost))}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{formatINR(Number(p.revenue))}</td>
                    <td className="px-4 py-3 text-right text-success font-medium">{formatPercent(Number(p.margin_pct))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-muted">No projects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
