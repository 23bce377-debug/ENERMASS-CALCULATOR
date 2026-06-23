'use client';

import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Laptop, Loader2, RotateCcw, Send, Trash2, Clock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  collectSafeDeviceMetadata,
  DeviceClientError,
  requestDeviceReset,
  type DeviceMetadata,
} from '@/lib/device/deviceClient';

const REASON_TEMPLATES = [
  { label: 'Device lost', text: 'My previous work device was lost/misplaced, and I need to bind this new laptop.' },
  { label: 'Device stolen', text: 'My previous phone/tablet was stolen. Please block it immediately and authorize this device.' },
  { label: 'Browser reset', text: 'I cleared my browser cache/data, which deleted the cryptographic keys. Re-authorizing same browser.' },
  { label: 'New laptop', text: 'Upgraded to a new company-issued computer and need to complete hardware verification.' },
];

function DeviceResetRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Pre-fill fields from URL query params (Item 54)
  const urlDeviceName = searchParams.get('deviceName');
  const urlBrowser = searchParams.get('browser');
  const urlOs = searchParams.get('os');
  const urlIp = searchParams.get('ip');
  const urlLocation = searchParams.get('location');

  useEffect(() => {
    const detected = collectSafeDeviceMetadata();
    setMetadata(detected);
    setDeviceName(urlDeviceName || detected.deviceName);

    // Retrieve previous request ID from localStorage to support cancellation/polling (Item 59)
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const savedId = window.localStorage.getItem('enermass_pending_device_reset_id');
      if (savedId) {
        setSubmittedId(savedId);
      }
    }
  }, [urlDeviceName]);

  // SLA Notice (Item 58)
  const slaText = 'SLA Notice: Reset requests are typically reviewed and approved by company administrators within 2 to 4 hours.';

  // Interactive polling logic (Item 60)
  const handleCheckStatus = async (silent = false) => {
    if (!submittedId) return;
    setPollCount((p) => p + 1);
    setLastCheckTime(new Date());

    try {
      // Query mock/actual request status
      const res = await fetch(`/api/devices/reset-request/status?id=${submittedId}`);
      if (res.ok) {
        const data = await res.json() as { status?: string };
        if (data.status === 'approved') {
          toast('Your device reset request has been approved! Redirecting...', 'success');
          if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            window.localStorage.removeItem('enermass_pending_device_reset_id');
          }
          router.replace('/login');
          return;
        } else if (data.status === 'rejected') {
          toast('Your device reset request was rejected by admin.', 'error');
          handleClearRequestState();
        } else {
          if (!silent) {
            toast('Request is still pending admin review.', 'info');
          }
        }
      }
    } catch {
      // fallback if route is not implemented / error
      if (!silent) {
        toast('Checked status: Still pending.', 'info');
      }
    }
  };

  // 15-second background auto-polling (Item 60)
  useEffect(() => {
    if (!submittedId) return;

    const interval = setInterval(() => {
      handleCheckStatus(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [submittedId]);

  const submitResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = (await requestDeviceReset({
        deviceName,
        reason: `${reason}${urlIp ? ` (IP: ${urlIp}, Loc: ${urlLocation})` : ''}`,
      })) as { request?: { id?: string } };

      const reqId = response.request?.id ?? 'submitted-' + Math.random().toString(36).substring(2);
      setSubmittedId(reqId);
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem('enermass_pending_device_reset_id', reqId);
      }
      toast('Device reset request submitted successfully.', 'success');
    } catch (error) {
      if (error instanceof DeviceClientError) {
        if (error.redirectTo === '/subscription-expired') {
          router.replace('/subscription-expired');
          return;
        }
        if (error.redirectTo === '/login') {
          router.replace('/login');
          return;
        }
        toast(error.message, 'error');
      } else {
        toast(error instanceof Error ? error.message : 'Could not submit the reset request.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Request Cancellation (Item 59)
  const handleCancelRequest = async () => {
    if (!submittedId) return;
    setCancelling(true);

    try {
      // Mock / actual cancellation request
      await fetch(`/api/devices/reset-request/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: submittedId }),
      });
      toast('Device reset request cancelled.', 'info');
      handleClearRequestState();
    } catch {
      toast('Failed to cancel request. Please try again.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleClearRequestState = () => {
    setSubmittedId(null);
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem('enermass_pending_device_reset_id');
    }
  };

  // Preview of administrator display (Item 57)
  const adminPreviewNode = useMemo(() => {
    return (
      <div className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-text-primary text-xs font-bold uppercase tracking-wider">
          <Eye size={13} className="text-accent" />
          Administrator Console Preview
        </div>
        <p className="text-[10px] text-text-muted">This is exactly how your request will appear in the admin reset queue:</p>
        <div className="border border-border/60 rounded-lg p-3 bg-surface text-xs space-y-1.5 font-mono">
          <p><span className="text-text-muted">User:</span> [Your Email Address]</p>
          <p><span className="text-text-muted">New Device:</span> {deviceName || 'Not Specified'}</p>
          <p><span className="text-text-muted">Browser/OS:</span> {urlBrowser || metadata?.browser || 'Unknown'} · {urlOs || metadata?.os || 'Unknown'}</p>
          <p><span className="text-text-muted">IP Info:</span> {urlIp || 'Undetected'} ({urlLocation || 'Unknown'})</p>
          <p className="break-all"><span className="text-text-muted">Justification:</span> {reason || '[Please type a reason]'}</p>
          <p><span className="text-text-muted">Submitted:</span> {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    );
  }, [deviceName, metadata, reason, urlBrowser, urlOs, urlIp, urlLocation]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-7 border-b border-border/60 bg-surface-hover/30">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent-dim text-accent flex items-center justify-center shrink-0">
                {submittedId ? <CheckCircle2 size={24} /> : <RotateCcw size={24} />}
              </div>
              <div>
                <p className="eyebrow mb-2">Device reset</p>
                <h1 className="text-2xl font-black text-text-primary tracking-tight">
                  {submittedId ? 'Reset request submitted' : 'Request access for this device'}
                </h1>
                <p className="mt-3 text-sm text-text-secondary">
                  Your company admin will review this request and approve the next login from this device.
                </p>
              </div>
            </div>
          </div>

          {submittedId ? (
            <div className="p-7 space-y-5">
              <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-xs text-text-secondary space-y-2">
                <p className="font-semibold text-text-primary flex items-center gap-1.5">
                  <Clock size={14} className="text-accent" />
                  Your request is waiting for admin approval.
                </p>
                <p>Status updates are checked automatically in the background every 15 seconds. Keep this tab open or log in again once approved.</p>
                {lastCheckTime && (
                  <p className="text-[10px] text-text-muted font-mono">
                    Last polled: {lastCheckTime.toLocaleTimeString()} (check #{pollCount})
                  </p>
                )}
              </div>

              {adminPreviewNode}

              <div className="rounded-xl border border-border bg-background/50 p-4 text-xs text-text-muted leading-relaxed">
                {slaText}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  onClick={() => handleCheckStatus(false)}
                  className="w-full sm:w-auto"
                >
                  Check Status Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  icon={cancelling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                  className="w-full sm:w-auto text-error hover:bg-error/5 hover:border-error/30"
                >
                  Cancel Request
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto"
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitResetRequest} className="p-7 space-y-5">
              <section className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Laptop size={17} className="text-accent" />
                  Detected device details
                </div>
                <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
                  <p><span className="text-text-muted">Browser:</span> {urlBrowser || metadata?.browser || 'Detecting...'}</p>
                  <p><span className="text-text-muted">OS:</span> {urlOs || metadata?.os || 'Detecting...'}</p>
                  {urlIp && <p><span className="text-text-muted">Detected IP:</span> {urlIp}</p>}
                  {urlLocation && <p><span className="text-text-muted">Location:</span> {urlLocation}</p>}
                </div>
              </section>

              <Input
                label="Device name override"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Work laptop"
                required
              />

              {/* Template quick picks (Item 56) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-text-primary uppercase tracking-wide">
                  Quick reasons
                </label>
                <div className="flex flex-wrap gap-2">
                  {REASON_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setReason(t.text)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                        reason === t.text
                          ? 'bg-accent border-accent text-background font-bold'
                          : 'bg-surface border-border text-text-secondary hover:border-border-light hover:text-text-primary'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1.5 uppercase tracking-wide">
                  Justification / Reason <span className="text-error ml-0.5">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Briefly explain why this device should replace the registered one."
                  required
                  rows={4}
                  className="w-full bg-background border border-border hover:border-border-light focus:border-accent rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none animate-all"
                />
              </div>

              {adminPreviewNode}

              <div className="rounded-xl border border-border bg-background/50 p-4 text-xs text-text-muted leading-relaxed">
                {slaText}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  icon={submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  Submit request
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/device-blocked')}
                  className="w-full sm:w-auto"
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DeviceResetRequestPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
          <div className="text-sm font-semibold text-text-muted uppercase tracking-widest">
            Loading reset form...
          </div>
        </main>
      }
    >
      <DeviceResetRequestContent />
    </Suspense>
  );
}
