import type { Database, Json } from '@/lib/types/schema.types';

export type TableRow<TableName extends string> = TableName extends keyof Database['public']['Tables'] ? Database['public']['Tables'][TableName]['Row'] : any;

export type TableInsert<TableName extends string> = TableName extends keyof Database['public']['Tables'] ? Database['public']['Tables'][TableName]['Insert'] : any;

export type TableUpdate<TableName extends string> = TableName extends keyof Database['public']['Tables'] ? Database['public']['Tables'][TableName]['Update'] : any;

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type BillingCycle = 'monthly' | 'yearly' | 'trial' | 'manual';
export type OrgMemberRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';
export type OrgMemberStatus = 'invited' | 'active' | 'disabled';
export type DeviceStatus = 'active' | 'pending' | 'revoked';
export type DeviceResetStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'manual' | 'bank_transfer' | 'upi' | 'cash' | 'cheque' | 'card';

export type LicenseEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_expired'
  | 'payment_recorded'
  | 'role_changed'
  | 'seat_limit_reached'
  | 'user_invited'
  | 'user_disabled'
  | 'device_registered'
  | 'device_login_verified'
  | 'device_login_blocked'
  | 'device_mismatch_blocked'
  | 'device_reset_requested'
  | 'device_reset_approved'
  | 'device_reset_rejected'
  | 'feature_access_denied'
  | 'org_id_spoofed'
  | 'cross_org_attempt';

export type SubscriptionPlan = TableRow<'subscription_plans'>;
export type OrgSubscription = TableRow<'org_subscriptions'>;
export type OrgMember = TableRow<'org_members'>;
export type UserDevice = TableRow<'user_devices'> & { fingerprint_hash?: string | null };
export type DeviceResetRequest = TableRow<'device_reset_requests'>;
export type SubscriptionPayment = TableRow<'subscription_payments'>;
export type LicenseEvent = TableRow<'license_events'>;
export type ActivationKey = TableRow<'activation_keys'>;
export type PasswordResetRequest = TableRow<'password_reset_requests'>;


export type FeatureMap = Record<string, boolean | number | string | Json | undefined>;

export interface DevicePayload {
  deviceSecretHash: string;
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  publicKey?: string | null;
  fingerprintHash?: string | null;
}

export interface DeviceInfo {
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}

export interface LicenseEventPayload {
  orgId?: string | null;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  eventType: LicenseEventType;
  eventData?: Json;
  actorUserId?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SeatUsage {
  activeSeats: number;
  invitedSeats: number;
  usedSeats: number;
  seatLimit: number;
  overLimitBy: number;
}

