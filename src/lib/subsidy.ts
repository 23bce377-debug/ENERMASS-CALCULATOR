// src/lib/subsidy.ts
export interface SubsidyResult {
  amount: number;
  breakdown: string;
  isEligible: boolean;
  schemeNote: string;
}

export function calculatePMSuryaGharSubsidy(
  systemKw: number,
  category: "residential" | "commercial" | "industrial"
): SubsidyResult {
  if (category !== "residential") {
    return {
      amount: 0,
      breakdown: "Not applicable — commercial/industrial installations excluded",
      isEligible: false,
      schemeNote: "PM Surya Ghar scheme is for residential consumers only",
    };
  }
  if (systemKw > 10) {
    return {
      amount: 0,
      breakdown: `${systemKw}kW exceeds the 10kW residential eligibility ceiling`,
      isEligible: false,
      schemeNote: "Systems above 10kW are not eligible under PM Surya Ghar",
    };
  }
  // Slab calculation per MNRE Budget 2024 notification
  let subsidy = 0;
  let breakdown = "";
  if (systemKw <= 2) {
    subsidy = systemKw * 30000;
    breakdown = `${systemKw}kW × ₹30,000/kW = ₹${subsidy.toLocaleString("en-IN")}`;
  } else if (systemKw <= 3) {
    const tier1 = 2 * 30000;
    const tier2 = (systemKw - 2) * 18000;
    subsidy = tier1 + tier2;
    breakdown = `2kW×₹30,000 + ${(systemKw-2).toFixed(2)}kW×₹18,000 = ₹${subsidy.toLocaleString("en-IN")}`;
  } else {
    // 3kW < systemKw <= 10kW: flat cap at ₹78,000
    subsidy = 78000;
    breakdown = `Capped at ₹78,000 (MNRE ceiling for systems >3kW up to 10kW)`;
  }
  return {
    amount: subsidy,
    breakdown,
    isEligible: true,
    schemeNote: "PM Surya Ghar Muft Bijli Yojana · MNRE 2024 · DISCOM approval required",
  };
}
