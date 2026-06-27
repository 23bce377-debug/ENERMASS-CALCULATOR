import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';
import DeviceResetRequestPage from '@/app/device-reset-request/page';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

const supabaseAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
}));

const deviceClient = vi.hoisted(() => {
  class MockDeviceClientError extends Error {
    readonly code: string;
    readonly redirectTo?: string;

    constructor(code: string, message: string, options: { redirectTo?: string } = {}) {
      super(message);
      this.name = 'DeviceClientError';
      this.code = code;
      this.redirectTo = options.redirectTo;
    }
  }

  return {
    DeviceClientError: MockDeviceClientError,
    DEVICE_BLOCKED_MESSAGE: 'This account is already registered on another device.',
    DEVICE_RESET_MESSAGE: 'Please request a device reset from your company admin.',
    collectSafeDeviceMetadata: vi.fn(() => ({
      deviceName: 'Windows - Chrome',
      browser: 'Chrome',
      os: 'Windows',
    })),
    registerOrVerifyDevice: vi.fn(),
    requestDeviceReset: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: supabaseAuth,
  },
}));

vi.mock('@/lib/device/deviceClient', () => deviceClient);

function render(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;

  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function changeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('device binding frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
    supabaseAuth.signInWithPassword.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    deviceClient.registerOrVerifyDevice.mockResolvedValue({ session: { id: 'session-1' } });
    deviceClient.requestDeviceReset.mockResolvedValue({ request: { id: 'reset-1' } });
  });

  it('redirects to the blocked page when device verification is blocked after login', async () => {
    deviceClient.registerOrVerifyDevice.mockRejectedValue(
      new deviceClient.DeviceClientError('device_blocked', 'blocked', { redirectTo: '/device-blocked' })
    );
    const view = render(<LoginPage />);
    await flush();

    // Switch to credentials mode
    const switchBtn = Array.from(view.container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Admin Credentials')
    );
    if (switchBtn) {
      await act(async () => {
        switchBtn.click();
      });
      await flush();
    }

    changeValue(view.container.querySelector('input[type="email"]') as HTMLInputElement, 'user@example.com');
    changeValue(view.container.querySelector('input[type="password"]') as HTMLInputElement, 'password');
    await submit(view.container.querySelector('form') as HTMLFormElement);

    expect(deviceClient.registerOrVerifyDevice).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/device-blocked?reason=device');
    view.unmount();
  });

  it('shows the missing IndexedDB error state as a blocked-device redirect', async () => {
    deviceClient.registerOrVerifyDevice.mockRejectedValue(
      new deviceClient.DeviceClientError('cookies_blocked', 'cookies unavailable', { redirectTo: '/device-blocked' })
    );
    const view = render(<LoginPage />);
    await flush();

    // Switch to credentials mode
    const switchBtn = Array.from(view.container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Admin Credentials')
    );
    if (switchBtn) {
      await act(async () => {
        switchBtn.click();
      });
      await flush();
    }

    changeValue(view.container.querySelector('input[type="email"]') as HTMLInputElement, 'user@example.com');
    changeValue(view.container.querySelector('input[type="password"]') as HTMLInputElement, 'password');
    await submit(view.container.querySelector('form') as HTMLFormElement);

    expect(router.replace).toHaveBeenCalledWith('/device-blocked?reason=device');
    view.unmount();
  });

  it('submits a reset request with detected browser and OS metadata', async () => {
    const view = render(<DeviceResetRequestPage />);
    await flush();

    changeValue(view.container.querySelector('textarea') as HTMLTextAreaElement, 'I replaced my work laptop.');
    await submit(view.container.querySelector('form') as HTMLFormElement);

    expect(deviceClient.requestDeviceReset).toHaveBeenCalledWith({
      deviceName: 'Windows - Chrome',
      reason: 'I replaced my work laptop.',
    });
    expect(view.container.textContent).toContain('Reset request submitted');
    view.unmount();
  });
});
