import { useEffect, useState } from 'react';
import localforage from 'localforage';
import { useCalculatorStore } from '../store/calculatorStore';

export const SYNC_STORE_KEY = 'enermass_offline_master_data';
export const LAST_SYNC_KEY = 'enermass_last_sync_timestamp';

// Helper to merge delta arrays by ID
function mergeArraysById(oldArray: any[], newArray: any[]) {
  if (!oldArray) return newArray || [];
  if (!newArray || newArray.length === 0) return oldArray;

  const map = new Map(oldArray.map(item => [item.id, item]));
  newArray.forEach(item => {
    map.set(item.id, item); // Upsert
  });
  return Array.from(map.values());
}

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  
  // We grab the setter from the store (assuming we'll add setOfflineData to calculatorStore)
  const setOfflineData = useCalculatorStore((state: any) => state.setOfflineData);

  useEffect(() => {
    async function syncData() {
      setIsSyncing(true);
      try {
        const lastSync = await localforage.getItem<string>(LAST_SYNC_KEY);
        setLastSyncedAt(lastSync);

        // Fetch delta or full if no lastSync
        const params = new URLSearchParams();
        if (lastSync) {
          params.append('lastSyncedAt', lastSync);
        }

        const res = await fetch(`/api/sync?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to sync master data');
        
        const payload = await res.json();
        
        let finalData = payload.data;

        // If it was a delta sync, we need to merge with local data
        if (payload.isDelta) {
          const oldData = await localforage.getItem<any>(SYNC_STORE_KEY);
          if (oldData) {
            finalData = {
              panels: mergeArraysById(oldData.panels, payload.data.panels),
              inverters: mergeArraysById(oldData.inverters, payload.data.inverters),
              batteries: mergeArraysById(oldData.batteries, payload.data.batteries),
              meters: mergeArraysById(oldData.meters, payload.data.meters),
              lightningArresters: mergeArraysById(oldData.lightningArresters, payload.data.lightningArresters),
              structures: mergeArraysById(oldData.structures, payload.data.structures),
              bomItems: mergeArraysById(oldData.bomItems, payload.data.bomItems),
              commDevices: mergeArraysById(oldData.commDevices, payload.data.commDevices),
              systems: mergeArraysById(oldData.systems, payload.data.systems),
              weightLookups: payload.data.weightLookups?.length ? payload.data.weightLookups : oldData.weightLookups, // Assuming static
              stateRules: mergeArraysById(oldData.stateRules, payload.data.stateRules),
              slabs: payload.data.slabs?.length ? payload.data.slabs : oldData.slabs,
              schemes: mergeArraysById(oldData.schemes, payload.data.schemes),
              inventorySummary: mergeArraysById(oldData.inventorySummary, payload.data.inventorySummary),
              vendors: mergeArraysById(oldData.vendors, payload.data.vendors),
              structureComponents: mergeArraysById(oldData.structureComponents, payload.data.structureComponents),
              structureBom: payload.data.structureBom?.length ? payload.data.structureBom : oldData.structureBom,
              structureAddons: mergeArraysById(oldData.structureAddons, payload.data.structureAddons),
              appSettings: payload.data.appSettings || oldData.appSettings,
              structureVendors: mergeArraysById(oldData.structureVendors, payload.data.structureVendors),
              structureAccessoryRates: mergeArraysById(oldData.structureAccessoryRates, payload.data.structureAccessoryRates),
              structureMaterialRates: payload.data.structureMaterialRates?.length ? payload.data.structureMaterialRates : oldData.structureMaterialRates,
              structureTemplates: payload.data.structureTemplates?.length ? payload.data.structureTemplates : oldData.structureTemplates,
              structureTemplateItems: payload.data.structureTemplateItems?.length ? payload.data.structureTemplateItems : oldData.structureTemplateItems,
              walkwayTemplates: payload.data.walkwayTemplates?.length ? payload.data.walkwayTemplates : oldData.walkwayTemplates,
              ladderTemplates: payload.data.ladderTemplates?.length ? payload.data.ladderTemplates : oldData.ladderTemplates,
              structureComponentMasters: mergeArraysById(oldData.structureComponentMasters, payload.data.structureComponentMasters),
            };
          }
        }

        // Write merged data to indexedDB
        await localforage.setItem(SYNC_STORE_KEY, finalData);
        await localforage.setItem(LAST_SYNC_KEY, payload.timestamp);
        
        // Push to zustand
        if (setOfflineData) {
          setOfflineData(finalData);
        }

        setLastSyncedAt(payload.timestamp);
      } catch (err) {
        console.error('Offline sync failed:', err);
        // On failure, try to load from localforage to gracefully degrade
        const oldData = await localforage.getItem<any>(SYNC_STORE_KEY);
        if (oldData && setOfflineData) {
          setOfflineData(oldData);
        }
      } finally {
        setIsSyncing(false);
      }
    }

    syncData();
  }, [setOfflineData]);

  return { isSyncing, lastSyncedAt };
}
