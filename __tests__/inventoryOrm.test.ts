/**
 * inventoryOrm.test.ts — Tests for InventoryMovementORM.
 *
 * Key invariants:
 * 1. No update/delete methods exist (append-only enforced at type level)
 * 2. bulkInsert rejects mixed org_id
 * 3. aggregatePosition correctly sums positive and negative quantities
 * 4. checkStock returns correct sufficiency
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// ─── Type-level test: Update is `never` ───────────────────────────────────────

describe('InventoryMovementORM — Type Safety', () => {
  it('does not export an update method', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((InventoryMovementORM as any).update).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((InventoryMovementORM as any).delete).toBeUndefined();
  });

  it('has insert method', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    expect(typeof InventoryMovementORM.insert).toBe('function');
  });

  it('has bulkInsert method', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    expect(typeof InventoryMovementORM.bulkInsert).toBe('function');
  });
});

// ─── bulkInsert validation ────────────────────────────────────────────────────

describe('InventoryMovementORM — bulkInsert', () => {
  it('returns empty array for empty input', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const result = await InventoryMovementORM.bulkInsert([]);
    expect(result).toEqual([]);
  });

  it('throws if records have mixed org_ids', async () => {
    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    await expect(
      InventoryMovementORM.bulkInsert([
        { org_id: 'org-1', item_id: 'item-1', project_id: 'proj-1', to_state: 'site', quantity: 5 },
        { org_id: 'org-2', item_id: 'item-1', project_id: 'proj-1', to_state: 'site', quantity: 3 },
      ])
    ).rejects.toThrow(/same org_id/);
  });
});

// ─── aggregatePosition ────────────────────────────────────────────────────────

describe('InventoryMovementORM — aggregatePosition', () => {
  it('sums positive movements (IN)', async () => {
    const { supabase } = await import('../src/lib/supabase/client');

    // Mock getByItem to return 3 IN movements (positive qty)
    const movements = [
      { id: '1', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', quantity: 10, moved_at: '2026-01-03T00:00:00Z', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-03T00:00:00Z' },
      { id: '2', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', quantity: 5, moved_at: '2026-01-02T00:00:00Z', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-02T00:00:00Z' },
      { id: '3', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', quantity: 2, moved_at: '2026-01-01T00:00:00Z', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: movements, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const pos = await InventoryMovementORM.aggregatePosition('org-1', 'item-1');

    expect(pos.quantity_on_hand).toBe(17); // 10 + 5 + 2
    expect(pos.movement_count).toBe(3);
    expect(pos.last_movement_at).toBe('2026-01-03T00:00:00Z');
  });

  it('correctly handles OUT movements (negative quantity)', async () => {
    const { supabase } = await import('../src/lib/supabase/client');

    const movements = [
      { id: '1', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'site', quantity: -3, moved_at: '2026-01-02T00:00:00Z', from_state: 'warehouse', moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-02T00:00:00Z' },
      { id: '2', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', quantity: 10, moved_at: '2026-01-01T00:00:00Z', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: movements, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const pos = await InventoryMovementORM.aggregatePosition('org-1', 'item-1');

    expect(pos.quantity_on_hand).toBe(7); // 10 - 3 = 7
  });

  it('returns zero for item with no movements', async () => {
    const { supabase } = await import('../src/lib/supabase/client');

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const pos = await InventoryMovementORM.aggregatePosition('org-1', 'unknown-item');

    expect(pos.quantity_on_hand).toBe(0);
    expect(pos.movement_count).toBe(0);
    expect(pos.last_movement_at).toBeNull();
  });
});

// ─── checkStock ───────────────────────────────────────────────────────────────

describe('InventoryMovementORM — checkStock', () => {
  it('returns sufficient: true when stock >= required', async () => {
    const { supabase } = await import('../src/lib/supabase/client');

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ quantity: 20, moved_at: '2026-01-01T00:00:00Z', id: '1', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-01T00:00:00Z' }],
        error: null,
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const result = await InventoryMovementORM.checkStock('org-1', 'item-1', 10);

    expect(result.sufficient).toBe(true);
    expect(result.available).toBe(20);
  });

  it('returns sufficient: false when stock < required', async () => {
    const { supabase } = await import('../src/lib/supabase/client');

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ quantity: 2, moved_at: '2026-01-01T00:00:00Z', id: '1', org_id: 'org-1', item_id: 'item-1', project_id: 'p1', to_state: 'warehouse', from_state: null, moved_by: null, vehicle_number: null, driver_contact: null, site_received_by: null, site_received_at: null, notes: null, created_at: '2026-01-01T00:00:00Z' }],
        error: null,
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as any);

    const { InventoryMovementORM } = await import('../src/backend/orm/inventory');
    const result = await InventoryMovementORM.checkStock('org-1', 'item-1', 10);

    expect(result.sufficient).toBe(false);
    expect(result.available).toBe(2);
  });
});
