/**
 * multiTenant.test.ts — Multi-tenancy isolation simulation tests.
 *
 * Verifies TypeScript-layer multi-tenancy constraints:
 * 1. BomCategoryORM scopes global reads to org_id IS NULL
 * 2. BomCategoryORM scopes org reads using OR filter
 * 3. InventoryMovementORM.bulkInsert() rejects cross-org data
 * 4. Empty string orgId is treated as falsy (global scope only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const isArgs: unknown[][] = [];
const orArgs: unknown[][] = [];
const eqArgs: unknown[][] = [];

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  is: vi.fn().mockImplementation((...a) => { isArgs.push(a); return mockChain; }),
  or: vi.fn().mockImplementation((...a) => { orArgs.push(a); return mockChain; }),
  eq: vi.fn().mockImplementation((...a) => { eqArgs.push(a); return mockChain; }),
  single: vi.fn().mockResolvedValue({ data: [], error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  // Make the chain itself resolvable (array result)
  then: vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve({ data: [], error: null })),
};

vi.mock('../src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockChain),
  },
}));

beforeEach(async () => {
  isArgs.length = 0;
  orArgs.length = 0;
  eqArgs.length = 0;
  vi.clearAllMocks();
  mockChain.is.mockImplementation((...a) => { isArgs.push(a); return mockChain; });
  mockChain.or.mockImplementation((...a) => { orArgs.push(a); return mockChain; });
  mockChain.eq.mockImplementation((...a) => { eqArgs.push(a); return mockChain; });
  mockChain.then.mockImplementation((resolve: (v: unknown) => void) => resolve({ data: [], error: null }));
  mockChain.single.mockResolvedValue({ data: null, error: null });
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  // Re-apply mock after clearAllMocks
  const supabaseModule = await import('../src/lib/supabase/client');
  vi.mocked(supabaseModule.supabase.from).mockReturnValue(mockChain as any);
});

// ─── BomCategoryORM — tenant isolation ────────────────────────────────────────

describe('Multi-tenancy: BomCategoryORM — Filter Verification', () => {
  it('getAll() without orgId uses IS NULL filter (not all rows)', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    await BomCategoryORM.getAll();

    // Must call .is('org_id', null) — not use OR which would expose all orgs
    expect(isArgs.some((args) => args[0] === 'org_id' && args[1] === null)).toBe(true);
    expect(orArgs.length).toBe(0);
  });

  it('getAll(orgId) uses OR filter (global + org)', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    await BomCategoryORM.getAll('org-123');

    expect(orArgs.length).toBeGreaterThan(0);
    const filterStr = orArgs[0][0] as string;
    expect(filterStr).toContain('org_id.is.null');
    expect(filterStr).toContain('org-123');
  });

  it('getAll() with empty string orgId uses IS NULL (not all rows)', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    // Empty string is falsy — should behave like no orgId
    await BomCategoryORM.getAll('');

    // With empty string (falsy), should use is(null) not or()
    expect(isArgs.some((args) => args[0] === 'org_id' && args[1] === null)).toBe(true);
    expect(orArgs.length).toBe(0);
  });
});

// ─── InventoryMovementORM — cross-org bulk insert ─────────────────────────────

describe('Multi-tenancy: InventoryMovementORM — Cross-Org Rejection', () => {
  it('bulkInsert rejects records with different org_ids', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');

    await expect(
      InventoryMovementORM.bulkInsert([
        {
          org_id: 'org-A',
          item_id: 'item-1',
          project_id: 'proj-1',
          to_state: 'site',
          quantity: 5,
        },
        {
          org_id: 'org-B', // Different org — must be rejected
          item_id: 'item-1',
          project_id: 'proj-1',
          to_state: 'site',
          quantity: 3,
        },
      ])
    ).rejects.toThrow(/same org_id/);
  });

  it('query() always includes org_id eq filter', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    await InventoryMovementORM.query({ orgId: 'org-XYZ' });

    // Must call .eq('org_id', 'org-XYZ')
    expect(eqArgs.some((args) => args[0] === 'org_id' && args[1] === 'org-XYZ')).toBe(true);
  });
});

// ─── Global row visibility documentation ─────────────────────────────────────

describe('Multi-tenancy: Attack Simulation', () => {
  it('OR filter for org queries includes null (global) rows but not other org rows', async () => {
    const { BomCategoryORM } = await import('../src/backend/orm/bom');
    await BomCategoryORM.getAll('org-legitimate');

    expect(orArgs.length).toBeGreaterThan(0);
    const filter = orArgs[0][0] as string;

    // Must include 'org_id.is.null' (global rows) + specific org
    expect(filter).toContain('org_id.is.null');
    expect(filter).toContain('org-legitimate');

    // Must NOT include a wildcard that would leak ALL org rows
    expect(filter).not.toContain('*');
    // Must NOT contain a pattern that would include arbitrary org data
    expect(filter).not.toMatch(/org_id IS NOT NULL/i);
  });
});
