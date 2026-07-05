import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';

export const MASTER_DATA_UPDATED_EVENT = 'enermass-master-data-updated';

export function notifyMasterDataUpdated(entity?: string) {
  if (typeof window === 'undefined') return;
  const detail = { entity, updatedAt: Date.now() };
  window.dispatchEvent(new CustomEvent(MASTER_DATA_UPDATED_EVENT, { detail }));
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(MASTER_DATA_UPDATED_EVENT);
      channel.postMessage(detail);
      channel.close();
    }
  } catch {}
}

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
  if (entity === 'panels') {
    if ('wattage_w' in item && (!Number.isFinite(Number(item.wattage_w)) || Number(item.wattage_w) <= 0)) {
      throw new Error('Panel wattage must be greater than zero.');
    }
    if ('rate_per_watt' in item && (!Number.isFinite(Number(item.rate_per_watt)) || Number(item.rate_per_watt) <= 0)) {
      throw new Error('Panel selling rate must be greater than zero.');
    }
    if ('selling_price' in item && (!Number.isFinite(Number(item.selling_price)) || Number(item.selling_price) <= 0)) {
      throw new Error('Panel selling price must be greater than zero.');
    }
  }
  if ((entity === 'inverters' || entity === 'batteries') && 'rate' in item) {
    if (!Number.isFinite(Number(item.rate)) || Number(item.rate) <= 0) {
      throw new Error('Selling price must be greater than zero.');
    }
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
  const globalById = new Map(rows.filter((row) => !row.org_id).map((row) => [row.id, row]));
  const globalByNaturalKey = new Map<string, any>();
  for (const row of rows) {
    if (!row.org_id) {
      const signature = getNaturalKeySignature(entity, row);
      if (signature) globalByNaturalKey.set(signature, row);
    }
  }

  const redundantOrgIds = new Set<string>();
  const overriddenGlobalIds = new Set<string>();

  for (const row of rows) {
    if (!row.org_id) continue;

    const naturalGlobal = getNaturalKeySignature(entity, row);
    const sourceGlobal = row.source_global_id
      ? globalById.get(row.source_global_id)
      : naturalGlobal
        ? globalByNaturalKey.get(naturalGlobal)
        : null;

    if (sourceGlobal) {
      if (masterPayloadHasChanges(entity, sourceGlobal, pickMutablePayload(entity, row))) {
        overriddenGlobalIds.add(sourceGlobal.id);
      } else {
        redundantOrgIds.add(row.id);
      }
    } else if (row.source_global_id) {
      overriddenGlobalIds.add(row.source_global_id);
    }
  }

  return rows.filter((row) => {
    if (row.org_id && redundantOrgIds.has(row.id)) return false;
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
      if (!Number.isFinite(Number(ratePerWatt)) || Number(ratePerWatt) <= 0) {
        throw new Error('Panel selling rate must be greater than zero.');
      }
      if (!Number.isFinite(Number(wattage)) || Number(wattage) <= 0) {
        throw new Error('Panel wattage must be greater than zero.');
      }
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

function getNaturalKey(entity: string, item: any): Record<string, any> | null {
  if (!item) return null;
  if (entity === 'panels') return { brand: item.brand, model: item.model, wattage_w: item.wattage_w };
  if (entity === 'inverters') return { brand: item.brand, model: item.model, capacity_kw: item.capacity_kw, inverter_type: item.inverter_type };
  if (entity === 'batteries') return { brand: item.brand, model: item.model, capacity_kwh: item.capacity_kwh };
  if (entity === 'structures') return { name: item.name, material: item.material, roof_mount_type: item.roof_mount_type };
  if (entity === 'accessories') return { sku_code: item.sku_code };
  return null;
}

function getNaturalKeySignature(entity: string, item: any): string | null {
  const key = getNaturalKey(entity, item);
  if (!key) return null;

  const parts = Object.entries(key).map(([column, value]) => {
    if (value === undefined || value === null || value === '') return null;
    const normalizedValue = typeof value === 'number'
      ? Number(value).toFixed(5)
      : String(value).trim().toLowerCase();
    return `${column}:${normalizedValue}`;
  });

  if (parts.some((part) => part === null)) return null;
  return parts.join('|');
}

function isDuplicateKeyError(error: any) {
  return error?.code === '23505' || String(error?.message || '').toLowerCase().includes('duplicate key value');
}

function scopeQuery(query: any, orgId: string | null) {
  return orgId ? query.eq('org_id', orgId) : query.is('org_id', null);
}

async function findExistingMasterRow(entity: string, table: string, payload: any, orgId: string | null) {
  const key = getNaturalKey(entity, payload);
  if (!key) return null;

  for (const scope of [orgId, null]) {
    let query: any = scopeQuery((supabase as any).from(table).select('*'), scope);
    for (const [column, value] of Object.entries(key)) {
      if (value === undefined || value === null || value === '') return null;
      query = query.eq(column, value);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function findExistingOrgOverrideRow(entity: string, table: string, payload: any, orgId: string, sourceGlobalId: string) {
  const { data: sourceMatch, error: sourceError } = await ((supabase as any)
    .from(table)
    .select('*')
    .eq('org_id', orgId)
    .eq('source_global_id', sourceGlobalId)
    .maybeSingle() as any);
  if (sourceError) throw sourceError;
  if (sourceMatch) return sourceMatch;

  const key = getNaturalKey(entity, payload);
  if (!key) return null;

  let query: any = (supabase as any).from(table).select('*').eq('org_id', orgId);
  for (const [column, value] of Object.entries(key)) {
    if (value === undefined || value === null || value === '') return null;
    query = query.eq(column, value);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

function equivalentMasterValue(left: any, right: any) {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) < 0.00001;
  }

  return String(left).trim() === String(right).trim();
}

function masterPayloadHasChanges(entity: string, existing: any, payload: any) {
  const ignoredColumns = new Set(['is_active', 'is_custom', 'updated_at']);
  const columns = (mutableColumnsByEntity[entity] ?? Object.keys(payload))
    .filter((column) => !ignoredColumns.has(column) && Object.prototype.hasOwnProperty.call(payload, column));

  return columns.some((column) => !equivalentMasterValue(existing?.[column], payload?.[column]));
}

async function writeOrgOverride<T>(
  entity: string,
  table: string,
  beforeState: any,
  updates: any,
  orgId: string,
  userId: string,
  sourceGlobalId: string,
  createAction: string,
  updateAction: string,
): Promise<T> {
  const overridePayload = buildOverridePayload(entity, beforeState, updates, orgId, sourceGlobalId);
  const existingOverride = await findExistingOrgOverrideRow(entity, table, overridePayload, orgId, sourceGlobalId);

  const write = existingOverride?.id
    ? (supabase as any).from(table).update(overridePayload).eq('id', existingOverride.id)
    : (supabase as any).from(table).insert(overridePayload);

  const { data, error } = await (write.select().maybeSingle() as any);

  if (error && isDuplicateKeyError(error)) {
    const duplicateTarget = await findExistingOrgOverrideRow(entity, table, overridePayload, orgId, sourceGlobalId);
    if (duplicateTarget?.id) {
      const retry = await ((supabase as any)
        .from(table)
        .update(overridePayload)
        .eq('id', duplicateTarget.id)
        .select()
        .maybeSingle() as any);
      if (retry.error) throw retry.error;

      await logAudit(orgId, userId, 'masters', table, retry.data.id, updateAction, duplicateTarget, retry.data);
      return transformFromDb(entity, retry.data) as T;
    }
  }

  if (error) throw error;

  await logAudit(
    orgId,
    userId,
    'masters',
    table,
    data.id,
    existingOverride?.id ? updateAction : createAction,
    existingOverride ?? beforeState,
    data,
  );
  return transformFromDb(entity, data) as T;
}

async function writeMasterInsertOrUpdate<T>(entity: string, table: string, payload: any, orgId: string, userId: string): Promise<T> {
  const existingBeforeInsert = await findExistingMasterRow(entity, table, payload, orgId);

  if (existingBeforeInsert) {
    const updates = {
      ...pickMutablePayload(entity, payload),
      is_active: true,
      is_custom: existingBeforeInsert.org_id === null ? existingBeforeInsert.is_custom : true,
      updated_at: new Date().toISOString(),
    };

    if (!masterPayloadHasChanges(entity, existingBeforeInsert, updates)) {
      return transformFromDb(entity, existingBeforeInsert) as T;
    }

    if (existingBeforeInsert.org_id === null && orgId !== null && overrideableEntities.has(entity)) {
      return writeOrgOverride<T>(
        entity,
        table,
        existingBeforeInsert,
        updates,
        orgId,
        userId,
        existingBeforeInsert.id,
        'import_create_override',
        'import_update_override',
      );
    }

    const { data, error } = await ((supabase as any)
      .from(table)
      .update(updates)
      .eq('id', existingBeforeInsert.id)
      .select()
      .maybeSingle() as any);
    if (error) throw error;

    await logAudit(orgId, userId, 'masters', table, data.id, 'import_update', existingBeforeInsert, data);
    return transformFromDb(entity, data) as T;
  }

  const insertResult = await ((supabase as any)
    .from(table)
    .insert(payload)
    .select()
    .maybeSingle() as any);

  if (!insertResult.error) {
    await logAudit(orgId, userId, 'masters', table, insertResult.data.id, 'create', null, insertResult.data);
    return transformFromDb(entity, insertResult.data) as T;
  }

  if (!isDuplicateKeyError(insertResult.error)) throw insertResult.error;

  const existing = await findExistingMasterRow(entity, table, payload, orgId);
  if (!existing) throw insertResult.error;

  const updates = {
    ...pickMutablePayload(entity, payload),
    is_active: true,
    is_custom: true,
    updated_at: new Date().toISOString(),
  };

  if (existing.org_id === null && orgId !== null && overrideableEntities.has(entity)) {
    return writeOrgOverride<T>(
      entity,
      table,
      existing,
      updates,
      orgId,
      userId,
      existing.id,
      'import_create_override',
      'import_update_override',
    );
  }

  const { data, error } = await ((supabase as any)
    .from(table)
    .update(updates)
    .eq('id', existing.id)
    .select()
    .maybeSingle() as any);
  if (error) throw error;

  await logAudit(orgId, userId, 'masters', table, data.id, 'import_update', existing, data);
  return transformFromDb(entity, data) as T;
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
    staleTime: 2 * 60 * 1000,
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

      const payload = { ...transformToDb(entity, newItem), org_id: orgId, is_custom: true };
      if (activeFlagEntities.has(entity)) payload.is_active = true;
      return writeMasterInsertOrUpdate<T>(entity, table, payload, orgId, userId);
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
      notifyMasterDataUpdated(entity);
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
        const data = await writeOrgOverride<any>(
          entity,
          table,
          beforeState,
          payloadToApply,
          orgId,
          userId,
          id,
          'create_override',
          'update_override',
        );

        await (supabase as any)
          .from('master_hidden_items')
          .delete()
          .eq('org_id', orgId)
          .eq('entity', entity)
          .eq('global_id', id);
        
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
      notifyMasterDataUpdated(entity);
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
      notifyMasterDataUpdated(entity);
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

      const beforeById = new Map(((beforeStates || []) as any[]).map((row: any) => [row.id, row]));
      const operations = ids.map((id) => {
        const before = beforeById.get(id);
        if (!before) throw new Error(`Bulk update aborted: row ${id} was not found or is not accessible.`);
        return {
          id,
          before,
          payload: transformToDb(entity, updates, before),
          shouldForkGlobal: before.org_id === null && orgId !== null,
        };
      });

      const results: any[] = [];
      for (const operation of operations) {
        const { id, before, payload, shouldForkGlobal } = operation;

        try {
          if (shouldForkGlobal) {
            const data = await writeOrgOverride<any>(
              entity,
              table,
              before,
              payload,
              orgId,
              userId,
              id,
              'bulk_create_override',
              'bulk_update_override',
            );

            await (supabase as any)
              .from('master_hidden_items')
              .delete()
              .eq('org_id', orgId)
              .eq('entity', entity)
              .eq('global_id', id);
            
            await supabase.from('master_data_changes_log').insert({
              entity_type: table,
              entity_id: data.id,
              change_type: 'created',
              old_values: before,
              new_values: data,
            });

            results.push(transformFromDb(entity, data));
            continue;
          }

          const { data, error } = await (supabase
            .from(table as any)
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .maybeSingle() as any);
          if (error) throw error;
          if (!data) throw new Error('Update returned no row.');

          // Log Audit Event for each
          await logAudit(orgId, userId, 'masters', table, id, 'bulk_update', before, data);
          
          await supabase.from('master_data_changes_log').insert({
            entity_type: table,
            entity_id: id,
            change_type: 'updated',
            old_values: before,
            new_values: data,
          });

          results.push(transformFromDb(entity, data));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Bulk update failed on row ${results.length + 1} of ${operations.length}: ${message}`);
        }
      }
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
      notifyMasterDataUpdated(entity);
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
    },
    staleTime: 10 * 60 * 1000,
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
    },
    staleTime: 10 * 60 * 1000,
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

      const { data: afterScheme, error: rpcError } = await (supabase as any)
        .rpc('update_subsidy_scheme_atomic', {
          p_scheme_id: schemeId,
          p_updates: updates,
          p_slabs: slabs ?? [],
          p_state_overrides: stateOverrides ?? [],
        });

      if (rpcError) throw rpcError;

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
      notifyMasterDataUpdated('subsidy');
    }
  });
}

export function useCreateSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updates, slabs, stateOverrides }: { updates: any; slabs: any[]; stateOverrides?: any[] }) => {
      const { orgId, userId } = await getOrgContext();

      const { data: afterScheme, error: rpcError } = await (supabase as any)
        .rpc('create_subsidy_scheme_atomic', {
          p_org_id: orgId,
          p_updates: updates,
          p_slabs: slabs ?? [],
          p_state_overrides: stateOverrides ?? [],
        });

      if (rpcError) throw rpcError;
      if (!afterScheme?.id) throw new Error('Failed to create subsidy scheme');

      const schemeId = afterScheme.id;

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
      notifyMasterDataUpdated('subsidy');
    }
  });
}

export function useDeleteSubsidyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schemeId: string) => {
      const { orgId, userId } = await getOrgContext();

      const { data: beforeScheme, error: beforeError } = await (supabase
        .from('calculation_schemes')
        .select('*, scheme_slabs(*)')
        .eq('id', schemeId)
        .maybeSingle() as any);

      if (beforeError) throw beforeError;
      if (!beforeScheme) throw new Error('Subsidy scheme not found');

      const { data: scheme, error: schemeErr } = await (supabase
        .from('calculation_schemes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', schemeId)
        .select()
        .maybeSingle() as any);

      if (schemeErr) throw schemeErr;

      await (supabase as any)
        .from('state_scheme_overrides')
        .update({ is_active: false })
        .eq('scheme_id', schemeId);

      await logAudit(orgId, userId, 'masters', 'calculation_schemes', schemeId, 'delete', beforeScheme, scheme);

      await supabase.from('master_data_changes_log').insert({
        entity_type: 'calculation_schemes',
        entity_id: schemeId,
        change_type: 'deactivated',
        old_values: beforeScheme,
        new_values: scheme,
      });

      return scheme;
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
      notifyMasterDataUpdated('subsidy');
    }
  });
}
