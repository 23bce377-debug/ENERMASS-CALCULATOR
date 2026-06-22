'use server';

import { revalidatePath } from 'next/cache';
import z from 'zod';
import type { ZodIssue } from 'zod';
import {
  assignPlanAsSuperAdmin,
  approveOrgDeviceResetAsAdmin,
  cancelSubscriptionAsSuperAdmin,
  changeSubscriptionStatusAsSuperAdmin,
  createOrganisationAsSuperAdmin,
  createPlanAsSuperAdmin,
  extendSubscriptionPeriodAsSuperAdmin,
  recordManualPaymentAsSuperAdmin,
  rejectOrgDeviceResetAsAdmin,
  requireSuperAdminSession,
  setSubscriptionSeatLimitAsSuperAdmin,
  updatePlanFeaturesAsSuperAdmin,
} from '@/lib/saas/services/managementService';
import type {
  BillingCycle,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from '@/lib/saas/types';

export interface SuperAdminActionState {
  ok: boolean;
  message: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === 'string' ? item.trim() : '';
}

function numberValue(formData: FormData, key: string) {
  return Number(value(formData, key));
}

function jsonValue(raw: string) {
  if (!raw) return {};
  return JSON.parse(raw);
}

function messageForError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
  }
  if (error && typeof error === 'object' && 'userMessage' in error && typeof error.userMessage === 'string') {
    return error.userMessage;
  }
  if (error instanceof Error) return error.message;
  return 'Unable to complete that request.';
}

function refreshSuperAdminPages() {
  revalidatePath('/super-admin/orgs');
  revalidatePath('/super-admin/plans');
  revalidatePath('/super-admin/subscriptions');
  revalidatePath('/super-admin/payments');
  revalidatePath('/super-admin/device-resets');
}

export async function createOrgAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await createOrganisationAsSuperAdmin({
      name: value(formData, 'name'),
      email: value(formData, 'email') || null,
    });
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function createPlanAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await createPlanAsSuperAdmin({
      name: value(formData, 'name'),
      code: value(formData, 'code'),
      monthlyPrice: numberValue(formData, 'monthlyPrice'),
      yearlyPrice: numberValue(formData, 'yearlyPrice'),
      seatLimit: numberValue(formData, 'seatLimit'),
      features: jsonValue(value(formData, 'features')),
      isActive: value(formData, 'isActive') !== 'false',
    });
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function updatePlanFeaturesAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await updatePlanFeaturesAsSuperAdmin(
      value(formData, 'planId'),
      jsonValue(value(formData, 'features')),
      value(formData, 'isActive') === 'true'
    );
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function assignPlanAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await assignPlanAsSuperAdmin({
      orgId: value(formData, 'orgId'),
      planId: value(formData, 'planId'),
      seatLimit: numberValue(formData, 'seatLimit'),
      billingCycle: value(formData, 'billingCycle') as BillingCycle,
      status: (value(formData, 'status') || 'active') as SubscriptionStatus,
    });
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function setSeatLimitAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await setSubscriptionSeatLimitAsSuperAdmin(value(formData, 'subscriptionId'), numberValue(formData, 'seatLimit'));
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function changeSubscriptionStatusAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await changeSubscriptionStatusAsSuperAdmin(value(formData, 'subscriptionId'), value(formData, 'status') as SubscriptionStatus);
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function recordManualPaymentAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    const activateStr = value(formData, 'activateSubscription');
    await recordManualPaymentAsSuperAdmin({
      orgId: value(formData, 'orgId') || undefined,
      subscriptionId: value(formData, 'subscriptionId'),
      amount: numberValue(formData, 'amount'),
      currency: value(formData, 'currency') || 'INR',
      paymentStatus: (value(formData, 'paymentStatus') || 'paid') as PaymentStatus,
      paymentMethod: (value(formData, 'paymentMethod') || 'manual') as PaymentMethod,
      invoiceNumber: value(formData, 'invoiceNumber') || null,
      paidAt: value(formData, 'paidAt') ? new Date(value(formData, 'paidAt')).toISOString() : null,
      activateSubscription: activateStr === 'on' || activateStr === 'true',
    });
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function extendSubscriptionPeriodAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await extendSubscriptionPeriodAsSuperAdmin(
      value(formData, 'subscriptionId'),
      numberValue(formData, 'days'),
      { reason: 'Manual extension by super admin' }
    );
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await cancelSubscriptionAsSuperAdmin(value(formData, 'subscriptionId'));
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function markPastDueAction(formData: FormData): Promise<void> {
  try {
    await requireSuperAdminSession();
    await changeSubscriptionStatusAsSuperAdmin(value(formData, 'subscriptionId'), 'past_due');
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function approveDeviceResetAsSuperAdminAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSuperAdminSession();
    await approveOrgDeviceResetAsAdmin(value(formData, 'orgId'), session.user.id, value(formData, 'requestId'));
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}

export async function rejectDeviceResetAsSuperAdminAction(formData: FormData): Promise<void> {
  try {
    const session = await requireSuperAdminSession();
    await rejectOrgDeviceResetAsAdmin(value(formData, 'orgId'), session.user.id, value(formData, 'requestId'));
    refreshSuperAdminPages();
    return;
  } catch (error) {
    throw new Error(messageForError(error));
  }
}
