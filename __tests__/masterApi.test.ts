import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedMasterData } from '../src/lib/cache/masterCache';

const routeAuth = vi.hoisted(() => ({
  shouldReject: false,
  sessionOrgId: 'org-abc-123',
}));

vi.mock('@/lib/auth/withLicensedApiRoute', () => ({
  withLicensedApiRoute: vi.fn((handler) => {
    return async (request: Request, route: unknown) => {
      if (routeAuth.shouldReject) {
        return Response.json(
          {
            error: 'AuthenticationRequiredError',
            message: 'Please sign in to continue.',
            redirectTo: '/login',
          },
          { status: 401 }
        );
      }

      return handler(request, {
        route,
        session: {
          orgId: routeAuth.sessionOrgId,
        },
      });
    };
  }),
}));

vi.mock('../src/lib/cache/masterCache', () => ({
  getCachedMasterData: vi.fn().mockResolvedValue({
    etag: 'mock-etag',
    generatedAt: '2026-06-20T00:00:00.000Z',
    version: '3.0.0',
    panels: [],
    inverters: [],
    batteries: [],
  }),
  CACHE_VERSION: '3.0.0',
}));

import { GET } from '../src/app/api/master/route';

describe('Master API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.shouldReject = false;
    routeAuth.sessionOrgId = 'org-abc-123';
  });

  it('rejects unauthenticated direct API requests before route logic runs', async () => {
    routeAuth.shouldReject = true;

    const res = await GET(new Request('http://localhost:3000/api/master'), { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: 'AuthenticationRequiredError',
      redirectTo: '/login',
    });
    expect(getCachedMasterData).not.toHaveBeenCalled();
  });

  it('accepts licensed requests and scopes getCachedMasterData to the session org', async () => {
    const res = await GET(new Request('http://localhost:3000/api/master'), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(getCachedMasterData).toHaveBeenCalledWith('org-abc-123');

    const body = await res.json();
    expect(body.etag).toBe('mock-etag');
    expect(res.headers.get('ETag')).toBe('"mock-etag"');
  });

  it('ignores any client-supplied org_id query parameter', async () => {
    const res = await GET(new Request('http://localhost:3000/api/master?org_id=attacker-org'), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(getCachedMasterData).toHaveBeenCalledWith('org-abc-123');
    expect(getCachedMasterData).not.toHaveBeenCalledWith('attacker-org');
  });

  it('ignores any client-supplied orgId query parameter', async () => {
    const res = await GET(new Request('http://localhost:3000/api/master?orgId=attacker-org'), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(getCachedMasterData).toHaveBeenCalledWith('org-abc-123');
    expect(getCachedMasterData).not.toHaveBeenCalledWith('attacker-org');
  });
});

