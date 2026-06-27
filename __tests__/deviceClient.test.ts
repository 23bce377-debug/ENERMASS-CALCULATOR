import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DeviceClientError,
  collectSafeDeviceMetadata,
  registerOrVerifyDevice,
  requestDeviceReset,
} from '@/lib/device/deviceClient';

const testNavigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
  platform: 'Win32',
  language: 'en-US',
  cookieEnabled: true,
} as Navigator;

describe('device client identity (simplified)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('collects device metadata correctly', () => {
    const meta = collectSafeDeviceMetadata({ navigator: testNavigator });
    expect(meta.deviceName).toBe('Windows - Chrome');
    expect(meta.browser).toBe('Chrome');
    expect(meta.os).toBe('Windows');
  });

  it('resolves immediately with stub active device details', async () => {
    const res = await registerOrVerifyDevice({
      navigator: testNavigator,
    });
    expect(res).toEqual({
      device: {
        id: '00000000-0000-0000-0000-000000000000',
        status: 'active',
      },
    });
  });

  it('sends post request to request device reset', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ request: { id: 'reset-1' } }),
    });

    const res = await requestDeviceReset(
      { reason: 'Lost my browser data' },
      { navigator: testNavigator, fetch: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/devices/reset-request',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          device_name: 'Windows - Chrome',
          browser: 'Chrome',
          os: 'Windows',
          reason: 'Lost my browser data',
        }),
      })
    );
    expect(res).toEqual({ request: { id: 'reset-1' } });
  });
});
