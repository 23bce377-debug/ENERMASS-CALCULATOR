'use server';

import { revalidateTag } from 'next/cache';
import { CACHE_TAG, orgCacheKey, invalidateMasterCache } from '@/lib/cache/masterCache';
import { invalidateServerCalculatorCache } from '@/lib/cache/server-cache';
import { invalidateCacheKeys, invalidateCachePrefixes } from '@/lib/cache/redisCache';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

/**
 * Invalidates both the Next.js cache and the server-side Redis cache keys.
 *
 * FIX SC-08: Cache invalidation is now org-scoped.
 * When Org A updates a panel, ONLY Org A's cache is invalidated.
 * Global equipment keys are only invalidated when explicitly requested
 * (e.g., when a super-admin updates a global row).
 *
 * @param orgId      - The org whose cache to invalidate (auto-resolved from session if omitted)
 * @param invalidateGlobal - Also purge global equipment cache (use sparingly — affects ALL orgs)
 */
export async function revalidateMasterCache(
  orgId?: string,
  invalidateGlobal = false
): Promise<void> {
  void orgId;

  // Always revalidate the Next.js tag (page-level caching)
  revalidateTag(CACHE_TAG, 'max');

  const session = await requireLicensedPage({
    feature: 'calculator',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });
  const targetOrgId = session.orgId;
  const canInvalidateGlobal = invalidateGlobal && session.permissions.canManageOrg;

  // FIX SC-08: Invalidate ONLY this org's scoped cache keys
  if (targetOrgId) {
    invalidateServerCalculatorCache(targetOrgId);
    await invalidateCacheKeys(
      orgCacheKey(targetOrgId, 'panels'),
      orgCacheKey(targetOrgId, 'inverters'),
      orgCacheKey(targetOrgId, 'batteries'),
      `rate_master:org:${targetOrgId}`,
      `category_margins:org:${targetOrgId}`
    );
    await invalidateCachePrefixes(
      `erp:bootstrap:${targetOrgId}:`,
      `erp:master:equipment:${targetOrgId}:`,
      `erp:master:rules:${targetOrgId}:`,
      `erp:master:org:${targetOrgId}:`,
      'erp:master:structures:global:'
    );
    await invalidateMasterCache(targetOrgId);
  }

  // Only invalidate global keys when explicitly requested (super-admin action)
  if (canInvalidateGlobal) {
    invalidateServerCalculatorCache(null);
    await invalidateCacheKeys(
      'eq:global:panels:active',
      'eq:global:inverters:active',
      'eq:global:batteries:active',
      'state_rules:all',
      'subsidy_schemes:active'
    );
    await invalidateCachePrefixes(
      'erp:bootstrap:',
      'erp:master:equipment:',
      'erp:master:rules:',
      'erp:master:structures:global:'
    );
    await invalidateMasterCache(null);
  }
}
