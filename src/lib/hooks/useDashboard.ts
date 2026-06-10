import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase/client';

export function useSalesStatsQuery(orgId: string | null) {
  return useQuery({
    queryKey: ['salesStats', orgId],
    queryFn: async () => {
      if (!orgId) return {
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        marginPct: 0,
        wonQuotes: 0,
        pendingValue: 0,
      };
      const { data: quotes, error } = await (supabase as any)
        .from('quotes')
        .select('final_customer_price, total_incl_gst, status')
        .eq('org_id', orgId);
      
      if (error) throw error;

      const won = (quotes as any[] || []).filter((q: any) => q.status === 'won');
      const pending = (quotes as any[] || []).filter((q: any) => q.status === 'sent' || q.status === 'draft');

      const totalRevenue = won.reduce((sum: number, q: any) => sum + Number(q.final_customer_price || 0), 0);
      const totalCost = won.reduce((sum: number, q: any) => sum + Number(q.total_incl_gst || 0), 0);
      const grossProfit = totalRevenue - totalCost;
      const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const pendingValue = pending.reduce((sum: number, q: any) => sum + Number(q.final_customer_price || 0), 0);

      return {
        totalRevenue,
        totalCost,
        grossProfit,
        marginPct,
        wonQuotes: won.length,
        pendingValue,
      };
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });
}

export function useProcurementAnalyticsQuery(
  filters: { startDate: string; endDate: string; vendorId: string; presetId: string },
  enabled: boolean
) {
  const { startDate, endDate, vendorId, presetId } = filters;
  return useQuery({
    queryKey: ['procurementAnalytics', { startDate, endDate, vendorId, presetId }],
    queryFn: async () => {
      const query = new URLSearchParams({
        startDate,
        endDate,
        vendorId,
        presetId
      }).toString();
      const res = await fetch(`/api/procurement/analytics?${query}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });
}
