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

function isPlaceholderMaster(entity: string, item: any): boolean {
  if (!['panels', 'inverters', 'batteries'].includes(entity) || !item) return false;
  const brand = String(item.brand ?? '').trim().toLowerCase();
  const model = String(item.model ?? '').trim().toLowerCase();
  return (
    brand === 'unknown' ||
    brand === 'unknown brand' ||
    model === 'unknown' ||
    model === 'unknown model' ||
    (entity === 'inverters' && model === 'inverter')
  );
}

function assertValidMasterPayload(entity: string, item: any) {
  if (!['panels', 'inverters', 'batteries'].includes(entity) || !item) return;
  if (isPlaceholderMaster(entity, item)) {
    throw new Error('Please enter a real brand and model. Placeholder names like Unknown are not allowed in masters.');
  }
}

const entityReferenceChecks: Record<string, Array<{ table: string; column: string }>> = {
  panels: [{ table: 'system_items', column: 'panel_id' }],
  inverters: [{ table: 'system_items', column: 'inverter_id' }],
  batteries: [{ table: 'system_items', column: 'battery_id' }],
  structures: [{ table: 'system_items', column: 'structure_id' }],
  pricing: [{ table: 'system_items', column: 'bom_item_id' }],
  accessories: [{ table: 'system_items', column: 'bom_item_id' }],
};

const activeFlagEntities = new Set([
  'panels',
  'inverters',
  'batteries',
  'accessories',
  'structures',
  'pricing',
  'subsidy',
]);

const overrideableEntities = new Set(['panels', 'inverters', 'batteries', 'structures', 'accessories']);

const mutableColumnsByEntity: Record<string, string[]> = {
  panels: ['brand', 'model', 'wattage_w', 'panel_type', 'gst_pct', 'description', 'specification_details', 'buy_price', 'selling_price', 'is_active', 'is_custom'],
  inverters: ['brand', 'model', 'capacity_kw', 'inverter_type', 'phases', 'gst_pct', 'description', 'specification_details', 'buy_price', 'selling_price', 'is_active', 'is_custom'],
  batteries: ['brand', 'model', 'capacity_kwh', 'voltage_v', 'chemistry', 'dod_pct', 'gst_pct', 'description', 'specification_details', 'buy_price', 'selling_price', 'is_active', 'is_custom'],
  structures: ['name', 'material', 'roof_mount_type', 'elevation_height_mm', 'raw_material_rate', 'fabrication_rate', 'galvanizing_rate', 'wastage_pct', 'fastener_weight_pct', 'base_weight_kg', 'selling_price', 'buy_price', 'per_watt_rate', 'gst_pct', 'description', 'specification_details', 'is_active', 'is_custom'],
  accessories: ['category_id', 'sku_code', 'description', 'specification_details', 'unit', 'unit_rate_min', 'unit_rate_max', 'default_rate', 'gst_pct', 'qty_formula', 'is_survey_dependent', 'civil_required_only', 'notes', 'is_active', 'is_custom'],
  pricing: ['category_id', 'sku_code', 'description', 'specification_details', 'unit', 'unit_rate_min', 'unit_rate_max', 'default_rate', 'gst_pct', 'qty_formula', 'is_survey_dependent', 'civil_required_only', 'notes', 'is_active', 'is_custom'],
};

async function isReferenced(entity: string, id: string): Promise<boolean> {
  const checks = entityReferenceChecks[entity] ?? [];
  for (const check of checks) {
    const { count, error } = await (supabase
      .from(check.table as any)
      .select('id', { count: 'exact', head: true })
      .eq(check.column, id) as any);
    if (error) throw error;
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

function pickMutablePayload(entity: string, source: any) {
  const allowed = mutableColumnsByEntity[entity];
  if (!allowed) return { ...source };
  return Object.fromEntries(
    allowed
      .filter((column) => Object.prototype.hasOwnProperty.call(source, column))
      .map((column) => [column, source[column]]),
  );
}

function buildOverridePayload(entity: string, beforeState: any, updates: any, orgId: string, sourceGlobalId: string) {
  return {
    ...pickMutablePayload(entity, beforeState),
    ...pickMutablePayload(entity, updates),
    org_id: orgId,
    source_global_id: sourceGlobalId,
    is_active: true,
    is_custom: true,
    updated_at: new Date().toISOString(),
  };
}

async function fetchHiddenGlobalIds(entity: string, orgId: string | null): Promise<Set<string>> {
  if (!orgId || !overrideableEntities.has(entity)) return new Set();
  const { data, error } = await (supabase as any)
    .from('master_hidden_items')
    .select('global_id')
    .eq('org_id', orgId)
    .eq('entity', entity);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.global_id));
}

function filterOrgVisibleRows(entity: string, rows: any[], hiddenGlobalIds: Set<string>) {
  if (!overrideableEntities.has(entity)) return rows;
  const overriddenGlobalIds = new Set(
    rows
      .filter((row) => row.org_id && row.source_global_id)
      .map((row) => row.source_global_id),
  );
  return rows.filter((row) => {
    if (!row.org_id && hiddenGlobalIds.has(row.id)) return false;
    if (!row.org_id && overriddenGlobalIds.has(row.id)) return false;
    return true;
  });
}

function transformFromDb(entity: string, item: any): any {
  if (!item) return item;
  const copy = { ...item };
  if (entity === 'panels') {
    copy.rate_per_watt = copy.selling_price && copy.wattage_w ? Number(copy.selling_price) / Number(copy.wattage_w) : 0;
  } else if (entity === 'batteries' || entity === 'inverters') {
    copy.rate = copy.selling_price ?? 0;
  } else if (entity === 'accessories' || entity === 'pricing') {
    copy.rate = copy.default_rate ?? 0;
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
  } else if (entity === 'batteries' || entity === 'inverters') {
    if ('rate' in copy) {
      copy.selling_price = copy.rate;
      delete copy.rate;
    }
  } else if (entity === 'accessories' || entity === 'pricing') {
    if ('rate' in copy) {
      copy.default_rate = copy.rate;
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
      if (entity === 'vendors') {
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

      if (entity !== 'vendors' && entity !== 'bom_categories' && entity !== 'pricing') {
        query = query.eq('is_active', true);
      } else if (entity === 'pricing') {
        query = query.eq('is_active', true);
      }

      const [{ data, error }, hiddenGlobalIds] = await Promise.all([
        query,
        fetchHiddenGlobalIds(entity, orgId),
      ]);
      if (error) throw error;
      return filterOrgVisibleRows(entity, data || [], hiddenGlobalIds)
        .filter((item: any) => !isPlaceholderMaster(entity, item))
        .map((item: any) => transformFromDb(entity, item)) as T[];
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
      assertValidMasterPayload(entity, newItem);
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      const payload = { ...transformToDb(entity, newItem), org_id: orgId };
      if (activeFlagEntities.has(entity)) payload.is_active = true;
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
      assertValidMasterPayload(entity, updates);
      const { orgId, userId } = await getOrgContext();
      const table = getEntityTable(entity);

      // 1. Fetch current values for audit comparison
      const { data: beforeState } = await (supabase.from(table as any).select('*').eq('id', id).maybeSingle() as any);

      // If modifying a global template as an org user, FORK it into an org override
      if (beforeState && beforeState.org_id === null && orgId !== null) {
        const payloadToApply = transformToDb(entity, updates, beforeState);
        const overridePayload = buildOverridePayload(entity, beforeState, payloadToApply, orgId, id);
        const { data: existingOverride, error: overrideLookupError } = await (supabase
          .from(table as any)
          .select('id')
          .eq('org_id', orgId)
          .eq('source_global_id', id)
          .maybeSingle() as any);
        if (overrideLookupError) throw overrideLookupError;

        const write = existingOverride?.id
          ? supabase.from(table as any).update(overridePayload).eq('id', existingOverride.id)
          : supabase.from(table as any).insert(overridePayload);

        const { data, error } = await (write
          .select()
          .maybeSingle() as any);

        if (error) throw error;

        await (supabase as any)
          .from('master_hidden_items')
          .delete()
          .eq('org_id', orgId)
          .eq('entity', entity)
          .eq('global_id', id);
        
        await logAudit(orgId, userId, 'masters', table, data.id, existingOverride?.id ? 'update_override' : 'create_override', beforeState, data);
        
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

      if (!beforeState) return id;

      let error;
      const hasActiveFlag = Object.prototype.hasOwnProperty.call(beforeState, 'is_active');
      const hasRefs = await isReferenced(entity, id);
      const canHardDelete = !hasRefs && (beforeState.org_id === orgId || entity === 'vendors' || entity === 'pricing');

      if (beforeState.org_id === null && orgId !== null && overrideableEntities.has(entity)) {
        const res = await (supabase as any)
          .from('master_hidden_items')
          .upsert({ org_id: orgId, entity, global_id: id, hidden_by: userId }, { onConflict: 'org_id,entity,global_id' });
        error = res.error;
      } else if (canHardDelete) {
        const res = await supabase.from(table as any).delete().eq('id', id);
        error = res.error;
      } else if (hasActiveFlag) {
        const res = await supabase
          .from(table as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        error = res.error;
      } else {
        const res = await supabase.from(table as any).delete().eq('id', id);
        error = res.error;
      }

      if (error) throw error;

      // Log Audit Event
      await logAudit(orgId, userId, 'masters', table, id, 'delete', beforeState, null);
      
      // Log to changes list
      await supabase.from('master_data_changes_log').insert({
        entity_type: table,
        entity_id: id,
        change_type: beforeState.org_id === null ? 'hidden' : canHardDelete ? 'deleted' : 'deactivated',
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
      queryClient.invalidateQueries({ queryKey: ['bom-items-pricing'] });
    }
  });
}

export function useMasterBulkUpdateMutation(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: any }) => {
      assertValidMasterPayload(entity, updates);
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
          const overridePayload = buildOverridePayload(entity, before, payloadToApply, orgId, id);
          const { data: existingOverride, error: overrideLookupError } = await (supabase
            .from(table as any)
            .select('id')
            .eq('org_id', orgId)
            .eq('source_global_id', id)
            .maybeSingle() as any);
          if (overrideLookupError) throw overrideLookupError;

          const write = existingOverride?.id
            ? supabase.from(table as any).update(overridePayload).eq('id', existingOverride.id)
            : supabase.from(table as any).insert(overridePayload);

          const { data, error } = await (write
            .select()
            .maybeSingle() as any);
          if (error) throw error;

          await (supabase as any)
            .from('master_hidden_items')
            .delete()
            .eq('org_id', orgId)
            .eq('entity', entity)
            .eq('global_id', id);

          await logAudit(orgId, userId, 'masters', table, data.id, existingOverride?.id ? 'bulk_update_override' : 'bulk_create_override', before, data);
          
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

      const schemeIds = ((data as any) || []).map((scheme: any) => scheme.id);
      if (schemeIds.length === 0) return [];

      const { data: overrides, error: overridesError } = await (supabase
        .from('state_scheme_overrides' as any)
        .select('*, state_rules(id, state_name, state_code)')
        .in('scheme_id', schemeIds)
        .eq('is_active', true) as any);
      if (overridesError) throw overridesError;

      return ((data as any) || []).map((scheme: any) => ({
        ...scheme,
        state_scheme_overrides: (overrides || []).filter((override: any) => override.scheme_id === scheme.id),
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache validity
  });
}

export function useUpdateSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schemeId, updates, slabs, stateOverrides }: { schemeId: string; updates: any; slabs: any[]; stateOverrides?: any[] }) => {
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

      // 3. Replace scheme slabs
      await supabase.from('scheme_slabs').delete().eq('scheme_id', schemeId);
      if (slabs && slabs.length > 0) {
        const slabsToInsert = slabs.map((s, idx) => ({
          scheme_id: schemeId,
          slab_index: idx + 1,
          start_kw: parseFloat(s.startKW ?? s.start_kw),
          end_kw: s.endKW || s.end_kw ? parseFloat(s.endKW ?? s.end_kw) : null,
          rate_per_kw: parseFloat(s.ratePerKW ?? s.rate_per_kw ?? 0),
          is_fixed_amount: s.isFixedAmount ?? s.is_fixed_amount ?? false,
          fixed_amount: s.fixedAmount || s.fixed_amount ? parseFloat(s.fixedAmount ?? s.fixed_amount) : null,
          formula: s.formula ?? null,
        }));

        const { error: slabsErr } = await supabase.from('scheme_slabs').insert(slabsToInsert);
        if (slabsErr) throw slabsErr;
      }

      await supabase.from('state_scheme_overrides' as any).delete().eq('scheme_id', schemeId);
      if (stateOverrides && stateOverrides.length > 0) {
        const overridesToInsert = stateOverrides.map((override) => ({
          scheme_id: schemeId,
          state_id: override.state_id,
          max_absolute_override: override.max_absolute_override === '' || override.max_absolute_override == null
            ? null
            : Number(override.max_absolute_override),
          additional_state_subsidy: Number(override.additional_state_subsidy || 0),
          is_active: true,
        }));
        const { error: overridesErr } = await supabase.from('state_scheme_overrides' as any).insert(overridesToInsert);
        if (overridesErr) throw overridesErr;
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
      queryClient.invalidateQueries({ queryKey: ['masters', 'state_rules'] });
    }
  });
}

export function useCreateSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updates, slabs, stateOverrides }: { updates: any; slabs: any[]; stateOverrides?: any[] }) => {
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
          formula: s.formula ?? null,
        }));

        const { error: slabsErr } = await supabase.from('scheme_slabs').insert(slabsToInsert);
        if (slabsErr) throw slabsErr;
      }

      if (stateOverrides && stateOverrides.length > 0) {
        const overridesToInsert = stateOverrides.map((override) => ({
          scheme_id: schemeId,
          state_id: override.state_id,
          max_absolute_override: override.max_absolute_override === '' || override.max_absolute_override == null
            ? null
            : Number(override.max_absolute_override),
          additional_state_subsidy: Number(override.additional_state_subsidy || 0),
          is_active: true,
        }));
        const { error: overridesErr } = await supabase.from('state_scheme_overrides' as any).insert(overridesToInsert);
        if (overridesErr) throw overridesErr;
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
      queryClient.invalidateQueries({ queryKey: ['masters', 'state_rules'] });
    }
  });
}
