import { TAX_CONSTANTS } from '@/lib/tax-constants';
import type { BomItem } from '../data/bom';
import { type StructureType } from '../structures/structureConfig';

export interface CivilEarthingInputs {
  systemKw: number;
  roofAreaSqft?: number;
  structureType?: StructureType;
  laCount?: number;
  earthPits?: number;
  earthStripLengthMeters?: number;
}

export function generateCivilEarthingBOM(inputs: CivilEarthingInputs): BomItem[] {
  const items: BomItem[] = [];
  const { 
    systemKw, 
    roofAreaSqft = systemKw * 100, 
    structureType = 'rcc_roof_elevated',
    laCount: inputLaCount,
    earthPits: inputEarthPits,
    earthStripLengthMeters: inputEarthStripLengthMeters
  } = inputs;

  if (systemKw <= 0) return items;

  // --- EARTHING ---

  // 1. Earth Pits (Chemical)
  const earthPits = inputEarthPits !== undefined && inputEarthPits >= 0
    ? inputEarthPits
    : (2 + Math.max(0, Math.ceil((systemKw - 10) / 10)));
  items.push({
    description: 'Chemical Earthing Kit (Pipe + Compound)',
    qty: earthPits,
    unit: 'Pits',
    ratePerUnit: 2850,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 2. Earthing Strip (GI 25x3mm)
  const earthStripLengthMeters = inputEarthStripLengthMeters !== undefined && inputEarthStripLengthMeters >= 0
    ? inputEarthStripLengthMeters
    : ((earthPits * 5) + Math.sqrt(roofAreaSqft) * 2);
  items.push({
    description: 'Earthing Strip (GI Flat 25x3mm)',
    qty: Math.ceil(earthStripLengthMeters),
    unit: 'Meters',
    ratePerUnit: 100,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 3. Lightning Arrester (LA)
  const laCount = inputLaCount !== undefined && inputLaCount >= 0
    ? inputLaCount
    : Math.max(1, Math.ceil(roofAreaSqft / 1500));
  items.push({
    description: 'Lightning Arrester (Franklin/ESE)',
    qty: laCount,
    unit: 'Nos',
    ratePerUnit: 3500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 4. LA Mast
  items.push({
    description: 'Lightning Arrester Mast (GI, 3m/6m)',
    qty: laCount,
    unit: 'Nos',
    ratePerUnit: 2500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 5. Cu Bonded Electrode & Down Conductor for LA
  items.push({
    description: 'Copper Bonded Electrode (for LA)',
    qty: laCount,
    unit: 'Nos',
    ratePerUnit: 1500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  items.push({
    description: 'LA Down Conductor (Cu 25x3mm)',
    qty: laCount * 15, // Approx 15m drop per LA
    unit: 'Meters',
    ratePerUnit: 400,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 6. Earth Chamber Covers
  items.push({
    description: 'Earthing Pit Chamber Cover (RCC/PVC)',
    qty: earthPits + laCount,
    unit: 'Nos',
    ratePerUnit: 450,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // --- CIVIL WORKS ---

  // For flat roofs/ground mount, add civil material
  if (structureType !== 'tin_shed_hook' && structureType !== 'trapezoidal_sheet') {
    items.push({
      description: 'Portland Cement (50kg)',
      qty: Math.ceil(systemKw * 0.4),
      unit: 'Bags',
      ratePerUnit: 400,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'River Sand / M-Sand',
      qty: Number((systemKw * 0.02).toFixed(2)),
      unit: 'Cubic Meters',
      ratePerUnit: 2100,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'Coarse Aggregate (20mm)',
      qty: Number((systemKw * 0.015).toFixed(2)),
      unit: 'Cubic Meters',
      ratePerUnit: 2500,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'Equipment Foundation Pads (Inverter/ACDB)',
      qty: Math.ceil(systemKw / 25), // 1 pad per 25kW block
      unit: 'Lot',
      ratePerUnit: 3500,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  }

  // --- SAFETY & LOGISTICS ---

  // Walkways and Lifelines for larger systems
  if (systemKw >= 25) {
    items.push({
      description: 'FRP/GI Walkway Grating',
      qty: systemKw * 2, // 2m per kW roughly
      unit: 'Meters',
      ratePerUnit: 1200,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'Caged Access Ladder',
      qty: 1,
      unit: 'Nos',
      ratePerUnit: 15000,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  }

  items.push({
    description: 'Safety & Danger Signage Kit',
    qty: 1,
    unit: 'Lot',
    ratePerUnit: 800,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  return items;
}
