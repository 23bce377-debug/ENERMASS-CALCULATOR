import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatINR } from '@/lib/engine/calculator';

interface Schedule {
  id: string;
  milestone_name: string;
  trigger_event: string;
  percent: number;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  payment_reference: string | null;
}

export function FinanceTimeline({ quoteId }: { quoteId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedules() {
      const { data } = await supabase
        .from('payment_schedules')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });
        
      if (data) setSchedules(data);
      setLoading(false);
    }
    loadSchedules();
  }, [quoteId]);

  if (loading) return <div className="text-sm text-text-muted">Loading timeline...</div>;
  if (schedules.length === 0) return <div className="text-sm text-text-muted">No payment schedule found.</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text-primary text-lg">Customer Payment Schedule</h3>
      <div className="relative border-l border-border ml-3 space-y-6 pb-4">
        {schedules.map((ms, index) => {
          const isPaid = !!ms.paid_at;
          const isDue = !!ms.due_date && !isPaid;
          const isPending = !isPaid && !isDue;
          
          return (
            <div key={ms.id} className="relative pl-6">
              <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${
                isPaid ? 'bg-success' : isDue ? 'bg-warning-dark' : 'bg-border'
              }`} />
              
              <div className="flex flex-col sm:flex-row sm:justify-between items-start">
                <div>
                  <h4 className={`text-sm font-bold ${isPaid ? 'text-success' : 'text-text-primary'}`}>
                    {ms.milestone_name} ({ms.percent}%)
                  </h4>
                  <p className="text-xs text-text-muted mt-1">Trigger: {ms.trigger_event.replace('_', ' ')}</p>
                  {isPaid && ms.paid_at && (
                    <p className="text-xs text-text-muted mt-0.5">Paid on: {new Date(ms.paid_at).toLocaleDateString()}</p>
                  )}
                  {isDue && ms.due_date && (
                    <p className="text-xs text-warning-dark mt-0.5">Due since: {new Date(ms.due_date).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                  <div className="text-base font-bold text-text-primary">{formatINR(ms.amount)}</div>
                  <div className={`text-xs mt-1 font-semibold ${
                    isPaid ? 'text-success' : isDue ? 'text-warning-dark' : 'text-text-muted'
                  }`}>
                    {isPaid ? 'PAID' : isDue ? 'DUE NOW' : 'PENDING'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
