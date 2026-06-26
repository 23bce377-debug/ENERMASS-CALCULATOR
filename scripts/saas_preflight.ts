import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type CheckValue = boolean | string;
type CheckFn = () => Promise<CheckValue> | CheckValue;

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ACTIVATION_KEY_ENCRYPTION_SECRET',
];

const requiredTables = [
  'organisations',
  'profiles',
  'subscription_plans',
  'org_subscriptions',
  'org_members',
  'user_devices',
  'device_reset_requests',
  'subscription_payments',
  'license_events',
  'activation_keys',
  'password_reset_requests',
];

const requiredPlanCodes = ['starter', 'team', 'business', 'enterprise'];
const requiredFeatureKeys = [
  'calculator',
  'erp',
  'inventory',
  'reports',
  'master_data',
  'device_management',
  'billing',
];

const requiredAuditEvents = [
  'subscription_created',
  'subscription_updated',
  'subscription_expired',
  'seat_limit_reached',
  'user_invited',
  'user_disabled',
  'device_registered',
  'device_login_verified',
  'device_mismatch_blocked',
  'device_reset_requested',
  'device_reset_approved',
  'device_reset_rejected',
  'feature_access_denied',
  'payment_recorded',
  'role_changed',
  'cross_org_attempt',
];

const guardedApiRoutes = [
  'src/app/api/bundles/route.ts',
  'src/app/api/bundles/[id]/route.ts',
  'src/app/api/sync/route.ts',
  'src/app/api/procurement/analytics/route.ts',
  'src/app/api/finance/journal/route.ts',
  'src/app/api/profile/route.ts',
  'src/app/api/inverter-yield/route.ts',
  'src/app/api/master/route.ts',
  'src/app/api/erp/bootstrap/route.ts',
  'src/app/api/erp/health/route.ts',
  'src/app/api/dashboard/management/route.ts',
];

const superAdminApiRoutes = [
  'src/app/api/admin/devices/reset-approve/route.ts',
  'src/app/api/admin/devices/reset-reject/route.ts',
];

const guardedLayouts = [
  'src/app/calculator/layout.tsx',
  'src/app/dashboard/layout.tsx',
  'src/app/dashboards/layout.tsx',
  'src/app/inventory/layout.tsx',
  'src/app/master/layout.tsx',
  'src/app/quotes/layout.tsx',
  'src/app/reports/layout.tsx',
  'src/app/settings/layout.tsx',
];

const deviceApiRoutes = [
  'src/app/api/devices/verify/route.ts',
  'src/app/api/devices/reset-request/route.ts',
];

const dangerousPatterns = [
  /catch\s*\{\s*\}/,
  /fallback access/i,
  /default subscription/i,
  /default org/i,
  /skipDeviceCheck/,
  /skipSubscriptionCheck/,
  /TODO auth/i,
  /temporary allow/i,
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;

async function readText(relativePath: string) {
  return fs.readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

async function readAllMigrationSql() {
  const migrationsPath = path.resolve(process.cwd(), 'supabase', 'migrations');
  const entries = await fs.readdir(migrationsPath);
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();
  const contents = await Promise.all(
    sqlFiles.map(async (file) => readText(path.join('supabase', 'migrations', file)))
  );
  return contents.join('\n');
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const absoluteRoot = path.resolve(process.cwd(), root);
  const entries = await fs.readdir(absoluteRoot, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(absoluteRoot, entry.name);
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'coverage', 'dist'].includes(entry.name)) return [];
      return collectSourceFiles(relativePath);
    }
    return /\.(ts|tsx|sql)$/.test(entry.name) ? [relativePath] : [];
  }));
  return files.flat();
}

async function check(name: string, fn: CheckFn) {
  try {
    const result = await fn();
    if (result === true) {
      console.log(`[PASS] ${name}`);
      return true;
    }

    console.error(`[FAIL] ${name}${typeof result === 'string' && result ? `: ${result}` : ''}`);
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${name}: ${message}`);
    return false;
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase service client is unavailable because env vars are missing');
  return supabase;
}

async function tableExists(table: string) {
  const client = requireSupabase();
  const { error } = await client.from(table).select('id').limit(1);
  if (!error) return true;
  if (error.code === '42P01' || error.message.toLowerCase().includes('does not exist')) {
    return `missing table ${table}`;
  }
  return true;
}

async function planSeedsAreReady() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subscription_plans')
    .select('code, features')
    .in('code', requiredPlanCodes);

  if (error) return error.message;

  const byCode = new Map((data ?? []).map((plan) => [String(plan.code), plan]));
  const missingPlans = requiredPlanCodes.filter((code) => !byCode.has(code));
  if (missingPlans.length) return `missing plans ${missingPlans.join(', ')}`;

  for (const code of requiredPlanCodes) {
    const features = (byCode.get(code)?.features ?? {}) as Record<string, unknown>;
    const missingFeatures = requiredFeatureKeys.filter((feature) => !(feature in features));
    if (missingFeatures.length) return `${code} plan missing features ${missingFeatures.join(', ')}`;
  }

  return true;
}

async function activeOrgSubscriptionIsReady() {
  const client = requireSupabase();
  const { data: subscription, error } = await client
    .from('org_subscriptions')
    .select('id, org_id, status, seat_limit, current_period_end, trial_ends_at')
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return error.message;
  if (!subscription) return 'no active, trialing, or past_due org subscription found';

  const { data: org, error: orgError } = await client
    .from('organisations')
    .select('id')
    .eq('id', subscription.org_id)
    .maybeSingle();
  if (orgError) return orgError.message;
  if (!org) return `subscription ${subscription.id} points to a missing organisation`;

  const now = Date.now();
  const endsAt = subscription.status === 'trialing'
    ? subscription.trial_ends_at ?? subscription.current_period_end
    : subscription.current_period_end;
  if (subscription.status !== 'past_due' && endsAt && new Date(endsAt).getTime() <= now) {
    return `subscription ${subscription.id} has status ${subscription.status} but expired period`;
  }

  const { count, error: countError } = await client
    .from('org_members')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', subscription.org_id)
    .eq('status', 'active');
  if (countError) return countError.message;
  if ((count ?? 0) > Number(subscription.seat_limit)) {
    return `active seats ${count ?? 0} exceed seat limit ${subscription.seat_limit}`;
  }

  return true;
}

async function sourceContainsAll(relativePath: string, snippets: string[]) {
  const source = await readText(relativePath);
  const missing = snippets.filter((snippet) => !source.includes(snippet));
  return missing.length ? `${relativePath} missing ${missing.join(', ')}` : true;
}

async function routeUsesLicensedGuard(relativePath: string) {
  const source = await readText(relativePath);
  return source.includes('withLicensedApiRoute')
    ? true
    : `${relativePath} does not use withLicensedApiRoute`;
}

async function routeUsesSuperAdminGuard(relativePath: string) {
  const source = await readText(relativePath);
  return source.includes('requireSuperAdminSession')
    ? true
    : `${relativePath} does not use requireSuperAdminSession`;
}

async function layoutUsesLicensedPage(relativePath: string) {
  const source = await readText(relativePath);
  return source.includes('requireLicensedPage') || source.includes('requireOrgAdminPageSession')
    ? true
    : `${relativePath} does not use a licensed page guard`;
}

async function noDangerousFallbacks() {
  const files = [
    ...(await collectSourceFiles('src/lib/auth')),
    ...(await collectSourceFiles('src/lib/saas')),
    ...(await collectSourceFiles('src/app/api')),
    ...(await collectSourceFiles('scripts')),
  ].filter((file) => file !== 'scripts/saas_preflight.ts');

  const findings: string[] = [];
  for (const file of files) {
    const source = await readText(file);
    for (const pattern of dangerousPatterns) {
      if (pattern.test(source)) findings.push(`${file} matches ${pattern}`);
    }
  }

  return findings.length ? findings.slice(0, 10).join('; ') : true;
}

async function runPreflight() {
  console.log('[SaaS Preflight] Starting hard deployment checks');

  const migrations = await readAllMigrationSql();
  const checks: Array<[string, CheckFn]> = [
    [
      'Build-safe environment variables exist',
      () => {
        const missing = requiredEnvVars.filter((key) => !process.env[key]);
        return missing.length ? `missing ${missing.join(', ')}` : true;
      },
    ],
    ...requiredTables.map<[string, CheckFn]>((table) => [`Database table exists: ${table}`, () => tableExists(table)]),
    [
      'RLS is declared for SaaS tables',
      () => {
        const missing = requiredTables
          .filter((table) => table !== 'organisations' && table !== 'profiles')
          .filter((table) => !migrations.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
        return missing.length ? `missing RLS declarations for ${missing.join(', ')}` : true;
      },
    ],
    [
      'RLS policies are declared for SaaS tables',
      () => {
        const missing = requiredTables
          .filter((table) => table !== 'organisations' && table !== 'profiles')
          .filter((table) => !migrations.includes(`ON public.${table}`));
        return missing.length ? `missing policy declarations for ${missing.join(', ')}` : true;
      },
    ],
    [
      'Seed plans exist with required feature keys',
      planSeedsAreReady,
    ],
    [
      'At least one live org has a usable subscription and valid seat count',
      activeOrgSubscriptionIsReady,
    ],
    [
      'Seat limit is enforced in database and service',
      async () => {
        const errors = await readText('src/lib/saas/errors.ts');
        return (
          migrations.includes('saas_enforce_org_subscription_seat_limit') &&
          migrations.includes('org_members_enforce_seat_limit') &&
          errors.includes('SeatLimitReachedError')
            ? true
            : 'missing database trigger or typed seat-limit error'
        );
      },
    ],
    [
      'One active device per user is enforced',
      () => (
        migrations.includes('user_devices_one_active_per_user_idx') &&
        migrations.includes('device_secret_hash')
          ? true
          : 'missing active-device uniqueness index or simplified device secret schema'
      ),
    ],
    [
      'Device registration flow is wired',
      async () => {
        const filesExist = await Promise.all(deviceApiRoutes.map((file) => fs.access(path.resolve(process.cwd(), file)).then(() => true, () => false)));
        if (filesExist.some((exists) => !exists)) return 'one or more device API routes are missing';
        return sourceContainsAll('src/lib/saas/services/deviceService.ts', [
          'registerDevice',
          'DeviceMismatchError',
          'getActiveForUser',
          'deviceSecretHash',
          'device_registered',
          'device_mismatch_blocked',
        ]);
      },
    ],

    [
      'Device reset approval revokes old device',
      () => sourceContainsAll('src/lib/saas/services/deviceResetService.ts', [
        'approveDeviceReset',
        'userDeviceRepository.revoke',
        'device_reset_approved',
      ]),
    ],
    [
      'Expired subscriptions and active payments are handled',
      () => sourceContainsAll('src/lib/saas/services/subscriptionService.ts', [
        'SubscriptionExpiredError',
        'hasPaidPayment',
        'subscription_expired',
        "subscription.status === 'expired'",
        "subscription.status === 'past_due'",
      ]),
    ],
    [
      'Feature gate blocks disabled features',
      () => sourceContainsAll('src/lib/saas/services/featureAccessService.ts', [
        'assertFeatureAccess',
        'FeatureNotEnabledError',
        'feature_access_denied',
      ]),
    ],
    [
      'Licensed session guard order is implemented',
      () => sourceContainsAll('src/lib/auth/requireLicensedSession.ts', [
        'getAuthenticatedUser',
        'resolveActiveMembership',
        'assertActiveSubscription',
        'assertFeatureAccess',
        'hasAllowedRole',
      ]),
    ],
    [
      'org_id spoofing is rejected from query, header, and body',
      () => sourceContainsAll('src/lib/auth/requireLicensedSession.ts', [
        "searchParams.get('orgId')",
        "searchParams.get('org_id')",
        "request.headers.get('x-org-id')",
        'request.clone().json()',
        'cross_org_attempt',
      ]),
    ],
    ...guardedApiRoutes.map<[string, CheckFn]>((file) => [`Protected API uses licensed guard: ${file}`, () => routeUsesLicensedGuard(file)]),
    ...superAdminApiRoutes.map<[string, CheckFn]>((file) => [`Super admin API uses super admin guard: ${file}`, () => routeUsesSuperAdminGuard(file)]),
    ...guardedLayouts.map<[string, CheckFn]>((file) => [`Protected page uses licensed guard: ${file}`, () => layoutUsesLicensedPage(file)]),
    [
      'Proxy protects SaaS route prefixes without over-protecting public routes',
      () => sourceContainsAll('src/proxy.ts', [
        "'/calculator'",
        "'/dashboard'",
        "'/settings'",
        "'/super-admin'",
        "'/api/calculator'",
        "'/api/admin'",
        "'/login'",
        "'/device-blocked'",
        "'/subscription-expired'",
        "'/api/auth'",
      ]),
    ],
    [
      'Audit events are typed',
      async () => {
        const types = await readText('src/lib/saas/types.ts');
        const repositories = await readText('src/lib/saas/repositories.ts');
        const missing = requiredAuditEvents.filter((event) => !types.includes(event) || !repositories.includes(event));
        return missing.length ? `missing typed audit events ${missing.join(', ')}` : true;
      },
    ],
    [
      'Audit service fails closed on logging failures and exposes list APIs',
      () => sourceContainsAll('src/lib/saas/services/licenseAuditService.ts', [
        '[Audit Log Failure]',
        'throw error',
        'listLicenseEventsByOrg',
        'listAllLicenseEventsAsSuperAdmin',
      ]),
    ],
    [
      'Fake profile membership fallback is removed',
      async () => {
        const source = await readText('src/lib/auth/requireLicensedSession.ts');
        return source.includes('id: `profile:${user.id}`') ? 'profile fallback still fabricates org_members' : true;
      },
    ],
    [
      'Super admin authorization is DB-backed',
      () => sourceContainsAll('src/lib/saas/services/managementService.ts', [
        ".from('profiles')",
        'is_super_admin',
        'await isSuperAdmin(user)',
      ]),
    ],
    [
      'Security hardening migration exists',
      () => {
        const missing = [
          'subscription_payments_unique_org_invoice_idx',
          'org_subscriptions_current_period_required',
          "m.status IN ('active', 'invited')",
          'is_super_admin',
        ].filter((snippet) => !migrations.includes(snippet));
        return missing.length ? `missing ${missing.join(', ')}` : true;
      },
    ],
    [
      'Critical device APIs are rate limited',
      async () => {
        const checks = await Promise.all(deviceApiRoutes.map(async (file) => {
          const source = await readText(file);
          return source.includes('enforceRateLimit') ? null : file;
        }));
        const absent = checks.filter(Boolean);
        return absent.length ? `missing rate limits in ${absent.join(', ')}` : true;
      },
    ],
    [
      'Management UI and manual billing surfaces exist',
      async () => {
        const requiredFiles = [
          'src/app/settings/billing/page.tsx',
          'src/app/settings/users/page.tsx',
          'src/app/settings/devices/page.tsx',
          'src/app/settings/audit-log/page.tsx',
          'src/app/super-admin/orgs/page.tsx',
          'src/app/super-admin/plans/page.tsx',
          'src/app/super-admin/subscriptions/page.tsx',
          'src/app/super-admin/payments/page.tsx',
          'src/app/super-admin/device-resets/page.tsx',
          'src/app/super-admin/audit-log/page.tsx',
        ];
        const missing: string[] = [];
        for (const file of requiredFiles) {
          try {
            await fs.access(path.resolve(process.cwd(), file));
          } catch {
            missing.push(file);
          }
        }
        return missing.length ? `missing ${missing.join(', ')}` : true;
      },
    ],
    [
      'No dangerous SaaS auth fallback patterns are present',
      noDangerousFallbacks,
    ],
  ];

  let failed = false;
  for (const [name, fn] of checks) {
    const ok = await check(name, fn);
    failed = failed || !ok;
  }

  if (failed) {
    console.error('[SaaS Preflight] FAILED. Blocking deployment.');
    process.exit(1);
  }

  console.log('[SaaS Preflight] PASSED. SaaS licensing checks are ready.');
}

runPreflight().catch((error) => {
  console.error('[SaaS Preflight] Unhandled failure:', error);
  process.exit(1);
});
