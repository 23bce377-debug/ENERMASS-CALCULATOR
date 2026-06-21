# SaaS Architecture

Current state: ENERMASS uses Supabase Auth, organizations, RLS, SaaS subscription tables, one-device binding, central licensed guards, org-admin pages, super-admin pages, audit logs, preflight tests, and smoke tests.

Target state: every protected calculator and ERP flow resolves org context from the authenticated session and active membership, then enforces subscription, feature, device, and role checks before work is done.

System map:

```txt
Supabase Auth
-> active org membership
-> organization
-> subscription status
-> plan features
-> device session
-> role permissions
-> calculator / ERP / inventory / reports / settings
```

Affected files:

- `supabase/migrations/202606200008_saas_database_foundation.sql`
- `supabase/migrations/202606200009_device_binding_challenges.sql`
- `src/lib/saas/**`
- `src/lib/auth/**`
- `src/lib/device/deviceClient.ts`
- `src/app/api/devices/**`
- `src/app/api/settings/**`
- `src/app/api/super-admin/**`
- `src/app/settings/**`
- `src/app/super-admin/**`
- `src/proxy.ts`
- `scripts/saas_preflight.ts`

Known risks:

- Existing client components may still read profile `org_id` for display/data loading. Authorization must remain server-side.
- Service role access bypasses RLS, so every service-role route must derive org from the licensed session or super-admin guard.
- Browser storage loss requires device reset by design.

Migration notes:

- Existing profile org data is backfilled into `org_members`.
- RLS helper functions tolerate both profiles and JWT metadata.
- SaaS migrations are idempotent.

Implementation order:

1. Database and RLS.
2. Services and typed errors.
3. Central licensed guard.
4. Device APIs and client login flow.
5. Org admin and super-admin UI.
6. Enforcement across protected routes.
7. Manual billing and expiry.
8. Audit/security.
9. Preflight and certification.

See `knowledge/saas_subscription_system_guide.md` for operational details.

