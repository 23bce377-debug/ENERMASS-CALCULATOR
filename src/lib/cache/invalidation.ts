import { revalidateTag } from 'next/cache';

export async function invalidateMasterCache(orgId?: string | null) {
  revalidateTag('master-data', 'max');
  if (orgId) {
    revalidateTag(`org:${orgId}:master`, 'max');
  }
}

export async function invalidateTransactionalCache(orgId: string, entity: string) {
  revalidateTag('transactional', 'max');
  revalidateTag(`org:${orgId}:${entity}`, 'max');
}

