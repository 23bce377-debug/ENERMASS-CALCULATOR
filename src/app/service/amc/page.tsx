'use client';

import { useState } from 'react';
import { Settings, Calendar, Plus, Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

const MOCK_CONTRACTS = [
  { id: 'AMC-2026-001', customer: 'Global Tech Park', type: 'Comprehensive', status: 'Active', nextVisit: '2026-07-15', visitsLeft: 3 },
  { id: 'AMC-2026-002', customer: 'Sunrise Hospitals', type: 'Non-Comprehensive', status: 'Active', nextVisit: '2026-06-20', visitsLeft: 1 },
  { id: 'AMC-2026-003', customer: 'City Mall', type: 'Preventive', status: 'Expiring', nextVisit: '2026-06-18', visitsLeft: 0 },
];

export default function AMCContractsPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AMC Contracts</h1>
          <p className="text-sm text-text-muted mt-1">Manage Annual Maintenance Contracts and Auto-Scheduled Visits</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />}>
          New AMC Contract
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search contracts or customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Contract ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Next Visit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Visits Left</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CONTRACTS.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-hover/30">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{c.id}</td>
                  <td className="px-4 py-3 text-text-primary font-medium">{c.customer}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.type}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-info" /> {c.nextVisit}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-text-secondary">{c.visitsLeft}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.status === 'Active' ? 'success' : 'warning'}>
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
