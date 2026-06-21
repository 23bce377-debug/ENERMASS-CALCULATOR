'use client';

export const DEVICE_BLOCKED_MESSAGE = 'This account is already registered on another device.';
export const DEVICE_RESET_MESSAGE = 'Please request a device reset from your company admin.';

export type DeviceClientErrorCode =
  | 'device_blocked'
  | 'subscription_expired'
  | 'cookies_blocked'
  | 'network_error'
  | 'verification_failed';

export class DeviceClientError extends Error {
  readonly code: DeviceClientErrorCode;
  readonly redirectTo?: string;
  readonly status?: number;

  constructor(code: DeviceClientErrorCode, message: string, options: { redirectTo?: string; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'DeviceClientError';
    this.code = code;
    this.redirectTo = options.redirectTo;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export interface DeviceMetadata {
  deviceName: string;
  browser: string;
  os: string;
}

interface DeviceClientEnvironment {
  navigator?: Navigator;
  screen?: Screen;
  fetch?: typeof fetch;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  redirectTo?: string;
}

function envValue<T>(provided: T | undefined, fallback: () => T | undefined): T | undefined {
  return provided ?? fallback();
}

function getNavigator(env: DeviceClientEnvironment = {}) {
  return envValue(env.navigator, () => (typeof navigator === 'undefined' ? undefined : navigator));
}

function detectBrowser(userAgent: string) {
  if (/Edg\//u.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//u.test(userAgent)) return 'Opera';
  if (/Chrome\//u.test(userAgent)) return 'Chrome';
  if (/Firefox\//u.test(userAgent)) return 'Firefox';
  if (/Safari\//u.test(userAgent)) return 'Safari';
  return 'Unknown browser';
}

function detectOs(userAgent: string, platform = '') {
  const source = `${userAgent} ${platform}`;
  if (/Windows/u.test(source)) return 'Windows';
  if (/Android/u.test(source)) return 'Android';
  if (/iPhone|iPad|iPod/u.test(source)) return 'iOS';
  if (/Mac/u.test(source)) return 'macOS';
  if (/Linux/u.test(source)) return 'Linux';
  return 'Unknown OS';
}

export function collectSafeDeviceMetadata(env: DeviceClientEnvironment = {}): DeviceMetadata {
  const nav = getNavigator(env);
  const userAgent = nav?.userAgent ?? '';
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent, nav?.platform ?? '');
  const deviceName = [os, browser].filter(Boolean).join(' - ') || 'Current device';

  return { deviceName, browser, os };
}

async function parseApiError(response: Response): Promise<ApiErrorBody> {
  try {
    return await response.json() as ApiErrorBody;
  } catch {
    return {};
  }
}

function normalizeDeviceApiError(response: Response, body: ApiErrorBody) {
  if (response.status === 402 || body.error === 'SubscriptionExpiredError') {
    return new DeviceClientError(
      'subscription_expired',
      'Your subscription is not active. Please renew or contact an administrator.',
      { redirectTo: '/subscription-expired', status: response.status }
    );
  }

  if (
    body.error === 'DeviceMismatchError' ||
    body.error === 'DeviceNotRegisteredError' ||
    body.redirectTo?.startsWith('/device') ||
    response.status === 428
  ) {
    return new DeviceClientError(
      'device_blocked',
      `${DEVICE_BLOCKED_MESSAGE} ${DEVICE_RESET_MESSAGE}`,
      { redirectTo: '/device-blocked', status: response.status }
    );
  }

  if (response.status === 403) {
    return new DeviceClientError(
      'verification_failed',
      body.message ?? 'Your account could not be verified for this device.',
      { redirectTo: body.redirectTo, status: response.status }
    );
  }

  return new DeviceClientError(
    'verification_failed',
    body.message ?? 'Device verification failed. Please try again.',
    { redirectTo: body.redirectTo, status: response.status }
  );
}

async function postJson<T>(url: string, body: unknown, env: DeviceClientEnvironment = {}): Promise<T> {
  const fetcher = env.fetch ?? fetch;

  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new DeviceClientError(
      'network_error',
      'Device verification could not reach the server. Please check your connection and try again.',
      { cause: error }
    );
  }

  if (!response.ok) {
    throw normalizeDeviceApiError(response, await parseApiError(response));
  }

  return await response.json() as T;
}

export async function registerOrVerifyDevice(env: DeviceClientEnvironment = {}) {
  const nav = getNavigator(env);
  if (nav?.cookieEnabled === false) {
    throw new DeviceClientError(
      'cookies_blocked',
      'Cookies must be enabled to keep this device signed in.',
      { redirectTo: '/device-blocked' }
    );
  }

  const metadata = collectSafeDeviceMetadata(env);

  return postJson('/api/devices/verify', {
    device_name: metadata.deviceName,
    browser: metadata.browser,
    os: metadata.os,
  }, env);
}

export async function requestDeviceReset(input: { deviceName?: string; reason?: string }, env: DeviceClientEnvironment = {}) {
  const metadata = collectSafeDeviceMetadata(env);

  return postJson('/api/devices/reset-request', {
    device_name: input.deviceName?.trim() || metadata.deviceName,
    browser: metadata.browser,
    os: metadata.os,
    reason: input.reason?.trim() || undefined,
  }, env);
}
