# Subscription Model

Each client company is an organization. Each organization should have one current subscription in `org_subscriptions` with status `trialing`, `active`, or `past_due`.

Plans live in `subscription_plans` and define default seat limit, prices, and features. The current seed plans are `starter`, `team`, `business`, and `enterprise`.

Subscription statuses:

- `trialing`
- `active`
- `past_due`
- `cancelled`
- `expired`

Billing cycles:

- `monthly`
- `yearly`
- `trial`
- `manual`

Important service files:

- `src/lib/saas/services/subscriptionService.ts`
- `src/lib/saas/services/seatService.ts`
- `src/lib/saas/services/featureAccessService.ts`
- `src/lib/saas/services/managementService.ts`

Super admin operations:

- Assign plan: `assignPlanAsSuperAdmin`
- Change seats: `setSubscriptionSeatLimitAsSuperAdmin`
- Change status: `changeSubscriptionStatusAsSuperAdmin`
- Record payment: `recordManualPaymentAsSuperAdmin`
- Extend period: `extendSubscriptionPeriodAsSuperAdmin`
- Cancel: `cancelSubscriptionAsSuperAdmin`

Seat rules:

- Active and invited users consume invite capacity.
- Disabled users do not consume seats.
- New invite is blocked when used seats reach the subscription seat limit.
- If seat limit is reduced below active users, existing users remain but the org is over limit and new invites are blocked.

Payment rules:

- Manual payments are stored in `subscription_payments`.
- Paid payments can reactivate expired or past-due subscriptions when requested.
- Duplicate invoice numbers are rejected per organization.
- Backdated payments are supported through `paid_at`.

Expiry:

- `scripts/expire_subscriptions.ts` marks expired/past-due subscriptions and logs events.
- Optional grace period is read from `app_settings.subscription_grace_days`.

