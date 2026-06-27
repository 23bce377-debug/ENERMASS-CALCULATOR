import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeAuth = vi.hoisted(() => ({
  userId: '22222222-2222-4222-8222-222222222222',
  orgId: '11111111-1111-4111-8111-111111111111',
}));

const deviceServices = vi.hoisted(() => ({
  registerDevice: vi.fn(),
  requestDeviceReset: vi.fn(),
  approveDeviceReset: vi.fn(),
  rejectDeviceReset: vi.fn(),
}));

vi.mock('@/lib/auth/withAuthenticatedOrgApiRoute', () => ({
  withAuthenticatedOrgApiRoute: vi.fn((handler) => {
    return (request: Request, routeContext = {}) =>
      handler(request, {
        route: routeContext,
        session: {
          user: { id: routeAuth.userId },
          orgId: routeAuth.orgId,
          member: { role: 'staff' },
          subscription: { id: 'subscription-id' },
          permissions: {},
        },
      });
  }),
}));

vi.mock('@/lib/auth/withLicensedApiRoute', () => ({
  withLicensedApiRoute: vi.fn((handler) => {
    return (request: Request, routeContext = {}) =>
      handler(request, {
        route: routeContext,
        session: {
          user: { id: routeAuth.userId },
          orgId: routeAuth.orgId,
          member: { role: 'admin' },
          subscription: { id: 'subscription-id' },
          permissions: { canManageDevices: true },
        },
      });
  }),
}));

vi.mock('@/lib/security/rateLimit', () => ({
  enforceRateLimit: vi.fn().mockReturnValue(null),
}));

const mockRepos = vi.hoisted(() => ({
  mockGetActiveForUser: vi.fn(),
  mockTouch: vi.fn(),
}));

const mockGetActiveForUser = mockRepos.mockGetActiveForUser;
const mockTouch = mockRepos.mockTouch;

vi.mock('@/lib/saas/repositories', () => ({
  UserDeviceRepository: class {
    getActiveForUser = mockRepos.mockGetActiveForUser;
    getActiveForUserAndSecretHash = mockRepos.mockGetActiveForUser;
    touch = mockRepos.mockTouch;
  }
}));

vi.mock('@/lib/saas/services/deviceService', () => ({
  registerDevice: deviceServices.registerDevice,
}));

vi.mock('@/lib/saas/services/deviceResetService', () => ({
  requestDeviceReset: deviceServices.requestDeviceReset,
  approveDeviceReset: deviceServices.approveDeviceReset,
  rejectDeviceReset: deviceServices.rejectDeviceReset,
}));

vi.mock('@/lib/saas/services/managementService', () => ({
  requireSuperAdminSession: vi.fn(async () => ({
    user: { id: routeAuth.userId },
  })),
}));

vi.mock('@/lib/saas', () => ({
  registerDevice: deviceServices.registerDevice,
  requestDeviceReset: deviceServices.requestDeviceReset,
  approveDeviceReset: deviceServices.approveDeviceReset,
  rejectDeviceReset: deviceServices.rejectDeviceReset,
  requireSuperAdminSession: vi.fn(async () => ({
    user: { id: routeAuth.userId },
  })),
  SaasError: class SaasError extends Error {},
}));

function jsonRequest(url: string, body: unknown, cookie?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Vitest Browser',
    'x-forwarded-for': '203.0.113.10',
  };
  if (cookie) {
    headers['cookie'] = cookie;
  }
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('device binding API routes (simplified)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetActiveForUser.mockReset();
    mockTouch.mockReset();
    routeAuth.orgId = '11111111-1111-4111-8111-111111111111';
  });

  it('returns stub device on verification requests', async () => {
    const { POST } = await import('@/app/api/devices/verify/route');
    const response = await POST(jsonRequest('https://example.test/api/devices/verify', {
      device_name: 'Work laptop',
      browser: 'Chrome',
      os: 'Windows',
    }), {});

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.device).toEqual({ id: '00000000-0000-0000-0000-000000000000', status: 'active' });
  });

  it('creates reset requests and lets super admins approve them', async () => {
    deviceServices.requestDeviceReset.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'pending',
      old_device_id: 'device-id',
    });
    deviceServices.approveDeviceReset.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'approved',
    });

    const resetRoute = await import('@/app/api/devices/reset-request/route');
    const approveRoute = await import('@/app/api/admin/devices/reset-approve/route');

    const resetResponse = await resetRoute.POST(jsonRequest('https://example.test/api/devices/reset-request', {
      device_name: 'Work laptop',
      browser: 'Chrome',
      os: 'Windows',
      reason: 'Lost browser cookies',
    }), {});

    const approveResponse = await approveRoute.POST(jsonRequest('https://example.test/api/admin/devices/reset-approve', {
      request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }));

    expect(resetResponse.status).toBe(201);
    expect(approveResponse.status).toBe(200);
    expect(deviceServices.requestDeviceReset).toHaveBeenCalledWith(
      routeAuth.userId,
      routeAuth.orgId,
      expect.objectContaining({
        deviceName: 'Work laptop',
        reason: 'Lost browser cookies',
      })
    );
    expect(deviceServices.approveDeviceReset).toHaveBeenCalledWith(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      routeAuth.userId
    );
  });
});
