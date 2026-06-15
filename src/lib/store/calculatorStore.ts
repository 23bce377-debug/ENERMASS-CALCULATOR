/**
 * ENERMASS Solar Calculator — Zustand Store
 * ==========================================
 * Central state management with localStorage persistence.
 * Combined slices wrapper for backward compatibility.
 */
import '../mockStorage';
import { create } from 'zustand';
import { Variant, CalculatorState } from './calculatorTypes';
import { createQuoteSlice } from './calculatorStores/quoteStore';
import { createProjectSlice } from './calculatorStores/projectStore';
import { createSubsidySlice } from './calculatorStores/subsidyStore';
import { createEquipmentSlice } from './calculatorStores/equipmentStore';
import { createCalculationSlice } from './calculatorStores/calculationStore';

// Re-export types to prevent breaking imports across the application
export type { Variant, CalculatorState };

export const useCalculatorStore = create<CalculatorState>()(
  (set, get, store) => ({
    ...createCalculationSlice(set, get, store),
    ...createEquipmentSlice(set, get, store),
    ...createSubsidySlice(set, get, store),
    ...createProjectSlice(set, get, store),
    ...createQuoteSlice(set, get, store),
  })
);
