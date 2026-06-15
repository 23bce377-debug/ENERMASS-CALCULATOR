import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectORM, type Project, type ProjectMilestone, type SiteSurvey } from '@/backend/orm/project';
import { supabase } from '@/lib/supabase/client';

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useProjectsQuery(orgId: string | null) {
  return useQuery<any[]>({
    queryKey: ['projects', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return ProjectORM.getAll(orgId) as any;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });
}

export function useProjectDetailsQuery(projectId: string | null) {
  return useQuery<any>({
    queryKey: ['project-details', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return ProjectORM.getById(projectId) as any;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2, // 2 minutes details cache validity
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useUpdateProjectStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      status,
      version,
      orgId
    }: {
      projectId: string;
      status: string;
      version: number;
      orgId: string;
    }) => {
      return ProjectORM.updateStatus(projectId, status, version);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['project-details', variables.projectId] });
    }
  });
}

export function useAssignPMMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      pmId,
      orgId
    }: {
      projectId: string;
      pmId: string | null;
      orgId: string;
    }) => {
      return ProjectORM.assignPM(projectId, pmId);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['project-details', variables.projectId] });
    }
  });
}

export function useUpdateMilestoneMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      milestoneId,
      status,
      actualDate,
      userId,
      projectId,
      orgId
    }: {
      milestoneId: string;
      status: 'pending' | 'completed' | 'overdue';
      actualDate: string | null;
      userId?: string;
      projectId: string;
      orgId: string;
    }) => {
      return ProjectORM.updateMilestone(milestoneId, status, actualDate, userId);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['project-details', variables.projectId] });
    }
  });
}

export function useSaveSiteSurveyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      survey,
      projectId,
      orgId
    }: {
      survey: Partial<SiteSurvey>;
      projectId: string;
      orgId: string;
    }) => {
      return ProjectORM.saveSiteSurvey(survey);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['project-details', variables.projectId] });
    }
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: {
      orgId: string;
      userId: string;
      projectNumber: string;
      plannedStart?: string | null;
      plannedEnd?: string | null;
      quoteId?: string | null;
      isManual: boolean;
      customerName?: string;
      customerPhone?: string;
      projectType?: string;
      capacityKw?: number;
      assignedPmId?: string | null;
    }) => {
      let finalQuoteId = variables.quoteId;

      if (variables.isManual) {
        const quoteNumber = `QT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const { data: qData, error: qErr } = await (supabase.from('quotes') as any)
          .insert({
            org_id: variables.orgId,
            quote_number: quoteNumber,
            customer_name: variables.customerName,
            customer_phone: variables.customerPhone || '—',
            project_type: variables.projectType || 'residential',
            system_capacity_kw: variables.capacityKw || 5,
            status: 'won',
            created_by: variables.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        if (qErr) throw qErr;
        finalQuoteId = qData.id;
      } else if (finalQuoteId) {
        const { error: quoteUpdateErr } = await (supabase.from('quotes') as any)
          .update({ status: 'won', updated_at: new Date().toISOString() })
          .eq('id', finalQuoteId);
        if (quoteUpdateErr) {
          console.warn('[useCreateProjectMutation] Failed to update quote status to won:', quoteUpdateErr);
        }
      }

      return ProjectORM.create({
        org_id: variables.orgId,
        quote_id: finalQuoteId,
        project_number: variables.projectNumber,
        status: 'survey_phase',
        planned_start: variables.plannedStart || null,
        planned_end: variables.plannedEnd || null,
        assigned_pm_id: variables.assignedPmId || null
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.orgId] });
    }
  });
}
