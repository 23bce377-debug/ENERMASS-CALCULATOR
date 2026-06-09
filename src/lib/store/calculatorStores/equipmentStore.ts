import { StateCreator } from 'zustand';
import { CalculatorState } from '../calculatorTypes';

export const createEquipmentSlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<
    CalculatorState,
    | 'selectedPanelId'
    | 'panelMix'
    | 'selectedInverterMix'
    | 'selectedBatteryMix'
    | 'backupLoadW'
    | 'selectedStructureId'
    | 'structurePricingMode'
    | 'structureRateOverride'
    | 'structureWastageOverride'
    | 'structureFastenerOverride'
    | 'structureBaseWeightOverride'
    | 'structureWeightLookupKg'
    | 'structureCustomRawRate'
    | 'structureCustomFabricationRate'
    | 'structureCustomGalvanizingRate'
    | 'solarMeterId'
    | 'solarMeterQty'
    | 'netMeterId'
    | 'netMeterQty'
    | 'lightningArresterId'
    | 'lightningArresterQty'
    | 'selectPanel'
    | 'setPanelMixQty'
    | 'clearPanelMix'
    | 'setInverterMixQty'
    | 'clearInverterMix'
    | 'setBatteryMixQty'
    | 'clearBatteryMix'
    | 'setBackupLoadW'
    | 'setStructureSelection'
    | 'setStructureCustomField'
    | 'setMeterSelection'
    | 'setLASelection'
  >
> = (set, get) => ({
  selectedPanelId: null,
  panelMix: {},
  selectedInverterMix: {},
  selectedBatteryMix: {},
  backupLoadW: 0,

  selectedStructureId: null,
  structurePricingMode: 'weight',
  structureRateOverride: null,
  structureWastageOverride: null,
  structureFastenerOverride: null,
  structureBaseWeightOverride: null,
  structureWeightLookupKg: null,
  structureCustomRawRate: null,
  structureCustomFabricationRate: null,
  structureCustomGalvanizingRate: null,

  solarMeterId: null,
  solarMeterQty: 1,
  netMeterId: null,
  netMeterQty: 1,

  lightningArresterId: null,
  lightningArresterQty: 1,

  selectPanel: (id: string | null) => {
    set({ selectedPanelId: id, panelMix: {} });
    get().fetchRpcSubsidy();
  },

  setPanelMixQty: (panelId: string, qty: number) => {
    const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
    const nextMix = { ...get().panelMix };

    if (safeQty === 0) {
      delete nextMix[panelId];
    } else {
      nextMix[panelId] = safeQty;
    }

    const firstSelectedPanelId = Object.keys(nextMix)[0] ?? null;
    set({ panelMix: nextMix, selectedPanelId: firstSelectedPanelId });
    get().fetchRpcSubsidy();
  },

  clearPanelMix: () => {
    set({ panelMix: {}, selectedPanelId: null });
    get().fetchRpcSubsidy();
  },

  setInverterMixQty: (inverterId: string, qty: number) => {
    const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
    const nextMix = { ...get().selectedInverterMix };

    if (safeQty === 0) {
      delete nextMix[inverterId];
    } else {
      nextMix[inverterId] = safeQty;
    }

    set({ selectedInverterMix: nextMix });
    get().fetchRpcSubsidy();
  },

  clearInverterMix: () => {
    set({ selectedInverterMix: {} });
    get().fetchRpcSubsidy();
  },

  setBatteryMixQty: (batteryId: string, qty: number) => {
    const safeQty = Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
    const nextMix = { ...get().selectedBatteryMix };

    if (safeQty === 0) {
      delete nextMix[batteryId];
    } else {
      nextMix[batteryId] = safeQty;
    }

    set({ selectedBatteryMix: nextMix });
    get().fetchRpcSubsidy();
  },

  clearBatteryMix: () => {
    set({ selectedBatteryMix: {} });
    get().fetchRpcSubsidy();
  },

  setBackupLoadW: (loadW: number) => {
    set({ backupLoadW: Math.max(0, Math.floor(Number.isFinite(loadW) ? loadW : 0)) });
  },

  setStructureSelection: (id: string | null, mode?: 'weight' | 'per_watt' | 'flat') => {
    set({
      selectedStructureId: id,
      structurePricingMode: mode ?? get().structurePricingMode,
    });
    get().recalculate();
  },

  setStructureCustomField: (field: string, val: number | null) => {
    set({
      [field]: val,
    } as any);
    get().recalculate();
  },

  setMeterSelection: (type: 'solar' | 'net', id: string | null, qty?: number) => {
    if (type === 'solar') {
      set({
        solarMeterId: id,
        solarMeterQty: qty !== undefined ? Math.max(0, qty) : get().solarMeterQty,
      });
    } else {
      set({
        netMeterId: id,
        netMeterQty: qty !== undefined ? Math.max(0, qty) : get().netMeterQty,
      });
    }
    get().recalculate();
  },

  setLASelection: (id: string | null, qty?: number) => {
    set({
      lightningArresterId: id,
      lightningArresterQty: qty !== undefined ? Math.max(0, qty) : get().lightningArresterQty,
    });
    get().recalculate();
  },
});
