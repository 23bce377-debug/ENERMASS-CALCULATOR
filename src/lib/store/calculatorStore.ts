/**
 * ENERMASS Solar Calculator — Zustand Store
 * ==========================================
 * Central state management with localStorage persistence.
 * Combined slices wrapper for backward compatibility.
 */
import '../mockStorage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Variant, CalculatorState } from './calculatorTypes';
import { createQuoteSlice } from './calculatorStores/quoteStore';
import { createProjectSlice } from './calculatorStores/projectStore';
import { createSubsidySlice } from './calculatorStores/subsidyStore';
import { createEquipmentSlice } from './calculatorStores/equipmentStore';
import { createCalculationSlice } from './calculatorStores/calculationStore';

// Re-export types to prevent breaking imports across the application
export type { Variant, CalculatorState };

const safeStorage = createJSONStorage(() => {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
});

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set, get, store) => ({
      ...createCalculationSlice(set, get, store),
      ...createEquipmentSlice(set, get, store),
      ...createSubsidySlice(set, get, store),
      ...createProjectSlice(set, get, store),
      ...createQuoteSlice(set, get, store),
    }),
    {
      name: 'enermass-calc-state',
      storage: safeStorage,
      partialize: (state) => ({
        selectedSystemId: state.selectedSystemId,
        selectedState: state.selectedState,
        projectType: state.projectType,
        targetMarginPct: state.targetMarginPct,
        overrides: state.overrides,
        rateMaster: state.rateMaster,
        disabledItemIndices: state.disabledItemIndices,
        additionalCosts: state.additionalCosts,
        discountType: state.discountType,
        discountVal: state.discountVal,
        selectedPanelId: state.selectedPanelId,
        panelMix: state.panelMix,
        selectedInverterMix: state.selectedInverterMix,
        selectedBatteryMix: state.selectedBatteryMix,
        backupLoadW: state.backupLoadW,
        customItems: state.customItems,
        variants: state.variants,
        activeVariantId: state.activeVariantId,
        activeQuoteId: state.activeQuoteId,
        showInventoryInfo: state.showInventoryInfo,
        applySubsidy: state.applySubsidy,

        // Structure & Meter & LA selections
        selectedStructureId: state.selectedStructureId,
        structurePricingMode: state.structurePricingMode,
        structureRateOverride: state.structureRateOverride,
        structureWastageOverride: state.structureWastageOverride,
        structureFastenerOverride: state.structureFastenerOverride,
        structureBaseWeightOverride: state.structureBaseWeightOverride,
        structureWeightLookupKg: state.structureWeightLookupKg,
        structureCustomRawRate: state.structureCustomRawRate,
        structureCustomFabricationRate: state.structureCustomFabricationRate,
        structureCustomGalvanizingRate: state.structureCustomGalvanizingRate,
        structureComponentMix: state.structureComponentMix,
        structureAddonMix: state.structureAddonMix,
        solarMeterId: state.solarMeterId,
        solarMeterQty: state.solarMeterQty,
        netMeterId: state.netMeterId,
        netMeterQty: state.netMeterQty,
        lightningArresterId: state.lightningArresterId,
        lightningArresterQty: state.lightningArresterQty,

        // Pricing overrides (survive page refresh)
        gstOnOutputOverride: state.gstOnOutputOverride,
        targetMRPInclGST: state.targetMRPInclGST,
        targetMRPPerWatt: state.targetMRPPerWatt,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.recalculate();
          }
        };
      },
    }
  )
);
