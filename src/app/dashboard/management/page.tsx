'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

export default function ManagementDashboardPage() {
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
              <p className="text-xl font-bold text-text-primary">₹14.5 Cr</p>
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
              <p className="text-xl font-bold text-text-primary">18.2%</p>
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
              <p className="text-xl font-bold text-text-primary">42</p>
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
              <tr className="border-b border-border/50 hover:bg-surface-hover/30">
                <td className="px-4 py-3 text-text-primary font-medium">PRJ-2026-01 (City Mall)</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹1,20,00,000</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹1,25,00,000</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹1,45,00,000</td>
                <td className="px-4 py-3 text-right text-success font-medium">13.8%</td>
              </tr>
              <tr className="border-b border-border/50 hover:bg-surface-hover/30">
                <td className="px-4 py-3 text-text-primary font-medium">PRJ-2026-02 (Tech Park)</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹85,00,000</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹82,00,000</td>
                <td className="px-4 py-3 text-right text-text-secondary">₹1,05,00,000</td>
                <td className="px-4 py-3 text-right text-success font-medium">21.9%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
