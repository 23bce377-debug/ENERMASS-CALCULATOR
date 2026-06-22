import 'server-only';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type {
  ActivationKey,
  BillingCycle,
  DeviceInfo,
  DevicePayload,
  DeviceResetRequest,
  DeviceResetStatus,
  DeviceStatus,
  LicenseEvent,
  LicenseEventPayload,
  OrgMember,
  OrgMemberRole,
  OrgMemberStatus,
  OrgSubscription,
  PasswordResetRequest,
  PaymentMethod,
  PaymentStatus,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionStatus,
  TableInsert,
  TableRow,
  TableUpdate,
  UserDevice,
} from './types';

type UserClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;
type SaasClient = UserClient | AdminClient;
type ClientFactory = () => SaasClient | Promise<SaasClient>;

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");
const featureMapSchema = z.object({
  calculator: z.boolean().optional(),
  erp: z.boolean().optional(),
  inventory: z.boolean().optional(),
  reports: z.boolean().optional(),
  master_data: z.boolean().optional(),
  device_management: z.boolean().optional(),
  billing: z.boolean().optional(),
  custom_rates: z.boolean().optional(),
  max_projects: z.number().int().nonnegative().optional(),
}).strict();
const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']);
const billingCycleSchema = z.enum(['monthly', 'yearly', 'trial', 'manual']);
const memberRoleSchema = z.enum(['owner', 'admin', 'manager', 'staff', 'viewer']);
const memberStatusSchema = z.enum(['invited', 'active', 'disabled']);
const deviceStatusSchema = z.enum(['active', 'pending', 'revoked']);
const sessionStatusSchema = z.enum(['active', 'revoked', 'expired']);
const resetStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
const challengeStatusSchema = z.enum(['active', 'used', 'expired']);
const paymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'refunded', 'cancelled']);
const paymentMethodSchema = z.enum(['manual', 'bank_transfer', 'upi', 'cash', 'cheque', 'card']);

function typedRecord<T extends object>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

function throwDbError(context: string, error: { message?: string } | null | undefined): never {
  throw new Error(`${context}: ${error?.message ?? 'Unknown database error'}`);
}

async function resolveClient(factory: ClientFactory): Promise<SaasClient> {
  return factory();
}

abstract class RepositoryBase<TableName extends string> {
  constructor(
    protected readonly table: TableName,
    private readonly clientFactory: ClientFactory = createClient
  ) {}

  protected async client() {
    return resolveClient(this.clientFactory);
  }

  async getById(id: string): Promise<TableRow<TableName> | null> {
    uuidSchema.parse(id);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throwDbError(`Failed to fetch ${String(this.table)} by id`, error);
    return data;
  }

  async listByOrgId(orgId: string): Promise<TableRow<TableName>[]> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from(this.table)
      .select('*')
      .eq('org_id', orgId);

    if (error) throwDbError(`Failed to list ${String(this.table)} by org`, error);
    return data ?? [];
  }

  async getByOrgId(orgId: string): Promise<TableRow<TableName> | null> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from(this.table)
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) throwDbError(`Failed to fetch ${String(this.table)} by org`, error);
    return data;
  }

  protected async insert(payload: TableInsert<TableName>): Promise<TableRow<TableName>> {
    const client = await this.client();
    const { data, error } = await (client as any)
      .from(this.table)
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) throwDbError(`Failed to create ${String(this.table)}`, error);
    if (!data) throwDbError(`Failed to create ${String(this.table)}`, null);
    return data;
  }

  protected async patch(id: string, updates: TableUpdate<TableName>): Promise<TableRow<TableName>> {
    uuidSchema.parse(id);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from(this.table)
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throwDbError(`Failed to update ${String(this.table)}`, error);
    if (!data) throwDbError(`Failed to update ${String(this.table)}`, null);
    return data;
  }

  protected async updateStatus(id: string, status: string, extras: TableUpdate<TableName> = {} as TableUpdate<TableName>) {
    return this.patch(id, { ...extras, status } as TableUpdate<TableName>);
  }
}

const planCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).regex(/^[a-z0-9_-]+$/i),
  monthly_price: z.number().nonnegative().optional(),
  yearly_price: z.number().nonnegative().optional(),
  seat_limit: z.number().int().positive().optional(),
  features: featureMapSchema.optional(),
  is_active: z.boolean().optional(),
});

export class SubscriptionPlanRepository extends RepositoryBase<'subscription_plans'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('subscription_plans', clientFactory);
  }

  async listActive(): Promise<SubscriptionPlan[]> {
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('monthly_price', { ascending: true });

    if (error) throwDbError('Failed to list active subscription plans', error);
    return data ?? [];
  }

  async getByCode(code: string): Promise<SubscriptionPlan | null> {
    z.string().min(1).parse(code);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('subscription_plans')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) throwDbError('Failed to fetch subscription plan by code', error);
    return data;
  }

  create(input: z.input<typeof planCreateSchema>) {
    return this.insert(typedRecord(planCreateSchema, input) as TableInsert<'subscription_plans'>);
  }

  update(id: string, input: Partial<z.input<typeof planCreateSchema>>) {
    return this.patch(id, planCreateSchema.partial().parse(input) as TableUpdate<'subscription_plans'>);
  }

  deactivate(id: string) {
    return this.patch(id, { is_active: false });
  }
}

const subscriptionCreateSchema = z.object({
  plan_id: uuidSchema,
  status: subscriptionStatusSchema.optional(),
  seat_limit: z.number().int().positive().optional(),
  billing_cycle: billingCycleSchema.optional(),
  current_period_start: z.string().datetime().nullable().optional(),
  current_period_end: z.string().datetime().nullable().optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  cancelled_at: z.string().datetime().nullable().optional(),
});

export class OrgSubscriptionRepository extends RepositoryBase<'org_subscriptions'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('org_subscriptions', clientFactory);
  }

  async getActiveByOrgId(orgId: string): Promise<OrgSubscription | null> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('org_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throwDbError('Failed to fetch active org subscription', error);
    return data;
  }

  create(orgId: string, input: z.input<typeof subscriptionCreateSchema>) {
    uuidSchema.parse(orgId);
    return this.insert({ ...subscriptionCreateSchema.parse(input), org_id: orgId } as TableInsert<'org_subscriptions'>);
  }

  update(id: string, input: Partial<z.input<typeof subscriptionCreateSchema>>) {
    return this.patch(id, subscriptionCreateSchema.partial().parse(input) as TableUpdate<'org_subscriptions'>);
  }

  changeStatus(id: string, status: SubscriptionStatus) {
    return this.updateStatus(id, subscriptionStatusSchema.parse(status));
  }

  cancel(id: string) {
    return this.patch(id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
  }
}

const memberCreateSchema = z.object({
  user_id: uuidSchema,
  role: memberRoleSchema.optional(),
  status: memberStatusSchema.optional(),
});

export class OrgMemberRepository extends RepositoryBase<'org_members'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('org_members', clientFactory);
  }

  async getByOrgAndUser(orgId: string, userId: string): Promise<OrgMember | null> {
    uuidSchema.parse(orgId);
    uuidSchema.parse(userId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('org_members')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throwDbError('Failed to fetch org member', error);
    return data;
  }

  async countBillableSeats(orgId: string): Promise<{ active: number; invited: number }> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const [active, invited] = await Promise.all([
      (client as any).from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
      (client as any).from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'invited'),
    ]);

    if (active.error) throwDbError('Failed to count active seats', active.error);
    if (invited.error) throwDbError('Failed to count invited seats', invited.error);
    return { active: active.count ?? 0, invited: invited.count ?? 0 };
  }

  create(orgId: string, input: z.input<typeof memberCreateSchema>) {
    uuidSchema.parse(orgId);
    return this.insert({ ...memberCreateSchema.parse(input), org_id: orgId } as TableInsert<'org_members'>);
  }

  update(id: string, input: Partial<z.input<typeof memberCreateSchema>>) {
    return this.patch(id, memberCreateSchema.partial().parse(input) as TableUpdate<'org_members'>);
  }

  changeStatus(id: string, status: OrgMemberStatus) {
    return this.updateStatus(id, memberStatusSchema.parse(status));
  }

  changeRole(id: string, role: OrgMemberRole) {
    return this.patch(id, { role: memberRoleSchema.parse(role) });
  }

  disableByOrgAndUser(orgId: string, userId: string) {
    uuidSchema.parse(orgId);
    uuidSchema.parse(userId);
    return this.updateByFilter(orgId, userId, { status: 'disabled' });
  }

  private async updateByFilter(orgId: string, userId: string, updates: TableUpdate<'org_members'>): Promise<OrgMember> {
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('org_members')
      .update(updates)
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) throwDbError('Failed to update org member', error);
    if (!data) throwDbError('Failed to update org member', null);
    return data;
  }
}

const devicePayloadSchema = z.object({
  deviceSecretHash: z.string(),
  deviceName: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
});

export class UserDeviceRepository extends RepositoryBase<'user_devices'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('user_devices', clientFactory);
  }

  async getActiveForUser(userId: string): Promise<UserDevice | null> {
    uuidSchema.parse(userId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throwDbError('Failed to fetch active user device', error);
    return data;
  }

  create(orgId: string, userId: string, input: DevicePayload) {
    uuidSchema.parse(orgId);
    uuidSchema.parse(userId);
    const payload = devicePayloadSchema.parse(input);
    return this.insert({
      org_id: orgId,
      user_id: userId,
      device_secret_hash: payload.deviceSecretHash,
      device_name: payload.deviceName ?? null,
      browser: payload.browser ?? null,
      os: payload.os ?? null,
      status: 'active',
    } as TableInsert<'user_devices'>);
  }

  update(id: string, input: Partial<DevicePayload> & { status?: DeviceStatus }) {
    const payload = devicePayloadSchema.partial().extend({ status: deviceStatusSchema.optional() }).parse(input);
    return this.patch(id, {
      device_secret_hash: payload.deviceSecretHash,
      device_name: payload.deviceName,
      browser: payload.browser,
      os: payload.os,
      status: payload.status,
      last_seen_at: new Date().toISOString(),
    } as TableUpdate<'user_devices'>);
  }

  touch(id: string) {
    return this.patch(id, { last_seen_at: new Date().toISOString() });
  }

  revoke(id: string) {
    return this.patch(id, { status: 'revoked', revoked_at: new Date().toISOString() });
  }
}

const resetInfoSchema = z.object({
  deviceName: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
});

export class DeviceResetRequestRepository extends RepositoryBase<'device_reset_requests'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('device_reset_requests', clientFactory);
  }

  create(orgId: string, userId: string, oldDeviceId: string | null, requestedDeviceInfo: DeviceInfo) {
    uuidSchema.parse(orgId);
    uuidSchema.parse(userId);
    if (oldDeviceId) uuidSchema.parse(oldDeviceId);
    return this.insert({
      org_id: orgId,
      user_id: userId,
      old_device_id: oldDeviceId,
      requested_device_info: resetInfoSchema.parse(requestedDeviceInfo) as TableInsert<'device_reset_requests'>['requested_device_info'],
      status: 'pending',
    } as TableInsert<'device_reset_requests'>);
  }

  update(id: string, input: { status?: DeviceResetStatus; reviewed_by?: string | null; reviewed_at?: string | null }) {
    return this.patch(id, z.object({
      status: resetStatusSchema.optional(),
      reviewed_by: uuidSchema.nullable().optional(),
      reviewed_at: z.string().datetime().nullable().optional(),
    }).parse(input) as TableUpdate<'device_reset_requests'>);
  }

  approve(id: string, adminUserId: string) {
    uuidSchema.parse(adminUserId);
    return this.update(id, { status: 'approved', reviewed_by: adminUserId, reviewed_at: new Date().toISOString() });
  }

  reject(id: string, adminUserId: string) {
    uuidSchema.parse(adminUserId);
    return this.update(id, { status: 'rejected', reviewed_by: adminUserId, reviewed_at: new Date().toISOString() });
  }
}

const paymentCreateSchema = z.object({
  subscription_id: uuidSchema,
  amount: z.number().nonnegative(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
  payment_status: paymentStatusSchema.optional(),
  payment_method: paymentMethodSchema.optional(),
  invoice_number: z.string().nullable().optional(),
  paid_at: z.string().datetime().nullable().optional(),
});

export class SubscriptionPaymentRepository extends RepositoryBase<'subscription_payments'> {
  constructor(clientFactory: ClientFactory = createClient) {
    super('subscription_payments', clientFactory);
  }

  create(orgId: string, input: z.input<typeof paymentCreateSchema>) {
    uuidSchema.parse(orgId);
    return this.insert({ ...paymentCreateSchema.parse(input), org_id: orgId } as TableInsert<'subscription_payments'>);
  }

  update(id: string, input: Partial<z.input<typeof paymentCreateSchema>> & { payment_status?: PaymentStatus; payment_method?: PaymentMethod }) {
    return this.patch(id, paymentCreateSchema.partial().parse(input) as TableUpdate<'subscription_payments'>);
  }

  markPaid(id: string, paidAt = new Date()) {
    return this.patch(id, { payment_status: 'paid', paid_at: paidAt.toISOString() });
  }
}

const licenseEventSchema = z.object({
  orgId: uuidSchema.nullable().optional(),
  userId: uuidSchema.nullable().optional(),
  entityType: z.string().min(1),
  entityId: uuidSchema.nullable().optional(),
  eventType: z.enum([
    'subscription_created',
    'subscription_updated',
    'subscription_expired',
    'payment_recorded',
    'role_changed',
    'seat_limit_reached',
    'user_invited',
    'user_disabled',
    'device_registered',
    'device_login_verified',
    'device_login_blocked',
    'device_mismatch_blocked',
    'device_reset_requested',
    'device_reset_approved',
    'device_reset_rejected',
    'feature_access_denied',
    'org_id_spoofed',
    'cross_org_attempt',
    'invalid_device_session',
    'expired_device_session',
    'revoked_device_attempt',
    'invalid_challenge',
    'replayed_challenge',
  ]),
  eventData: z.unknown().optional(),
  actorUserId: uuidSchema.nullable().optional(),
  actorRole: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
});

export class LicenseEventRepository extends RepositoryBase<'license_events'> {
  constructor(clientFactory: ClientFactory = createAdminClient) {
    super('license_events', clientFactory);
  }

  create(input: LicenseEventPayload): Promise<LicenseEvent> {
    const payload = licenseEventSchema.parse(input);
    return this.insert({
      org_id: payload.orgId ?? null,
      user_id: payload.userId ?? null,
      entity_type: payload.entityType,
      entity_id: payload.entityId ?? null,
      event_type: payload.eventType,
      event_data: (payload.eventData ?? {}) as TableInsert<'license_events'>['event_data'],
      actor_user_id: payload.actorUserId ?? null,
      actor_role: payload.actorRole ?? null,
      ip_address: payload.ipAddress ?? null,
      user_agent: payload.userAgent ?? null,
    } as TableInsert<'license_events'>);
  }

  async listByOrgId(orgId: string, limit = 100): Promise<LicenseEvent[]> {
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('license_events')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  async listAll(limit = 200): Promise<LicenseEvent[]> {
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('license_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  update(): never {
    throw new Error('license_events is append-only');
  }

  softDelete(): never {
    throw new Error('license_events is append-only');
  }
}

// ─── Activation Key Repository ───────────────────────────────────────────────

const activationKeyStatusSchema = z.enum(['unused', 'activated', 'revoked', 'expired']);

export class ActivationKeyRepository extends RepositoryBase<'activation_keys'> {
  constructor(clientFactory: ClientFactory = createAdminClient) {
    super('activation_keys', clientFactory);
  }

  async getByHash(keyHash: string): Promise<ActivationKey | null> {
    z.string().min(64).parse(keyHash);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('activation_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .maybeSingle();
    if (error) throwDbError('Failed to fetch activation key by hash', error);
    return data;
  }

  async listByOrg(orgId: string): Promise<ActivationKey[]> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('activation_keys')
      .select('id, org_id, key_prefix, status, activated_by, activated_at, device_id, batch_id, created_by, expires_at, revoked_at, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throwDbError('Failed to list activation keys for org', error);
    return (data ?? []) as ActivationKey[];
  }

  async listAll(page = 1, limit = 100): Promise<ActivationKey[]> {
    const client = await this.client();
    const offset = (page - 1) * limit;
    const { data, error } = await (client as any)
      .from('activation_keys')
      .select('id, org_id, key_prefix, status, activated_by, activated_at, device_id, batch_id, created_by, expires_at, revoked_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throwDbError('Failed to list all activation keys', error);
    return (data ?? []) as ActivationKey[];
  }

  create(input: TableInsert<'activation_keys'>): Promise<ActivationKey> {
    return this.insert(input) as Promise<ActivationKey>;
  }

  async activate(id: string, activatedBy: string, deviceId: string): Promise<ActivationKey> {
    uuidSchema.parse(id);
    uuidSchema.parse(activatedBy);
    uuidSchema.parse(deviceId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('activation_keys')
      .update({
        status: 'activated',
        activated_by: activatedBy,
        activated_at: new Date().toISOString(),
        device_id: deviceId,
      })
      .eq('id', id)
      .eq('status', 'unused')
      .select('*')
      .maybeSingle();

    if (error) throwDbError('Failed to activate key in database', error);
    if (!data) {
      throw new Error('Failed to activate key. It may have already been activated or revoked.');
    }
    return data as ActivationKey;
  }

  revoke(id: string, revokedBy: string): Promise<ActivationKey> {
    uuidSchema.parse(id);
    uuidSchema.parse(revokedBy);
    return this.patch(id, {
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
    } as TableUpdate<'activation_keys'>) as Promise<ActivationKey>;
  }

  async countByOrg(orgId: string): Promise<{ unused: number; activated: number; revoked: number; total: number }> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('activation_keys')
      .select('status')
      .eq('org_id', orgId);
    if (error) throwDbError('Failed to count activation keys', error);
    const rows = (data ?? []) as { status: string }[];
    const unused = rows.filter(r => r.status === 'unused').length;
    const activated = rows.filter(r => r.status === 'activated').length;
    const revoked = rows.filter(r => r.status === 'revoked').length;
    return { unused, activated, revoked, total: rows.length };
  }
}

// ─── Password Reset Request Repository ───────────────────────────────────────

export class PasswordResetRequestRepository extends RepositoryBase<'password_reset_requests'> {
  constructor(clientFactory: ClientFactory = createAdminClient) {
    super('password_reset_requests', clientFactory);
  }

  async listPendingByOrg(orgId: string): Promise<PasswordResetRequest[]> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('password_reset_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending_admin_approval')
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false });
    if (error) throwDbError('Failed to list pending password reset requests', error);
    return (data ?? []) as PasswordResetRequest[];
  }

  async listByOrg(orgId: string): Promise<PasswordResetRequest[]> {
    uuidSchema.parse(orgId);
    const client = await this.client();
    const { data, error } = await (client as any)
      .from('password_reset_requests')
      .select('*')
      .eq('org_id', orgId)
      .order('requested_at', { ascending: false })
      .limit(50);
    if (error) throwDbError('Failed to list password reset requests', error);
    return (data ?? []) as PasswordResetRequest[];
  }

  create(orgId: string, userId: string, extras: { ip_address?: string | null; user_agent?: string | null } = {}): Promise<PasswordResetRequest> {
    uuidSchema.parse(orgId);
    uuidSchema.parse(userId);
    return this.insert({
      org_id: orgId,
      user_id: userId,
      status: 'pending_admin_approval',
      ip_address: extras.ip_address ?? null,
      user_agent: extras.user_agent ?? null,
    } as TableInsert<'password_reset_requests'>) as Promise<PasswordResetRequest>;
  }

  approve(id: string, approvedBy: string): Promise<PasswordResetRequest> {
    uuidSchema.parse(id);
    uuidSchema.parse(approvedBy);
    return this.patch(id, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    } as TableUpdate<'password_reset_requests'>) as Promise<PasswordResetRequest>;
  }

  markLinkSent(id: string): Promise<PasswordResetRequest> {
    uuidSchema.parse(id);
    return this.patch(id, {
      status: 'link_sent',
      link_sent_at: new Date().toISOString(),
    } as TableUpdate<'password_reset_requests'>) as Promise<PasswordResetRequest>;
  }

  reject(id: string, rejectedBy: string): Promise<PasswordResetRequest> {
    uuidSchema.parse(id);
    uuidSchema.parse(rejectedBy);
    return this.patch(id, {
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: new Date().toISOString(),
    } as TableUpdate<'password_reset_requests'>) as Promise<PasswordResetRequest>;
  }
}

export const saasRepositories = {
  SubscriptionPlanRepository,
  OrgSubscriptionRepository,
  OrgMemberRepository,
  UserDeviceRepository,
  DeviceResetRequestRepository,
  SubscriptionPaymentRepository,
  LicenseEventRepository,
  ActivationKeyRepository,
  PasswordResetRequestRepository,
};
