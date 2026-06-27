'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Laptop, RotateCcw, ShieldCheck, Mail, Globe, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  collectSafeDeviceMetadata,
  DEVICE_BLOCKED_MESSAGE,
  DEVICE_RESET_MESSAGE,
  type DeviceMetadata,
} from '@/lib/device/deviceClient';

interface ClientGeoInfo {
  ip: string;
  city: string;
  country_name: string;
  org: string;
}

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

  if (reason === 'device_limit_reached') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="p-7 border-b border-border/60 bg-surface-hover/30 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-error/10 text-error flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h1 className="text-xl font-black text-text-primary tracking-tight">
                Concurrent Limit Reached
              </h1>
              <p className="mt-3 text-sm text-text-secondary">
                This license key is already in use on the maximum number of allowed devices. Please log out from another device or ask your administrator to reset active sessions.
              </p>
            </div>
            <div className="p-7 space-y-4">
              <Button
                type="button"
                variant="primary"
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);
  const [geo, setGeo] = useState<ClientGeoInfo | null>(null);
  const [userAgent, setUserAgent] = useState('');
  const [selectedRegDeviceId, setSelectedRegDeviceId] = useState<string>('');

  useEffect(() => {
    setMetadata(collectSafeDeviceMetadata());
    if (typeof window !== 'undefined') {
      setUserAgent(window.navigator.userAgent);
    }

    // Fetch client IP and location info silently
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ip) {
          setGeo({
            ip: data.ip,
            city: data.city || 'Unknown City',
            country_name: data.country_name || 'Unknown Country',
            org: data.org || 'Unknown ISP',
          });
        }
      })
      .catch(() => {
        // Silent fallback on network blocker
        setGeo({
          ip: 'Undetected',
          city: 'Unknown',
          country_name: 'Unknown',
          org: 'Unknown',
        });
      });
  }, []);

  const title = useMemo(() => reasonCopy(reason), [reason]);

  // Multiple devices from query param
  const rawDevices = searchParams.get('devices');
  const devicesList = useMemo(() => {
    if (!rawDevices) return [];
    try {
      return JSON.parse(decodeURIComponent(rawDevices)) as Array<{
        id: string;
        device_name: string;
        browser: string;
        os: string;
        last_seen_at?: string;
      }>;
    } catch {
      return [];
    }
  }, [rawDevices]);

  useEffect(() => {
    if (devicesList.length > 0 && !selectedRegDeviceId) {
      setSelectedRegDeviceId(devicesList[0].id);
    }
  }, [devicesList, selectedRegDeviceId]);

  const regDeviceName = searchParams.get('deviceName') || searchParams.get('device_name');
  const regBrowser = searchParams.get('browser');
  const regOs = searchParams.get('os');

  const selectedDeviceDetails = useMemo(() => {
    if (devicesList.length > 0 && selectedRegDeviceId) {
      return devicesList.find((d) => d.id === selectedRegDeviceId);
    }
    if (regDeviceName) {
      return {
        id: 'single',
        device_name: regDeviceName,
        browser: regBrowser || 'Unknown',
        os: regOs || 'Unknown',
      };
    }
    return null;
  }, [selectedRegDeviceId, devicesList, regDeviceName, regBrowser, regOs]);

  // Construct Pre-filled Mailto Admin template (Item 53)
  const mailtoLink = useMemo(() => {
    const adminEmail = 'admin@company.com';
    const subject = encodeURIComponent('ENERMASS: Device Binding Reset Request');
    const body = encodeURIComponent(
      `Hello Admin,\n\nMy device access has been blocked. Please reset my device binding.\n\n` +
      `Detected Client Metadata:\n` +
      `- Device Name: ${metadata?.deviceName ?? 'Unknown'}\n` +
      `- OS: ${metadata?.os ?? 'Unknown'}\n` +
      `- Browser: ${metadata?.browser ?? 'Unknown'}\n` +
      `- IP: ${geo?.ip ?? 'Detecting...'}\n` +
      `- Location: ${geo ? `${geo.city}, ${geo.country_name}` : 'Detecting...'}\n` +
      `- User Agent: ${userAgent}\n\n` +
      `Conflict Device Details:\n` +
      `- Device Name: ${selectedDeviceDetails?.device_name ?? 'Unknown'}\n` +
      `- Browser: ${selectedDeviceDetails?.browser ?? 'Unknown'}\n` +
      `- OS: ${selectedDeviceDetails?.os ?? 'Unknown'}\n\n` +
      `Thank you.`
    );
    return `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  }, [metadata, geo, userAgent, selectedDeviceDetails]);

  const handleResetRedirect = () => {
    // Pass detected info to reset page (Item 54)
    const params = new URLSearchParams();
    if (metadata) {
      params.set('deviceName', metadata.deviceName);
      params.set('browser', metadata.browser);
      params.set('os', metadata.os);
    }
    if (geo) {
      params.set('ip', geo.ip);
      params.set('location', `${geo.city}, ${geo.country_name}`);
    }
    router.push(`/device-reset-request?${params.toString()}`);
  };

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
              {/* This Client Fingerprint Info (Item 52) */}
              <section className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Laptop size={17} className="text-accent" />
                  This browser
                </div>
                <div className="space-y-2 text-xs text-text-secondary">
                  <p><span className="text-text-muted">Device:</span> {metadata?.deviceName ?? 'Detecting...'}</p>
                  <p><span className="text-text-muted">Browser:</span> {metadata?.browser ?? 'Detecting...'}</p>
                  <p><span className="text-text-muted">OS:</span> {metadata?.os ?? 'Detecting...'}</p>
                  <p className="flex items-center gap-1">
                    <Globe size={12} className="text-accent/60" />
                    <span className="text-text-muted">IP:</span> {geo?.ip ?? 'Detecting...'}
                  </p>
                  <p>
                    <span className="text-text-muted">Location:</span> {geo ? `${geo.city}, ${geo.country_name}` : 'Detecting...'}
                  </p>
                  <div className="pt-1.5 border-t border-border/40">
                    <p className="text-[10px] text-text-muted font-mono break-all leading-normal">
                      <span className="font-bold text-text-secondary">User Agent:</span> {userAgent || 'Loading...'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Registered Device Details / Multi-Device Select (Item 55) */}
              <section className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <ShieldCheck size={17} className="text-accent" />
                  Registered Devices
                </div>

                {devicesList.length > 1 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    <p className="text-[11px] text-text-muted">Choose blocking device to review:</p>
                    {devicesList.map((d) => (
                      <label
                        key={d.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedRegDeviceId === d.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border bg-surface/40 hover:bg-surface'
                        }`}
                      >
                        <input
                          type="radio"
                          name="registered_device"
                          checked={selectedRegDeviceId === d.id}
                          onChange={() => setSelectedRegDeviceId(d.id)}
                          className="mt-0.5 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-text-primary">{d.device_name}</span>
                          <span className="block text-[10px] text-text-muted">
                            {d.browser} · {d.os}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : selectedDeviceDetails ? (
                  <div className="space-y-2 text-xs text-text-secondary">
                    <p><span className="text-text-muted">Device:</span> {selectedDeviceDetails.device_name}</p>
                    <p><span className="text-text-muted">Browser:</span> {selectedDeviceDetails.browser}</p>
                    <p><span className="text-text-muted">OS:</span> {selectedDeviceDetails.os}</p>
                    <p className="text-[10px] text-text-muted italic">
                      This active registration blocks new logins.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    Existing registered device details are available to your company admin.
                  </p>
                )}
              </section>
            </div>

            {/* Admin mailto link (Item 53) */}
            <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-xs text-text-secondary flex flex-col gap-2">
              <p>Contact your company admin if this device should be approved, or submit a reset request from this browser.</p>
              <a
                href={mailtoLink}
                className="inline-flex items-center gap-1.5 text-accent font-semibold hover:underline text-xs"
              >
                <Mail size={13} /> Contact Admin via pre-filled email template
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                icon={<RotateCcw size={16} />}
                onClick={handleResetRedirect}
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
