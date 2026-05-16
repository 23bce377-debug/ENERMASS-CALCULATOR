'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Calculator,
  Cpu,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bookmark,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

// ─── Nav Item Config ────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  mobileVisible?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/calculator', label: 'Calculator', icon: <Calculator size={20} />, mobileVisible: true },
  { href: '/systems', label: 'Systems', icon: <Cpu size={20} /> },
  { href: '/quotes', label: 'Quotes', icon: <FileText size={20} />, mobileVisible: true },
  { href: '/rate-master', label: 'Rate Master', icon: <BarChart3 size={20} /> },
  { href: '/presets', label: 'Presets', icon: <Bookmark size={20} />, mobileVisible: true },
  { href: '/settings', label: 'Settings', icon: <Settings size={20} />, mobileVisible: true },
];

// ─── Desktop Sidebar ────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`sidebar-desktop fixed left-0 top-0 z-40 h-screen flex flex-col
        bg-surface border-r border-border transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}
    >
      {/* Logo area */}
      <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Gold sun icon */}
          <div className="relative shrink-0 w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shadow-lg shadow-accent/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2"/>
              <path d="M12 20v2"/>
              <path d="m4.93 4.93 1.41 1.41"/>
              <path d="m17.66 17.66 1.41 1.41"/>
              <path d="M2 12h2"/>
              <path d="M20 12h2"/>
              <path d="m6.34 17.66-1.41 1.41"/>
              <path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <span className="text-sm font-bold tracking-wide text-text-primary">ENER</span>
              <span className="text-sm font-bold tracking-wide text-accent">MASS</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-accent-dim text-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
            >
              {/* Active gold left border */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent animate-slide-in" />
              )}
              
              <span className={`shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'}`}>
                {item.icon}
              </span>
              
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md
                  bg-surface-hover border border-border text-xs text-text-primary
                  opacity-0 pointer-events-none group-hover:opacity-100
                  transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle & Branding */}
      <div className="px-3 py-3 border-t border-border shrink-0 space-y-2">
        {!collapsed && (
          <div className="text-center px-2 pb-1 animate-fade-in">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Made by <span className="text-accent font-bold">Pitbull Corporations</span>
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg
            text-text-muted hover:text-text-secondary hover:bg-surface-hover
            transition-all duration-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="ml-2 text-xs font-semibold uppercase tracking-wider">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Tab Bar ─────────────────────────────────────────────────────────────

export function MobileTabBar() {
  const pathname = usePathname();
  const mobileItems = NAV_ITEMS.filter((item) => item.mobileVisible);

  return (
    <nav className="mobile-tab-bar fixed bottom-0 left-0 right-0 z-50
      h-16 flex items-center justify-around
      bg-surface/95 backdrop-blur-xl border-t border-border
      safe-area-inset-bottom">
      {mobileItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg
              transition-all duration-200
              ${isActive
                ? 'text-accent'
                : 'text-text-muted active:text-text-secondary'
              }`}
          >
            <span className={isActive ? 'text-accent' : ''}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// ─── Header Bar ─────────────────────────────────────────────────────────────────

interface HeaderProps {
  contextLabel?: string;
  contextValue?: string | null;
  quoteCount?: number;
}

export function Header({ contextLabel = 'System', contextValue, quoteCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between
      px-4 md:px-6 bg-surface/80 backdrop-blur-xl border-b border-border">
      {/* Left: System context */}
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          {/* Mobile hamburger placeholder — not needed because we use bottom tab */}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-wider">{contextLabel}</span>
            <span className="text-text-muted">·</span>
          </div>
          {contextValue ? (
            <span className="text-sm font-semibold text-text-primary truncate max-w-[200px] md:max-w-[400px]">
              {contextValue}
            </span>
          ) : (
            <span className="text-sm text-text-muted italic">No context selected</span>
          )}
        </div>
      </div>

      {/* Right: Quote counter + branding */}
      <div className="flex items-center gap-4">
        {/* Quote counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-glow border border-accent/20">
          <FileText size={14} className="text-accent" />
          <span className="text-xs font-semibold text-accent">{quoteCount}</span>
          <span className="hidden sm:inline text-xs text-text-muted">Quotes</span>
        </div>

        {/* Removed duplicate Logo badge from Header */}
      </div>
    </header>
  );
}
