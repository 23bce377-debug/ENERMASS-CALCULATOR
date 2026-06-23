/**
 * Centralized query key factory for TanStack Query
 * Ensures consistency across queries and makes invalidation easier.
 */

export const queryKeys = {
  // Master data
  master: {
    all: ['master'] as const,
    equipment: (orgId: string | null) => [...queryKeys.master.all, 'equipment', orgId] as const,
    structures: (orgId: string | null) => [...queryKeys.master.all, 'structures', orgId] as const,
    rules: (orgId: string | null) => [...queryKeys.master.all, 'rules', orgId] as const,
    orgContext: (orgId: string | null) => [...queryKeys.master.all, 'orgContext', orgId] as const,
  },
  
  // Projects
  projects: {
    all: (orgId: string | null) => ['projects', orgId] as const,
    detail: (projectId: string | null) => ['project-details', projectId] as const,
  },
  
  // Quotes
  quotes: {
    all: (orgId: string | null) => ['quotes', orgId] as const,
    detail: (quoteId: string | null) => ['quote-details', quoteId] as const,
  },

  // Subscriptions & Auth
  auth: {
    session: ['auth-session'] as const,
    profile: (userId: string | null) => ['profile', userId] as const,
  }
};
