# SaaS Execution Plan

This file records the completed implementation plan and the order to re-run or audit it.

## Database Design

Tables:

- `subscription_plans`
- `org_subscriptions`
- `org_members`
- `user_devices`
- `device_challenges`
- `device_sessions`
- `device_reset_requests`
- `subscription_payments`
- `license_events`

RLS design:

- Org users read only their org data.
- Org admins manage members/devices inside their org.
- Super admins manage SaaS entities globally.
- Service role inserts audit events and performs controlled server-side mutations.
- License events are read by org scope or super admin.

## Service Design

Repositories live in `src/lib/saas/repositories.ts`.

Services live in `src/lib/saas/services/`.

No repository should expose raw client `org_id` as authorization authority. Services receive org context from guards or super-admin workflows.

## API Design

Protected operational APIs use `withLicensedApiRoute`.

Pre-device APIs use `withAuthenticatedOrgApiRoute` only where a valid device session cannot exist yet, such as registration/challenge/verify/reset-request.

Management APIs:

- Org admin: `src/app/api/settings/**`
- Super admin: `src/app/api/super-admin/**`

## Frontend Page Design

Org admin:

- `/settings/billing`
- `/settings/subscription`
- `/settings/users`
- `/settings/devices`
- `/settings/device-reset-requests`
- `/settings/roles`
- `/settings/audit-log`

Super admin:

- `/super-admin/orgs`
- `/super-admin/plans`
- `/super-admin/subscriptions`
- `/super-admin/payments`
- `/super-admin/device-resets`
- `/super-admin/audit-log`

Device UX:

- `/device-blocked`
- `/device-reset-request`

## Middleware/Proxy Design

`src/proxy.ts` protects route prefixes for optimistic login redirects. Heavy authorization remains in route handlers, layouts, and server actions.

## Test Design

Test files include:

- `__tests__/saasDatabaseFoundation.test.ts`
- `__tests__/saasServices.test.ts`
- `__tests__/licensedSessionGuard.test.ts`
- `__tests__/deviceBindingApi.test.ts`
- `__tests__/deviceBindingFrontend.test.tsx`
- `__tests__/deviceClient.test.ts`
- `__tests__/managementService.test.ts`
- `__tests__/manualBilling.test.ts`
- `__tests__/auditSecurity.test.ts`
- `__tests__/saasEnforcement.test.ts`
- `__tests__/saasAccessControl.test.ts`
- `__tests__/saas_smoke_live.test.ts`

## Rollback Strategy

1. Stop scheduled expiry jobs.
2. Disable new SaaS route enforcement only if emergency access is required.
3. Run rollback SQL from `supabase/rollbacks`.
4. Revert SaaS code paths if schema rollback is used.
5. Re-run `npx tsc --noEmit`, `npm test`, and `npm run build`.

## Certification Gate

Do not certify until all pass:

```bash
npx tsc --noEmit
npm test
npm run saas:test
npm run saas:preflight
npm run build
```

See `knowledge/saas_subscription_system_guide.md` for the human operating guide.

