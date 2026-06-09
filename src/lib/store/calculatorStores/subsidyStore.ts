import { StateCreator } from 'zustand';
import {
  CalculatorState,
  runCalculation
} from '../calculatorTypes';

export const createSubsidySlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<CalculatorState, 'rpcSubsidyAmount' | 'fetchRpcSubsidy'>
> = (set, get) => ({
  rpcSubsidyAmount: null,

  fetchRpcSubsidy: async () => {
    const state = get();
    if (!state.dbLoaded || !state.selectedSystemId || state.projectType === 'commercial') {
      set({ rpcSubsidyAmount: 0 });
      const { result, error } = runCalculation(get());
      set({ calcResult: result, calcError: error });
      return;
    }

    const stateInfo = state.dbStateData[state.selectedState];
    const stateCode = stateInfo?.stateCode || null;

    // Calculate eligible capacity
    const systems = state.dbSystems;
    const system = systems.find(s => s.id === state.selectedSystemId);
    let panelCapacityKW = system?.capacityKW ?? 0;
    
    // Calculate custom panel capacity if panelMix is used
    const panelMixEntries = Object.entries(state.panelMix).filter(([, qty]) => qty > 0);
    if (panelMixEntries.length > 0) {
      panelCapacityKW = 0;
      for (const [panelId, qty] of panelMixEntries) {
        const p = state.dbPanels.find(x => x.id === panelId);
        if (p) {
          panelCapacityKW += (p.wattage * qty) / 1000;
        }
      }
    } else if (state.selectedPanelId) {
      const p = state.dbPanels.find(x => x.id === state.selectedPanelId);
      const qty = system?.panelQty ?? 0;
      if (p) {
        panelCapacityKW = (p.wattage * qty) / 1000;
      }
    }

    let inverterCapacityKW = panelCapacityKW;
    const inverterMixEntries = Object.entries(state.selectedInverterMix).filter(([, q]) => q > 0);
    if (inverterMixEntries.length > 0) {
      inverterCapacityKW = 0;
      for (const [invId, qty] of inverterMixEntries) {
        const inv = state.dbInverters.find(x => x.id === invId);
        if (inv) inverterCapacityKW += inv.capacityKW * qty;
      }
    }
    
    const eligibleCapacityKW = Math.min(panelCapacityKW, inverterCapacityKW);

    try {
      const { supabase } = await import('../../supabase/client');
      const { data, error } = await (supabase.rpc as any)('calculate_subsidy', {
        p_scheme_code: 'PM_SURYA_GHAR_2024',
        p_capacity_kw: eligibleCapacityKW,
        p_state_code: stateCode
      });
      if (error) throw error;
      
      set({ rpcSubsidyAmount: Number(data ?? 0) });
      
      // Trigger recalculate so it uses the new subsidy
      const { result, error: calcErr } = runCalculation(get());
      set({ calcResult: result, calcError: calcErr });
    } catch (err) {
      console.error('Failed to fetch subsidy RPC:', err);
    }
  },
});
