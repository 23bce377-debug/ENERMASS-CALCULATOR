import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { inviteOrgUserAsAdmin, listOrgUsers, requireOrgManagementSession, type OrgMemberRole } from '@/lib/saas';

export async function GET() {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    return NextResponse.json({ users: await listOrgUsers(session.orgId) });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireOrgManagementSession(['owner', 'admin', 'manager']);
    const body = await parseJson(request);
    const member = await inviteOrgUserAsAdmin(session.orgId, session.user.id, String(body.email ?? ''), String(body.role ?? 'staff') as OrgMemberRole);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
