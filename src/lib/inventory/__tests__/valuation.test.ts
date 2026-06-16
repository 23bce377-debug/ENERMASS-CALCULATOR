import { describe, it, expect, vi } from 'vitest';
import { consumeInventoryFIFO } from '../valuation';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'layer1', remaining_qty: 10, unit_cost: 100 },
            { id: 'layer2', remaining_qty: 20, unit_cost: 110 }
          ],
          error: null
        })
      }))
    }))
  }))
}));

describe('Inventory Valuation FIFO', () => {
  it('should consume layers correctly for a valid quantity', async () => {
    const result = await consumeInventoryFIFO('org1', 'wh1', 'item1', 15);
    
    expect(result.layersConsumed).toHaveLength(2);
    
    // First layer should be fully consumed (10 qty @ 100)
    expect(result.layersConsumed[0]).toMatchObject({ layerId: 'layer1', qtyConsumed: 10, unitCost: 100 });
    
    // Second layer should be partially consumed (5 qty @ 110)
    expect(result.layersConsumed[1]).toMatchObject({ layerId: 'layer2', qtyConsumed: 5, unitCost: 110 });
    
    // Total cost = (10 * 100) + (5 * 110) = 1000 + 550 = 1550
    expect(result.totalCost).toBe(1550);
  });

  it('should throw error when trying to consume more than available', async () => {
    await expect(consumeInventoryFIFO('org1', 'wh1', 'item1', 50)).rejects.toThrow('Insufficient inventory');
  });

  it('should throw error for negative quantity', async () => {
    await expect(consumeInventoryFIFO('org1', 'wh1', 'item1', -5)).rejects.toThrow('must be greater than zero');
  });
});
