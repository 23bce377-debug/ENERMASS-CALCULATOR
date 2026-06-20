/**
 * bomOrm.test.ts — Unit tests for BomCategoryORM and BomTemplateItemORM.
 *
 * Tests verify:
 * - Correct tenant filtering (org_id IS NULL | org_id = orgId)
 * - Formula validation on write (invalid formulas throw before DB call)
 * - bulkInsert validates all formulas before any DB call (fail-fast)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Stable mock state ────────────────────────────────────────────────────────

const capturedIs: unknown[][] = [];
const capturedOr: unknown[][] = [];

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockImplementation((...a) => { capturedIs.push(a); return mockChain; }),
  or: vi.fn().mockImplementation((...a) => { capturedOr.push(a); return mockChain; }),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: '1', org_id: null, name: 'Panels', display_order: 1, is_optional: false }, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  // Allow await on the chain itself (resolves as array result)
  then: vi.fn().mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [{ id: '1', org_id: null, name: 'Panels', display_order: 1, is_optional: false }], error: null })
  ),
};

vi.mock('../src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockChain),
  },
}));

beforeEach(async () => {
  capturedIs.length = 0;
  capturedOr.length = 0;
  vi.clearAllMocks();
  // Restore mocks after clearAllMocks
  mockChain.is.mockImplementation((...a) => { capturedIs.push(a); return mockChain; });
  mockChain.or.mockImplementation((...a) => { capturedOr.push(a); return mockChain; });
  mockChain.select.mockReturnValue(mockChain);
  mockChain.order.mockReturnValue(mockChain);
  mockChain.eq.mockReturnValue(mockChain);
  mockChain.then.mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [{ id: '1', org_id: null, name: 'Panels', display_order: 1, is_optional: false }], error: null })
  );
  mockChain.single.mockResolvedValue({
    data: { id: 'item-1', category_id: 'cat-1', sku_code: 'SKU-001', description: 'Test', unit: 'Nos', qty_formula: 'CEIL(system_kw / 5)' },
    error: null,
  });
  // Re-apply the supabase.from mock after clearAllMocks
  const supabaseModule = await import('../src/lib/supabase/client');
  vi.mocked(supabaseModule.supabase.from).mockReturnValue(mockChain as any);
});

// ─── BomCategoryORM ───────────────────────────────────────────────────────────

describe('BomCategoryORM', () => {
  it('getAll without orgId filters to global rows (org_id IS NULL)', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    const result = await BomCategoryORM.getAll();

    expect(capturedIs.some((a) => a[0] === 'org_id' && a[1] === null)).toBe(true);
    expect(capturedOr.length).toBe(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAll with orgId uses OR filter', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    await BomCategoryORM.getAll('org-123');

    expect(capturedOr.length).toBeGreaterThan(0);
    expect(capturedOr[0][0]).toContain('org_id.is.null');
    expect(capturedOr[0][0]).toContain('org-123');
  });

  it('delete returns true', async () => {
    mockChain.then.mockImplementation((resolve: (v: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null })
    );
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    const result = await BomCategoryORM.delete('cat-1');
    expect(result).toBe(true);
  });
});

// ─── BomTemplateItemORM ───────────────────────────────────────────────────────

describe('BomTemplateItemORM', () => {
  it('rejects invalid qty_formula before DB call', async () => {
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');
    await expect(
      BomTemplateItemORM.upsert({
        category_id: 'cat-1',
        sku_code: 'SKU-001',
        description: 'Test',
        unit: 'Nos',
        qty_formula: 'system_kw $ panel_count', // invalid operator
      })
    ).rejects.toThrow(/Invalid qty_formula/);
  });

  it('rejects security-violating formula before DB call', async () => {
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');
    await expect(
      BomTemplateItemORM.upsert({
        category_id: 'cat-1',
        sku_code: 'SKU-002',
        description: 'Malicious',
        unit: 'Nos',
        qty_formula: 'eval("x")',
      })
    ).rejects.toThrow(/Invalid qty_formula/);
  });

  it('accepts valid qty_formula and calls DB', async () => {
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');
    const result = await BomTemplateItemORM.upsert({
      category_id: 'cat-1',
      sku_code: 'SKU-001',
      description: 'Test',
      unit: 'Nos',
      qty_formula: 'CEIL(system_kw / 5)',
    });
    // Should not throw and should return the mocked data
    expect(result).toBeTruthy();
  });

  it('bulkInsert validates all formulas before any DB call (fail-fast)', async () => {
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');

    await expect(
      BomTemplateItemORM.bulkInsert([
        {
          category_id: 'cat-1',
          sku_code: 'VALID',
          description: 'Valid',
          unit: 'Nos',
          qty_formula: 'panel_count * 2',
        },
        {
          category_id: 'cat-1',
          sku_code: 'INVALID',
          description: 'Invalid',
          unit: 'Nos',
          qty_formula: 'eval("x")', // blocked
        },
      ])
    ).rejects.toThrow(/Invalid qty_formula/);
  });

  it('bulkInsert accepts all-valid formulas', async () => {
    mockChain.then.mockImplementation((resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [{ id: '1' }, { id: '2' }], error: null })
    );
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');

    const result = await BomTemplateItemORM.bulkInsert([
      {
        category_id: 'cat-1',
        sku_code: 'SKU-A',
        description: 'A',
        unit: 'Nos',
        qty_formula: 'panel_count * 2',
      },
      {
        category_id: 'cat-1',
        sku_code: 'SKU-B',
        description: 'B',
        unit: 'm',
        qty_formula: 'CEIL(system_kw / 5)',
      },
    ]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getByCategory passes category_id filter', async () => {
    const { BomTemplateItemORM } = await import('../src/backend/orm/bom');
    await BomTemplateItemORM.getByCategory('cat-abc');

    const supabaseModule = await import('../src/lib/supabase/client');
    expect(supabaseModule.supabase.from).toHaveBeenCalledWith('bom_template_items');
    expect(mockChain.eq).toHaveBeenCalledWith('category_id', 'cat-abc');
  });
});
