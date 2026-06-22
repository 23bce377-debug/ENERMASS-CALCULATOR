import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { createOrganisationAsSuperAdmin, listSuperAdminOrgs, requireSuperAdminSession } from '@/lib/saas/services/managementService';

export async function GET() {
  try {
    await requireSuperAdminSession();
    return NextResponse.json({ orgs: await listSuperAdminOrgs() });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdminSession();
    const body = await parseJson(request);
    const org = await createOrganisationAsSuperAdmin({ name: String(body.name ?? ''), email: body.email ? String(body.email) : null });
    return NextResponse.json({ org }, { status: 201 });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
