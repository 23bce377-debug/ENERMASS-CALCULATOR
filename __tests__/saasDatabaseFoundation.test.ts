import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/202606200008_saas_database_foundation.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

function section(start: string, end: string) {
  const startIndex = normalized.indexOf(start);
  const endIndex = normalized.indexOf(end, startIndex + start.length);
  return normalized.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

describe('SaaS database foundation migration', () => {
  it('blocks cross-org subscription reads with org-scoped RLS', () => {
    expect(normalized).toContain('create policy org_subscriptions_org_read');
    expect(normalized).toContain('on public.org_subscriptions');
    expect(normalized).toContain('using (public.is_superadmin() or org_id = public.auth_org_id())');
  });

  it('blocks cross-org device reads while allowing users to read their own device status', () => {
    expect(normalized).toContain('create policy user_devices_org_or_own_read');
    expect(normalized).toContain('on public.user_devices');
    expect(normalized).toContain('public.is_org_admin(org_id)');
    expect(normalized).toContain('org_id = public.auth_org_id() and user_id = auth.uid()');
  });

  it('does not let non-admin authenticated users update subscriptions', () => {
    const subscriptionPolicies = section(
      'create policy org_subscriptions_org_read',
      'create policy org_members_org_read'
    );

    expect(subscriptionPolicies).toContain('create policy org_subscriptions_admin_manage');
    expect(subscriptionPolicies).toContain('to service_role');
    expect(subscriptionPolicies).toContain('create policy org_subscriptions_superadmin_manage');
    expect(subscriptionPolicies).not.toContain('public.is_org_admin(org_id)');
  });

  it('enforces subscription and member seat-limit integrity', () => {
    expect(normalized).toContain('constraint org_subscriptions_seat_limit_positive check (seat_limit > 0)');
    expect(normalized).toContain('saas_enforce_subscription_plan_seat_limit');
    expect(normalized).toContain('saas_enforce_org_subscription_seat_limit');
    expect(normalized).toContain('org_members_enforce_seat_limit');
  });

  it('allows only one active device per user', () => {
    expect(normalized).toContain('create unique index if not exists user_devices_one_active_per_user_idx');
    expect(normalized).toContain('on public.user_devices(user_id)');
    expect(normalized).toContain("where status = 'active'");
  });

  it('keeps device reset request visibility org-scoped or owner-scoped', () => {
    expect(normalized).toContain('create policy device_reset_requests_org_or_own_read');
    expect(normalized).toContain('on public.device_reset_requests');
    expect(normalized).toContain('public.is_org_admin(org_id)');
    expect(normalized).toContain('org_id = public.auth_org_id() and user_id = auth.uid()');
  });
});
