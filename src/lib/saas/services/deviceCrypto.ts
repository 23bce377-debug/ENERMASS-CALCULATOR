import 'server-only';

import { createPublicKey, createVerify, type KeyObject } from 'node:crypto';

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64');
}

export function parseDevicePublicKey(publicKey: string): KeyObject {
  const trimmed = publicKey.trim();

  try {
    if (trimmed.startsWith('{')) {
      return createPublicKey({ key: JSON.parse(trimmed), format: 'jwk' });
    }

    return createPublicKey(trimmed);
  } catch (error) {
    throw new Error('Malformed device public key', { cause: error });
  }
}

export function assertValidDevicePublicKey(publicKey: string) {
  parseDevicePublicKey(publicKey);
}

export function verifyDeviceSignature(publicKey: string, nonce: string, signature: string) {
  const key = parseDevicePublicKey(publicKey);
  const verifier = createVerify('sha256');
  verifier.update(nonce);
  verifier.end();

  try {
    return verifier.verify(key, decodeBase64Url(signature));
  } catch {
    return false;
  }
}
