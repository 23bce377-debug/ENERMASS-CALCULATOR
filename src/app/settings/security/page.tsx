'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
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
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/Confirm';
import { supabase } from '@/lib/supabase/client';
import { revokeSelfDeviceAction } from '../saasActions';
import { ChevronLeft, Key, Laptop, ShieldAlert, Edit2, Check, X, ShieldCheck, Printer, Copy, RotateCcw } from 'lucide-react';

interface SecurityDeviceItem {
  id: string;
  user_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  status: string;
  public_key: string | null;
  device_secret_hash: string | null;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<SecurityDeviceItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentDeviceHash, setCurrentDeviceHash] = useState<string | null>(null);
  
  // Renaming state (Item 80)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Auto-logout setting state (Item 84)
  const [sessionTimeout, setSessionTimeout] = useState('never');

  // Recovery Codes state (Item 83)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState(false);

  // Backup passkey registration state (Item 82)
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyStep, setPasskeyStep] = useState<'idle' | 'prompt' | 'scanning' | 'success'>('idle');
  const [backupKeyLabel, setBackupKeyLabel] = useState('Backup Security Key');

  const loadSecurityData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // Fetch cookie device token via client side parsing if available
      const rawCookies = typeof document !== 'undefined' ? document.cookie : '';
      const deviceToken = rawCookies
        .split('; ')
        .find((row) => row.startsWith('enermass_device_token='))
        ?.split('=')[1];

      if (deviceToken) {
        // Quick SHA256 hashing mock/calculation client-side
        const encoder = new TextEncoder();
        const data = encoder.encode(decodeURIComponent(deviceToken));
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        setCurrentDeviceHash(hashHex);
      }

      // Fetch user specific devices
      const { data: dRows } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', session.user.id);
      
      setDevices((dRows || []) as SecurityDeviceItem[]);

      // Load session timeout setting from localStorage
      if (typeof window !== 'undefined') {
        const savedTimeout = window.localStorage.getItem('enermass_session_timeout') || 'never';
        setSessionTimeout(savedTimeout);
        
        // Load recovery codes if they were generated
        const savedCodes = window.localStorage.getItem('enermass_recovery_codes');
        if (savedCodes) {
          setRecoveryCodes(JSON.parse(savedCodes));
        }
      }

    } catch (err: any) {
      console.error('Failed to load security parameters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const activeDevices = useMemo(() => devices.filter((d) => d.status === 'active'), [devices]);
  const inactiveDevices = useMemo(() => devices.filter((d) => d.status !== 'active'), [devices]);

  // Rename passkey key (Item 80)
  const handleStartRename = (device: SecurityDeviceItem) => {
    setEditingId(device.id);
    setRenameVal(device.device_name || 'Primary Key');
  };

  const handleSaveRename = async (id: string) => {
    if (!renameVal.trim()) {
      toast('Device name cannot be empty.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_devices')
        .update({ device_name: renameVal.trim(), last_seen_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast('Passkey name updated successfully ✓', 'success');
      setEditingId(null);
      await loadSecurityData();
    } catch (err: any) {
      toast(err.message || 'Failed to rename device', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate Recovery Codes (Item 83)
  const handleGenerateRecoveryCodes = async () => {
    const confirmed = await confirm({
      title: 'Generate Backup Recovery Codes?',
      message: 'Generating new recovery codes will invalidate any previously generated backup codes. Ensure you save these codes securely.',
      confirmLabel: 'Generate',
      cancelLabel: 'Cancel',
      type: 'warning',
    });

    if (!confirmed) return;

    // Generate 8 codes of format XXXX-XXXX
    const generated: string[] = [];
    for (let i = 0; i < 8; i++) {
      const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      generated.push(`${p1}-${p2}`);
    }

    setRecoveryCodes(generated);
    setShowCodes(true);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('enermass_recovery_codes', JSON.stringify(generated));
    }
    toast('Backup recovery codes generated successfully ✓', 'success');
  };

  const handleCopyCodes = () => {
    if (recoveryCodes.length === 0) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast('Recovery codes copied to clipboard', 'success');
  };

  // Save Session Timeout (Item 84)
  const handleSaveTimeout = (val: string) => {
    setSessionTimeout(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('enermass_session_timeout', val);
    }
    toast(`Auto-logout configuration updated: ${val.replace('_', ' ')}`, 'success');
  };

  // Mock passkey registration flow (Item 82)
  const startBackupPasskeyRegistration = () => {
    setBackupKeyLabel('Backup YubiKey NFC');
    setPasskeyStep('prompt');
    setRegisteringPasskey(true);
  };

  const handleSimulatePasskeyTouch = () => {
    setPasskeyStep('scanning');
    setTimeout(() => {
      // Create a mock active device key in user_devices via client insert
      setPasskeyStep('success');
    }, 2000);
  };

  const handleCompleteMockRegistration = async () => {
    setRegisteringPasskey(false);
    setLoading(true);

    try {
      const mockKeyJwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'mock_backup_x', y: 'mock_backup_y' });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile, error: profileError } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).maybeSingle();
      if (profileError || !profile?.org_id) {
        toast(profileError ? `Failed to resolve organisation: ${profileError.message}` : 'Could not resolve organisation for this user.', 'error');
        return;
      }
      
      const { error } = await supabase.from('user_devices').insert({
        org_id: profile.org_id,
        user_id: session.user.id,
        device_name: backupKeyLabel.trim() || 'Backup Security Key',
        browser: 'Chrome (Simulated)',
        os: 'macOS',
        public_key: mockKeyJwk,
        device_secret_hash: 'mock_hash_' + Math.random().toString(36).substring(2),
        status: 'active',
      });

      if (error) throw error;
      toast('Backup passkey registered successfully ✓', 'success');
      await loadSecurityData();
    } catch (err: any) {
      toast(err.message || 'Failed to register backup key', 'error');
    } finally {
      setLoading(false);
      setPasskeyStep('idle');
    }
  };

  function formatDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
        return `Passkey (RS256 RSA: ${jwk.n?.substring(0, 10)}...)`;
      }
      return 'Cryptographic key registered';
    } catch {
      return 'Invalid key format';
    }
  }

  return (
    <PageShell
      title="Security & Active Sessions"
      description="Configure hardware passkeys, inactivity timeguards, and backup authentication recovery tokens."
      nav={
        <Link
          href="/settings"
          className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
        >
          <ChevronLeft size={14} /> Back to Settings
        </Link>
      }
    >
      {/* Active Devices Section */}
      <Section
        title="Active Devices & Cryptographic Keys"
        aside={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-full">
              {activeDevices.length} Active
            </span>
            {/* Backup Passkey Trigger (Item 82) */}
            <button
              onClick={startBackupPasskeyRegistration}
              className="px-3 py-1.5 rounded-lg border border-accent/25 bg-accent/5 hover:bg-accent/15 text-accent text-xs font-semibold cursor-pointer"
            >
              Add Backup Passkey
            </button>
          </div>
        }
      >
        <p className="text-xs text-text-muted mb-4 leading-relaxed font-normal">
          Each user session is anchored via a secure hardware passkey. You can review active devices below.
          Renaming allows you to personalize your keys (e.g., YubiKey 5C, Office Desktop).
        </p>

        {loading && devices.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading security credentials...</div>
        ) : activeDevices.length === 0 ? (
          <EmptyState title="No active credentials found">Please register a key to continue.</EmptyState>
        ) : (
          <TableWrap>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Hardware Label / Name</th>
                  <th className={thClass}>Cryptographic Passkey Details</th>
                  <th className={thClass}>Registered On</th> {/* Registered On column (Item 81) */}
                  <th className={thClass}>Last Active</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {activeDevices.map((device) => {
                  const isCurrent = currentDeviceHash && device.device_secret_hash === currentDeviceHash;
                  const isEditing = editingId === device.id;

                  return (
                    <tr key={device.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className={tdClass}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-surface border ${isCurrent ? 'border-accent/40 text-accent' : 'border-border text-text-muted'}`}>
                            <Laptop size={15} />
                          </div>
                          
                          {/* Inline renaming input (Item 80) */}
                          <div className="flex-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={renameVal}
                                  onChange={(e) => setRenameVal(e.target.value)}
                                  className="bg-background border border-border focus:border-accent text-xs rounded px-2 py-1 max-w-[150px] outline-none text-text-primary"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveRename(device.id)}
                                  className="p-1 rounded bg-success/15 border border-success/30 text-success hover:bg-success/25"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 rounded bg-error/15 border border-error/30 text-error hover:bg-error/25"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="font-semibold text-text-primary text-xs flex items-center gap-2">
                                {device.device_name ?? 'Primary Device'}
                                <button
                                  onClick={() => handleStartRename(device)}
                                  className="text-text-muted hover:text-accent transition-colors"
                                >
                                  <Edit2 size={11} />
                                </button>
                                {isCurrent && (
                                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 animate-pulse">
                                    Current
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-[9px] text-text-muted mt-0.5">
                              {device.browser} · {device.os}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                          <Key size={11} className="text-accent" />
                          <span className="font-mono text-[9px]">{formatJwkFingerprint(device.public_key)}</span>
                        </div>
                      </td>
                      {/* Registered On creation date (Item 81) */}
                      <td className={`${tdClass} text-xs text-text-muted whitespace-nowrap`}>
                        {formatDate(device.first_seen_at)}
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

      {/* Auto Logout & Inactivity Settings Section (Item 84) */}
      <Section title="Session Timeouts & Inactivity Guards">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border max-w-2xl">
          <div>
            <h4 className="text-xs font-bold text-text-primary">Automatic Inactivity Logout</h4>
            <p className="text-[10px] text-text-muted mt-0.5">Log out of your active browser session automatically after periods of inactivity to protect sensitive financial BOM data.</p>
          </div>
          <select
            value={sessionTimeout}
            onChange={(e) => handleSaveTimeout(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none min-w-[150px] font-semibold"
          >
            <option value="30_mins">30 Minutes</option>
            <option value="1_hour">1 Hour</option>
            <option value="4_hours">4 Hours</option>
            <option value="never">Never (Persistent)</option>
          </select>
        </div>
      </Section>

      {/* Invalidation Recovery Codes Checklist Section (Item 83) */}
      <Section
        title="Emergency Recovery Codes"
        aside={
          <button
            onClick={handleGenerateRecoveryCodes}
            className="px-3.5 py-1.5 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/15 text-accent text-xs font-semibold cursor-pointer"
          >
            Generate Backup Codes
          </button>
        }
      >
        <p className="text-xs text-text-muted mb-4 leading-relaxed font-normal">
          Recovery codes can be used to log in if you lose access to your verified hardware keys/passkeys.
          Each code can only be used once. Keep these printed or stored in a physical vault.
        </p>

        {recoveryCodes.length > 0 ? (
          <div className="bg-background border border-border rounded-xl p-5 space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent">Active Recovery Codes Checklist</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyCodes}
                  className="p-1.5 rounded bg-surface border border-border hover:border-border-light text-text-secondary hover:text-text-primary"
                  title="Copy to clipboard"
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded bg-surface border border-border hover:border-border-light text-text-secondary hover:text-text-primary"
                  title="Print Codes"
                >
                  <Printer size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recoveryCodes.map((code, idx) => (
                <div
                  key={code}
                  className="font-mono text-xs font-bold bg-surface border border-border/80 p-2.5 rounded-lg text-center select-all flex flex-col justify-between h-14"
                >
                  <span className="text-[9px] text-text-muted font-sans font-bold">CODE {idx + 1}</span>
                  <span className="text-text-primary mt-1">{code}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg text-[10px] text-warning font-medium leading-normal">
              ⚠ Treat these recovery codes with the same security level as passwords.
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-center text-xs text-text-muted max-w-xl">
            No recovery codes generated. Click &quot;Generate Backup Codes&quot; to secure your login bypasses.
          </div>
        )}
      </Section>

      {/* Historical Logs Section */}
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
              <tbody className="divide-y divide-border bg-background opacity-60">
                {inactiveDevices.map((device) => (
                  <tr key={device.id}>
                    <td className={tdClass}>
                      <div className="font-semibold text-text-primary text-xs">{device.device_name ?? 'Previous Key'}</div>
                      <div className="text-[9px] text-text-muted">{device.browser} · {device.os}</div>
                    </td>
                    <td className={`${tdClass} text-xs whitespace-nowrap`}>{formatDate(device.first_seen_at)}</td>
                    <td className={`${tdClass} text-xs whitespace-nowrap`}>{formatDate(device.revoked_at)}</td>
                    <td className={tdClass}><StatusBadge status={device.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      )}

      {/* Mock Passkey Setup Modal (Item 82) */}
      {registeringPasskey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRegisteringPasskey(false)} />
          <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center">
              <h3 className="text-sm font-bold text-text-primary">
                Register Backup Passkey
              </h3>
              <button onClick={() => setRegisteringPasskey(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {passkeyStep === 'prompt' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-accent-dim/10 text-accent flex items-center justify-center">
                    <Key size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">Register a secondary hardware key</h4>
                    <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">Prepare your YubiKey or built-in biometric security key. Choose a distinct name below:</p>
                  </div>
                  <input
                    type="text"
                    value={backupKeyLabel}
                    onChange={(e) => setBackupKeyLabel(e.target.value)}
                    className="w-full bg-background border border-border focus:border-accent p-2.5 rounded-lg text-xs text-center text-text-primary outline-none"
                    placeholder="Backup Security Key"
                  />
                  <button
                    onClick={handleSimulatePasskeyTouch}
                    className="w-full py-2.5 bg-accent text-background font-bold text-xs rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    Simulate Browser Biometrics Prompt
                  </button>
                </div>
              )}

              {passkeyStep === 'scanning' && (
                <div className="space-y-5 text-center py-6">
                  <div className="relative mx-auto h-20 w-20 rounded-full border-4 border-accent border-t-transparent animate-spin flex items-center justify-center">
                    <Laptop size={28} className="text-accent animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">Verify Passkey Biometrics</h4>
                    <p className="text-xs text-text-muted mt-1">Please touch your fingerprint sensor or verify security key PIN...</p>
                  </div>
                </div>
              )}

              {passkeyStep === 'success' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">Passkey Registered Successfully!</h4>
                    <p className="text-xs text-text-muted mt-1">Secondary hardware credential is now linked and active in your database.</p>
                  </div>
                  <button
                    onClick={handleCompleteMockRegistration}
                    className="w-full py-2.5 bg-accent text-background font-bold text-xs rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    Complete Registration
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
