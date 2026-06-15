import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { SurveyORM, type SurveyRow, type SurveyInsert, type SurveyUpdate } from '@/backend/orm/survey';

// ─── Query: Survey by Lead ───────────────────────────────────────────────────

export function useSurveyByLeadId(leadId: string | null) {
  return useQuery<SurveyRow | null>({
    queryKey: ['survey-lead', leadId],
    queryFn: () => SurveyORM.getLatestByLeadId(leadId!),
    enabled: !!leadId,
    staleTime: 1000 * 30,
  });
}

// ─── Query: Survey by Quote (for gate check + summary card) ─────────────────

export function useSurveyByQuoteId(quoteNumber: string | null) {
  return useQuery<SurveyRow | null>({
    queryKey: ['survey-quote', quoteNumber],
    queryFn: () => SurveyORM.getByQuoteId(quoteNumber!),
    enabled: !!quoteNumber,
    staleTime: 1000 * 30,
  });
}

// ─── Gate Check ─────────────────────────────────────────────────────────────

export function useSurveyGateCheck(quoteNumber: string | null) {
  return useQuery<{ blocked: boolean; survey: SurveyRow | null }>({
    queryKey: ['survey-gate', quoteNumber],
    queryFn: () => SurveyORM.checkGate(quoteNumber!),
    enabled: !!quoteNumber,
    staleTime: 0, // Always fresh for gate checks
  });
}

// ─── Mutation: Create Survey ─────────────────────────────────────────────────

export function useCreateSurveyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SurveyInsert) => SurveyORM.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-lead', data.lead_id] });
      if (data.quote_id) {
        queryClient.invalidateQueries({ queryKey: ['survey-quote'] });
        queryClient.invalidateQueries({ queryKey: ['survey-gate'] });
      }
    },
  });
}

// ─── Mutation: Update Survey ─────────────────────────────────────────────────

export function useUpdateSurveyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: SurveyUpdate }) =>
      SurveyORM.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-lead', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['survey-gate'] });
      queryClient.invalidateQueries({ queryKey: ['survey-quote'] });
    },
  });
}

// ─── Mutation: Waive Survey ──────────────────────────────────────────────────

export function useWaiveSurveyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      orgId,
      waivedById,
      reason,
      quoteId,
    }: {
      leadId: string;
      orgId: string;
      waivedById: string;
      reason: string;
      quoteId?: string;
    }) => SurveyORM.waive(leadId, orgId, waivedById, reason, quoteId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-lead', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['survey-gate'] });
      queryClient.invalidateQueries({ queryKey: ['survey-quote'] });
    },
  });
}

// ─── Helper: Fetch lead_id for a quote ──────────────────────────────────────

export async function fetchLeadIdForQuote(quoteNumber: string): Promise<string | null> {
  const { data } = await supabase
    .from('quotes')
    .select('lead_id')
    .eq('quote_number', quoteNumber)
    .maybeSingle();
  return data?.lead_id ?? null;
}
