'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Calculator,
  Cpu,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  LogOut,
  User,
  Zap,
  Building2,
  Shield,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

// --- Nav Config -------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  mobileVisible?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/calculator',  label: 'Calculator',  icon: <Calculator  size={18} />, mobileVisible: true  },
  { href: '/systems',     label: 'Systems',     icon: <Cpu         size={18} /> },
  { href: '/quotes',      label: 'Quotes',      icon: <FileText    size={18} />, mobileVisible: true  },
  { href: '/master',      label: 'Price Masters', icon: <Building2   size={18} />, mobileVisible: true  },

  { href: '/settings',    label: 'Settings',    icon: <Settings    size={18} />, mobileVisible: true  },
  { href: '/profile',     label: 'Profile',     icon: <User        size={18} /> },
];

// --- Avatar Helpers ---------------------------------------------------------

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = ['#C6973F', '#7C3AED', '#059669', '#E84040', '#0284C7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// --- User Avatar Chip -------------------------------------------------------

function UserAvatarChip({ collapsed }: { collapsed: boolean }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setEmail(session.user.email ?? '');
      try {
        const { ProfileORM } = await import('@/backend/orm/profile');
        const profile = await ProfileORM.getById(session.user.id);
        if (profile?.full_name) setDisplayName(profile.full_name);
        else setDisplayName(session.user.email?.split('@')[0] ?? '');
      } catch {
        setDisplayName(session.user.email?.split('@')[0] ?? '');
      }
    });
  }, []);

  const initials  = getInitials(displayName || email);
  const color     = getAvatarColor(displayName || email);
  const isActive  = pathname === '/profile';

  return (
    <Link
      href="/profile"
      title={collapsed ? 'Profile' : undefined}
      className={[
        'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full',
        'text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-accent-dim text-accent'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      ].join(' ')}
    >
      {isActive && <div className="sidebar-active-bar" />}

      {/* Avatar */}
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: color }}
      >
        {initials}
      </span>

      {!collapsed && (
        <span className="truncate text-[13px]">{displayName || email || 'Profile'}</span>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <div className={[
          'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
          'bg-surface-2 border border-border text-xs text-text-primary',
          'opacity-0 pointer-events-none group-hover:opacity-100',
          'transition-all duration-200 -translate-x-1 group-hover:translate-x-0',
          'whitespace-nowrap z-50 shadow-xl',
        ].join(' ')}>
          {displayName || 'Profile'}
        </div>
      )}
    </Link>
  );
}

// --- Desktop Sidebar --------------------------------------------------------

export function Sidebar({ collapsed, setCollapsed, isSuperAdmin }: { collapsed: boolean; setCollapsed: (v: boolean) => void; isSuperAdmin?: boolean }) {
  const pathname = usePathname();

  const displayNavItems = [...NAV_ITEMS];
  if (isSuperAdmin) {
    displayNavItems.push({
      href: '/super-admin/orgs',
      label: 'Master Control',
      icon: <Shield size={18} className="text-amber-500" />,
      mobileVisible: false,
    });
  }

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); }
    catch (err) { console.error('Error logging out:', err); }
  };

  return (
    <aside
      className={[
        'sidebar-desktop fixed left-0 top-0 z-40 h-screen flex flex-col',
        // Seamless: same as background, just a subtle right border
        'bg-background border-r border-border/60',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-[62px]' : 'w-[228px]',
      ].join(' ')}
    >
      {/* Logo */}
      <div className={[
        'flex items-center h-14 border-b border-border/60 shrink-0',
        collapsed ? 'px-3.5 justify-center' : 'px-4',
      ].join(' ')}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Icon mark */}
          <div className="relative shrink-0 w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shadow-md shadow-accent/15">
            <Zap size={15} strokeWidth={2.5} color="#111" fill="#111" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in leading-none">
              <div className="text-[13.5px] font-bold tracking-widest text-text-primary">
                ENER<span className="text-accent">MASS</span>
              </div>
              <div className="text-[9px] text-text-muted font-medium tracking-[0.12em] mt-0.5 uppercase">
                Solar ERP
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={['flex-1 py-3 overflow-y-auto', collapsed ? 'px-2' : 'px-2.5'].join(' ')}>
        <div className="space-y-0.5">
          {displayNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={[
                  'sidebar-nav-item',
                  isActive ? 'active' : '',
                  collapsed ? 'justify-center px-0' : '',
                ].join(' ')}
              >
                {isActive && <div className="sidebar-active-bar" />}

                {/* Icon */}
                <span className="shrink-0">
                  {item.icon}
                </span>

                {/* Label */}
                {!collapsed && (
                  <span className="truncate text-[13px]">{item.label}</span>
                )}

                {/* Collapsed tooltip */}
                {collapsed && (
                  <div className={[
                    'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
                    'bg-surface-2 border border-border text-[12px] text-text-primary',
                    'opacity-0 pointer-events-none group-hover:opacity-100',
                    'transition-all duration-200 -translate-x-1 group-hover:translate-x-0',
                    'whitespace-nowrap z-50 shadow-xl shadow-black/20',
                  ].join(' ')}>
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className={['py-3 border-t border-border/60 shrink-0 space-y-0.5', collapsed ? 'px-2' : 'px-2.5'].join(' ')}>
        {/* User chip */}
        <UserAvatarChip collapsed={collapsed} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log Out' : undefined}
          className={[
            'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full',
            'text-[13px] font-medium text-text-muted',
            'hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444]',
            'transition-all duration-200',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <span className="shrink-0"><LogOut size={16} /></span>
          {!collapsed && <span className="truncate">Log Out</span>}

          {collapsed && (
            <div className={[
              'absolute left-full ml-3 px-2.5 py-1.5 rounded-lg',
              'bg-surface-2 border border-border text-xs text-[#EF4444]',
              'opacity-0 pointer-events-none group-hover:opacity-100',
              'transition-all duration-200 -translate-x-1 group-hover:translate-x-0',
              'whitespace-nowrap z-50 shadow-xl',
            ].join(' ')}>
              Log Out
            </div>
          )}
        </button>

        {/* Footer brand */}
        {!collapsed && (
          <div className="px-2.5 pt-2 pb-0.5 animate-fade-in">
            <p className="text-[9.5px] font-medium text-text-muted tracking-[0.1em] uppercase">
              by <span className="text-accent font-semibold">Pitbull Corporations</span>
            </p>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={[
            'flex items-center w-full py-2 rounded-lg mt-1',
            'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
            'transition-all duration-200 text-[11px] font-semibold uppercase tracking-widest',
            collapsed ? 'justify-center' : 'px-2.5 gap-2',
          ].join(' ')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

// --- Mobile Tab Bar ---------------------------------------------------------

export function MobileTabBar() {
  const pathname = usePathname();
  const mobileItems = NAV_ITEMS.filter((item) => item.mobileVisible);

  return (
    <nav className={[
      'mobile-tab-bar fixed bottom-0 left-0 right-0 z-50',
      'h-16 flex items-center justify-around',
      'bg-surface/95 backdrop-blur-xl border-t border-border/70',
    ].join(' ')}>
      {mobileItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl',
              'transition-all duration-200 min-w-[52px]',
              isActive ? 'text-accent' : 'text-text-muted active:text-text-secondary',
            ].join(' ')}
          >
            {isActive && (
              <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent" />
            )}
            <span className={isActive ? 'text-accent' : ''}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// --- Header Bar -------------------------------------------------------------

interface HeaderProps {
  contextLabel?: string;
  contextValue?: string | null;
  quoteCount?: number;
}

export function Header({ contextLabel = 'System', contextValue, quoteCount = 0 }: HeaderProps) {
  return (
    <header className={[
      'sticky top-0 z-30 h-14 flex items-center justify-between',
      'px-4 md:px-6',
      'bg-background/85 backdrop-blur-xl border-b border-border/60',
    ].join(' ')}>
      {/* Left: context */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-1.5 text-text-muted">
          <span className="text-[11px] font-medium uppercase tracking-wider">{contextLabel}</span>
          <span className="text-border-light">·</span>
        </div>
        {contextValue ? (
          <span className="text-sm font-semibold text-text-primary truncate max-w-[180px] md:max-w-[360px]">
            {contextValue}
          </span>
        ) : (
          <span className="text-sm text-text-muted italic font-normal">No context selected</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <Link
          href="/quotes"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-dim border border-accent/20 cursor-pointer hover:bg-accent/12 active:scale-95 transition-all"
        >
          <FileText size={13} className="text-accent" />
          <span className="text-xs font-bold text-accent">{quoteCount}</span>
          <span className="hidden sm:inline text-xs text-text-muted font-medium">Quotes</span>
        </Link>
      </div>
    </header>
  );
}
