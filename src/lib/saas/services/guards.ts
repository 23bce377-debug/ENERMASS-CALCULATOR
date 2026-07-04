import 'server-only';

import { OrgMemberRepository } from '../repositories';
import { MembershipMissingError, UnauthorizedRoleError } from '../errors';
import type { OrgMember, OrgMemberRole } from '../types';

export type AdminRole = OrgMemberRole;

const adminRoles = new Set<OrgMemberRole>(['owner', 'admin', 'manager', 'staff', 'viewer']);

export interface MembershipDeps {
  orgMemberRepository?: Pick<OrgMemberRepository, 'getByOrgAndUser'>;
}

export async function assertActiveMembership(
  orgId: string,
  userId: string,
  deps: MembershipDeps = {}
): Promise<OrgMember> {
  const orgMemberRepository = deps.orgMemberRepository ?? new OrgMemberRepository();
  const member = await orgMemberRepository.getByOrgAndUser(orgId, userId);

  if (!member || member.status !== 'active') {
    throw new MembershipMissingError({ orgId, userId, memberStatus: member?.status ?? null });
  }

  return member;
}

export async function assertOrgAdmin(
  orgId: string,
  userId: string,
  deps: MembershipDeps = {}
): Promise<OrgMember & { role: AdminRole }> {
  const member = await assertActiveMembership(orgId, userId, deps);

  if (!adminRoles.has(member.role as OrgMemberRole)) {
    throw new UnauthorizedRoleError({ orgId, userId, role: member.role });
  }

  return member as OrgMember & { role: AdminRole };
}

