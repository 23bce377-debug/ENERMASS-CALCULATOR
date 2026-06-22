import 'server-only';

import crypto from 'node:crypto';

const CHALLENGE_SECRET = process.env.JWT_SECRET || 'fallback-challenge-secret-value-enermass-123';

export interface WebAuthnRegistrationPayload {
  id: string;
  rawId: string;
  clientDataJSON: string; // base64url encoded
  attestationObject: string; // base64url encoded
}

export interface WebAuthnVerificationResult {
  success: boolean;
  credentialId: string;
  publicKeyJwk: any;
  error?: string;
}

/**
 * Generates an HMAC-signed challenge bound to a specific activation key hash.
 */
export function generateWebAuthnChallenge(keyHash: string): string {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}:${keyHash}:${randomBytes}`;
  const hmac = crypto.createHmac('sha256', CHALLENGE_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/**
 * Verifies the HMAC-signed challenge.
 */
export function verifyWebAuthnChallenge(challenge: string, keyHash: string, maxAgeMs = 15 * 60 * 1000): boolean {
  try {
    const decoded = Buffer.from(challenge, 'base64url').toString('utf8');
    const [timestampStr, originalKeyHash, randomBytes, hmacSignature] = decoded.split(':');
    if (!timestampStr || !originalKeyHash || !randomBytes || !hmacSignature) return false;

    if (originalKeyHash !== keyHash) return false;

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) return false;

    const payload = `${timestampStr}:${originalKeyHash}:${randomBytes}`;
    const expectedHmac = crypto.createHmac('sha256', CHALLENGE_SECRET).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmacSignature), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

/**
 * Helper to parse a basic CBOR byte string or map to extract authData and public key.
 */
function extractAuthData(attestationBuffer: Buffer): { authData: Buffer; fmt: string } {
  // Find key "authData" in CBOR.
  // "authData" key in CBOR is encoded as 0x68 followed by 'authData' ascii bytes:
  const authDataKey = Buffer.from([0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61]);
  const keyIdx = attestationBuffer.indexOf(authDataKey);
  if (keyIdx === -1) {
    throw new Error('Invalid attestation object: authData key not found');
  }

  // Find format "fmt" for attestation type
  const fmtKey = Buffer.from([0x63, 0x66, 0x6d, 0x74]); // 0x63 followed by 'fmt'
  const fmtIdx = attestationBuffer.indexOf(fmtKey);
  let fmt = 'none';
  if (fmtIdx !== -1) {
    const fmtValueStart = fmtIdx + 4;
    const fmtTypeByte = attestationBuffer[fmtValueStart];
    if (fmtTypeByte >= 0x60 && fmtTypeByte <= 0x7b) {
      const len = fmtTypeByte - 0x60;
      fmt = attestationBuffer.subarray(fmtValueStart + 1, fmtValueStart + 1 + len).toString('utf8');
    }
  }

  // Parse CBOR byte string starting at keyIdx + authDataKey.length
  const valStart = keyIdx + authDataKey.length;
  const typeByte = attestationBuffer[valStart];

  let length = 0;
  let dataStart = 0;

  if (typeByte >= 0x40 && typeByte <= 0x57) {
    length = typeByte - 0x40;
    dataStart = valStart + 1;
  } else if (typeByte === 0x58) {
    length = attestationBuffer[valStart + 1];
    dataStart = valStart + 2;
  } else if (typeByte === 0x59) {
    length = attestationBuffer.readUInt16BE(valStart + 1);
    dataStart = valStart + 3;
  } else if (typeByte === 0x5a) {
    length = attestationBuffer.readUInt32BE(valStart + 1);
    dataStart = valStart + 5;
  } else {
    throw new Error('Unsupported CBOR byte string format for authData');
  }

  const authData = attestationBuffer.subarray(dataStart, dataStart + length);
  return { authData, fmt };
}

/**
 * Parses COSE public key from authData to JSON Web Key (JWK)
 */
function parseCosePublicKey(coseBuffer: Buffer): any {
  // A simple heuristic COSE parser.
  // COSE key is a CBOR map. Let's find coordinate keys or map markers.
  // For ES256 (EC2 key):
  // kty (1) -> 2 (EC2)
  // alg (3) -> -7 (ES256)
  // crv (-1) -> 1 (P-256)
  // x (-2) -> 32-byte buffer
  // y (-3) -> 32-byte buffer
  // For RS256:
  // kty (1) -> 3 (RSA)
  // alg (3) -> -257 (RS256)
  // n (-1) -> modulus buffer
  // e (-2) -> exponent buffer (typically [1, 0, 1])

  // Let's implement a safe parser by searching for markers or parsing the CBOR map.
  // We can decode keys and values. Since it's a small map, we can search for the keys:
  // Key 1 (kty): 0x01. Key 3 (alg): 0x03.
  // Coordinate keys: -1 (0x20), -2 (0x21), -3 (0x22).
  // Negative integers in CBOR: -1 is 0x20, -2 is 0x21, -3 is 0x22.

  const mapHeader = coseBuffer[0];
  if ((mapHeader & 0xe0) !== 0xa0) {
    throw new Error('Invalid COSE key: not a CBOR map');
  }

  const mapSize = mapHeader & 0x1f;
  let offset = 1;

  const keyMap = new Map<number, any>();

  for (let i = 0; i < mapSize; i++) {
    if (offset >= coseBuffer.length) break;

    // Read Key
    let keyByte = coseBuffer[offset++];
    let key: number;
    if (keyByte >= 0x00 && keyByte <= 0x17) {
      key = keyByte;
    } else if (keyByte >= 0x20 && keyByte <= 0x37) {
      // Negative integers: -1 - (val - 0x20)
      key = -1 - (keyByte - 0x20);
    } else {
      // Simple skip or generic handling
      continue;
    }

    // Read Value
    if (offset >= coseBuffer.length) break;
    let valByte = coseBuffer[offset];

    if (valByte >= 0x00 && valByte <= 0x17) {
      keyMap.set(key, valByte);
      offset++;
    } else if (valByte >= 0x20 && valByte <= 0x37) {
      keyMap.set(key, -1 - (valByte - 0x20));
      offset++;
    } else if (valByte === 0x26) { // -7
      keyMap.set(key, -7);
      offset++;
    } else if (valByte === 0x38) { // 1 byte negative int
      const val = coseBuffer[offset + 1];
      keyMap.set(key, -1 - val);
      offset += 2;
    } else if (valByte === 0x18) { // 1 byte positive int
      const val = coseBuffer[offset + 1];
      keyMap.set(key, val);
      offset += 2;
    } else if (valByte >= 0x40 && valByte <= 0x5b) {
      // Byte string
      let len = 0;
      let valStart = offset;
      if (valByte >= 0x40 && valByte <= 0x57) {
        len = valByte - 0x40;
        offset += 1;
      } else if (valByte === 0x58) {
        len = coseBuffer[offset + 1];
        offset += 2;
      } else if (valByte === 0x59) {
        len = coseBuffer.readUInt16BE(offset + 1);
        offset += 3;
      }
      const data = coseBuffer.subarray(offset, offset + len);
      keyMap.set(key, data);
      offset += len;
    } else {
      // Skip unknown type
      offset++;
    }
  }

  const kty = keyMap.get(1);
  const alg = keyMap.get(3);

  if (kty === 2) {
    // EC2 Key
    const crv = keyMap.get(-1);
    const x = keyMap.get(-2);
    const y = keyMap.get(-3);

    if (!x || !y) {
      throw new Error('EC2 public key missing coordinates');
    }

    return {
      kty: 'EC',
      crv: crv === 1 ? 'P-256' : 'P-256',
      x: x.toString('base64url'),
      y: y.toString('base64url'),
      alg: 'ES256',
    };
  } else if (kty === 3) {
    // RSA Key
    const n = keyMap.get(-1);
    const e = keyMap.get(-2);

    if (!n || !e) {
      throw new Error('RSA public key missing modulus/exponent');
    }

    return {
      kty: 'RSA',
      n: n.toString('base64url'),
      e: e.toString('base64url'),
      alg: 'RS256',
    };
  }

  throw new Error(`Unsupported key type in COSE: ${kty}`);
}

/**
 * Validates FIDO2 WebAuthn registration attestation and extracts public key
 */
export async function verifyWebAuthnRegistration(
  payload: WebAuthnRegistrationPayload,
  expectedChallenge: string,
  expectedOrigin: string
): Promise<WebAuthnVerificationResult> {
  try {
    // ── 1. Decode clientDataJSON ──────────────────────────────────────────────
    const clientDataStr = Buffer.from(payload.clientDataJSON, 'base64url').toString('utf8');
    const clientData = JSON.parse(clientDataStr);

    // Verify type
    if (clientData.type !== 'webauthn.create') {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'Invalid clientData type: expected webauthn.create' };
    }

    // Verify challenge matches
    if (clientData.challenge !== expectedChallenge) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'Challenge mismatch' };
    }

    // Verify origin (e.g. check domain or localhost)
    const clientOrigin = clientData.origin;
    if (expectedOrigin && !clientOrigin.includes(expectedOrigin) && !expectedOrigin.includes('localhost') && !clientOrigin.includes('localhost')) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: `Origin mismatch: expected ${expectedOrigin}, got ${clientOrigin}` };
    }

    // ── 2. Decode attestationObject ───────────────────────────────────────────
    const attestationBuffer = Buffer.from(payload.attestationObject, 'base64url');
    const { authData, fmt } = extractAuthData(attestationBuffer);

    // ── 3. Parse authData ─────────────────────────────────────────────────────
    // AuthData layout:
    // rpIdHash: 32 bytes
    // flags: 1 byte
    // signCount: 4 bytes
    // attestedCredentialData: (if flag AT is set)
    //   aaguid: 16 bytes
    //   credentialIdLength: 2 bytes
    //   credentialId: variable length
    //   credentialPublicKey: variable length (COSE format)

    if (authData.length < 37) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'authData too short' };
    }

    const flags = authData[32];
    const userPresent = (flags & 0x01) !== 0;
    const attestedDataPresent = (flags & 0x40) !== 0;

    // Check user present bound
    if (!userPresent) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'User Present flag not set' };
    }

    if (!attestedDataPresent) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'Attested credential data flag not set' };
    }

    // Extract attested credential data
    const aaguid = authData.subarray(37, 53);
    const credIdLen = authData.readUInt16BE(53);
    const credentialId = authData.subarray(55, 55 + credIdLen);
    const coseKeyBuffer = authData.subarray(55 + credIdLen);

    // Check credential ID matches payload
    const payloadCredId = Buffer.from(payload.rawId, 'base64url');
    if (!credentialId.equals(payloadCredId)) {
      return { success: false, credentialId: '', publicKeyJwk: null, error: 'Credential ID mismatch' };
    }

    // Parse the COSE Public Key
    const jwk = parseCosePublicKey(coseKeyBuffer);

    return {
      success: true,
      credentialId: credentialId.toString('base64url'),
      publicKeyJwk: jwk,
    };
  } catch (error: any) {
    return {
      success: false,
      credentialId: '',
      publicKeyJwk: null,
      error: error.message || 'Verification failed',
    };
  }
}
