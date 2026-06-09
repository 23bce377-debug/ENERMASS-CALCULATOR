import { type BomItem, type SolarSystem } from '../data/bom';
import { resolveRate, getMasterEntry } from './calculator'; // keep backwards-compatible imports if needed or define locally

const EQUIPMENT_DESCRIPTIONS = new Set(['PANEL', 'INVERTER', 'BATTERY']);

export interface RowOverride {
  qty?: number;
  ratePerUnit?: number;
  gstPct?: number;
}

export interface RateMaster {
  [description: string]: { rate: number; active: boolean };
}

export function localGetMasterEntry(description: string, rateMaster?: RateMaster) {
  if (!rateMaster) return undefined;
  const target = description.toUpperCase();
  if (rateMaster[description]) return rateMaster[description];
  const matchKey = Object.keys(rateMaster).find(k => k.toUpperCase() === target);
  return matchKey ? rateMaster[matchKey] : undefined;
}

export function localResolveRate(
  item: BomItem,
  index: number,
  overrides?: Record<number, RowOverride>,
  rateMaster?: RateMaster,
): number {
  const rowOverride = overrides?.[index];
  if (rowOverride?.ratePerUnit !== undefined) {
    return rowOverride.ratePerUnit;
  }
  const descUpper = item.description.toUpperCase();
  if (!EQUIPMENT_DESCRIPTIONS.has(descUpper)) {
    const masterEntry = localGetMasterEntry(item.description, rateMaster);
    if (masterEntry && masterEntry.active && masterEntry.rate > 0) {
      return masterEntry.rate;
    }
  }
  return item.ratePerUnit;
}
