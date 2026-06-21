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

  it('throws cookies_blocked when cookies are disabled', async () => {
    const nav = { ...testNavigator, cookieEnabled: false };
    await expect(
      registerOrVerifyDevice({ navigator: nav })
    ).rejects.toThrowError(
      new DeviceClientError('cookies_blocked', 'Cookies must be enabled to keep this device signed in.', { redirectTo: '/device-blocked' })
    );
  });

  it('sends post request to verify device', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ device: { id: 'device-1', status: 'active' } }),
    });

    const res = await registerOrVerifyDevice({
      navigator: testNavigator,
      fetch: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/devices/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          device_name: 'Windows - Chrome',
          browser: 'Chrome',
          os: 'Windows',
        }),
      })
    );
    expect(res).toEqual({ device: { id: 'device-1', status: 'active' } });
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
