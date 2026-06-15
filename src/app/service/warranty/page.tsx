'use client';

import { useState } from 'react';
import { ShieldAlert, Plus, Search, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

const MOCK_CLAIMS = [
  { id: 'WTY-2026-091', customer: 'Raman LLC', component: 'Inverter (Sungrow 50kW)', status: 'Pending Approval', filedOn: '2026-06-10' },
  { id: 'WTY-2026-092', customer: 'Alpha Corp', component: 'Panel (Trina 540W)', status: 'Replacement Shipped', filedOn: '2026-06-05' },
];

export default function WarrantyClaimsPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Warranty Claims</h1>
          <p className="text-sm text-text-muted mt-1">Track and manage component warranty claims</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />}>
          New Claim
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search claims or customers..."
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
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Claim ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Component</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Filed On</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CLAIMS.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-hover/30">
                  <td className="px-4 py-3 font-mono text-xs text-accent">{c.id}</td>
                  <td className="px-4 py-3 text-text-primary font-medium">{c.customer}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.component}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.filedOn}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="info">
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
