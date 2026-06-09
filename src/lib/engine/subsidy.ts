export type ProjectType = 'residential' | 'commercial';

export interface SubsidyInput {
  panelCapacityKW: number;
  inverterCapacityKW?: number;
  projectType: ProjectType;
  slabs?: Array<{
    start_kw: number;
    end_kw: number | null;
    rate_per_kw: number;
    is_fixed_amount: boolean;
    fixed_amount: number | null;
  }>;
  maxCapacityKW?: number;
}

export function calculateSubsidyAmount(input: SubsidyInput): number {
  if (input.projectType === 'commercial') {
    return 0;
  }

  const eligibleCapacityKW = input.inverterCapacityKW !== undefined 
    ? Math.min(input.panelCapacityKW, input.inverterCapacityKW) 
    : input.panelCapacityKW;

  const maxCapacity = input.maxCapacityKW ?? 10.0;
  const capacityForSubsidy = Math.min(eligibleCapacityKW, maxCapacity);

  if (!input.slabs || input.slabs.length === 0) {
    return 0;
  }

  let total = 0;
  for (const slab of input.slabs) {
    const start = Number(slab.start_kw);
    if (capacityForSubsidy <= start) {
      break;
    }
    if (slab.is_fixed_amount) {
      total += Number(slab.fixed_amount ?? 0);
    } else {
      const end = slab.end_kw === null ? capacityForSubsidy : Math.min(capacityForSubsidy, Number(slab.end_kw));
      const applicable = end - start;
      total += applicable * Number(slab.rate_per_kw);
    }
  }
  return total;
}
