import { type BomItem, type SolarSystem } from '../data/bom';
export { resolveRate, getMasterEntry } from './calculator';

export interface RowOverride {
  qty?: number;
  ratePerUnit?: number;
  gstPct?: number;
}

export interface RateMaster {
  [description: string]: { rate: number; active: boolean };
}