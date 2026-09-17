import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as sessionStartPost } from '@/app/api/auth/session-start/route';
import { GET as sessionCheckGet } from '@/app/api/auth/session-check/route';
import { ConcurrentSessionError } from '@/lib/saas/errors';

let mockUser: any = { id: 'test-user-123' };
let mockProfileActiveSessionId: string | null = 'active-session-abc';
let mockCookieSessionId: string | undefined = 'active-session-abc';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
  })),
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      update: vi.fn((payload: any) => {
        if (payload.active_session_id) {
          mockProfileActiveSessionId = payload.active_session_id;
        }
        return {
          eq: vi.fn(() => Promise.resolve({ error: null })),
        };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { active_session_id: mockProfileActiveSessionId },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name: string) => (name === 'enermass_session_id' && mockCookieSessionId ? { value: mockCookieSessionId } : undefined)),
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

describe('Single Active Session & Concurrent Login Prevention', () => {
  beforeEach(() => {
    mockUser = { id: 'test-user-123' };
    mockProfileActiveSessionId = 'active-session-abc';
    mockCookieSessionId = 'active-session-abc';
  });

  it('session-start updates profile active_session_id and sets session cookie', async () => {
    const res = await sessionStartPost();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.sessionId).toBe('string');
    expect(mockProfileActiveSessionId).toBe(data.sessionId);
  });

  it('session-check returns active: true when session cookie matches profile', async () => {
    mockProfileActiveSessionId = 'session-999';
    mockCookieSessionId = 'session-999';

    const res = await sessionCheckGet();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.active).toBe(true);
  });

  it('session-check returns active: false and superseded when another device logged in', async () => {
    mockProfileActiveSessionId = 'new-device-session-xyz';
    mockCookieSessionId = 'old-device-session-abc';

    const res = await sessionCheckGet();
    const data = await res.json();

    expect(data.active).toBe(false);
    expect(data.reason).toBe('superseded');
  });

  it('session-check returns active: false when cookie is missing', async () => {
    mockCookieSessionId = undefined;

    const res = await sessionCheckGet();
    const data = await res.json();

    expect(data.active).toBe(false);
    expect(data.reason).toBe('missing_session_cookie');
  });
});
