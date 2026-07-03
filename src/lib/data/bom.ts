export type GstPct = 0 | 0.05 | 0.089 | 0.12 | 0.138 | 0.18 | 0.28;

export interface BomItem {
  id?: string;
  description: string;
  remarks?: string;
  unit?: string;
  qty: number;
  ratePerUnit: number;
  gstPct?: number; // Kept for temporary backward compat
  hsn_sac_id?: string | null;
  unitWattage?: number;
  sourceTable?: string;
  sourceItemId?: string;
  sourceLabel?: string;
}

export interface SolarSystem {
  id: string;
  name: string;
  category: 'on-grid' | '3-phase' | 'micro-inverter' | 'hybrid' | 'upgrade' | 'commercial' | 'custom';
  capacityKW: number;
  panelWattage: number;
  panelQty: number;
  stateId?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
  targetMarginPct: number;
  items: BomItem[];
  defaultEquipment?: {
    panelMix?: Record<string, number>;
    inverterMix?: Record<string, number>;
    batteryMix?: Record<string, number>;
  };
}

export const SYSTEMS: SolarSystem[] = [];
