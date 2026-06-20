import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryMovementORM } from '../src/backend/orm/inventory';

// Use vi.hoisted to declare shared mocks before the vi.mock call is hoisted
const { mockEq, mockSelect } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockSelect: vi.fn()
}));

vi.mock('../src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null })
        })
      })
    })
  }
}));

describe('Inventory Isolation and Hardening Tests (Blocker 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: vi.fn().mockReturnThis()
    });
    mockEq.mockReturnValue({
      eq: mockEq,
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis()
    });
  });

  it('prohibits update and delete methods at the ORM layer', () => {
    // Append-only ledger should not expose any mutation methods besides insert/bulkInsert
    expect((InventoryMovementORM as any).update).toBeUndefined();
    expect((InventoryMovementORM as any).delete).toBeUndefined();
  });

  it('scopes all select queries with strict org_id equality filter to prevent cross-tenant leak', async () => {
    await InventoryMovementORM.query({
      orgId: 'legitimate-org-123',
      itemId: 'item-abc'
    });

    // Verify that the query applies the org_id constraint
    expect(mockEq).toHaveBeenCalledWith('org_id', 'legitimate-org-123');
  });

  it('rejects cross-tenant bulk inserts with mismatched org_ids', async () => {
    const movements = [
      { org_id: 'org-A', item_id: 'item-1', project_id: 'p-1', to_state: 'site', quantity: 5 },
      { org_id: 'org-B', item_id: 'item-1', project_id: 'p-1', to_state: 'site', quantity: 3 }
    ];

    await expect(InventoryMovementORM.bulkInsert(movements)).rejects.toThrow(
      /same org_id/
    );
  });
});
