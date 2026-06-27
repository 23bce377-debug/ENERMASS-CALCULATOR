import {
  AdminTabs,
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  superAdminTabs,
  tableClass,
  tdClass,
  thClass,
  formatDateTime,
  dangerButtonClass,
} from '@/components/saas/ManagementUi';
import { listAllActivationKeys } from '@/lib/saas/services/activationKeyService';
import { requireSuperAdminPageSession } from '@/lib/saas/managementPageGuards';
import { GenerateKeysModal } from '@/components/saas/GenerateKeysModal';
import { resetKeyDevicesAction } from '../actions';
import { RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default async function SuperAdminActivationKeysPage() {
  await requireSuperAdminPageSession();

  const keys = await listAllActivationKeys();

  const unused = keys.filter(k => k.status === 'unused').length;
  const activated = keys.filter(k => k.status === 'activated').length;
  const revoked = keys.filter(k => k.status === 'revoked').length;

  return (
    <PageShell
      title="License Keys"
      description="Generate, monitor, and reset license keys for the pricing terminal."
      nav={<AdminTabs items={superAdminTabs} />}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
          {[
            { label: 'Total Keys', value: keys.length, color: 'text-text-primary' },
            { label: 'Unused', value: unused, color: 'text-amber-400' },
            { label: 'Activated', value: activated, color: 'text-green-400' },
            { label: 'Revoked', value: revoked, color: 'text-error' },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{stat.label}</div>
              <div className={`mt-2 text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Generate Card */}
        <div className="shrink-0 w-full md:w-auto bg-surface border border-border p-4 rounded-lg flex items-center justify-center min-h-[98px]">
          <GenerateKeysModal />
        </div>
      </div>

      {/* All Keys */}
      <Section
        title={`All License Keys (${keys.length} shown)`}
        aside={
          <Link
            href="/api/super-admin/activation-keys/export"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors"
            title="Download all license keys as CSV"
          >
            ↓ Export CSV
          </Link>
        }
      >
        {keys.length === 0 ? (
          <EmptyState title="No license keys generated yet">
            Use the &quot;Generate Keys&quot; button above to create license keys.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Key Prefix</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>User Limit</th>
                  <th className={thClass}>Activated Accounts</th>
                  <th className={thClass}>Activated By</th>
                  <th className={thClass}>Expires</th>
                  <th className={thClass}>Created</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {keys.map(key => (
                  <tr key={key.id}>
                    <td className={tdClass}>
                      <code className="font-mono text-xs text-accent bg-accent/10 px-2 py-1 rounded-md">
                        {key.key_prefix}-****-****-****
                      </code>
                    </td>
                    <td className={tdClass}><StatusBadge status={key.status} /></td>
                    <td className={tdClass}><span className="font-semibold text-sm">{key.max_uses ?? 5}</span></td>
                    <td className={tdClass}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        (key as any).active_devices_count >= (key.max_uses ?? 5)
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {(key as any).active_devices_count ?? 0}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {key.activated_by_name || key.activated_by_email ? (
                        <div>
                          <div className="text-sm text-text-primary">{key.activated_by_name ?? 'Activated user'}</div>
                          <div className="text-[11px] text-text-muted">{key.activated_by_email ?? key.activated_by}</div>
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className={tdClass}>{formatDateTime(key.expires_at)}</td>
                    <td className={tdClass}>{formatDateTime(key.created_at)}</td>
                    <td className={tdClass}>
                      {key.activated_by && (
                        <form action={resetKeyDevicesAction}>
                          <input type="hidden" name="keyId" value={key.id} />
                          <button
                            type="submit"
                            title="Reset all active device sessions for this key"
                            className={`${dangerButtonClass} py-1 px-2.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer`}
                          >
                            <RotateCcw size={12} />
                            Reset Logins
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </PageShell>
  );
}
