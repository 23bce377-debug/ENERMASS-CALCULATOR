export type StructureType =
  | "rcc_roof_elevated"      // RCC roof, elevated tilt (most common)
  | "rcc_roof_flush"         // RCC roof, flush mount
  | "tin_shed_hook"          // Tin/GI sheet roof, hook mount
  | "ground_mount"           // Ground mounted, concrete foundation
  | "carport"                // Vehicle parking canopy
  | "trapezoidal_sheet";     // Industrial trapezoidal sheet

export interface StructureSpec {
  type: StructureType;
  displayName: string;
  weightPerKwKg: number;        // kg per kW installed
  ratePerKwMin: number;         // ₹/kW minimum (HDG, market 2026)
  ratePerKwMax: number;         // ₹/kW maximum
  ratePerKwDefault: number;     // ₹/kW default for quoting
  elevationSurcharge: boolean;  // if true, ask for roof height
  civilRequired: boolean;       // if true, include civil BOM
  notes: string;
}

export const STRUCTURE_CONFIGS: Record<StructureType, StructureSpec> = {
  rcc_roof_elevated: {
    type: "rcc_roof_elevated",
    displayName: "RCC Roof — Elevated Tilt (HDG)",
    weightPerKwKg: 18,        // 18 kg/kW for standard 2-row elevated
    ratePerKwMin: 4500,
    ratePerKwMax: 6000,
    ratePerKwDefault: 5000,
    elevationSurcharge: true,
    civilRequired: true,
    notes: "Add ₹500/kW surcharge if terrace elevation > 15ft from ground"
  },
  rcc_roof_flush: {
    type: "rcc_roof_flush",
    displayName: "RCC Roof — Flush Mount (HDG)",
    weightPerKwKg: 14,
    ratePerKwMin: 3800,
    ratePerKwMax: 5000,
    ratePerKwDefault: 4200,
    elevationSurcharge: false,
    civilRequired: false,
    notes: "Lower material cost, reduced airflow — slightly higher temp losses"
  },
  tin_shed_hook: {
    type: "tin_shed_hook",
    displayName: "Tin/GI Sheet Roof — Hook Mount",
    weightPerKwKg: 8,
    ratePerKwMin: 2800,
    ratePerKwMax: 4000,
    ratePerKwDefault: 3200,
    elevationSurcharge: false,
    civilRequired: false,
    notes: "Verify GI sheet gauge (min 0.5mm). Add waterproofing cost."
  },
  ground_mount: {
    type: "ground_mount",
    displayName: "Ground Mount — Concrete Foundation",
    weightPerKwKg: 28,
    ratePerKwMin: 6000,
    ratePerKwMax: 9000,
    ratePerKwDefault: 7000,
    elevationSurcharge: false,
    civilRequired: true,
    notes: "Includes foundation bolts. Civil (concrete + excavation) billed separately."
  },
  carport: {
    type: "carport",
    displayName: "Carport / Parking Canopy",
    weightPerKwKg: 35,
    ratePerKwMin: 9000,
    ratePerKwMax: 14000,
    ratePerKwDefault: 11000,
    elevationSurcharge: false,
    civilRequired: true,
    notes: "Premium structure. Include wind load design certificate cost (₹8,000–15,000)."
  },
  trapezoidal_sheet: {
    type: "trapezoidal_sheet",
    displayName: "Industrial Trapezoidal Sheet — Top Hook",
    weightPerKwKg: 10,
    ratePerKwMin: 3200,
    ratePerKwMax: 4800,
    ratePerKwDefault: 3800,
    elevationSurcharge: false,
    civilRequired: false,
    notes: "Use L-foot or top-hook clamps only. No drilling into sheet."
  },
};
