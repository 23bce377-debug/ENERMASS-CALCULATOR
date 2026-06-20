export interface OverrideContext {
  orgId: string;
  stateCode: string;
  category: string;
  systemCapacityKW: number;
}

export interface ResolvedRate {
  rate: number;
  source: 'row_override' | 'org_rate_master' | 'state_override' | 'category_default' | 'system_default';
  sourceDescription: string;
}

export interface ResolvedMargin {
  marginPct: number;
  source: 'org_override' | 'state_override' | 'category_default' | 'system_default';
}

/**
 * Resolve effective rate using strict priority chain:
 * 1. Row-level override
 * 2. Org rate master
 * 3. State-specific override
 * 4. Default rate
 */
export function resolveEffectiveRate(
  description: string,
  defaultRate: number,
  rowOverride?: number,
  rateMaster?: Record<string, { rate: number; active: boolean }>,
  stateRateOverrides?: Record<string, number>
): ResolvedRate {
  if (rowOverride !== undefined) {
    return { rate: rowOverride, source: 'row_override', sourceDescription: 'Manual row override' };
  }

  if (rateMaster && rateMaster[description] && rateMaster[description].active) {
    return { rate: rateMaster[description].rate, source: 'org_rate_master', sourceDescription: 'Org rate master' };
  }

  if (stateRateOverrides && stateRateOverrides[description] !== undefined) {
    return { rate: stateRateOverrides[description], source: 'state_override', sourceDescription: 'State override' };
  }

  return { rate: defaultRate, source: 'category_default', sourceDescription: 'Category default' };
}

/**
 * Resolve effective margin using strict priority chain:
 * 1. Org category override
 * 2. State margin override
 * 3. Category default margin
 * 4. System default
 */
export function resolveEffectiveMargin(
  category: string,
  defaultMarginPct: number,
  orgCategoryMargins?: Record<string, number>,
  stateMarginOverrides?: Record<string, number>
): ResolvedMargin {
  if (orgCategoryMargins && orgCategoryMargins[category] !== undefined) {
    return { marginPct: orgCategoryMargins[category], source: 'org_override' };
  }

  if (stateMarginOverrides && stateMarginOverrides[category] !== undefined) {
    return { marginPct: stateMarginOverrides[category], source: 'state_override' };
  }

  return { marginPct: defaultMarginPct, source: 'category_default' };
}

export function resolveWithPriorityChain<T>(
  values: Array<{ value: T | undefined; source: string }>
): { value: T; source: string } | undefined {
  for (const item of values) {
    if (item.value !== undefined) {
      return { value: item.value, source: item.source };
    }
  }
  return undefined;
}
