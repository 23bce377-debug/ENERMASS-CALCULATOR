import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import {
  listSuperAdminPayments,
  recordManualPaymentAsSuperAdmin,
  requireSuperAdminSession,
} from '@/lib/saas/services/managementService';
import type { PaymentMethod, PaymentStatus } from '@/lib/saas/types';

export async function GET() {
  try {
    await requireSuperAdminSession();
    return NextResponse.json({ payments: await listSuperAdminPayments() });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdminSession();
    const body = await parseJson(request);
    const payment = await recordManualPaymentAsSuperAdmin({
      subscriptionId: String(body.subscription_id ?? body.subscriptionId ?? ''),
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? 'INR'),
      paymentStatus: String(body.payment_status ?? body.paymentStatus ?? 'paid') as PaymentStatus,
      paymentMethod: String(body.payment_method ?? body.paymentMethod ?? 'manual') as PaymentMethod,
      invoiceNumber: body.invoice_number ?? body.invoiceNumber ?? null,
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
