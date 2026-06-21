'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';

interface PasswordResetItem {
  id: string;
  user_email: string | null;
  user_name: string | null;
  status: string;
  requested_at: string;
  expires_at: string;
}

type ActionStatus = 'idle' | 'approved' | 'rejected' | 'error';

export function PasswordResetActions({ request }: { request: PasswordResetItem }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ActionStatus>(
    request.status !== 'pending_admin_approval'
      ? (request.status as ActionStatus)
      : 'idle'
  );
  const [errorMsg, setErrorMsg] = useState('');

  const approve = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/password-resets/${request.id}/approve`, { method: 'POST' });
        if (res.ok) {
          setStatus('approved');
        } else {
          const d = await res.json() as { error?: string };
          setErrorMsg(d.error ?? 'Approval failed.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error.');
        setStatus('error');
      }
    });
  };

  const reject = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/password-resets/${request.id}/reject`, { method: 'POST' });
        if (res.ok) {
          setStatus('rejected');
        } else {
          const d = await res.json() as { error?: string };
          setErrorMsg(d.error ?? 'Rejection failed.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error.');
        setStatus('error');
      }
    });
  };

  // Render based on status — no early narrowing guard
  if (status === 'error') {
    return <span className="text-xs text-error">{errorMsg}</span>;
  }

  if (status === 'approved') {
    return <span className="text-xs font-bold uppercase text-green-400">approved — link sent</span>;
  }

  if (status === 'rejected') {
    return <span className="text-xs font-bold uppercase text-error">rejected</span>;
  }

  // status === 'idle'
  return (
    <div className="flex items-center gap-2">
      <button
        id={`approve-reset-${request.id}`}
        onClick={approve}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md bg-green-500/10 border border-green-500/30 px-2.5 py-1.5 text-xs font-semibold text-green-400 transition hover:bg-green-500/20 disabled:opacity-50"
      >
        <Check size={12} /> Approve &amp; Send Link
      </button>
      <button
        id={`reject-reset-${request.id}`}
        onClick={reject}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-error hover:border-error/30 disabled:opacity-50"
      >
        <X size={12} /> Reject
      </button>
    </div>
  );
}
