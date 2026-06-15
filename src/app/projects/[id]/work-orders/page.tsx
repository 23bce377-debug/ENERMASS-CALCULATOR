'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useConfirm } from '@/components/ui/Confirm';
import {
  Wrench,
  Calendar,
  User,
  Plus,
  FileText,
  MapPin,
  CheckCircle2,
  Clock,
  Printer
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

type WOStatus = 'Draft' | 'Issued' | 'In Progress' | 'Completed';

interface WorkOrder {
  id: string;
  title: string;
  subcontractor: string;
  startDate: string;
  endDate: string;
  status: WOStatus;
  amount: number;
}

const MOCK_WOS: WorkOrder[] = [
  {
    id: 'WO-26-001',
    title: 'Module Installation & Wiring',
    subcontractor: 'Apex Solar Installers Ltd.',
    startDate: '2026-06-15',
    endDate: '2026-06-20',
    status: 'Issued',
    amount: 45000,
  },
  {
    id: 'WO-26-002',
    title: 'Civil Works & Structure Base',
    subcontractor: 'BuildWell Contractors',
    startDate: '2026-06-10',
    endDate: '2026-06-14',
    status: 'Completed',
    amount: 18000,
  }
];

const STATUS_STYLES: Record<WOStatus, 'default' | 'success' | 'warning' | 'info' | 'outline'> = {
  'Draft': 'default',
  'Issued': 'info',
  'In Progress': 'warning',
  'Completed': 'success',
};

export default function WorkOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const confirm = useConfirm();

  const [wos, setWos] = useState<WorkOrder[]>(MOCK_WOS);

  const handleGenerateWO = async () => {
    const confirmed = await confirm({
      title: 'Generate New Work Order',
      message: 'Create a new work order draft for this project?',
      confirmLabel: 'Create Draft',
      cancelLabel: 'Cancel',
    });

    if (confirmed) {
      const newWO: WorkOrder = {
        id: `WO-26-00${wos.length + 1}`,
        title: 'New Subcontractor Task',
        subcontractor: 'Unassigned',
        startDate: 'TBD',
        endDate: 'TBD',
        status: 'Draft',
        amount: 0,
      };
      setWos([newWO, ...wos]);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <span className="hover:text-accent cursor-pointer" onClick={() => router.push('/projects')}>Projects</span>
            <span>/</span>
            <span className="hover:text-accent cursor-pointer" onClick={() => router.push(`/projects/${projectId}`)}>{projectId}</span>
            <span>/</span>
            <span className="text-text-primary font-medium">Work Orders</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Wrench className="text-accent" />
            Subcontractor Work Orders
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleGenerateWO}>
            Generate Work Order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - List */}
        <div className="md:col-span-2 space-y-4">
          {wos.map((wo) => (
            <Card key={wo.id} className="hover:border-accent/30 transition-colors group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-text-primary">{wo.title}</h3>
                    <Badge variant={STATUS_STYLES[wo.status]}>{wo.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                    <span className="flex items-center gap-1 font-mono text-accent">
                      <FileText size={14} /> {wo.id}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={14} /> {wo.subcontractor}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> {wo.startDate} to {wo.endDate}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Value</p>
                    <p className="font-mono font-bold text-text-primary">₹{wo.amount.toLocaleString('en-IN')}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="group-hover:bg-accent/10 group-hover:text-accent">
                    <Printer size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {wos.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Wrench className="mx-auto text-text-muted/50 mb-3" size={48} />
              <h3 className="text-lg font-bold text-text-primary">No Work Orders</h3>
              <p className="text-text-muted text-sm mt-1">Generate a work order to assign tasks to subcontractors.</p>
              <Button variant="outline" className="mt-4" onClick={handleGenerateWO}>
                Create First Work Order
              </Button>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-4">
          <Card className="bg-surface-hover/50">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-text-muted">Work Order Summary</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-text-secondary flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Completed</span>
                <span className="font-bold text-text-primary">{wos.filter(w => w.status === 'Completed').length}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-text-secondary flex items-center gap-2"><Clock size={16} className="text-warning" /> In Progress</span>
                <span className="font-bold text-text-primary">{wos.filter(w => w.status === 'In Progress' || w.status === 'Issued').length}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-text-primary font-bold">Total Allocated Value</span>
                <span className="font-mono font-bold text-accent text-lg">
                  ₹{wos.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-text-muted">Quick Actions</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm">Download All WOs (PDF)</Button>
              <Button variant="outline" className="w-full justify-start text-sm">Send Reminders to Subcontractors</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
