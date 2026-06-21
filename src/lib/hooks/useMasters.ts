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
  if (entity === 'pricing') return 'bom_template_items';
  if (entity === 'subsidy') return 'calculation_schemes';
  if (entity === 'accessories') return 'bom_template_items';
  if (entity === 'structures') return 'eq_mounting_structures';
  if (entity === 'bom_categories') return 'bom_categories';
  return `eq_${entity}`;
}

function transformFromDb(entity: string, item: any): any {
  if (!item) return item;
  const copy = { ...item };
  if (entity === 'panels') {
    copy.rate_per_watt = copy.selling_price && copy.wattage_w ? Number(copy.selling_price) / Number(copy.wattage_w) : 0;
  } else if (entity === 'batteries' || entity === 'inverters' || entity === 'accessories') {
    copy.rate = copy.selling_price ?? 0;
  } else if (entity === 'structures') {
    copy.flat_rate = copy.selling_price;
  }
  return copy;
}

function transformToDb(entity: string, item: any, currentItem?: any): any {
  if (!item) return item;
  const copy = { ...item };
  if (entity === 'panels') {
    if ('rate_per_watt' in copy || 'wattage_w' in copy) {
      const ratePerWatt = copy.rate_per_watt ?? (currentItem?.selling_price && currentItem?.wattage_w ? Number(currentItem.selling_price) / Number(currentItem.wattage_w) : 0);
      const wattage = copy.wattage_w ?? currentItem?.wattage_w ?? 550;
      copy.selling_price = Number(ratePerWatt) * Number(wattage);
      delete copy.rate_per_watt;
    }
  } else if (entity === 'batteries' || entity === 'inverters' || entity === 'accessories') {
    if ('rate' in copy) {
      copy.selling_price = copy.rate;
      if (entity === 'accessories' && !('buy_price' in copy)) {
        copy.buy_price = copy.rate;
      }
      delete copy.rate;
    }
  } else if (entity === 'structures') {
    if ('flat_rate' in copy) {
      copy.selling_price = copy.flat_rate;
      delete copy.flat_rate;
    }
  }
  return copy;
}

export function useMasterQuery<T>(entity: string, options?: any) {
  return useQuery<T[]>({
    queryKey: ['masters', entity],
    queryFn: async () => {
      const { orgId } = await getOrgContext();
      const table = getEntityTable(entity);

      let query = supabase.from(table as any).select('*');
      
      // Enforce organisation filtering safely
      if (entity === 'vendors' || entity === 'pricing') {
        if (orgId) {
          query = query.eq('org_id', orgId);
        } else {
          query = query.is('org_id', null);
        }
      } else if (entity === 'subsidy') {
        // Subsidy schemes can be global or org specific
        if (orgId) {
          query = query.or(`org_id.eq.${orgId},org_id.is.null`);
        } else {
          query = query.is('org_id', null);
        }
      } else {
        // Equipment tables allow either global default (org_id is null) or org overrides
        if (orgId) {
          query = query.or(`org_id.eq.${orgId},org_id.is.null`);
        } else {
          query = query.is('org_id', null);
        }
      }

      if (entity !== 'pricing' && entity !== 'vendors' && entity !== 'bom_categories') {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((item: any) => transformFromDb(entity, item)) as T[];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours cache validity
    ...options
  });
}

export function useMasterCreateMutation<T>(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (newItem: any) => {
      await queryClient.cancelQueries({ queryKey: ['masters', entity] });
      const previousData = queryClient.getQueryData(['masters', entity]);
      
      const optimisticItem = { ...newItem, id: 'temp-id-' + Date.now() };
      queryClient.setQueryData(['masters', entity], (old: any) => {
        return old ? [...old, optimisticItem] : [optimisticItem];
      });

      return { previousData };
    },
    mutationFn: async (newItem: any) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      const payload = { ...transformToDb(entity, newItem), org_id: orgId };
      const { data, error } = await (supabase
        .from(table as any)
        .insert(payload)
        .select()
        .maybeSingle() as any);

      if (error) throw error;

      // Log Audit Event
      await logAudit(orgId, userId, 'masters', table, data.id, 'create', null, data);
      return transformFromDb(entity, data) as T;
    },
    onError: (err, newItem, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['masters', entity], context.previousData);
      }
    },
    onSettled: async () => {
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
    onMutate: async ({ id, updates }: { id: string; updates: any }) => {
      await queryClient.cancelQueries({ queryKey: ['masters', entity] });
      const previousData = queryClient.getQueryData(['masters', entity]);
      
      queryClient.setQueryData(['masters', entity], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => item.id === id ? { ...item, ...updates } : item);
      });

      return { previousData };
    },
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // 1. Fetch current values for audit comparison
      const { data: beforeState } = await (supabase.from(table as any).select('*').eq('id', id).maybeSingle() as any);

      // If modifying a global template as an org user, FORK it into an org override
      if (beforeState && beforeState.org_id === null && orgId !== null) {
        const payloadToApply = transformToDb(entity, updates, beforeState);
        const insertPayload = { 
          ...beforeState, 
          ...payloadToApply, 
          org_id: orgId,
          updated_at: new Date().toISOString()
        };
        // Ensure we create a new row by removing id and created_at
        delete insertPayload.id;
        delete insertPayload.created_at;

        const { data, error } = await (supabase
          .from(table as any)
          .insert(insertPayload)
          .select()
          .maybeSingle() as any);

        if (error) throw error;
        
        await logAudit(orgId, userId, 'masters', table, data.id, 'create_override', beforeState, data);
        
        await supabase.from('master_data_changes_log').insert({
          entity_type: table,
          entity_id: data.id,
          change_type: 'created',
          old_values: beforeState,
          new_values: data,
        });

        return transformFromDb(entity, data) as T;
      }

      // 2. Perform normal update
      const { data, error } = await (supabase
        .from(table as any)
        .update({ ...transformToDb(entity, updates, beforeState), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle() as any);

      if (error) throw error;
      if (!data) throw new Error('Update failed. You may not have permission to edit this record (it might be a global system template).');

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

      return transformFromDb(entity, data) as T;
    },
    onError: (err, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['masters', entity], context.previousData);
      }
    },
    onSettled: async () => {
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
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['masters', entity] });
      const previousData = queryClient.getQueryData(['masters', entity]);
      
      queryClient.setQueryData(['masters', entity], (old: any) => {
        if (!old) return old;
        return old.filter((item: any) => item.id !== id);
      });

      return { previousData };
    },
    mutationFn: async (id: string) => {
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // Fetch before deleting
      const { data: beforeState } = await (supabase.from(table as any).select('*').eq('id', id).maybeSingle() as any);

      let error;
      // Perform soft delete by default or hard delete for rate overrides / connections
      if (entity === 'pricing' || entity === 'vendors') {
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
    onError: (err, id, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['masters', entity], context.previousData);
      }
    },
    onSettled: async () => {
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
        
        if (before && before.org_id === null && orgId !== null) {
          const payloadToApply = transformToDb(entity, updates, before);
          const insertPayload = {
            ...before,
            ...payloadToApply,
            org_id: orgId,
            updated_at: new Date().toISOString()
          };
          delete insertPayload.id;
          delete insertPayload.created_at;

          const { data, error } = await (supabase
            .from(table as any)
            .insert(insertPayload)
            .select()
            .maybeSingle() as any);
          if (error) throw error;

          await logAudit(orgId, userId, 'masters', table, data.id, 'bulk_create_override', before, data);
          
          await supabase.from('master_data_changes_log').insert({
            entity_type: table,
            entity_id: data.id,
            change_type: 'created',
            old_values: before,
            new_values: data,
          });

          return transformFromDb(entity, data);
        }

        const { data, error } = await (supabase
          .from(table as any)
          .update({ ...transformToDb(entity, updates, before), updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle() as any);
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

        return transformFromDb(entity, data);
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
        .eq('entity_type', entityTable)
        .order('created_at', { ascending: false });

      if (orgId) {
        query = query.eq('org_id', orgId);
      } else {
        query = query.is('org_id', null);
      }

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
      
      let query = supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)');

      if (orgId) {
        query = query.or(`org_id.eq.${orgId},org_id.is.null`);
      } else {
        query = query.is('org_id', null);
      }

      const { data, error } = await (query
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
        .maybeSingle() as any);

      // 2. Update scheme
      const { data: scheme, error: schemeErr } = await (supabase
        .from('calculation_schemes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', schemeId)
        .select()
        .maybeSingle() as any);

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
        .maybeSingle() as any);

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

export function useCreateSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updates, slabs }: { updates: any; slabs: any[] }) => {
      const { orgId, userId } = await getOrgContext();

      // 1. Insert scheme
      const { data: scheme, error: schemeErr } = await (supabase
        .from('calculation_schemes')
        .insert({ ...updates, org_id: orgId, is_active: true, updated_at: new Date().toISOString() })
        .select()
        .maybeSingle() as any);

      if (schemeErr) throw schemeErr;
      if (!scheme) throw new Error('Failed to create subsidy scheme');

      const schemeId = scheme.id;

      // 2. Insert scheme slabs
      if (slabs && slabs.length > 0) {
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

      // 3. Log Audit Trail
      const { data: afterScheme } = await (supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)')
        .eq('id', schemeId)
        .maybeSingle() as any);

      await logAudit(orgId, userId, 'masters', 'calculation_schemes', schemeId, 'create', null, afterScheme);
      
      await supabase.from('master_data_changes_log').insert({
        entity_type: 'calculation_schemes',
        entity_id: schemeId,
        change_type: 'created',
        old_values: null,
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
