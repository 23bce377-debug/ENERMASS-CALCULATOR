import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { listOrgUsers } from '@/lib/saas/services/managementService';

export const dynamic = 'force-dynamic';

export const GET = withLicensedApiRoute(async (_request, context) => {
  const members = await listOrgUsers(context.session.orgId);
  const executives = members
    .filter((member) => member.status === 'active')
    .map((member) => ({
      id: member.user_id,
      name: member.full_name || member.email || 'Unnamed user',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    executives,
    currentUserId: context.session.user.id,
  });
}, {
  feature: 'calculator',
  roles: ['owner', 'admin', 'manager', 'staff'],
});
