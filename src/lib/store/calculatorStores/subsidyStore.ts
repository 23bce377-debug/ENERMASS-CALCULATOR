import { StateCreator } from 'zustand';
import {
  CalculatorState,
  getEligibleSubsidySchemes,
  runCalculation
} from '../calculatorTypes';

export const createSubsidySlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<CalculatorState, 'applySubsidy' | 'rpcSubsidyAmount' | 'fetchRpcSubsidy' | 'setApplySubsidy' | 'setSelectedScheme' | 'setSelectedSubsidySchemeId'>
> = (set, get) => ({
  applySubsidy: true,
  rpcSubsidyAmount: null,
  
  setApplySubsidy: (val) => {
    set({ applySubsidy: val });
    const { result, error } = runCalculation(get());
    set({ calcResult: result, calcError: error });
  },

  setSelectedScheme: (val) => {
    set({ selectedScheme: val });
    const { result, error } = runCalculation(get());
    set({ calcResult: result, calcError: error });
  },

  setSelectedSubsidySchemeId: (id) => {
    const eligibleSchemes = getEligibleSubsidySchemes(get());
    const scheme = eligibleSchemes.find((item: any) => item.id === id) ?? eligibleSchemes[0] ?? null;
    set({
      selectedSubsidySchemeId: scheme?.id ?? null,
      dbActiveScheme: scheme ?? null,
      rpcSubsidyAmount: null,
    });
    const { result, error } = runCalculation(get());
    set({ calcResult: result, calcError: error });
  },

  fetchRpcSubsidy: async () => {
    let state = get();

    // Auto-assign first system if none selected but master data is loaded
    // Use soft-set to preserve current equipment selections
    if (!state.selectedSystemId && state.dbLoaded && state.dbSystems.length > 0) {
      set({ selectedSystemId: state.dbSystems[0].id });
      state = get(); // Re-read after soft-set
    }

    if (!state.dbLoaded || state.projectType === 'commercial') {
      set({ rpcSubsidyAmount: 0 });
      const { result, error } = runCalculation(get());
      set({ calcResult: result, calcError: error });
      return;
    }

    const eligibleSchemes = getEligibleSubsidySchemes(get());
    if (!eligibleSchemes.some((scheme: any) => scheme.id === get().selectedSubsidySchemeId)) {
      const nextScheme = eligibleSchemes[0] ?? null;
      set({ selectedSubsidySchemeId: nextScheme?.id ?? null, dbActiveScheme: nextScheme ?? null });
    }

    // Use local DB-backed slab calculation so the amount follows the exact
    // scheme selected in the UI. The legacy RPC auto-selects one scheme by
    // project type and cannot represent user-selected state schemes.
    set({ rpcSubsidyAmount: null });
    const { result, error: calcErr } = runCalculation(get());
    set({ calcResult: result, calcError: calcErr });
  },
});
