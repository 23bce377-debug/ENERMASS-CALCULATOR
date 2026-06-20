import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCachedMasterData, invalidateMasterCache } from '../src/lib/cache/masterCache';
import { createClient } from '../src/lib/supabase/server';

// Hoist mocks
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn()
}));

vi.mock('../src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom
  })
}));

describe('masterCache Coherency and SWR Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    invalidateMasterCache(null);
    invalidateMasterCache('org-123');
  });

  const setupDefaultMock = (panelsData: any[] = []) => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.is = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.maybeSingle = vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: null, error: null });
    });
    
    // Make builder a Promise-like object
    builder.then = vi.fn().mockImplementation((onfulfilled) => {
      return Promise.resolve({ data: panelsData, error: null }).then(onfulfilled);
    });

    mockFrom.mockReturnValue(builder);
  };

  it('performs cold load on cache miss', async () => {
    setupDefaultMock();
    const data = await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(data.orgId).toBe('org-123');
    expect(data.version).toBe('3.0.0');
  });

  it('serves from cache on subsequent hits within TTL', async () => {
    setupDefaultMock();
    await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(1);

    const data2 = await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('forces DB reload after explicit invalidation', async () => {
    setupDefaultMock();
    await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(1);

    await invalidateMasterCache('org-123');

    await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('implements SWR (stale-while-revalidate) after TTL expires', async () => {
    setupDefaultMock();
    await getCachedMasterData('org-123');
    expect(createClient).toHaveBeenCalledTimes(1);

    // Fast forward past TTL (3 minutes for org)
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000 + 1000);

    // Call again - should return stale data immediately and start DB refresh in background
    const staleData = await getCachedMasterData('org-123');
    
    // Background refresh calls createClient synchronously in the same event loop tick (up to first await)
    expect(createClient).toHaveBeenCalledTimes(2);
    
    // Wait for background promise to complete
    await vi.runAllTimersAsync();
  });

  it('changes ETag when underlying data changes', async () => {
    // 1. First run with empty panels
    setupDefaultMock([]);
    const data1 = await getCachedMasterData('org-123');
    const etag1 = data1.etag;

    // Invalidate
    await invalidateMasterCache('org-123');

    // 2. Second run with panels data
    setupDefaultMock([
      { id: 'p1', brand: 'BrandA', model: 'ModelA', wattage_w: 400, rate_per_watt: 2, gst_pct: 0.12, is_active: true }
    ]);
    const data2 = await getCachedMasterData('org-123');
    const etag2 = data2.etag;

    expect(etag1).not.toBe(etag2);
  });
});
