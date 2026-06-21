# Device Binding Model

ENERMASS uses one active device per user. The system does not rely only on browser fingerprinting.

Client:

- `src/lib/device/deviceClient.ts`

Backend:

- `src/lib/saas/services/deviceService.ts`
- `src/lib/saas/services/deviceChallengeService.ts`
- `src/lib/saas/services/deviceSessionService.ts`
- `src/lib/saas/services/deviceResetService.ts`
- `src/app/api/devices/**`
- `src/app/api/admin/devices/**`

Flow:

1. Browser creates or loads `device_install_id` in IndexedDB.
2. Browser creates a non-extractable Web Crypto private key.
3. Browser exports public key.
4. Server registers device if user has no active device.
5. Same install ID is allowed.
6. Different active install ID is blocked.
7. Server creates a nonce challenge.
8. Browser signs nonce.
9. Server verifies signature and creates a device session.
10. Server sets `device_session_token`.

Security properties:

- Private key does not leave browser.
- Session token is httpOnly.
- Raw session token is not stored in DB.
- DB stores token hash.
- Device session expiry is enforced.
- Revoked devices invalidate sessions.
- Replayed and expired challenges are blocked.

Reset:

- User requests reset from `/device-reset-request`.
- Org admin approves/rejects from `/settings/device-reset-requests`.
- Super admin can review from `/super-admin/device-resets`.
- Approval revokes old device and old sessions, then allows next login to register a new device.

Worst-case handling:

- Cleared IndexedDB, private browsing, changed browser, or new laptop require reset.
- Multiple tabs reuse the same stored device identity.
- Stolen cookies fail after expiry or device/session revocation.

