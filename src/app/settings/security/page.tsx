import { requireOrgAdminPageSession } from '@/lib/saas/managementPageGuards';
import {
  EmptyState,
  PageShell,
  Section,
  StatusBadge,
  TableWrap,
  dangerButtonClass,
  tableClass,
  tdClass,
  thClass,
} from '@/components/saas/ManagementUi';
import { UserDeviceRepository } from '@/lib/saas/repositories';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import Link from 'next/link';
import { revokeSelfDeviceAction } from '../saasActions';
import { ChevronLeft, Key, Laptop, ShieldAlert } from 'lucide-react';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatJwkFingerprint(jwkStr: string | null | undefined): string {
  if (!jwkStr) return 'No cryptographic key registered';
  try {
    const jwk = JSON.parse(jwkStr);
    if (jwk.kty === 'EC') {
      return `Passkey (ES256 EC: ${jwk.x?.substring(0, 8)}... / ${jwk.y?.substring(0, 8)}...)`;
    }
    if (jwk.kty === 'RSA') {
      return `Passkey (RS256 RSA Modulus: ${jwk.n?.substring(0, 10)}...)`;
    }
    return 'Cryptographic key registered';
  } catch {
    return 'Invalid key format';
  }
}

export default async function SecuritySettingsPage() {
  const session = await requireOrgAdminPageSession(['owner', 'admin', 'manager', 'staff', 'viewer']);

  // Get current device token to identify the current device session
  const cookieStore = await cookies();
  const deviceToken = cookieStore.get('enermass_device_token')?.value;
  const currentDeviceHash = deviceToken
    ? crypto.createHash('sha256').update(deviceToken).digest('hex')
    : null;

  // Retrieve devices for the logged-in user
  const deviceRepo = new UserDeviceRepository(createAdminClient);
  const allOrgDevices = await deviceRepo.listByOrgId(session.orgId);
  const userDevices = allOrgDevices.filter((d) => d.user_id === session.user.id);

  const activeDevices = userDevices.filter((d) => d.status === 'active');
  const inactiveDevices = userDevices.filter((d) => d.status !== 'active');

  return (
    <PageShell
      title="Security & Sessions"
      description="Manage your active devices, cryptographic passkeys, and active sessions."
      nav={
        <Link
          href="/settings"
          className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
        >
          <ChevronLeft size={14} /> Back to Settings
        </Link>
      }
    >
      {/* Active Devices & Sessions */}
      <Section
        title="Active Devices & Sessions"
        aside={
          <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
            {activeDevices.length} Active
          </span>
        }
      >
        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          The following devices currently have access to your account. You can revoke any session at any time.
          Revoking a device will immediately sign it out and require super-admin approval to re-register.
        </p>

        {activeDevices.length === 0 ? (
          <EmptyState title="No active sessions found">
            You do not have any active registered devices.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Device / Agent</th>
                  <th className={thClass}>Cryptographic Passkey</th>
                  <th className={thClass}>Last Active</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {activeDevices.map((device) => {
                  const isCurrent = currentDeviceHash && device.device_secret_hash === currentDeviceHash;

                  return (
                    <tr key={device.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className={tdClass}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-surface border ${isCurrent ? 'border-accent/40 text-accent' : 'border-border text-text-muted'}`}>
                            <Laptop size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary text-sm flex items-center gap-2">
                              {device.device_name ?? 'Primary Device'}
                              {isCurrent && (
                                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 animate-pulse">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-text-muted">
                              {device.browser ?? 'Unknown Browser'} · {device.os ?? 'Unknown OS'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2 text-xs text-text-secondary font-medium">
                          <Key size={12} className="text-accent" />
                          <span className="font-mono text-[10px]">{formatJwkFingerprint(device.public_key)}</span>
                        </div>
                      </td>
                      <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                        {formatDate(device.last_seen_at)}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge status={device.status} />
                      </td>
                      <td className={tdClass}>
                        <form action={revokeSelfDeviceAction}>
                          <input type="hidden" name="deviceId" value={device.id} />
                          <button
                            className={dangerButtonClass}
                            type="submit"
                            title={isCurrent ? 'Revoke current device — this will immediately log you out' : 'Revoke this device'}
                          >
                            Revoke
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      {/* Revoked & Historical Sessions */}
      {inactiveDevices.length > 0 && (
        <Section title={`Inactive & Revoked Sessions (${inactiveDevices.length})`}>
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Device</th>
                  <th className={thClass}>First Seen</th>
                  <th className={thClass}>Revoked At</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {inactiveDevices.map((device) => (
                  <tr key={device.id} className="opacity-55 hover:bg-surface-hover/10 transition-colors">
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary text-sm">
                        {device.device_name ?? 'Previous Device'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {device.browser ?? 'Unknown Browser'} · {device.os ?? 'Unknown OS'}
                      </div>
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                      {formatDate(device.first_seen_at)}
                    </td>
                    <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                      {formatDate(device.revoked_at)}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={device.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      )}

      {/* Security Guidance */}
      <Section title="Security Warning & Best Practices" aside={<ShieldAlert size={16} className="text-warning" />}>
        <div className="text-sm text-text-secondary space-y-3 leading-relaxed">
          <p>
            ENERMASS utilizes mandatory device binding with cryptographic hardware keys (Passkeys / FIDO2).
            Each user account is allowed exactly <strong>one active registered device</strong> at a time.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-text-muted">
            <li>If you revoke your active device, you will be locked out and signed out on that device immediately.</li>
            <li>To log back in from a new or revoked device, you must submit a <strong>Device Reset Request</strong>.</li>
            <li>Device resets must be reviewed and approved by an Administrator or a Pitbull Corporations Super Admin.</li>
          </ul>
        </div>
      </Section>
    </PageShell>
  );
}
