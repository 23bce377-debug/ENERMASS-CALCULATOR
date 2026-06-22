import 'server-only';

import type { User } from '@supabase/supabase-js';
import z from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { AuthenticationRequiredError } from '@/lib/auth/requireLicensedSession';
import { MembershipMissingError, SeatLimitReachedError, UnauthorizedRoleError } from '../errors';
import {
  DeviceResetRequestRepository,
  ActivationKeyRepository,
  LicenseEventRepository,
  OrgMemberRepository,
  OrgSubscriptionRepository,
  SubscriptionPaymentRepository,
  SubscriptionPlanRepository,
  UserDeviceRepository,
} from '../repositories';
import type {
  BillingCycle,
  DeviceResetRequest,
  OrgMember,
  OrgMemberRole,
  OrgSubscription,
  PaymentMethod,
  PaymentStatus,
  SeatUsage,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionStatus,
  UserDevice,
  ActivationKey,
} from '../types';
import { approveDeviceReset, rejectDeviceReset } from './deviceResetService';
import { disableOrgUser, getSeatUsage, inviteOrgUser } from './seatService';
import { logLicenseEvent } from './licenseAuditService';
import type { Database, Json } from '@/lib/types/schema.types';
import { profilesByUserId, userEmailsById } from './userDirectory';

type Organisation = Database['public']['Tables']['organisations']['Row'];
export interface ManagementSession {
  user: User;
  orgId: string;
  org: Organisation | null;
  member: OrgMember;
}

export interface SuperAdminSession {
  user: User;
}

export interface MemberListItem extends OrgMember {
  email: string | null;
  full_name: string | null;
  phone: string | null;
}

export interface DeviceListItem extends Omit<UserDevice, 'device_secret_hash'> {
  user_email: string | null;
  user_name: string | null;
}

export interface ResetRequestListItem extends DeviceResetRequest {
  user_email: string | null;
  user_name: string | null;
  old_device_name: string | null;
}

export interface BillingOverview {
  org: Organisation | null;
  subscription: OrgSubscription | null;
  plan: SubscriptionPlan | null;
  latestPayment: SubscriptionPayment | null;
  payments: SubscriptionPayment[];
  seatUsage: SeatUsage;
}

export interface SuperAdminOrgItem extends Organisation {
  subscription_status: string | null;
  plan_name: string | null;
  seat_limit: number | null;
}

export interface SuperAdminSubscriptionItem extends OrgSubscription {
  org_name: string | null;
  plan_name: string | null;
}

export interface SuperAdminDeviceResetItem extends DeviceResetRequest {
  org_name: string | null;
  user_email: string | null;
  user_name: string | null;
  old_device_name: string | null;
}

export interface SuperAdminOrgDashboard {
  overview: BillingOverview;
  members: MemberListItem[];
  devices: DeviceListItem[];
  activationKeys: {
    id: string;
    org_id: string;
    key_prefix: string;
    status: ActivationKey['status'];
    activated_by: string | null;
    activated_by_email: string | null;
    activated_by_name: string | null;
    activated_at: string | null;
    device_id: string | null;
    batch_id: string | null;
    created_by: string;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
  }[];
}

const adminRoles = new Set<OrgMemberRole>(['owner', 'admin', 'manager']);
const ownerRoles = new Set<OrgMemberRole>(['owner']);
const roleSchema = z.enum(['owner', 'admin', 'manager', 'staff', 'viewer']);
const subscriptionStatusSchema = z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']);
const billingCycleSchema = z.enum(['monthly', 'yearly', 'trial', 'manual']);
const paymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'refunded', 'cancelled']);
const paymentMethodSchema = z.enum(['manual', 'bank_transfer', 'upi', 'cash', 'cheque', 'card']);
const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");

function adminClient() {
  return createAdminClient();
}

async function authenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthenticationRequiredError();
  return user;
}

function preferredOrgId(user: User) {
  const app = user.app_metadata as Record<string, unknown> | undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const value = app?.active_org_id ?? app?.org_id ?? meta?.active_org_id ?? meta?.org_id;
  return typeof value === 'string' && value ? value : null;
}

async function isSuperAdmin(user: User) {
  const { data, error } = await (adminClient() as any)
    .from('profiles')
    .select('id, role, is_super_admin, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new UnauthorizedRoleError({ userId: user.id, reason: error.message });

  const profile = (data ?? null) as { role?: string | null; is_super_admin?: boolean | null; is_active?: boolean | null } | null;
  if (!profile || profile.is_active === false) return false;
  return profile?.is_super_admin === true || profile?.role === 'superadmin' || profile?.role === 'super_admin';
}

export async function requireOrgManagementSession(
  roles: OrgMemberRole[] = ['owner', 'admin', 'manager']
): Promise<ManagementSession> {
  const user = await authenticatedUser();
  const client = adminClient();
  const { data, error } = await (client as any)
    .from('org_members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw new MembershipMissingError({ userId: user.id, reason: error.message });

  const members = ((data ?? []) as OrgMember[]).filter((member) => member.status === 'active');
  const preferred = preferredOrgId(user);
  const member = (preferred ? members.find((item) => item.org_id === preferred) : null) ?? members[0] ?? null;
  if (!member) throw new MembershipMissingError({ userId: user.id, reason: 'No active organization membership.' });

  const role = roleSchema.catch('staff').parse(member.role);
  if (!roles.includes(role)) {
    throw new UnauthorizedRoleError({ orgId: member.org_id, userId: user.id, role, allowedRoles: roles });
  }

  // Enforce MFA AAL2 for Org management actions
  if (['owner', 'admin', 'manager'].includes(role)) {
    const supabase = await createClient();
    const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError || aalData?.currentLevel !== 'aal2') {
      throw new Error('MFA_REQUIRED');
    }
  }

  const { data: org, error: orgError } = await (client as any)
    .from('organisations')
    .select('*')
    .eq('id', member.org_id)
    .maybeSingle();
  if (orgError) throw new MembershipMissingError({ orgId: member.org_id, reason: orgError.message });

  return {
    user,
    orgId: member.org_id,
    org: (org ?? null) as Organisation | null,
    member: { ...member, role },
  };
}

export async function requireSuperAdminSession(): Promise<SuperAdminSession> {
  const user = await authenticatedUser();
  if (!(await isSuperAdmin(user))) {
    throw new UnauthorizedRoleError({ userId: user.id, role: user.app_metadata?.role ?? user.user_metadata?.role ?? null });
  }
  
  // Enforce MFA AAL2 for Super Admin actions
  const supabase = await createClient();
  const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aalData?.currentLevel !== 'aal2') {
    throw new Error('MFA_REQUIRED');
  }
  
  return { user };
}

async function safeSeatUsage(orgId: string, subscription: OrgSubscription | null): Promise<SeatUsage> {
  if (subscription) {
    try {
      return await getSeatUsage(orgId, {
        orgSubscriptionRepository: new OrgSubscriptionRepository(adminClient),
        subscriptionPaymentRepository: new SubscriptionPaymentRepository(adminClient),
        orgMemberRepository: new OrgMemberRepository(adminClient),
      });
    } catch {
      // Fall through to a display-only usage model for expired subscriptions.
    }
  }

  const repo = new OrgMemberRepository(adminClient);
  const counts = await repo.countBillableSeats(orgId);
  const usedSeats = counts.active + counts.invited;
  const seatLimit = subscription?.seat_limit ?? 0;
  return {
    activeSeats: counts.active,
    invitedSeats: counts.invited,
    usedSeats,
    seatLimit,
    overLimitBy: Math.max(0, usedSeats - seatLimit),
  };
}

export async function getBillingOverview(orgId: string): Promise<BillingOverview> {
  uuidSchema.parse(orgId);
  const client = adminClient();
  const [orgResult, subscriptionsResult, paymentsResult] = await Promise.all([
    (client as any).from('organisations').select('*').eq('id', orgId).maybeSingle(),
    (client as any).from('org_subscriptions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(1),
    (client as any).from('subscription_payments').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
  ]);

  if (orgResult.error) throw new Error(`Failed to load organization: ${orgResult.error.message}`);
  if (subscriptionsResult.error) throw new Error(`Failed to load subscription: ${subscriptionsResult.error.message}`);
  if (paymentsResult.error) throw new Error(`Failed to load payments: ${paymentsResult.error.message}`);

  const subscription = (subscriptionsResult.data?.[0] ?? null) as OrgSubscription | null;
  const payments = (paymentsResult.data ?? []) as SubscriptionPayment[];
  const plan = subscription ? await new SubscriptionPlanRepository(adminClient).getById(subscription.plan_id) as SubscriptionPlan | null : null;

  return {
    org: (orgResult.data ?? null) as Organisation | null,
    subscription,
    plan,
    latestPayment: payments[0] ?? null,
    payments,
    seatUsage: await safeSeatUsage(orgId, subscription),
  };
}

export async function listOrgUsers(orgId: string): Promise<MemberListItem[]> {
  uuidSchema.parse(orgId);
  const members = await new OrgMemberRepository(adminClient).listByOrgId(orgId) as OrgMember[];
  const ids = members.map((member) => member.user_id);
  const [profiles, emails] = await Promise.all([profilesByUserId(ids), userEmailsById(ids)]);

  return members.map((member) => {
    const profile = profiles.get(member.user_id);
    return {
      ...member,
      email: emails.get(member.user_id) ?? null,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
    };
  });
}

export async function listOrgDevices(orgId: string): Promise<DeviceListItem[]> {
  uuidSchema.parse(orgId);
  const client = adminClient();
  const devicesResult = await (client as any)
    .from('user_devices')
    .select('id, org_id, user_id, device_name, browser, os, status, first_seen_at, last_seen_at, revoked_at')
    .eq('org_id', orgId)
    .order('status', { ascending: true })
    .order('last_seen_at', { ascending: false });
  
  if (devicesResult.error) throw new Error(`Failed to load devices: ${devicesResult.error.message}`);

  const devices = (devicesResult.data ?? []) as UserDevice[];
  const ids = devices.map((device) => device.user_id);
  const [profiles, emails] = await Promise.all([profilesByUserId(ids), userEmailsById(ids)]);

  return devices.map((device) => {
    const profile = profiles.get(device.user_id);
    return {
      ...device,
      user_email: emails.get(device.user_id) ?? null,
      user_name: profile?.full_name ?? null,
    };
  });
}

export async function getSuperAdminOrgDashboard(orgId: string): Promise<SuperAdminOrgDashboard> {
  uuidSchema.parse(orgId);

  const client = adminClient();
  const [
    orgResult,
    subscriptionsResult,
    paymentsResult,
    members,
    devicesResult,
    activationKeys,
  ] = await Promise.all([
    (client as any).from('organisations').select('*').eq('id', orgId).maybeSingle(),
    (client as any).from('org_subscriptions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(1),
    (client as any).from('subscription_payments').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
    new OrgMemberRepository(adminClient).listByOrgId(orgId) as Promise<OrgMember[]>,
    (client as any)
      .from('user_devices')
      .select('id, org_id, user_id, device_name, browser, os, status, first_seen_at, last_seen_at, revoked_at')
      .eq('org_id', orgId)
      .order('status', { ascending: true })
      .order('last_seen_at', { ascending: false }),
    new ActivationKeyRepository(adminClient).listByOrg(orgId),
  ]);

  if (orgResult.error) throw new Error(`Failed to load organization: ${orgResult.error.message}`);
  if (subscriptionsResult.error) throw new Error(`Failed to load subscription: ${subscriptionsResult.error.message}`);
  if (paymentsResult.error) throw new Error(`Failed to load payments: ${paymentsResult.error.message}`);
  if (devicesResult.error) throw new Error(`Failed to load devices: ${devicesResult.error.message}`);

  const org = (orgResult.data ?? null) as Organisation | null;
  const subscription = (subscriptionsResult.data?.[0] ?? null) as OrgSubscription | null;
  const payments = (paymentsResult.data ?? []) as SubscriptionPayment[];
  const devices = (devicesResult.data ?? []) as UserDevice[];
  const userIds = [
    ...members.map((member) => member.user_id),
    ...devices.map((device) => device.user_id),
    ...activationKeys.filter((key) => key.activated_by).map((key) => key.activated_by!),
  ];

  const [profiles, emails, plan, seatUsage] = await Promise.all([
    profilesByUserId(userIds),
    userEmailsById(userIds),
    subscription ? new SubscriptionPlanRepository(adminClient).getById(subscription.plan_id) as Promise<SubscriptionPlan | null> : Promise.resolve(null),
    safeSeatUsage(orgId, subscription),
  ]);

  return {
    overview: {
      org,
      subscription,
      plan,
      latestPayment: payments[0] ?? null,
      payments,
      seatUsage,
    },
    members: members.map((member) => {
      const profile = profiles.get(member.user_id);
      return {
        ...member,
        email: emails.get(member.user_id) ?? null,
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
      };
    }),
    devices: devices.map((device) => {
      const profile = profiles.get(device.user_id);
      return {
        ...device,
        user_email: emails.get(device.user_id) ?? null,
        user_name: profile?.full_name ?? null,
      };
    }),
    activationKeys: activationKeys.map((key) => {
      const activatedBy = key.activated_by;
      const profile = activatedBy ? profiles.get(activatedBy) : null;
      return {
        ...key,
        activated_by_email: activatedBy ? (emails.get(activatedBy) ?? null) : null,
        activated_by_name: profile?.full_name ?? null,
      };
    }),
  };
}

export async function listOrgDeviceResetRequests(orgId: string): Promise<ResetRequestListItem[]> {
  uuidSchema.parse(orgId);
  const client = adminClient();
  const [requestsResult, devicesResult] = await Promise.all([
    (client as any).from('device_reset_requests').select('*').eq('org_id', orgId).order('requested_at', { ascending: false }),
    (client as any).from('user_devices').select('id, device_name, browser, os').eq('org_id', orgId),
  ]);
  if (requestsResult.error) throw new Error(`Failed to load reset requests: ${requestsResult.error.message}`);
  if (devicesResult.error) throw new Error(`Failed to load reset devices: ${devicesResult.error.message}`);

  const requests = (requestsResult.data ?? []) as DeviceResetRequest[];
  const devices = new Map(((devicesResult.data ?? []) as Pick<UserDevice, 'id' | 'device_name' | 'browser' | 'os'>[]).map((device) => [device.id, device]));
  const ids = requests.map((request) => request.user_id);
  const [profiles, emails] = await Promise.all([profilesByUserId(ids), userEmailsById(ids)]);

  return requests.map((request) => {
    const profile = profiles.get(request.user_id);
    const oldDevice = request.old_device_id ? devices.get(request.old_device_id) : null;
    return {
      ...request,
      user_email: emails.get(request.user_id) ?? null,
      user_name: profile?.full_name ?? null,
      old_device_name: oldDevice?.device_name ?? oldDevice?.browser ?? null,
    };
  });
}

export async function inviteOrgUserAsAdmin(orgId: string, actorUserId: string, email: string, role: OrgMemberRole) {
  await assertOrgAdminForManagement(orgId, actorUserId);
  return inviteOrgUser(orgId, email, role, {
    orgMemberRepository: new OrgMemberRepository(adminClient),
    orgSubscriptionRepository: new OrgSubscriptionRepository(adminClient),
    subscriptionPaymentRepository: new SubscriptionPaymentRepository(adminClient),
    audit: logLicenseEvent,
  });
}

export async function disableOrgUserAsAdmin(orgId: string, actorUserId: string, memberId: string) {
  await assertOrgAdminForManagement(orgId, actorUserId);
  const member = await getOrgMemberById(orgId, memberId);
  return disableOrgUser(orgId, member.user_id, {
    orgMemberRepository: new OrgMemberRepository(adminClient),
    audit: logLicenseEvent,
  });
}

export async function changeOrgUserRoleAsAdmin(orgId: string, actorUserId: string, memberId: string, role: OrgMemberRole) {
  await assertOwnerForOwnerRoleChange(orgId, actorUserId, role);
  const member = await getOrgMemberById(orgId, memberId);
  const updated = await new OrgMemberRepository(adminClient).changeRole(member.id, roleSchema.parse(role));
  await logLicenseEvent({
    orgId,
    userId: member.user_id,
    entityType: 'org_member',
    entityId: member.id,
    eventType: 'role_changed',
    actorUserId,
    eventData: { role },
  });
  return updated;
}

export async function revokeOrgDeviceAsAdmin(orgId: string, actorUserId: string, deviceId: string) {
  await assertOrgAdminForManagement(orgId, actorUserId);
  const device = await getOrgDeviceById(orgId, deviceId);
  const [revoked] = await Promise.all([
    new UserDeviceRepository(adminClient).revoke(device.id),
    // Device sessions are deprecated.
  ]);
  return revoked;
}

export async function approveOrgDeviceResetAsAdmin(orgId: string, actorUserId: string, requestId: string) {
  // Device reset approval is SUPER ADMIN only — verify super admin status
  const user = await authenticatedUser();
  if (!(await isSuperAdmin(user))) {
    throw new UnauthorizedRoleError({ userId: actorUserId, reason: 'Only super admin can approve device resets.' });
  }
  const request = await getOrgResetById(orgId, requestId);
  return approveDeviceReset(request.id, actorUserId, {
    orgMemberRepository: new OrgMemberRepository(adminClient),
    deviceResetRequestRepository: new DeviceResetRequestRepository(adminClient),
    // Device sessions are deprecated
    userDeviceRepository: new UserDeviceRepository(adminClient),
    audit: logLicenseEvent,
  });
}


export async function rejectOrgDeviceResetAsAdmin(orgId: string, actorUserId: string, requestId: string) {
  const user = await authenticatedUser();
  if (!(await isSuperAdmin(user))) {
    throw new UnauthorizedRoleError({ userId: actorUserId, reason: 'Only super admin can reject device resets.' });
  }
  const request = await getOrgResetById(orgId, requestId);
  return rejectDeviceReset(request.id, actorUserId, {
    orgMemberRepository: new OrgMemberRepository(adminClient),
    deviceResetRequestRepository: new DeviceResetRequestRepository(adminClient),
    audit: logLicenseEvent,
  });
}

async function assertOrgAdminForManagement(orgId: string, actorUserId: string) {
  const member = await new OrgMemberRepository(adminClient).getByOrgAndUser(orgId, actorUserId);
  if (!member || member.status !== 'active') throw new MembershipMissingError({ orgId, actorUserId });
  if (!adminRoles.has(member.role as OrgMemberRole)) throw new UnauthorizedRoleError({ orgId, actorUserId, role: member.role });
  return member;
}

async function assertOwnerForOwnerRoleChange(orgId: string, actorUserId: string, requestedRole: OrgMemberRole) {
  const member = await assertOrgAdminForManagement(orgId, actorUserId);
  if (requestedRole === 'owner' && !ownerRoles.has(member.role as OrgMemberRole)) {
    throw new UnauthorizedRoleError({ orgId, actorUserId, role: member.role, requestedRole });
  }
  return member;
}

async function getOrgMemberById(orgId: string, memberId: string) {
  const member = await new OrgMemberRepository(adminClient).getById(memberId) as OrgMember | null;
  if (!member || member.org_id !== orgId) throw new MembershipMissingError({ orgId, memberId });
  return member;
}

async function getOrgDeviceById(orgId: string, deviceId: string) {
  const device = await new UserDeviceRepository(adminClient).getById(deviceId) as UserDevice | null;
  if (!device || device.org_id !== orgId) throw new MembershipMissingError({ orgId, deviceId });
  return device;
}

async function getOrgResetById(orgId: string, requestId: string) {
  const request = await new DeviceResetRequestRepository(adminClient).getById(requestId) as DeviceResetRequest | null;
  if (!request || request.org_id !== orgId) throw new MembershipMissingError({ orgId, requestId });
  return request;
}

export async function listSuperAdminOrgs(): Promise<SuperAdminOrgItem[]> {
  const client = adminClient();
  const [orgsResult, subscriptionsResult, plansResult] = await Promise.all([
    (client as any).from('organisations').select('*').order('created_at', { ascending: false }),
    (client as any).from('org_subscriptions').select('id, org_id, plan_id, status, seat_limit, created_at').order('created_at', { ascending: false }),
    (client as any).from('subscription_plans').select('id, name'),
  ]);
  if (orgsResult.error) throw new Error(`Failed to load orgs: ${orgsResult.error.message}`);
  if (subscriptionsResult.error) throw new Error(`Failed to load subscriptions: ${subscriptionsResult.error.message}`);
  if (plansResult.error) throw new Error(`Failed to load plans: ${plansResult.error.message}`);

  const plans = new Map(((plansResult.data ?? []) as SubscriptionPlan[]).map((plan) => [plan.id, plan]));
  const latestByOrg = new Map<string, OrgSubscription>();
  for (const sub of (subscriptionsResult.data ?? []) as OrgSubscription[]) {
    if (!latestByOrg.has(sub.org_id)) latestByOrg.set(sub.org_id, sub);
  }

  return ((orgsResult.data ?? []) as Organisation[]).map((org) => {
    const subscription = latestByOrg.get(org.id);
    const plan = subscription ? plans.get(subscription.plan_id) : null;
    return {
      ...org,
      subscription_status: subscription?.status ?? null,
      plan_name: plan?.name ?? null,
      seat_limit: subscription?.seat_limit ?? null,
    };
  });
}

export async function listSuperAdminPlans() {
  const { data, error } = await (adminClient() as any)
    .from('subscription_plans')
    .select('*')
    .order('monthly_price', { ascending: true });
  if (error) throw new Error(`Failed to load plans: ${error.message}`);
  return (data ?? []) as SubscriptionPlan[];
}

export async function listSuperAdminSubscriptions(): Promise<SuperAdminSubscriptionItem[]> {
  const client = adminClient();
  const [subsResult, orgsResult, plansResult] = await Promise.all([
    (client as any).from('org_subscriptions').select('*').order('created_at', { ascending: false }),
    (client as any).from('organisations').select('id, name'),
    (client as any).from('subscription_plans').select('id, name'),
  ]);
  if (subsResult.error) throw new Error(`Failed to load subscriptions: ${subsResult.error.message}`);
  if (orgsResult.error) throw new Error(`Failed to load orgs: ${orgsResult.error.message}`);
  if (plansResult.error) throw new Error(`Failed to load plans: ${plansResult.error.message}`);

  const orgEntries: [string, string][] = ((orgsResult.data ?? []) as Pick<Organisation, 'id' | 'name'>[]).map((org) => [org.id, org.name]);
  const planEntries: [string, string][] = ((plansResult.data ?? []) as Pick<SubscriptionPlan, 'id' | 'name'>[]).map((plan) => [plan.id, plan.name]);
  const orgs = new Map<string, string>(orgEntries);
  const plans = new Map<string, string>(planEntries);
  return ((subsResult.data ?? []) as OrgSubscription[]).map((sub) => ({
    ...sub,
    org_name: orgs.get(sub.org_id) ?? null,
    plan_name: plans.get(sub.plan_id) ?? null,
  }));
}

export async function listSuperAdminPayments() {
  const { data, error } = await (adminClient() as any)
    .from('subscription_payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return (data ?? []) as SubscriptionPayment[];
}

export async function listSuperAdminDeviceResets(): Promise<SuperAdminDeviceResetItem[]> {
  const client = adminClient();
  const [requestsResult, orgsResult, devicesResult] = await Promise.all([
    (client as any).from('device_reset_requests').select('*').order('requested_at', { ascending: false }),
    (client as any).from('organisations').select('id, name'),
    (client as any).from('user_devices').select('id, device_name, browser, os'),
  ]);
  if (requestsResult.error) throw new Error(`Failed to load device resets: ${requestsResult.error.message}`);
  if (orgsResult.error) throw new Error(`Failed to load reset organizations: ${orgsResult.error.message}`);
  if (devicesResult.error) throw new Error(`Failed to load reset devices: ${devicesResult.error.message}`);

  const requests = (requestsResult.data ?? []) as DeviceResetRequest[];
  const orgs = new Map(((orgsResult.data ?? []) as Pick<Organisation, 'id' | 'name'>[]).map((org) => [org.id, org.name]));
  const devices = new Map(((devicesResult.data ?? []) as Pick<UserDevice, 'id' | 'device_name' | 'browser' | 'os'>[]).map((device) => [device.id, device]));
  const ids = requests.map((request) => request.user_id);
  const [profiles, emails] = await Promise.all([profilesByUserId(ids), userEmailsById(ids)]);

  return requests.map((request) => {
    const profile = profiles.get(request.user_id);
    const oldDevice = request.old_device_id ? devices.get(request.old_device_id) : null;
    return {
      ...request,
      org_name: orgs.get(request.org_id) ?? null,
      user_email: emails.get(request.user_id) ?? null,
      user_name: profile?.full_name ?? null,
      old_device_name: oldDevice?.device_name ?? oldDevice?.browser ?? null,
    };
  });
}

export async function createOrganisationAsSuperAdmin(input: { name: string; email?: string | null }) {
  const payload = z.object({
    name: z.string().min(2),
    email: z.string().email().nullable().optional(),
  }).parse(input);
  const { data, error } = await (adminClient() as any)
    .from('organisations')
    .insert({ name: payload.name, email: payload.email ?? null })
    .select('*')
    .maybeSingle();
  if (error || !data) throw new Error(`Failed to create organization: ${error?.message ?? 'No row returned'}`);
  return data as Organisation;
}

export async function createPlanAsSuperAdmin(input: {
  name: string;
  code: string;
  monthlyPrice: number;
  yearlyPrice: number;
  seatLimit: number;
  features: Json;
  isActive?: boolean;
}) {
  return new SubscriptionPlanRepository(adminClient).create({
    name: input.name,
    code: input.code,
    monthly_price: input.monthlyPrice,
    yearly_price: input.yearlyPrice,
    seat_limit: input.seatLimit,
    features: input.features as Record<string, unknown>,
    is_active: input.isActive ?? true,
  });
}

export async function updatePlanFeaturesAsSuperAdmin(planId: string, features: Json, isActive?: boolean) {
  return new SubscriptionPlanRepository(adminClient).update(planId, {
    features: features as Record<string, unknown>,
    ...(typeof isActive === 'boolean' ? { is_active: isActive } : {}),
  });
}

export async function assignPlanAsSuperAdmin(input: {
  orgId: string;
  planId: string;
  seatLimit: number;
  billingCycle: BillingCycle;
  status?: SubscriptionStatus;
}) {
  const payload = z.object({
    orgId: uuidSchema,
    planId: uuidSchema,
    seatLimit: z.coerce.number().int().positive(),
    billingCycle: billingCycleSchema,
    status: subscriptionStatusSchema.optional(),
  }).parse(input);

  const planRepo = new SubscriptionPlanRepository(adminClient);
  const plan = await planRepo.getById(payload.planId);
  if (!plan) {
    throw new Error('Plan not found.');
  }
  if (payload.seatLimit > plan.seat_limit) {
    throw new Error(`Subscription seat_limit ${payload.seatLimit} exceeds plan seat_limit ${plan.seat_limit}`);
  }

  const repo = new OrgSubscriptionRepository(adminClient);
  const existing = await repo.getActiveByOrgId(payload.orgId);
  const now = new Date().toISOString();
  const updates = {
    plan_id: payload.planId,
    seat_limit: payload.seatLimit,
    billing_cycle: payload.billingCycle,
    status: payload.status ?? 'active',
    current_period_start: existing?.current_period_start ?? now,
    current_period_end: existing?.current_period_end ?? periodEnd(payload.billingCycle),
  };
  const subscription = existing
    ? await repo.update(existing.id, updates)
    : await repo.create(payload.orgId, updates);
  await logLicenseEvent({
    orgId: payload.orgId,
    entityType: 'org_subscription',
    entityId: subscription.id,
    eventType: existing ? 'subscription_updated' : 'subscription_created',
    eventData: { planId: payload.planId, seatLimit: payload.seatLimit, billingCycle: payload.billingCycle },
  });
  return subscription;
}

export async function setSubscriptionSeatLimitAsSuperAdmin(subscriptionId: string, seatLimit: number) {
  const parsedLimit = z.coerce.number().int().positive().parse(seatLimit);
  const subRepo = new OrgSubscriptionRepository(adminClient);
  const existing = await subRepo.getById(subscriptionId);
  if (!existing) {
    throw new Error('Subscription not found.');
  }
  const plan = await new SubscriptionPlanRepository(adminClient).getById(existing.plan_id);
  if (!plan) {
    throw new Error('Plan not found.');
  }
  if (parsedLimit > plan.seat_limit) {
    throw new Error(`Subscription seat_limit ${parsedLimit} exceeds plan seat_limit ${plan.seat_limit}`);
  }

  const subscription = await subRepo.update(subscriptionId, {
    seat_limit: parsedLimit,
  });
  const usage = await safeSeatUsage(subscription.org_id, subscription);
  if (usage.overLimitBy > 0) {
    await logLicenseEvent({
      orgId: subscription.org_id,
      entityType: 'org_subscription',
      entityId: subscription.id,
      eventType: 'seat_limit_reached',
      eventData: usage as unknown as Json,
    });
  }
  return subscription;
}

export async function changeSubscriptionStatusAsSuperAdmin(subscriptionId: string, status: SubscriptionStatus) {
  const parsedStatus = subscriptionStatusSchema.parse(status);
  const subscription = await new OrgSubscriptionRepository(adminClient).changeStatus(subscriptionId, parsedStatus);
  await logLicenseEvent({
    orgId: subscription.org_id,
    entityType: 'org_subscription',
    entityId: subscription.id,
    eventType: parsedStatus === 'expired' ? 'subscription_expired' : 'subscription_updated',
    eventData: { status: parsedStatus },
  });
  return subscription;
}

export async function recordManualPaymentAsSuperAdmin(input: {
  orgId?: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  invoiceNumber?: string | null;
  /** ISO datetime string for backdating the payment. Defaults to now for paid payments. */
  paidAt?: string | null;
  /** When true and paymentStatus is 'paid', auto-activate an expired/past_due subscription and extend its period. */
  activateSubscription?: boolean;
}) {
  const payload = z.object({
    orgId: uuidSchema.optional(),
    subscriptionId: uuidSchema,
    amount: z.coerce.number().nonnegative(),
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
    paymentStatus: paymentStatusSchema,
    paymentMethod: paymentMethodSchema,
    invoiceNumber: z.string().nullable().optional(),
    paidAt: z.string().datetime().nullable().optional(),
    activateSubscription: z.boolean().optional(),
  }).parse(input);

  const subRepo = new OrgSubscriptionRepository(adminClient);
  const subscription = await subRepo.getById(payload.subscriptionId) as OrgSubscription | null;
  if (!subscription) throw new Error('Subscription not found.');
  if (payload.orgId && payload.orgId !== subscription.org_id) {
    throw new Error('Payment organization does not match subscription.');
  }

  // Duplicate invoice number check (skip for null/empty invoices). Also enforced by a DB partial unique index.
  if (payload.invoiceNumber) {
    const { data: existing } = await (adminClient() as any)
      .from('subscription_payments')
      .select('id')
      .eq('org_id', subscription.org_id)
      .eq('invoice_number', payload.invoiceNumber)
      .maybeSingle();
    if (existing) {
      throw new Error(`Invoice number '${payload.invoiceNumber}' already exists for this organization.`);
    }
  }

  const resolvedPaidAt = payload.paymentStatus === 'paid'
    ? (payload.paidAt ?? new Date().toISOString())
    : null;

  if (payload.paymentStatus === 'paid' && payload.activateSubscription === true) {
    const plan = await new SubscriptionPlanRepository(adminClient).getById(subscription.plan_id) as SubscriptionPlan | null;
    const expectedAmount = expectedPlanAmount(plan, subscription.billing_cycle as BillingCycle);
    if (expectedAmount > 0 && payload.amount < expectedAmount) {
      throw new Error(`Payment amount ${payload.amount} is below the plan price ${expectedAmount}.`);
    }
  }

  const payment = await new SubscriptionPaymentRepository(adminClient).create(subscription.org_id, {
    subscription_id: payload.subscriptionId,
    amount: payload.amount,
    currency: payload.currency,
    payment_status: payload.paymentStatus,
    payment_method: payload.paymentMethod,
    invoice_number: payload.invoiceNumber ?? null,
    paid_at: resolvedPaidAt,
  });

  // Auto-activate: if payment is paid + flag set + sub is expired or past_due, reactivate it
  if (
    payload.paymentStatus === 'paid' &&
    payload.activateSubscription === true &&
    (subscription.status === 'expired' || subscription.status === 'past_due')
  ) {
    await extendSubscriptionPeriodAsSuperAdmin(subscription.id, periodDaysForCycle(subscription.billing_cycle as BillingCycle), {
      forceStatus: 'active',
      reason: `Reactivated by payment ${payment.id}`,
    });
  }

  await logLicenseEvent({
    orgId: subscription.org_id,
    entityType: 'subscription_payment',
    entityId: payment.id,
    eventType: 'payment_recorded',
    eventData: {
      paymentStatus: payload.paymentStatus,
      amount: payload.amount,
      currency: payload.currency,
      invoiceNumber: payload.invoiceNumber ?? null,
      activateSubscription: payload.activateSubscription ?? false,
    },
  });

  return payment;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

/** Returns how many days correspond to one billing cycle. */
function periodDaysForCycle(cycle: BillingCycle): number {
  if (cycle === 'yearly') return 365;
  if (cycle === 'trial') return 14;
  return 30; // monthly / manual
}

function periodEnd(cycle: BillingCycle, from?: Date) {
  const base = from ?? new Date();
  const end = new Date(base);
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else if (cycle === 'trial') end.setDate(end.getDate() + 14);
  else end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}

function expectedPlanAmount(plan: SubscriptionPlan | null, cycle: BillingCycle) {
  if (!plan) return 0;
  if (cycle === 'yearly') return Number(plan.yearly_price ?? 0);
  if (cycle === 'monthly') return Number(plan.monthly_price ?? 0);
  return 0;
}

// ─── New super-admin billing operations ──────────────────────────────────────

/**
 * Extends a subscription's current_period_end by the given number of days.
 * If the subscription is expired or past_due and forceStatus='active' is passed,
 * the status is also corrected to 'active'. Safe to call on already-active subs.
 */
export async function extendSubscriptionPeriodAsSuperAdmin(
  subscriptionId: string,
  days: number,
  options: { forceStatus?: SubscriptionStatus; reason?: string } = {}
) {
  const parsedDays = z.number().int().positive().parse(days);
  const subRepo = new OrgSubscriptionRepository(adminClient);
  const subscription = await subRepo.getById(subscriptionId) as OrgSubscription | null;
  if (!subscription) throw new Error('Subscription not found.');

  const base = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date();
  const newEnd = new Date(base);
  newEnd.setDate(newEnd.getDate() + parsedDays);

  const statusUpdate: Partial<{ status: SubscriptionStatus; current_period_end: string }> = {
    current_period_end: newEnd.toISOString(),
  };
  if (options.forceStatus) {
    statusUpdate.status = subscriptionStatusSchema.parse(options.forceStatus);
  }

  const updated = await subRepo.update(subscriptionId, statusUpdate);

  await logLicenseEvent({
    orgId: subscription.org_id,
    entityType: 'org_subscription',
    entityId: subscription.id,
    eventType: 'subscription_updated',
    eventData: {
      action: 'period_extended',
      days: parsedDays,
      newPeriodEnd: newEnd.toISOString(),
      forceStatus: options.forceStatus ?? null,
      reason: options.reason ?? null,
    },
  });

  return updated;
}

/**
 * Cancels a subscription. Idempotent — already-cancelled subs are returned as-is.
 * A cancelled subscription cannot be reactivated automatically; it requires a new assignment.
 */
export async function cancelSubscriptionAsSuperAdmin(subscriptionId: string) {
  const subRepo = new OrgSubscriptionRepository(adminClient);
  const subscription = await subRepo.getById(subscriptionId) as OrgSubscription | null;
  if (!subscription) throw new Error('Subscription not found.');

  // Idempotent — already cancelled
  if (subscription.status === 'cancelled') return subscription;

  const updated = await subRepo.cancel(subscriptionId);

  await logLicenseEvent({
    orgId: subscription.org_id,
    entityType: 'org_subscription',
    entityId: subscription.id,
    eventType: 'subscription_expired',
    eventData: { action: 'cancelled', previousStatus: subscription.status },
  });

  return updated;
}

export function assertSeatNotOverflowing(usage: SeatUsage) {
  if (usage.seatLimit > 0 && usage.usedSeats >= usage.seatLimit) {
    throw new SeatLimitReachedError({ usage });
  }
}
