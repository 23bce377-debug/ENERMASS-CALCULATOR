import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logLicenseEvent } from '@/lib/saas/services/licenseAuditService';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { NextResponse } from 'next/server';
import { UnauthorizedRoleError } from '../src/lib/saas/errors';

// Mock dependencies
const mockAudit = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/saas/services/licenseAuditService', () => ({
  logLicenseEvent: (...args: any[]) => mockAudit(...args),
}));

vi.mock('@/lib/auth/requireLicensedSession', () => {
  return {
    requireLicensedSession: vi.fn().mockImplementation(async (request, options, deps) => {
      const url = new URL(request.url);
      const queryOrgId = url.searchParams.get('orgId') ?? url.searchParams.get('org_id');
      if (queryOrgId && queryOrgId !== 'org-1') {
        const auditFn = deps?.audit ?? logLicenseEvent;
        await auditFn({
          orgId: 'org-1',
          userId: 'user-1',
          entityType: 'licensed_session',
          eventType: 'cross_org_attempt',
          eventData: { path: url.pathname, requestedOrgId: queryOrgId },
        });
        throw new UnauthorizedRoleError({ orgId: 'org-1', userId: 'user-1', requestedOrgId: queryOrgId });
      }
      return {
        orgId: 'org-1',
        user: { id: 'user-1' },
        subscription: { id: 'sub-1' },
        device: { id: 'device-1' },
        permissions: {},
      };
    }),
    isLicensedSessionError: (err: any) => {
      return err && (err.name === 'UnauthorizedRoleError' || err.name === 'AuthenticationRequiredError' || err.name === 'MembershipMissingError');
    },
  };
});

describe('Audit & Security Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withLicensedApiRoute Cross-Org Detection', () => {
    it('blocks and logs when request orgId mismatches session orgId', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withLicensedApiRoute(handler, { feature: 'test' });
      
      const req = new Request('http://localhost/api/test?orgId=org-2');
      const response = await wrapped(req, {});
      
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'cross_org_attempt',
        orgId: 'org-1',
      }));
    });

    it('allows request when request orgId matches session orgId', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withLicensedApiRoute(handler, { feature: 'test' });
      
      const req = new Request('http://localhost/api/test?orgId=org-1');
      const response = await wrapped(req, {});
      
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
      expect(mockAudit).not.toHaveBeenCalled(); // No cross-org attempt
    });
  });
});
