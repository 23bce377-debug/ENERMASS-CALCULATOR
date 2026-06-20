import { describe, it, expect } from 'vitest';
import { resolveBomTemplateItem, resolveAllBomItems, BomResolutionContext } from '../bomResolver';

describe('bomResolver', () => {
  const mockCategory = { id: 'cat1', org_id: null, name: 'Electrical', display_order: 1, is_optional: false };
  const mockContext: BomResolutionContext = {
    systemKW: 10,
    panelCount: 20,
    inverterCount: 1,
    batteryCount: 0
  };

  it('evaluates formula CEIL(system_kw / 5)', () => {
    const item = {
      id: 'item1', org_id: null, category_id: 'cat1', sku_code: 'CB01', description: 'Combiner',
      unit: 'nos', unit_rate_min: null, unit_rate_max: null, default_rate: 100,
      qty_formula: 'CEIL(system_kw / 5)', is_survey_dependent: false, civil_required_only: false, notes: null
    };

    const resolved = resolveBomTemplateItem(item, mockCategory, mockContext);
    expect(resolved?.qty).toBe(2);
  });

  it('evaluates formula panel_count * 2', () => {
    const item = {
      id: 'item2', org_id: null, category_id: 'cat1', sku_code: 'CABLE_DC', description: 'DC Cable',
      unit: 'm', unit_rate_min: null, unit_rate_max: null, default_rate: 50,
      qty_formula: 'panel_count * 2', is_survey_dependent: false, civil_required_only: false, notes: null
    };

    const resolved = resolveBomTemplateItem(item, mockCategory, mockContext);
    expect(resolved?.qty).toBe(40);
  });

  it('defaults to qty 1 if no formula', () => {
    const item = {
      id: 'item3', org_id: null, category_id: 'cat1', sku_code: 'INV_1', description: 'Inverter',
      unit: 'nos', unit_rate_min: null, unit_rate_max: null, default_rate: 50000,
      qty_formula: null, is_survey_dependent: false, civil_required_only: false, notes: null
    };

    const resolved = resolveBomTemplateItem(item, mockCategory, mockContext);
    expect(resolved?.qty).toBe(1);
  });

  it('returns null if qty evaluates to 0', () => {
    const item = {
      id: 'item4', org_id: null, category_id: 'cat1', sku_code: 'BATT_1', description: 'Battery',
      unit: 'nos', unit_rate_min: null, unit_rate_max: null, default_rate: 20000,
      qty_formula: 'battery_count', is_survey_dependent: false, civil_required_only: false, notes: null
    };

    const resolved = resolveBomTemplateItem(item, mockCategory, mockContext);
    expect(resolved).toBeNull();
  });

  it('resolveAllBomItems respects rate overrides', () => {
    const items = [{
      id: 'item1', org_id: null, category_id: 'cat1', sku_code: 'SKU1', description: 'Test',
      unit: 'nos', unit_rate_min: null, unit_rate_max: null, default_rate: 100,
      qty_formula: null, is_survey_dependent: false, civil_required_only: false, notes: null
    }];

    const resolved = resolveAllBomItems(items, [mockCategory], mockContext, { 'SKU1': 150 });
    expect(resolved[0].rate).toBe(150);
  });
});
