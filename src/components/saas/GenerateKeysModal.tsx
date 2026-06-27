'use client';

import { useState, useTransition } from 'react';
import { Copy, Check, AlertTriangle, Key, X } from 'lucide-react';

interface GeneratedKey {
  id: string;
  key: string;
  prefix: string;
}

interface KeyGenerationResult {
  success: boolean;
  keys?: GeneratedKey[];
  batchId?: string;
  orgId?: string;
  warning?: string;
  error?: string;
}

interface GenerateKeysProps {
  orgId?: string;
  orgName?: string;
}

export function GenerateKeysModal({ orgId, orgName }: GenerateKeysProps = {}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(5);
  const [expiresAt, setExpiresAt] = useState('');
  const [result, setResult] = useState<KeyGenerationResult | null>(null);
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());
  const [allCopied, setAllCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
          setResult({ success: false, error: 'Please choose a valid expiry date.' });
          return;
        }

        const isoExpiry = expiresAt ? new Date(expiresAt).toISOString() : undefined;

        const res = await fetch('/api/super-admin/activation-keys/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orgId,
            count,
            maxUses,
            expiresAt: isoExpiry,
          }),
        });
        const data = await res.json() as KeyGenerationResult;
        setResult(res.ok ? data : { success: false, error: data.error ?? 'Generation failed.' });
      } catch (err) {
        setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
  };

  const copyKey = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKeys(prev => new Set(prev).add(id));
    setTimeout(() => setCopiedKeys(prev => { const n = new Set(prev); n.delete(id); return n; }), 2000);
  };

  const copyAll = async (keys: GeneratedKey[]) => {
    const text = keys.map(k => k.key).join('\n');
    await navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setCount(1);
    setMaxUses(5);
    setExpiresAt('');
    setCopiedKeys(new Set());
    setAllCopied(false);
  };

  return (
    <>
      <button
        id={orgId ? `generate-keys-${orgId}` : 'generate-keys'}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-bold text-background transition hover:bg-accent-hover cursor-pointer"
      >
        <Key size={13} /> Generate License Key
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/40">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Key size={16} className="text-accent" /> Generate License Keys
                </h2>
                {orgName && <p className="text-xs text-text-muted mt-0.5">{orgName}</p>}
              </div>
              <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!result ? (
                /* ── Generation Form ─────────────────────────────── */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      Raw keys are shown <strong>exactly once</strong> after generation. They cannot be recovered. Copy and distribute them securely.
                    </p>
                  </div>

                  {!orgId && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                        Number of Keys (1–100)
                      </label>
                      <input
                        id="key-count-input"
                        type="number"
                        value={count}
                        onChange={e => setCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                        min={1} max={100}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-text-primary
                          focus:outline-none focus:border-accent/50 transition-all"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      User Limit (Seats)
                    </label>
                    <input
                      id="key-maxuses-input"
                      type="number"
                      value={maxUses}
                      onChange={e => setMaxUses(Math.max(1, Math.min(9999, Number(e.target.value))))}
                      min={1} max={9999}
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-text-primary
                        focus:outline-none focus:border-accent/50 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      Key Expiry <span className="text-text-muted/50">(Optional)</span>
                    </label>
                    <input
                      id="key-expiry-input"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-text-primary
                        focus:outline-none focus:border-accent/50 transition-all"
                    />
                    <p className="text-[10px] text-text-muted">If blank, keys never expire until used or revoked.</p>
                  </div>

                  <button
                    id="generate-confirm-button"
                    onClick={handleGenerate}
                    disabled={isPending}
                    className="w-full gold-gradient py-3 px-4 rounded-xl text-background font-bold text-sm
                      transition-all active:scale-[0.98] shadow-lg shadow-accent/20 hover:brightness-110
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isPending ? 'Generating...' : orgId ? 'Generate License Key' : `Generate ${count} Key${count > 1 ? 's' : ''}`}
                  </button>
                </div>
              ) : result.success && result.keys ? (
                /* ── Keys Display (ONE TIME ONLY) ─────────────────── */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-2">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300 font-semibold">
                      {result.warning} Close this modal and these keys are gone forever.
                    </p>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.keys.map(k => (
                      <div key={k.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 border border-border/60 group">
                        <code className="flex-1 text-xs text-accent font-mono tracking-wider">{k.key}</code>
                        <button
                          onClick={() => copyKey(k.key, k.id)}
                          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
                          title="Copy key"
                        >
                          {copiedKeys.has(k.id) ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      id="copy-all-keys-button"
                      onClick={() => copyAll(result.keys!)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-2.5 px-4 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
                    >
                      {allCopied ? <><Check size={14} className="text-green-400" /> All Copied!</> : <><Copy size={14} /> Copy All Keys</>}
                    </button>
                    <button
                      id="close-keys-modal-button"
                      onClick={handleClose}
                      className="rounded-xl bg-error/10 border border-error/30 py-2.5 px-4 text-sm font-semibold text-error transition hover:bg-error/20"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Error ────────────────────────────────────────── */
                <div className="text-center space-y-4 py-4">
                  <p className="text-sm text-error">{result.error ?? 'Generation failed.'}</p>
                  <button onClick={() => setResult(null)} className="text-xs text-accent hover:underline">
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
