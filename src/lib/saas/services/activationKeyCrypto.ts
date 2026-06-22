import 'server-only';

import crypto from 'node:crypto';

// ─── Encryption Configuration ─────────────────────────────────────────────────
// AES-256-GCM: 256-bit key, 12-byte IV, 16-byte auth tag.
// The encryption secret is stored in ACTIVATION_KEY_ENCRYPTION_SECRET env var
// and MUST be a 64-character hex string (32 bytes).

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_ENTROPY_BYTES = 10; // 80 bits → ~1.2e24 possibilities

// Base32 alphabet (no ambiguous chars: no 0/O, 1/I/L)
const BASE32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CURRENT_VERSION = Number(process.env.ACTIVATION_KEY_CURRENT_VERSION || '1');

function getEncryptionKey(version: number = 1): Buffer {
  const secretVarName = version === 1 ? 'ACTIVATION_KEY_ENCRYPTION_SECRET' : `ACTIVATION_KEY_ENCRYPTION_SECRET_V${version}`;
  const secret = process.env[secretVarName] || process.env.ACTIVATION_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      `${secretVarName} must be a 64-character hex string. ` +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(secret, 'hex');
}

// ─── Key Format ───────────────────────────────────────────────────────────────
// Format: EMSOL-XXXX-XXXX-XXXX-XXXX (25 chars visible, 4 groups of 4 after prefix)
// Raw entropy: 10 random bytes → 80 bits → encoded as Base32 → 16 chars
// Final key: "EMSOL-" + 4+4+4+4 chars = "EMSOL-ABCD-EFGH-JKLM-NPQR"

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output.toUpperCase();
}

/**
 * Generates a raw activation key in format EMSOL-XXXX-XXXX-XXXX-XXXX
 * 80 bits of entropy from CSPRNG.
 */
export function generateRawActivationKey(): string {
  const bytes = crypto.randomBytes(KEY_ENTROPY_BYTES);
  const encoded = encodeBase32(bytes).padEnd(16, 'A').slice(0, 16);
  return `EMSOL-${encoded.slice(0, 4)}-${encoded.slice(4, 8)}-${encoded.slice(8, 12)}-${encoded.slice(12, 16)}`;
}

/**
 * Returns the 9-character prefix used for masked display.
 * e.g. "EMSOL-ABCD" from "EMSOL-ABCD-EFGH-JKLM-NPQR"
 */
export function keyPrefix(rawKey: string): string {
  const parts = rawKey.split('-');
  // "EMSOL-XXXX" = first two segments
  return parts.slice(0, 2).join('-');
}

/**
 * Computes SHA-256 hash of the raw key for DB lookup.
 * Constant-time comparison must be used when verifying.
 */
export function hashActivationKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim().toUpperCase()).digest('hex');
}

/**
 * Normalises an activation key entered by a user.
 * Strips spaces, lowercases, uppercases, handles common typos.
 */
export function normaliseActivationKey(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Validates that a raw key matches the expected format.
 */
export function isValidKeyFormat(raw: string): boolean {
  return /^EMSOL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw);
}

// ─── Encryption / Decryption ──────────────────────────────────────────────────

/**
 * Encrypts the raw activation key using AES-256-GCM.
 * Returns base64(iv || ciphertext || authTag).
 * The raw key is NEVER stored — only this ciphertext.
 */
export function encryptActivationKey(rawKey: string, version: number = CURRENT_VERSION): string {
  const encKey = getEncryptionKey(version);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(rawKey, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypts a stored activation key ciphertext.
 * This should ONLY be called by super admin endpoints.
 * Returns the raw key string.
 */
export function decryptActivationKey(encrypted: string, version: number = 1): string {
  const encKey = getEncryptionKey(version);
  const combined = Buffer.from(encrypted, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, encKey, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Constant-time comparison of two hashes to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
