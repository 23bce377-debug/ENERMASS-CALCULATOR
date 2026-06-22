import { NextResponse } from 'next/server';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { listAllActivationKeys } from '@/lib/saas';

/**
 * GET /api/super-admin/activation-keys/export
 * Super admin only. Returns all activation keys as a CSV file download.
 *
 * Query params:
 *   orgId (optional) - filter by organisation ID
 *   status (optional) - filter by key status: unused|activated|revoked|expired
 */
export async function GET(request: Request) {
  try {
    await requireSuperAdminPageSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const filterOrgId = url.searchParams.get('orgId');
    const filterStatus = url.searchParams.get('status');

    // Fetch all keys (paginated internally at 100/page, aggregate all pages)
    const allKeys: Awaited<ReturnType<typeof listAllActivationKeys>> = [];
    let page = 1;
    while (true) {
      const batch = await listAllActivationKeys(page, 100);
      allKeys.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    // Apply filters
    let keys = allKeys;
    if (filterOrgId) keys = keys.filter(k => k.org_id === filterOrgId);
    if (filterStatus) keys = keys.filter(k => k.status === filterStatus);

    // Build CSV
    const headers = [
      'Key Prefix',
      'Org ID',
      'Status',
      'Activated By Email',
      'Activated By Name',
      'Activated At',
      'Expires At',
      'Revoked At',
      'Batch ID',
      'Created At',
    ];

    function escapeCsv(value: string | null | undefined): string {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = keys.map(k => [
      escapeCsv(`${k.key_prefix}-****-****-****`),
      escapeCsv(k.org_id),
      escapeCsv(k.status),
      escapeCsv(k.activated_by_email),
      escapeCsv(k.activated_by_name),
      escapeCsv(k.activated_at),
      escapeCsv(k.expires_at),
      escapeCsv(k.revoked_at),
      escapeCsv(k.batch_id),
      escapeCsv(k.created_at),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `activation-keys-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ActivationKeys Export]', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
