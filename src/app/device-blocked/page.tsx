'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Laptop, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  collectSafeDeviceMetadata,
  DEVICE_BLOCKED_MESSAGE,
  DEVICE_RESET_MESSAGE,
  type DeviceMetadata,
} from '@/lib/device/deviceClient';

function reasonCopy(reason: string | null) {
  if (reason === 'indexeddb_unavailable') {
    return 'Secure browser storage is unavailable. This can happen in private browsing mode or when site data is blocked.';
  }
  if (reason === 'web_crypto_unavailable') {
    return 'This browser cannot create the secure device key required for licensed access.';
  }
  if (reason === 'cookies_blocked') {
    return 'Cookies are blocked, so this browser cannot keep the secure device session.';
  }
  return DEVICE_BLOCKED_MESSAGE;
}

function DeviceBlockedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);

  useEffect(() => {
    setMetadata(collectSafeDeviceMetadata());
  }, []);

  const title = useMemo(() => reasonCopy(reason), [reason]);

  const regDeviceName = searchParams.get('deviceName') || searchParams.get('device_name');
  const regBrowser = searchParams.get('browser');
  const regOs = searchParams.get('os');

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="p-7 border-b border-border/60 bg-surface-hover/30">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="eyebrow mb-2">Device access blocked</p>
                <h1 className="text-2xl font-black text-text-primary tracking-tight">
                  {title}
                </h1>
                <p className="mt-3 text-sm text-text-secondary">
                  {DEVICE_RESET_MESSAGE}
                </p>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Laptop size={17} className="text-accent" />
                  This browser
                </div>
                <div className="mt-3 space-y-2 text-sm text-text-secondary">
                  <p><span className="text-text-muted">Device:</span> {metadata?.deviceName ?? 'Detecting...'}</p>
                  <p><span className="text-text-muted">Browser:</span> {metadata?.browser ?? 'Detecting...'}</p>
                  <p><span className="text-text-muted">OS:</span> {metadata?.os ?? 'Detecting...'}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <ShieldCheck size={17} className="text-accent" />
                  Registered device
                </div>
                {regDeviceName ? (
                  <div className="mt-3 space-y-2 text-sm text-text-secondary">
                    <p><span className="text-text-muted">Device:</span> {regDeviceName}</p>
                    <p><span className="text-text-muted">Browser:</span> {regBrowser ?? 'Unknown'}</p>
                    <p><span className="text-text-muted">OS:</span> {regOs ?? 'Unknown'}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">
                    Existing registered device details are available to your company admin.
                  </p>
                )}
              </section>
            </div>

            <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-text-secondary">
              Contact your company admin if this device should be approved, or submit a reset request from this browser.
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                icon={<RotateCcw size={16} />}
                onClick={() => router.push('/device-reset-request')}
                className="w-full sm:w-auto"
              >
                Request device reset
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
        </div>
      </div>
    </main>
  );
}

export default function DeviceBlockedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
          <div className="text-sm font-semibold text-text-muted uppercase tracking-widest">
            Loading device status...
          </div>
        </main>
      }
    >
      <DeviceBlockedContent />
    </Suspense>
  );
}
