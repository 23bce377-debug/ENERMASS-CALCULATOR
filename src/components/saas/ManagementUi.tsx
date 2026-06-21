import Link from 'next/link';
import type { ReactNode } from 'react';

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatCurrency(value: number | null | undefined, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = status ?? 'missing';
  const tone =
    ['active', 'paid', 'approved'].includes(value) ? 'text-success bg-success/10 border-success/20' :
    ['trialing', 'pending', 'invited', 'past_due'].includes(value) ? 'text-warning bg-warning/10 border-warning/20' :
    ['disabled', 'revoked', 'expired', 'cancelled', 'failed', 'rejected'].includes(value) ? 'text-error bg-error/10 border-error/20' :
    'text-text-muted bg-surface-2 border-border';

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${tone}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export function PageShell({
  title,
  description,
  nav,
  children,
}: {
  title: string;
  description: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        {nav}
      </div>
      {children}
    </div>
  );
}

export function AdminTabs({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-border-light hover:text-text-primary"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold text-text-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-2 text-xl font-bold text-text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-text-muted">{detail}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
      <div className="text-sm font-semibold text-text-primary">{title}</div>
      {children && <div className="mt-1 text-xs text-text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

export const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-bold text-background transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary transition hover:border-border-light hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50';

export const dangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm font-semibold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50';

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border">{children}</div>;
}

export const tableClass = 'min-w-full divide-y divide-border text-sm';
export const thClass = 'bg-surface-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted';
export const tdClass = 'px-3 py-3 align-middle text-text-secondary';

export const orgAdminTabs = [
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/subscription', label: 'Subscription' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/device-reset-requests', label: 'Reset Requests' },
  { href: '/settings/activation-keys', label: 'Keys' },
  { href: '/settings/password-resets', label: 'Password Resets' },
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/audit-log', label: 'Audit Log' },
];

export const superAdminTabs = [
  { href: '/super-admin/orgs', label: 'Orgs' },
  { href: '/super-admin/plans', label: 'Plans' },
  { href: '/super-admin/subscriptions', label: 'Subscriptions' },
  { href: '/super-admin/payments', label: 'Payments' },
  { href: '/super-admin/activation-keys', label: 'Activation Keys' },
  { href: '/super-admin/device-resets', label: 'Device Resets' },
  { href: '/super-admin/audit-log', label: 'Audit Log' },
];
