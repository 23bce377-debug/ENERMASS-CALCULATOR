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

class DeviceKeyStore {
  private dbName = 'enermass-device-db';
  private storeName = 'keys';

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getKeyPair(): Promise<CryptoKeyPair | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get('device-keypair');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async setKeyPair(keyPair: CryptoKeyPair): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(keyPair, 'device-keypair');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // noop
    }
  }

  async getDeviceToken(): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get('device-token');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async setDeviceToken(token: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(token, 'device-token');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // noop
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.delete('device-keypair');
        store.delete('device-token');
        resolve();
      });
    } catch {
      // noop
    }
  }
}

const keyStore = new DeviceKeyStore();

export async function getOrCreateDeviceKeyPair(): Promise<{ publicKeyJwk: string; keyPair: CryptoKeyPair }> {
  let keyPair = await keyStore.getKeyPair();
  if (!keyPair) {
    keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false, // non-extractable!
      ['sign', 'verify']
    );
    await keyStore.setKeyPair(keyPair);
  }

  const publicKeyJwkObj = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return {
    publicKeyJwk: JSON.stringify(publicKeyJwkObj),
    keyPair
  };
}

export async function signChallenge(challengeStr: string, keyPair: CryptoKeyPair): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(challengeStr);
  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    keyPair.privateKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

export function generateClientFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasData = '';
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('EnerMass, 2026! ❄', 2, 2);
      ctx.strokeStyle = 'rgba(0, 102, 153, 0.7)';
      ctx.strokeText('EnerMass, 2026! ❄', 2, 2);
      canvasData = canvas.toDataURL();
    }

    const fingerprintParts = [
      canvasData,
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency ?? '',
      (navigator as any).deviceMemory ?? ''
    ];

    const str = fingerprintParts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  } catch (e) {
    return 'fallback-fingerprint';
  }
}

export async function clearLocalDeviceKeys(): Promise<void> {
  await keyStore.clear();
}

export async function saveDeviceToken(token: string): Promise<void> {
  await keyStore.setDeviceToken(token);
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
  const fingerprintHash = generateClientFingerprint();
  const { publicKeyJwk, keyPair } = await getOrCreateDeviceKeyPair();
  const deviceToken = await keyStore.getDeviceToken();
  
  const challenge = {
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(2)
  };
  const challengeStr = JSON.stringify(challenge);
  const signature = await signChallenge(challengeStr, keyPair);

  const res = await postJson<{ device: { id: string; status: string }; deviceToken?: string }>('/api/devices/verify', {
    device_name: metadata.deviceName,
    browser: metadata.browser,
    os: metadata.os,
    fingerprint_hash: fingerprintHash,
    public_key: publicKeyJwk,
    challenge_str: challengeStr,
    signature: signature,
    device_token: deviceToken
  }, env);

  if (res.deviceToken) {
    await keyStore.setDeviceToken(res.deviceToken);
  }

  return res;
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
