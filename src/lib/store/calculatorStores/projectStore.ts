import { StateCreator } from 'zustand';
import {
  CalculatorState,
  Variant,
  randomId
} from '../calculatorTypes';
import { MAX_VARIANTS } from '../../data/masters';

export const createProjectSlice: StateCreator<
  CalculatorState,
  [],
  [],
  Pick<CalculatorState, 'variants' | 'activeVariantId' | 'saveVariant' | 'loadVariant'>
> = (set, get) => ({
  variants: [],
  activeVariantId: null,

  saveVariant: (name: string) => {
    const state = get();
    if (!state.selectedSystemId) return;

    if (state.variants.length >= MAX_VARIANTS) {
      console.warn(`Maximum variants (${MAX_VARIANTS}) reached.`);
      return;
    }

    const variant: Variant = {
      id: randomId(),
      name,
      systemId: state.selectedSystemId,
      overrides: { ...state.overrides },
      customItems: [...state.customItems],
      disabledItemIndices: { ...state.disabledItemIndices },
      targetMarginPct: state.targetMarginPct ?? undefined,
      additionalCosts: [...state.additionalCosts],
      discountType: state.discountType,
      discountVal: state.discountVal,
      selectedPanelId: state.selectedPanelId,
      panelMix: { ...state.panelMix },
      selectedInverterMix: { ...state.selectedInverterMix },
      selectedBatteryMix: { ...state.selectedBatteryMix },
      backupLoadW: state.backupLoadW,
      selectedState: state.selectedState,
      projectType: state.projectType,
      rateMaster: { ...state.rateMaster },
      createdAt: new Date().toISOString(),
      orientation: state.orientation,
      dcCableLengthM: state.dcCableLengthM,
      acCableLengthM: state.acCableLengthM,
      electricityInflationRate: state.electricityInflationRate,
    };

    set({
      variants: [...state.variants, variant],
      activeVariantId: variant.id,
    });
  },

  loadVariant: (id: string) => {
    const variant = get().variants.find((v) => v.id === id);
    if (!variant) return;

    set({
      selectedSystemId: variant.systemId,
      overrides: { ...variant.overrides },
      customItems: [...variant.customItems],
      disabledItemIndices: { ...variant.disabledItemIndices },
      targetMarginPct: variant.targetMarginPct ?? null,
      additionalCosts: [...variant.additionalCosts],
      discountType: variant.discountType,
      discountVal: variant.discountVal,
      selectedPanelId: variant.selectedPanelId,
      panelMix: { ...variant.panelMix },
      selectedInverterMix: { ...variant.selectedInverterMix },
      selectedBatteryMix: { ...variant.selectedBatteryMix },
      backupLoadW: variant.backupLoadW,
      selectedState: variant.selectedState,
      projectType: variant.projectType,
      rateMaster: { ...variant.rateMaster },
      activeVariantId: id,
      orientation: variant.orientation ?? 'South',
      dcCableLengthM: variant.dcCableLengthM ?? 15,
      acCableLengthM: variant.acCableLengthM ?? 10,
      electricityInflationRate: variant.electricityInflationRate ?? 0.04,
    });
    get().recalculate();
  },
});
