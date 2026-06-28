import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateSystemFromDb } from '../src/lib/engine/dbCalculator';
import { getCachedMasterData } from '../src/lib/cache/masterCache';

// Mock getCachedMasterData
vi.mock('../src/lib/cache/masterCache', () => ({
  getCachedMasterData: vi.fn()
}));

// Mock calculateSystem from calculator.ts
vi.mock('../src/lib/engine/calculator', () => ({
  calculateSystem: vi.fn().mockReturnValue({
    lines: [],
    costBeforeGST: 1000,
    totalInputGST: 180,
    totalIncGST: 1180,
    mrpExclGST: 1200,
    mrpInclGST: 1416,
    discountAmount: 0,
    subsidyAmount: 0,
    effectiveMarginPct: 0.2,
    marginAmount: 240,
    finalCustomerPrice: 1416,
    beneficiaryContribution: 1416,
    dailyGenerationKWh: 10,
    annualGenerationKWh: 3650,
    annualSavingsINR: 29200,
    paybackYears: 4.8
  }),
  roundTo5: (n: number) => n,
  roundToINR: (n: number) => n
}));

describe('calculateSystemFromDb (Blocker 3 & 4)', () => {
  const mockClient = {
    query: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly retrieves from cache and database, and runs calculator', async () => {
    // 1. Mock DB queries inside calculateSystemFromDb
    mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM systems')) {
        return { rows: [{ id: 'sys-123', name: 'Test System', capacity_kw: 3, target_margin_pct: 0.2 }] };
      }
      if (sql.includes('FROM state_rules')) {
        return { rows: [{ id: 'state-123', state_name: 'Gujarat', state_code: 'GJ', sun_hours_per_day: 5.5, performance_ratio: 0.78, labour_multiplier: 1.0, gst_on_output: 0.138, grid_tariff_inr: 8.0 }] };
      }
      if (sql.includes('FROM system_items')) {
        return { rows: [
          { id: 'si-1', system_id: 'sys-123', bom_item_id: 'bom-1', description: 'Earthing Rod', default_qty: 2, unit: 'Nos' }
        ] };
      }
      if (sql.includes('FROM eq_communication_devices') || sql.includes('FROM structure_component_master')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    // 2. Mock cached master data
    vi.mocked(getCachedMasterData).mockResolvedValue({
      etag: 'etag-123',
      generatedAt: '2026-06-20T00:00:00.000Z',
      version: '3.0.0',
      orgId: 'org-123',
      panels: [],
      inverters: [],
      batteries: [],
      meters: [],
      lightningArresters: [],
      structures: [],
      weightLookups: [],
      orientationMultipliers: [],
      structureVendors: [],
      structureMaterialRates: [],
      structureTemplates: [],
      structureTemplateItems: [],
      walkwayTemplates: [],
      ladderTemplates: [],
      structureAccessoryRates: [],
      schemes: [],
      schemeOverrides: [],
      systemStateAvailability: [],
      stateTermsTemplates: [],
      slabs: [],
      stateRules: [],
      bomCategories: [],
      bomTemplateItems: [
        { id: 'bom-1', org_id: null, category_id: 'cat-1', sku_code: 'EARTH-ROD', description: 'Earthing Rod', unit: 'Nos', unit_rate_min: 500, unit_rate_max: 700, default_rate: 600, qty_formula: '2', is_survey_dependent: false, civil_required_only: false, notes: '' }
      ],
      rateMaster: [
        { item_name: 'Earthing Rod', override_rate: 650, is_active: true }
      ],
      categoryMargins: [],
      appSettings: {
        default_grid_tariff_inr: 8.5,
        default_validity_days: 30,
        electricity_inflation_pct: 6,
        orientation_factor: 1
      }
    });

    const input = {
      systemId: 'sys-123',
      state: 'Gujarat',
      orgId: 'org-123'
    };

    const result = await calculateSystemFromDb(mockClient as any, input);

    // Verify cache was accessed with correct orgId
    expect(getCachedMasterData).toHaveBeenCalledWith('org-123');

    // Verify DB queries were made for systems, state_rules, system_items
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('FROM systems'), expect.any(Array));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('FROM state_rules'), expect.any(Array));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('FROM system_items'), expect.any(Array));

    // Verify correct properties are calculated
    expect(result.pricing.costBeforeGST).toBe(1000);
    expect(result.energy.paybackYears).toBe(4.8);
  });
});
