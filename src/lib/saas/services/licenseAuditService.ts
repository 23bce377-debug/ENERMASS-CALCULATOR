import 'server-only';

import { LicenseEventRepository } from '../repositories';
import type { LicenseEventPayload } from '../types';

export interface LicenseAuditServiceDeps {
  licenseEventRepository?: Pick<LicenseEventRepository, 'create'>;
}

export async function logLicenseEvent(
  event: LicenseEventPayload,
  deps: LicenseAuditServiceDeps = {}
) {
  try {
    const licenseEventRepository = deps.licenseEventRepository ?? new LicenseEventRepository();
    return await licenseEventRepository.create(event);
  } catch (error) {
    console.error('[Audit Log Failure] Failed to insert license event:', event.eventType, error);
    throw error;
  }
}


export async function listLicenseEventsByOrg(orgId: string, limit = 100) {
  return new LicenseEventRepository().listByOrgId(orgId, limit);
}

export async function listAllLicenseEventsAsSuperAdmin(limit = 200) {
  return new LicenseEventRepository().listAll(limit);
}
