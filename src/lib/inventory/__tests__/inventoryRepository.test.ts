import { describe, it, expect, vi } from 'vitest';
import { InventoryRepository } from '../inventoryRepository';

// Mock the createClient from supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null })
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn().mockResolvedValue({ data: [], error: null })
      }))
    }))
  }))
}));

describe('InventoryRepository', () => {
  const repo = new InventoryRepository();

  it('validates negative stock and throws when unavailable', async () => {
    // Mock getPosition to return 0 available
    vi.spyOn(repo, 'getPosition').mockResolvedValueOnce({
      item_id: 'item1',
      project_id: null,
      qty_in_warehouse: 5,
      qty_in_transit: 0,
      qty_at_site: 0,
      qty_installed: 0,
      qty_commissioned: 0,
      qty_scrapped: 0,
      total_tracked: 5
    });

    await expect(repo.validateNoNegativeStock('item1', null, 'WAREHOUSE', 10))
      .rejects.toThrow(/Negative stock prevented/);
  });

  it('allows movement when stock is sufficient', async () => {
    vi.spyOn(repo, 'getPosition').mockResolvedValueOnce({
      item_id: 'item1',
      project_id: null,
      qty_in_warehouse: 15,
      qty_in_transit: 0,
      qty_at_site: 0,
      qty_installed: 0,
      qty_commissioned: 0,
      qty_scrapped: 0,
      total_tracked: 15
    });

    await expect(repo.validateNoNegativeStock('item1', null, 'WAREHOUSE', 10))
      .resolves.not.toThrow();
  });
});
