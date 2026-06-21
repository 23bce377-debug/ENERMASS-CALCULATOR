'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Laptop, Loader2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  collectSafeDeviceMetadata,
  DeviceClientError,
  requestDeviceReset,
  type DeviceMetadata,
} from '@/lib/device/deviceClient';

export default function DeviceResetRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [metadata, setMetadata] = useState<DeviceMetadata | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    const detected = collectSafeDeviceMetadata();
    setMetadata(detected);
    setDeviceName(detected.deviceName);
  }, []);

  const submitResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await requestDeviceReset({ deviceName, reason }) as { request?: { id?: string } };
      setSubmittedId(response.request?.id ?? 'submitted');
      toast('Device reset request submitted.', 'success');
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
              <div className="rounded-xl border border-success/25 bg-success/10 p-4 text-sm text-text-secondary">
                Your request is waiting for admin approval. You can try signing in again after your admin approves it.
              </div>
              <Button type="button" onClick={() => router.push('/login')}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submitResetRequest} className="p-7 space-y-5">
              <section className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-center gap-2 text-text-primary font-bold text-sm">
                  <Laptop size={17} className="text-accent" />
                  Detected device
                </div>
                <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                  <p><span className="text-text-muted">Browser:</span> {metadata?.browser ?? 'Detecting...'}</p>
                  <p><span className="text-text-muted">OS:</span> {metadata?.os ?? 'Detecting...'}</p>
                </div>
              </section>

              <Input
                label="Device name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="Work laptop"
                required
              />

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1.5 uppercase tracking-wide">
                  Reason <span className="text-error ml-0.5">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Briefly explain why this device should replace the registered one."
                  required
                  rows={4}
                  className="w-full bg-background border border-border hover:border-border-light focus:border-accent rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                />
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-4 text-sm text-text-secondary">
                This does not grant access immediately. An owner, admin, or manager must approve the reset first.
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

