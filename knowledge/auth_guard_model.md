# Auth Guard Model

Central guard:

- `src/lib/auth/requireLicensedSession.ts`

Required order:

1. Authenticated user.
2. Active organization membership.
3. Active subscription.
4. Feature access.
5. Valid device session.
6. Role permission.

API wrapper:

- `src/lib/auth/withLicensedApiRoute.ts`

Page helper:

- `src/lib/auth/requireLicensedPage.ts`

Authenticated org helper for pre-device login/device APIs:

- `src/lib/auth/withAuthenticatedOrgApiRoute.ts`

Proxy:

- `src/proxy.ts`

Proxy is only a light redirect layer. It does not replace DB authorization. Route handlers, layouts, and server actions perform the real checks.

Org spoofing:

Protected APIs reject mismatched client org context from query, body, or `x-org-id`. Authorization uses `session.orgId`, not request `org_id`.

Redirect mapping:

- unauthenticated: `/login`
- missing or disabled membership: `/login`
- subscription expired or feature disabled: `/subscription-expired`
- device blocked: `/device-blocked`
- wrong role: `/unauthorized`

