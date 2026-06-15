export type GuardSeverity = 'blocking' | 'advisory';

export interface ValidationResult {
  guardId: string;
  severity: GuardSeverity;
  message: string;
  suggestion?: string;
}

export interface SystemConfig {
  systemKw: number;
  inverterMaxVdc?: number;
  inverterPhases?: number;
  inverterAcKw?: number;
  sanctionedLoadKw?: number;
  roofAreaSqft?: number;
  meterPhase?: 'single' | 'three' | null;
  dcCapacityKw?: number;
  panelVoc?: number;
  panelCountPerString?: number;
  leadCategory?: string; // Residential, Commercial, Industrial, etc.
}

export function validateSystemConfig(config: SystemConfig): ValidationResult[] {
  const results: ValidationResult[] = [];

  // GUARD 1 — Sanctioned Load Check [BLOCKING]
  if (config.sanctionedLoadKw !== undefined && config.sanctionedLoadKw > 0) {
    if (config.systemKw > config.sanctionedLoadKw) {
      results.push({
        guardId: 'sanctioned_load_exceeded',
        severity: 'blocking',
        message: `System size (${config.systemKw}kW) exceeds sanctioned load (${config.sanctionedLoadKw}kW).`,
        suggestion: 'Customer must apply for load extension at DISCOM before proceeding.',
      });
    }
  }

  // GUARD 2 — Roof Area Feasibility [BLOCKING]
  if (config.roofAreaSqft !== undefined && config.roofAreaSqft > 0) {
    const requiredArea = config.systemKw * 100;
    if (config.roofAreaSqft < requiredArea) {
      const maxKw = Math.floor(config.roofAreaSqft / 100);
      results.push({
        guardId: 'insufficient_roof_area',
        severity: 'blocking',
        message: `Roof area (${config.roofAreaSqft} sqft) insufficient for ${config.systemKw}kW system (needs ~${requiredArea} sqft).`,
        suggestion: `Consider reducing to ${maxKw}kW or verifying actual panel dimensions.`,
      });
    }
  }

  // GUARD 3 — DC/AC Ratio [ADVISORY / BLOCKING]
  if (config.dcCapacityKw !== undefined && config.inverterAcKw !== undefined && config.inverterAcKw > 0) {
    const ratio = config.dcCapacityKw / config.inverterAcKw;
    if (ratio > 1.5) {
      results.push({
        guardId: 'dc_ac_ratio_exceeded',
        severity: 'blocking',
        message: `DC/AC ratio is ${ratio.toFixed(2)}, which exceeds the maximum typical 150% panel DC overload limit for the inverter.`,
        suggestion: 'Upgrade inverter capacity or reduce panel DC capacity to prevent clipping and inverter damage.',
      });
    } else if (ratio < 1.0 || ratio > 1.35) {
      const clippingLosses = Math.max(0, (ratio - 1.2) * 3.5).toFixed(1);
      results.push({
        guardId: 'dc_ac_ratio',
        severity: 'advisory',
        message: `DC/AC ratio is ${ratio.toFixed(2)}. Acceptable range: 1.0–1.35.`,
        suggestion: ratio > 1.35 
          ? `Current config may cause ${clippingLosses}% annual clipping losses.`
          : 'Under-utilization of inverter capacity. Consider adding more panels.',
      });
    }
  }

  // GUARD 4 — Phase Mismatch [BLOCKING]
  if (config.inverterPhases === 1 && config.meterPhase === 'three') {
    results.push({
      guardId: 'phase_mismatch',
      severity: 'blocking',
      message: 'Single-phase inverter selected but customer has a 3-phase meter.',
      suggestion: 'Either select a 3-phase inverter or confirm with DISCOM — unbalanced loading may cause penalties.',
    });
  }

  // Phase Mismatch [ADVISORY]
  if (config.systemKw > 7.5 && config.inverterPhases === 1) {
    results.push({
      guardId: 'high_load_single_phase',
      severity: 'advisory',
      message: `System size is ${config.systemKw}kW but a single-phase inverter is selected.`,
      suggestion: 'Systems above 7.5kW typically require 3-phase connection.',
    });
  }

  // GUARD 5 — Inverter String Sizing [ADVISORY]
  // Fallbacks: panel_voc = 45V, inverter_max_vdc = 600V if not provided
  const panelVoc = config.panelVoc || 45;
  const inverterMaxVdc = config.inverterMaxVdc || 600;
  
  if (config.panelCountPerString !== undefined && config.panelCountPerString > 0) {
    const stringVolts = config.panelCountPerString * panelVoc;
    if (stringVolts > inverterMaxVdc * 0.95) {
      results.push({
        guardId: 'string_sizing',
        severity: 'advisory',
        message: `String voltage (~${Math.round(stringVolts)}V) approaches inverter maximum (${inverterMaxVdc}V).`,
        suggestion: 'Verify panel Voc at minimum temperature (winter) with your designer.',
      });
    }
  }

  // GUARD 6 — System Size vs Category [ADVISORY]
  if (config.leadCategory) {
    const cat = config.leadCategory.toLowerCase();
    if (cat.includes('residential') && config.systemKw > 10) {
      results.push({
        guardId: 'residential_scale',
        severity: 'advisory',
        message: `System size (${config.systemKw}kW) is unusually large for Residential.`,
        suggestion: 'Verify category. Normally Residential is 0.5–10 kW.',
      });
    } else if (cat.includes('commercial') && config.systemKw < 10) {
      results.push({
        guardId: 'commercial_scale',
        severity: 'advisory',
        message: `System size (${config.systemKw}kW) is unusually small for Commercial.`,
        suggestion: 'Verify category. Normally Commercial is 10kW–1MW.',
      });
    } else if (cat.includes('industrial') && config.systemKw <= 100) {
      // The prompt says: "Industrial: > 100kW. Require multi-site or group account flag."
      results.push({
        guardId: 'industrial_scale',
        severity: 'advisory',
        message: `System size (${config.systemKw}kW) is small for Industrial.`,
        suggestion: 'Industrial projects typically exceed 100kW. Require multi-site or group account flag.',
      });
    }
  }

  return results;
}
