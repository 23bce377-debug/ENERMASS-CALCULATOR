import { TAX_CONSTANTS } from '@/lib/tax-constants';
import type { BomItem } from '../data/bom';

export interface ElectricalInputs {
  systemKw: number;
  panelCount: number;
  inverterCount: number;
  phase: 1 | 3; // 1-phase or 3-phase
  mpptCount?: number;
  distanceToMccbMeters?: number;
}

export function generateElectricalBOM(inputs: ElectricalInputs): BomItem[] {
  const items: BomItem[] = [];
  const { systemKw, panelCount, phase, inverterCount, mpptCount = 2, distanceToMccbMeters = 20 } = inputs;

  const currentAmps = (systemKw * 1000) / (phase === 1 ? 230 : Math.sqrt(3) * 400);

  // --- AC PROTECTION ---
  
  // 1. ACDB Enclosure
  items.push({
    description: `ACDB Enclosure (IP65, ${phase === 1 ? '1-Phase' : '3-Phase'})`,
    qty: 1,
    unit: 'Nos',
    ratePerUnit: phase === 1 ? 1500 : 2500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 2. AC SPD (Type 2)
  items.push({
    description: `AC SPD (Type 2, 320V, ${phase === 1 ? '2-Pole' : '4-Pole'})`,
    qty: 1,
    unit: 'Nos',
    ratePerUnit: phase === 1 ? 1800 : 3500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 3. Main AC Breaker (MCB/MCCB)
  let breakerRating = 16;
  if (currentAmps > 63) breakerRating = 100;
  else if (currentAmps > 40) breakerRating = 63;
  else if (currentAmps > 32) breakerRating = 40;
  else if (currentAmps > 16) breakerRating = 32;

  items.push({
    description: `Main AC ${breakerRating > 63 ? 'MCCB' : 'MCB'} (${breakerRating}A, ${phase === 1 ? '2-Pole' : '4-Pole'})`,
    qty: 1,
    unit: 'Nos',
    ratePerUnit: breakerRating > 63 ? 4500 : (phase === 1 ? 600 : 1200),
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 4. Inverter Output MCBs
  items.push({
    description: `Inverter Output MCB (${phase === 1 ? '2-Pole' : '4-Pole'})`,
    qty: inverterCount,
    unit: 'Nos',
    ratePerUnit: phase === 1 ? 500 : 1000,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // --- DC PROTECTION ---

  const stringCount = Math.ceil(panelCount / 10); // Rough estimate of strings (max 10 panels per string for <10kW)
  const requiredMppts = Math.max(mpptCount, Math.ceil(stringCount / 2));

  // 1. DCDB Enclosure
  items.push({
    description: `DCDB Enclosure (IP65, ${requiredMppts}-in-${requiredMppts}-out)`,
    qty: 1,
    unit: 'Nos',
    ratePerUnit: 1200 + (requiredMppts * 500),
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 2. DC Fuses
  items.push({
    description: 'DC Fuse Link (15A/20A, 1000V) + Holder',
    qty: stringCount * 2, // Positive and Negative per string
    unit: 'Nos',
    ratePerUnit: 350,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 3. DC SPD (Type 2)
  items.push({
    description: 'DC SPD (Type 2, 600V-1000V)',
    qty: requiredMppts, // One per MPPT
    unit: 'Nos',
    ratePerUnit: 1800,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 4. DC Isolator
  items.push({
    description: 'DC Isolator Switch (1000V, 32A)',
    qty: requiredMppts,
    unit: 'Nos',
    ratePerUnit: 1500,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 5. MC4 Connectors
  items.push({
    description: 'MC4 Connectors (Pair, 1000V)',
    qty: (panelCount * 2) + Math.ceil(panelCount * 0.1), // 2 per panel + 10% spare
    unit: 'Pairs',
    ratePerUnit: 80,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // --- CABLING & TERMINATIONS ---

  // 1. DC Cable
  const dcCableMeters = stringCount * 40; // Approx 20m out + 20m back per string
  items.push({
    description: `DC Solar Cable (4mm², Cu, XLPO)`,
    qty: dcCableMeters,
    unit: 'Meters',
    ratePerUnit: 45,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 2. AC Cable
  let acCableSpec = '4mm², 3-Core Cu Armoured';
  let acCableRate = 90;
  if (phase === 3) {
    if (systemKw > 50) { acCableSpec = '35mm², 4-Core Al Armoured'; acCableRate = 250; }
    else if (systemKw > 25) { acCableSpec = '16mm², 4-Core Cu Armoured'; acCableRate = 350; }
    else { acCableSpec = '6mm², 4-Core Cu Armoured'; acCableRate = 180; }
  } else {
    if (systemKw > 6) { acCableSpec = '10mm², 3-Core Cu Armoured'; acCableRate = 180; }
  }

  items.push({
    description: `AC Cable (${acCableSpec})`,
    qty: distanceToMccbMeters * 1.1, // 10% routing wastage
    unit: 'Meters',
    ratePerUnit: acCableRate,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 3. Cable Lugs
  items.push({
    description: `Cable Lugs (Cu/Al Bi-metallic, assorted sizes)`,
    qty: (inverterCount * 4) + 12, // Terminations at Inverter, ACDB, Main DB
    unit: 'Nos',
    ratePerUnit: 45,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 4. Conduit & Tray
  items.push({
    description: 'PVC/GI Conduit (25mm) for DC runs',
    qty: Math.ceil(dcCableMeters / 2), 
    unit: 'Meters',
    ratePerUnit: 80,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  if (systemKw >= 10) {
    items.push({
      description: 'Perforated Cable Tray (100mm) for AC runs',
      qty: Math.ceil(distanceToMccbMeters),
      unit: 'Meters',
      ratePerUnit: 250,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  }

  return items;
}
