import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';
import {
  AcquisitionORM,
  InventoryORM,
  type Acquisition,
  type InventorySummary,
  type AcquisitionItem
} from '@/backend/orm/acquisition';
import { BundlePresetORM } from '@/backend/orm/bundle';
import type { BundlePreset, BundlePresetItem } from '@/lib/types/bundle';
import { revalidateMasterCache } from '@/app/actions/revalidateMasters';

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useInventoryQuery(orgId: string | null) {
  return useQuery({
    queryKey: ['inventory', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return InventoryORM.getSummary(orgId);
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache validity
  });
}

export function useAcquisitionsQuery(orgId: string | null) {
  return useQuery<any[]>({
    queryKey: ['acquisitions', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return (await AcquisitionORM.getAll(orgId)) as any[];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}



export function useBundlePresetsQuery(orgId: string | null) {
  return useQuery({
    queryKey: ['bundlePresets', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return BundlePresetORM.getAll(orgId);
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useMarkAsReceivedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ acqId, orgId }: { acqId: string; orgId: string }) => {
      return AcquisitionORM.markAsReceived(acqId, orgId);
    },
    onSuccess: async (data, variables) => {
      await revalidateMasterCache(variables.orgId);
      queryClient.invalidateQueries({ queryKey: ['acquisitions', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.orgId] });
    }
  });
}



export function useDeletePresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return BundlePresetORM.delete(id);
    },
    onSuccess: async () => {
      await revalidateMasterCache();
      queryClient.invalidateQueries({ queryKey: ['bundlePresets'] });
    }
  });
}



export function useCreatePresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ preset, items, orgId }: { preset: Partial<BundlePreset>; items: BundlePresetItem[]; orgId: string }) => {
      return BundlePresetORM.create(preset, items);
    },
    onSuccess: async (data, variables) => {
      await revalidateMasterCache(variables.orgId);
      queryClient.invalidateQueries({ queryKey: ['bundlePresets', variables.orgId] });
    }
  });
}

export function useUpdatePresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, preset, items, orgId }: { id: string; preset: Partial<BundlePreset>; items: BundlePresetItem[]; orgId: string }) => {
      return BundlePresetORM.update(id, preset, items);
    },
    onSuccess: async (data, variables) => {
      await revalidateMasterCache(variables.orgId);
      queryClient.invalidateQueries({ queryKey: ['bundlePresets', variables.orgId] });
    }
  });
}

export function useCreateAcquisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      acquisition,
      items,
      bundles,
      orgId
    }: {
      acquisition: Partial<Acquisition>;
      items: Partial<AcquisitionItem>[];
      bundles?: Array<{
        bundle_preset_id?: string | null;
        name: string;
        qty: number;
        effective_bundle_price: number;
        allocation_strategy: 'proportional_cost' | 'proportional_qty' | 'manual';
        gst_pct: number;
        items: any[];
      }>;
      orgId: string;
    }) => {
      return AcquisitionORM.create(acquisition, items, bundles);
    },
    onSuccess: async (data, variables) => {
      await revalidateMasterCache(variables.orgId);
      queryClient.invalidateQueries({ queryKey: ['acquisitions', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.orgId] });
    }
  });
}
