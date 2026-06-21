import { NextResponse } from 'next/server';
import { jsonForManagementError, parseJson } from '@/lib/saas/managementApi';
import { changeOrgUserRoleAsAdmin, disableOrgUserAsAdmin, requireOrgManagementSession, type OrgMemberRole } from '@/lib/saas';

export async function PATCH(request: Request, context: { params: Promise<{ memberId: string }> }) {
  try {
    const [{ memberId }, session, body] = await Promise.all([
      context.params,
      requireOrgManagementSession(['owner', 'admin', 'manager']),
      parseJson(request),
    ]);
    const member = await changeOrgUserRoleAsAdmin(session.orgId, session.user.id, memberId, String(body.role ?? 'staff') as OrgMemberRole);
    return NextResponse.json({ member });
  } catch (error) {
    return jsonForManagementError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ memberId: string }> }) {
  try {
    const [{ memberId }, session] = await Promise.all([
      context.params,
      requireOrgManagementSession(['owner', 'admin', 'manager']),
    ]);
    const member = await disableOrgUserAsAdmin(session.orgId, session.user.id, memberId);
    return NextResponse.json({ member });
  } catch (error) {
    return jsonForManagementError(error);
  }
}
