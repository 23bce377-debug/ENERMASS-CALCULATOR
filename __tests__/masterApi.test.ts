import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../src/app/api/master/route';
import { getCachedMasterData } from '../src/lib/cache/masterCache';

// Define hoisted mocks to prevent hoisting ReferenceErrors in Vitest
const { mockGetUser, mockSelect, mockSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn()
}));

// Mock getCachedMasterData
vi.mock('../src/lib/cache/masterCache', () => ({
  getCachedMasterData: vi.fn().mockResolvedValue({
    etag: 'mock-etag',
    generatedAt: '2026-06-20T00:00:00.000Z',
    version: '3.0.0',
    panels: [],
    inverters: [],
    batteries: []
  }),
  CACHE_VERSION: '3.0.0'
}));

// Mock Supabase Server client using hoisted mocks
vi.mock('../src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser
    },
    from: mockSelect
  })
}));

describe('Master API Route Security (Blocker 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      select: mockSelect,
      eq: mockSelect,
      single: mockSingle
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    // Mock user profile as null (not logged in)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new Request('http://localhost:3000/api/master');
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects request if user profile org mapping does not exist', async () => {
    // Mock user exists, but profile lookup fails or has no org
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSingle.mockResolvedValue({ data: null, error: new Error('Profile not found') });

    const req = new Request('http://localhost:3000/api/master');
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Org profile not found');
  });

  it('accepts authenticated requests and scopes getCachedMasterData to the user org_id', async () => {
    // Mock successful authentication
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSingle.mockResolvedValue({ data: { org_id: 'org-abc-123', role: 'sales_exec' }, error: null });

    const req = new Request('http://localhost:3000/api/master');
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
    expect(getCachedMasterData).toHaveBeenCalledWith('org-abc-123');

    const body = await res.json();
    expect(body.etag).toBe('mock-etag');
    expect(res.headers.get('ETag')).toBe('"mock-etag"');
  });

  it('ignores any client-supplied org_id query parameter', async () => {
    // Mock successful authentication with org-abc-123
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSingle.mockResolvedValue({ data: { org_id: 'org-abc-123', role: 'sales_exec' }, error: null });

    // Client attempts to supply query param ?org_id=attacker-org
    const req = new Request('http://localhost:3000/api/master?org_id=attacker-org');
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(200);
    // Should still resolve using org-abc-123 exclusively
    expect(getCachedMasterData).toHaveBeenCalledWith('org-abc-123');
    expect(getCachedMasterData).not.toHaveBeenCalledWith('attacker-org');
  });
});
