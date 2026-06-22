import { describe, it, expect } from 'vitest';
import {
  generateWebAuthnChallenge,
  verifyWebAuthnChallenge,
  verifyWebAuthnRegistration,
} from '@/lib/security/webauthn';

describe('WebAuthn / Passkeys Cryptographic Service', () => {
  const keyHash = 'a'.repeat(64); // mock key hash

  it('should generate and verify signed challenges correctly', () => {
    const challenge = generateWebAuthnChallenge(keyHash);
    expect(challenge).toBeDefined();
    expect(typeof challenge).toBe('string');

    // Verification should pass for correct key hash
    const isValid = verifyWebAuthnChallenge(challenge, keyHash);
    expect(isValid).toBe(true);

    // Verification should fail for incorrect key hash
    const isInvalidHash = verifyWebAuthnChallenge(challenge, 'b'.repeat(64));
    expect(isInvalidHash).toBe(false);

    // Verification should fail for expired challenges (mock clock)
    const isNotExpired = verifyWebAuthnChallenge(challenge, keyHash, -1);
    expect(isNotExpired).toBe(false);
  });

  it('should reject invalid clientDataJSON types', async () => {
    // clientDataJSON with invalid type
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get', // login instead of registration
        challenge: 'some-challenge',
        origin: 'https://localhost',
      })
    ).toString('base64url');

    const result = await verifyWebAuthnRegistration(
      {
        id: 'cred-id',
        rawId: 'cred-id',
        clientDataJSON,
        attestationObject: 'some-attestation',
      },
      'some-challenge',
      'localhost'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid clientData type');
  });

  it('should reject mismatched challenges', async () => {
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: 'mismatched-challenge',
        origin: 'https://localhost',
      })
    ).toString('base64url');

    const result = await verifyWebAuthnRegistration(
      {
        id: 'cred-id',
        rawId: 'cred-id',
        clientDataJSON,
        attestationObject: 'some-attestation',
      },
      'expected-challenge',
      'localhost'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Challenge mismatch');
  });
});
