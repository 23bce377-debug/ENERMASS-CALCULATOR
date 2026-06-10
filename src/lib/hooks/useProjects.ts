import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectORM, type Project, type ProjectMilestone, type SiteSurvey } from '@/backend/orm/project';

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
