# ENERMASS SaaS Subscription System Guide

Last reviewed: 2026-06-21

This guide explains how the ENERMASS SaaS licensing system works end to end: organizations, plans, subscriptions, seats, device binding, route checks, admin screens, and verification.

## Mental Model

ENERMASS is now licensed per organization.

1. A super admin creates or selects an organization.
2. A super admin assigns that organization a subscription plan.
3. The subscription defines the seat limit and enabled features.
4. Org admins invite users until the seat limit is reached.
5. Each user can use one active registered device.
6. Every protected page/API checks auth, membership, subscription, feature, device, and role before allowing access.

The important rule is that client input never decides authorization org context. Protected APIs and pages use the org from the authenticated session and active membership.

## Key Tables

| Table | Purpose |
| --- | --- |
| `organisations` | Client companies. One company equals one tenant. |
| `profiles` | User profile records linked to Supabase auth users. |
| `subscription_plans` | SaaS plans such as Starter, Team, Business, Enterprise. |
| `org_subscriptions` | The current and historical subscription records for each organization. |
| `org_members` | Org membership, role, and seat status. |
| `user_devices` | Registered user devices. Only one active device per user is allowed. |
| `device_challenges` | Short-lived signing challenges for device verification. |
| `device_sessions` | Server-side, hashed device session tokens. |
| `device_reset_requests` | User requests to move to a new device. |
| `subscription_payments` | Manual payment records. |
| `license_events` | Audit trail for license, device, subscription, seat, and security events. |

Schema and RLS are in:

- `supabase/migrations/202606200008_saas_database_foundation.sql`
- `supabase/migrations/202606200009_device_binding_challenges.sql`

Rollback files are in:

- `supabase/rollbacks/202606200008_saas_database_foundation_rollback.sql`
- `supabase/rollbacks/202606200009_device_binding_challenges_rollback.sql`

## Plans and Features

Seeded plans:

| Code | Default Seats | Intended Use |
| --- | ---: | --- |
| `starter` | 1 | Small calculator/report access. |
| `team` | 5 | Team access to calculator, ERP, inventory, reports, device management, billing. |
| `business` | 25 | Larger orgs with higher project limits. |
| `enterprise` | 1000 | Large deployments and manual enterprise handling. |

Feature keys used by guards:

| Feature | Controls |
| --- | --- |
| `calculator` | Calculator and quote calculation flows. |
| `erp` | ERP/bootstrap/operational routes. |
| `inventory` | Inventory pages and APIs. |
| `reports` | Reports pages and APIs. |
| `master_data` | Master data and master cache access. |
| `custom_rates` | Rate override functionality. |
| `device_management` | Device reset and device admin surfaces. |
| `billing` | Billing/subscription management surfaces. |
| `max_projects` | Numeric plan limit for project-related checks. |

## Roles

Org roles:

| Role | Typical Access |
| --- | --- |
| `owner` | All organization management, billing, users, devices. |
| `admin` | Organization management, users, devices, operational modules. |
| `manager` | Calculator, projects, quotes, inventory, limited settings. |
| `staff` | Calculator and quote workflows. |
| `viewer` | Read-only style access where enabled. |

Super admin is not an org role in `org_members`. It is resolved from Supabase user metadata/profile role and checked by `requireSuperAdminSession`.

## How To Give A Subscription From Super Admin

Use the super admin pages:

- `/super-admin/orgs`
- `/super-admin/plans`
- `/super-admin/subscriptions`
- `/super-admin/payments`

Recommended flow:

1. Open `/super-admin/orgs`.
2. Create the organization if it does not exist.
3. Open `/super-admin/plans` and confirm the plan exists and has the needed feature JSON.
4. Open `/super-admin/subscriptions`.
5. Assign a plan to the organization.
6. Set the seat limit.
7. Choose billing cycle: `monthly`, `yearly`, `trial`, or `manual`.
8. Set status to `active` or `trialing`.
9. Open `/super-admin/payments`.
10. Record the manual payment with amount, currency, method, invoice number, and paid date.
11. If renewing an expired or past-due subscription, enable activation/reactivation when recording the paid payment or extend the subscription period from the subscription page.

Backend functions used:

- `assignPlanAsSuperAdmin`
- `setSubscriptionSeatLimitAsSuperAdmin`
- `changeSubscriptionStatusAsSuperAdmin`
- `recordManualPaymentAsSuperAdmin`
- `extendSubscriptionPeriodAsSuperAdmin`
- `cancelSubscriptionAsSuperAdmin`

Server actions live in:

- `src/app/super-admin/actions.ts`

Super admin APIs live in:

- `src/app/api/super-admin/orgs/route.ts`
- `src/app/api/super-admin/plans/route.ts`
- `src/app/api/super-admin/plans/[planId]/features/route.ts`
- `src/app/api/super-admin/subscriptions/route.ts`
- `src/app/api/super-admin/subscriptions/[subscriptionId]/seat-limit/route.ts`
- `src/app/api/super-admin/subscriptions/[subscriptionId]/status/route.ts`
- `src/app/api/super-admin/payments/route.ts`
- `src/app/api/super-admin/device-resets/route.ts`

## Organization Admin Flow

Use the organization admin pages:

- `/settings/billing`
- `/settings/subscription`
- `/settings/users`
- `/settings/devices`
- `/settings/device-reset-requests`
- `/settings/roles`
- `/settings/audit-log`

Org admins can:

- View current plan, subscription status, billing period, payment status, and seat usage.
- Invite users if seats are available.
- Disable users.
- Change user roles.
- See registered devices and active sessions.
- Revoke devices.
- Approve or reject device reset requests.
- Review org-scoped audit logs.

Server actions live in:

- `src/app/settings/saasActions.ts`

Org admin APIs live in:

- `src/app/api/settings/users/route.ts`
- `src/app/api/settings/users/[memberId]/route.ts`
- `src/app/api/settings/devices/route.ts`
- `src/app/api/settings/devices/[deviceId]/revoke/route.ts`
- `src/app/api/settings/device-reset-requests/route.ts`
- `src/app/api/settings/device-reset-requests/[requestId]/approve/route.ts`
- `src/app/api/settings/device-reset-requests/[requestId]/reject/route.ts`

## Seat Counting

Seats are counted from `org_members`.

- `active` users count.
- `invited` users count for invite availability.
- `disabled` users do not count.

If active plus invited users reaches the subscription seat limit, invite is blocked with `SeatLimitReachedError`.

There is also a database trigger:

- `saas_enforce_org_subscription_seat_limit`

This protects against bypasses that insert/update `org_members` directly.

If the super admin reduces the seat limit below current active users, existing users are not automatically disabled. The UI shows an over-limit state, new invites are blocked, and a `seat_limit_reached` audit event is logged.

## Device Binding

Device binding uses server-side state and Web Crypto, not just fingerprinting.

Client library:

- `src/lib/device/deviceClient.ts`

Backend services:

- `src/lib/saas/services/deviceService.ts`
- `src/lib/saas/services/deviceChallengeService.ts`
- `src/lib/saas/services/deviceSessionService.ts`
- `src/lib/saas/services/deviceResetService.ts`
- `src/lib/saas/services/deviceCrypto.ts`

Device APIs:

- `POST /api/devices/register`
- `POST /api/devices/challenge`
- `POST /api/devices/verify`
- `POST /api/devices/reset-request`
- `POST /api/admin/devices/reset-approve`
- `POST /api/admin/devices/reset-reject`

Login device flow:

1. Browser creates or loads a `device_install_id` from IndexedDB.
2. Browser creates a non-extractable Web Crypto private key.
3. Browser exports public key only.
4. API registers the device if no active device exists.
5. API blocks a different active device unless reset was approved.
6. API creates a nonce challenge.
7. Browser signs the nonce.
8. Server verifies the signature with the stored public key.
9. Server creates a device session and sets `device_session_token`.

Cookie rules:

- Name: `device_session_token`
- `httpOnly: true`
- `sameSite: strict`
- `secure` in production
- Raw token is not stored in the database.
- Database stores only the token hash.
- Expiry is enforced.
- Revoked devices invalidate sessions.

## Device Reset Flow

When a user changes browser/laptop or loses IndexedDB/private key:

1. User sees `/device-blocked`.
2. User opens `/device-reset-request`.
3. User submits device name, reason, browser, and OS.
4. Org admin reviews under `/settings/device-reset-requests`.
5. Super admin can also review under `/super-admin/device-resets`.
6. Approval revokes the old device and old sessions.
7. Next login can register the new device.

Important behavior:

- Clearing browser storage loses the private key and requires reset.
- Incognito or another browser will usually appear as a different device.
- Replayed or expired challenges are rejected.
- Stolen cookies are not enough if the device row is revoked or the session expires.

## Licensed Request Check Order

The central guard is:

- `src/lib/auth/requireLicensedSession.ts`

It checks in this order:

1. Authenticated user.
2. Active organization membership.
3. Active subscription.
4. Feature access.
5. Valid device session.
6. Role permission.

It returns:

```ts
{
  user,
  org,
  orgId,
  member,
  subscription,
  device,
  permissions
}
```

API wrapper:

- `src/lib/auth/withLicensedApiRoute.ts`

Page helper:

- `src/lib/auth/requireLicensedPage.ts`

Page failure redirects:

| Failure | Redirect |
| --- | --- |
| Not logged in | `/login` |
| Missing/disabled membership | `/login` |
| Expired/missing subscription | `/subscription-expired` |
| Feature disabled | `/subscription-expired` |
| Device missing/mismatch | `/device-blocked` |
| Wrong role | `/unauthorized` |

The API wrapper rejects spoofed org context from:

- `?org_id=`
- `?orgId=`
- `x-org-id`
- JSON body `org_id`
- JSON body `orgId`

If a client-supplied org id does not match the licensed session org id, the request returns 403 and logs `cross_org_attempt`.

## Protected Routes

Light auth redirect is in:

- `src/proxy.ts`

Full DB/device/license enforcement is in page layouts and API wrappers.

Protected page areas include:

- `/calculator`
- `/dashboard`
- `/dashboards`
- `/erp`
- `/inventory`
- `/master`
- `/projects`
- `/quotes`
- `/reports`
- `/settings`
- `/super-admin`

Protected API areas include:

- `/api/bundles`
- `/api/sync`
- `/api/procurement`
- `/api/finance`
- `/api/profile`
- `/api/settings`
- `/api/super-admin`
- `/api/master`
- `/api/calculator`
- `/api/erp`
- `/api/inventory`
- `/api/admin`

Public routes include:

- `/login`
- `/signup`
- `/device-blocked`
- `/device-reset-request`
- `/subscription-expired`
- `/api/auth`
- `/public`

## Audit Logs

Audit service:

- `src/lib/saas/services/licenseAuditService.ts`

Audit pages:

- `/settings/audit-log`
- `/super-admin/audit-log`

Important logged events:

- `subscription_created`
- `subscription_updated`
- `subscription_expired`
- `payment_recorded`
- `seat_limit_reached`
- `user_invited`
- `user_disabled`
- `role_changed`
- `device_registered`
- `device_login_verified`
- `device_login_blocked`
- `device_mismatch_blocked`
- `device_reset_requested`
- `device_reset_approved`
- `device_reset_rejected`
- `feature_access_denied`
- `cross_org_attempt`
- `invalid_device_session`
- `expired_device_session`
- `revoked_device_attempt`
- `invalid_challenge`
- `replayed_challenge`

Audit logging is designed not to crash the user path if event insert fails. Failures are logged server-side.

## Manual Billing And Expiry

Manual billing is intentionally implemented before payment gateway integration.

Payment records are stored in `subscription_payments`.

Expiry script:

- `scripts/expire_subscriptions.ts`

It:

- Finds active/trialing/past-due subscriptions past `current_period_end` or `trial_ends_at`.
- Applies optional org setting `subscription_grace_days`.
- Marks subscriptions `past_due` or `expired`.
- Does not alter cancelled subscriptions.
- Logs `subscription_expired`.

Preflight:

- `scripts/saas_preflight.ts`

NPM scripts:

- `npm run saas:preflight`
- `npm run saas:test`

## Error Types

Typed SaaS errors are in:

- `src/lib/saas/errors.ts`

| Error | Meaning |
| --- | --- |
| `SubscriptionExpiredError` | No active/trialing subscription or expired period without acceptable payment/grace. |
| `SeatLimitReachedError` | Invite or activation would exceed seats. |
| `DeviceMismatchError` | Session/device does not match active org/user/device. |
| `DeviceNotRegisteredError` | User has no valid active registered device session. |
| `FeatureNotEnabledError` | Plan feature is missing or false. |
| `UnauthorizedRoleError` | User role is not allowed. |
| `MembershipMissingError` | User is not an active member of the org. |

## Runtime Verification Checklist

Run these before deployment:

```bash
npx tsc --noEmit
npm test
npm run saas:test
npm run saas:preflight
npm run build
```

Manual browser checks:

1. `/login` loads without an error overlay.
2. Direct unauthenticated `/calculator` redirects to `/login`.
3. A valid licensed user can register/verify device and enter the app.
4. Expired subscription redirects to `/subscription-expired`.
5. Device mismatch redirects to `/device-blocked`.
6. Super admin pages are unavailable to normal org admins.
7. Org admin settings pages are unavailable to staff/viewer roles.

## Common Operational Questions

### How do I add seats?

Open `/super-admin/subscriptions`, find the organization's subscription, and update the seat limit. The change applies immediately.

### What happens if I reduce seats below current users?

Existing users are not automatically removed. The org becomes over limit, new invites are blocked, and admins must disable users or increase seats.

### How do I renew an expired subscription?

Record a paid manual payment under `/super-admin/payments` and activate/reactivate the subscription, or extend the subscription period from `/super-admin/subscriptions`.

### How do I move a user to a new laptop?

Have the user submit a reset request from `/device-reset-request`, then approve it under `/settings/device-reset-requests` or `/super-admin/device-resets`.

### Why does incognito fail?

Incognito usually cannot access the stored IndexedDB private key and install id, so it behaves like a new device. The backend blocks it unless a reset is approved.

### Can frontend hiding protect an API?

No. Protected APIs must use `withLicensedApiRoute`, and protected server actions must call the management/session guards internally.

