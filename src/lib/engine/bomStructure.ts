import { TAX_CONSTANTS } from '@/lib/tax-constants';
import type { BomItem } from '../data/bom';
import { STRUCTURE_CONFIGS, type StructureType } from '../structures/structureConfig';

export interface StructureInputs {
  systemKw: number;
  structureType?: StructureType;
  windSpeedKmph?: number; // e.g. 150 kmph
  weightMultiplier?: number;
  baseRatePerKg?: number;
}

/**
 * Calculates a detailed Engineering BOM for Module Mounting Structures
 * based on the capacity and wind load constraints, replacing flat rate estimation.
 */
export function generateStructureBOM(inputs: StructureInputs): BomItem[] {
  const items: BomItem[] = [];
  const { 
    systemKw, 
    structureType = 'rcc_roof_elevated', 
    windSpeedKmph = 150,
    weightMultiplier: inputWeightMultiplier,
    baseRatePerKg: inputBaseRatePerKg
  } = inputs;

  // If there's no structure required (e.g. some upgrade templates), return empty.
  if (systemKw <= 0) return items;

  // Base kg per kW multiplier based on wind load and structure type.
  // 150 kmph wind load typically requires 80-100 kg/kW for fixed tilt RCC.
  const spec = STRUCTURE_CONFIGS[structureType];
  let weightMultiplier = inputWeightMultiplier ?? spec?.engineeringWeightMultiplier ?? spec?.weightPerKwKg ?? 85; 

  if (windSpeedKmph > 150) weightMultiplier *= 1.2;
  if (windSpeedKmph < 120) weightMultiplier *= 0.85;

  const totalWeightKg = systemKw * weightMultiplier;
  const baseRatePerKg = inputBaseRatePerKg ?? (structureType === 'ground_mount' ? 85 : 81.5);

  if (structureType === 'tin_shed_hook' || structureType === 'trapezoidal_sheet') {
    // Sheet roof mainly consists of Rails and Clamps
    items.push({
      description: 'Aluminium Extruded Rails (Sheet Roof Mount)',
      qty: totalWeightKg,
      unit: 'kg',
      ratePerUnit: 250, // Alu is more expensive
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  } else {
    // Standard RCC / Ground Mount requires columns, rafters, purlins
    items.push({
      description: 'Structure Rafters (3x1.5" tube)',
      qty: totalWeightKg * 0.40, // 40% of weight
      unit: 'kg',
      ratePerUnit: baseRatePerKg,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'Structure Purlins (1.5x1.5" tube)',
      qty: totalWeightKg * 0.45, // 45% of weight
      unit: 'kg',
      ratePerUnit: baseRatePerKg,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    items.push({
      description: 'Columns / Legs (80x80mm box section)',
      qty: totalWeightKg * 0.15, // 15% of weight
      unit: 'kg',
      ratePerUnit: baseRatePerKg,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  }

  // --- ACCESSORIES & HARDWARE ---
  
  // 1. Clamps (Mid & End)
  const totalClamps = Math.ceil(systemKw * 4); // roughly 4 clamps per kW
  items.push({
    description: 'Module Mounting Clamps (Mid/End, Anodized Al)',
    qty: totalClamps,
    unit: 'Nos',
    ratePerUnit: 45,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  // 2. Base Plates & Foundation
  if (structureType !== 'tin_shed_hook' && structureType !== 'trapezoidal_sheet' && structureType !== 'rcc_roof_flush') {
    const columnCount = Math.ceil(systemKw * 0.8); // Roughly 0.8 columns per kW
    
    items.push({
      description: 'Base Plates (150x150x8mm MS/GI)',
      qty: columnCount,
      unit: 'Nos',
      ratePerUnit: 120,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    // Anchor bolts (4 per base plate)
    items.push({
      description: 'Foundation Anchor Bolts (M16, 8.8 Grade)',
      qty: columnCount * 4,
      unit: 'Nos',
      ratePerUnit: 85,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });

    // Non-shrink grout
    items.push({
      description: 'Non-shrink Chemical Grout (25kg bags)',
      qty: Math.ceil(columnCount / 10), // 1 bag per 10 plates
      unit: 'Bags',
      ratePerUnit: 850,
      gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
    });
  }

  // 3. Fasteners
  items.push({
    description: 'SS Fasteners (A2-70, Bolts/Nuts/Washers)',
    qty: Math.ceil(systemKw * 1.5), 
    unit: 'kg',
    ratePerUnit: 350,
    gstPct: TAX_CONSTANTS.BOS_GST_RATE as any
  });

  return items;
}
