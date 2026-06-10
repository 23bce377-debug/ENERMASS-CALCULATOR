import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';

// ─── Common Helper ────────────────────────────────────────────────────────────

export async function getOrgContext() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Unauthorized');
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', session.user.id)
    .single();
    
  if (error || !profile) throw new Error('Profile not found');
  return { userId: session.user.id, orgId: profile.org_id, role: profile.role };
}

async function logAudit(
  orgId: string,
  userId: string,
  module: string,
  entityType: string,
  entityId: string,
  action: string,
  beforeState: any,
  afterState: any
) {
  try {
    await supabase.from('sys_audit_logs').insert({
      org_id: orgId,
      module,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: userId,
      before_state: beforeState,
      after_state: afterState,
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ─── Generic Masters Fetch / Mutation Hooks ───────────────────────────────────

function getEntityTable(entity: string): string {
  if (entity === 'vendors') return 'vendors';
  if (entity === 'pricing') return 'rate_master';
  if (entity === 'subsidy') return 'calculation_schemes';
  if (entity === 'accessories') return 'eq_bom_items';
  if (entity === 'structures') return 'eq_mounting_structures';
  return `eq_${entity}`;
}

export function useMasterQuery<T>(entity: string, options?: any) {
  return useQuery<T[]>({
    queryKey: ['masters', entity],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      const table = getEntityTable(entity);

      let query = supabase.from(table as any).select('*');
      
      // Enforce organisation filtering
      if (entity === 'vendors' || entity === 'pricing') {
        query = query.eq('org_id', orgId);
      } else if (entity === 'subsidy') {
        // Subsidy schemes can be global or org specific
        query = query.or(`org_id.eq.${orgId},org_id.is.null`);
      } else {
        // Equipment tables allow either global default (org_id is null) or org overrides
        query = query.or(`org_id.eq.${orgId},org_id.is.null`);
      }

      if (entity !== 'pricing') {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as T[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache validity
    ...options
  });
}

export function useMasterCreateMutation<T>(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: any) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      const payload = { ...newItem, org_id: orgId };
      const { data, error } = await (supabase
        .from(table as any)
        .insert(payload)
        .select()
        .single() as any);

      if (error) throw error;

      // Log Audit Event
      await logAudit(orgId, userId, 'masters', table, data.id, 'create', null, data);
      return data as T;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['masters', entity] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'dashboard'] });
    }
  });
}

export function useMasterUpdateMutation<T>(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // 1. Fetch current values for audit comparison
      const { data: beforeState } = await (supabase.from(table as any).select('*').eq('id', id).single() as any);

      // 2. Perform update
      const { data, error } = await (supabase
        .from(table as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single() as any);

      if (error) throw error;

      // Log Audit Event
      await logAudit(orgId, userId, 'masters', table, id, 'update', beforeState, data);
      
      // Write to master data changes log for revision history if it's master equipment or details
      await supabase.from('master_data_changes_log').insert({
        entity_type: table,
        entity_id: id,
        change_type: 'updated',
        old_values: beforeState,
        new_values: data,
      });

      return data as T;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['masters', entity] });
    }
  });
}

export function useMasterDeleteMutation(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // Fetch before deleting
      const { data: beforeState } = await (supabase.from(table as any).select('*').eq('id', id).single() as any);

      // Perform soft delete by default or hard delete for rate overrides / connections
      let error;
      if (entity === 'pricing') {
        const res = await supabase.from(table as any).delete().eq('id', id);
        error = res.error;
      } else {
        const res = await supabase
          .from(table as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        error = res.error;
      }

      if (error) throw error;

      // Log Audit Event
      await logAudit(orgId, userId, 'masters', table, id, 'delete', beforeState, null);
      
      // Log to changes list
      await supabase.from('master_data_changes_log').insert({
        entity_type: table,
        entity_id: id,
        change_type: 'deleted',
        old_values: beforeState,
        new_values: null,
      });

      return id;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['masters', entity] });
      queryClient.invalidateQueries({ queryKey: ['masters', 'dashboard'] });
    }
  });
}

export function useMasterBulkUpdateMutation(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: any }) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // 1. Fetch current values for audit comparison
      const { data: beforeStates } = await (supabase
        .from(table as any)
        .select('*')
        .in('id', ids) as any);

      // 2. Perform updates row by row (or in bulk if fields allow)
      // Since it's a bulk operation on a relational database, doing updates in batch matches Supabase syntax
      const promises = ids.map(async (id) => {
        const before = beforeStates?.find((b: any) => b.id === id);
        const { data, error } = await (supabase
          .from(table as any)
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single() as any);
        if (error) throw error;

        // Log Audit Event for each
        await logAudit(orgId, userId, 'masters', table, id, 'bulk_update', before, data);
        
        await supabase.from('master_data_changes_log').insert({
          entity_type: table,
          entity_id: id,
          change_type: 'updated',
          old_values: before,
          new_values: data,
        });

        return data;
      });

      const results = await Promise.all(promises);
      return results;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['masters', entity] });
    }
  });
}

// ─── Version & Audit Logs Query Hooks ────────────────────────────────────────

export function useAuditLogsQuery(entityTable: string, entityId?: string) {
  return useQuery({
    queryKey: ['audit-logs', entityTable, entityId],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      let query = supabase
        .from('sys_audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('org_id', orgId)
        .eq('entity_type', entityTable)
        .order('created_at', { ascending: false });

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

export function useChangesLogQuery(entityTable: string, entityId?: string) {
  return useQuery({
    queryKey: ['changes-log', entityTable, entityId],
    queryFn: async () => {
      let query = supabase
        .from('master_data_changes_log')
        .select('*')
        .eq('entity_type', entityTable)
        .order('logged_at', { ascending: false });

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });
}

// ─── Subsidy / Slabs Specific Hooks ──────────────────────────────────────────

export function useSubsidySchemesQuery() {
  return useQuery({
    queryKey: ['masters', 'subsidy'],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      const { data, error } = await (supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)')
        .or(`org_id.eq.${orgId},org_id.is.null`)
        .eq('is_active', true)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache validity
  });
}

export function useUpdateSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schemeId, updates, slabs }: { schemeId: string; updates: any; slabs: any[] }) => {
      const { orgId, userId } = await getOrgContext();

      // 1. Fetch current scheme for audit
      const { data: beforeScheme } = await (supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)')
        .eq('id', schemeId)
        .single() as any);

      // 2. Update scheme
      const { data: scheme, error: schemeErr } = await (supabase
        .from('calculation_schemes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', schemeId)
        .select()
        .single() as any);

      if (schemeErr) throw schemeErr;

      // 3. Upsert scheme slabs
      if (slabs && slabs.length > 0) {
        // Delete all old slabs first to refresh indexes properly
        await supabase.from('scheme_slabs').delete().eq('scheme_id', schemeId);
        
        const slabsToInsert = slabs.map((s, idx) => ({
          scheme_id: schemeId,
          slab_index: idx + 1,
          start_kw: parseFloat(s.startKW ?? s.start_kw),
          end_kw: s.endKW || s.end_kw ? parseFloat(s.endKW ?? s.end_kw) : null,
          rate_per_kw: parseFloat(s.ratePerKW ?? s.rate_per_kw ?? 0),
          is_fixed_amount: s.isFixedAmount ?? s.is_fixed_amount ?? false,
          fixed_amount: s.fixedAmount || s.fixed_amount ? parseFloat(s.fixedAmount ?? s.fixed_amount) : null,
        }));

        const { error: slabsErr } = await supabase.from('scheme_slabs').insert(slabsToInsert);
        if (slabsErr) throw slabsErr;
      }

      // 4. Log Audit Trail
      const { data: afterScheme } = await (supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)')
        .eq('id', schemeId)
        .single() as any);

      await logAudit(orgId, userId, 'masters', 'calculation_schemes', schemeId, 'update', beforeScheme, afterScheme);
      
      await supabase.from('master_data_changes_log').insert({
        entity_type: 'calculation_schemes',
        entity_id: schemeId,
        change_type: 'updated',
        old_values: beforeScheme,
        new_values: afterScheme,
      });

      return afterScheme;
    },
    onSuccess: async () => {
      try {
        const { revalidateMasterCache } = await import('@/app/actions/revalidateMasters');
        await revalidateMasterCache();
      } catch (err) {
        console.error('Failed to revalidate master cache:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['masters', 'subsidy'] });
    }
  });
}
