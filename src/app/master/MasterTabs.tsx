'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Sun,
  Cpu,
  Battery,
  Wrench,
  Package,
  Truck,
  Tag,
  Percent,
  LayoutDashboard
} from 'lucide-react';

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { href: '/master/panels', label: 'Panels', icon: <Sun size={15} /> },
  { href: '/master/inverters', label: 'Inverters', icon: <Cpu size={15} /> },
  { href: '/master/batteries', label: 'Batteries', icon: <Battery size={15} /> },
  { href: '/master/structures', label: 'Structures', icon: <Wrench size={15} /> },
  { href: '/master/accessories', label: 'Accessories', icon: <Package size={15} /> },
  { href: '/master/vendors', label: 'Vendors', icon: <Truck size={15} /> },
  { href: '/master/pricing', label: 'Pricing Master', icon: <Tag size={15} /> },
  { href: '/master/subsidy', label: 'Subsidy Master', icon: <Percent size={15} /> },
];

export function MasterTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-1">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-border">
        <Link
          href="/master"
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg
            ${pathname === '/master'
              ? 'text-accent bg-accent-glow border border-accent/20'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border border-transparent'
            }`}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </Link>

        <div className="h-6 w-px bg-border mx-1 hidden md:block" />

        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg whitespace-nowrap
                ${isActive
                  ? 'text-accent bg-accent-glow border border-accent/20 font-extrabold'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border border-transparent'
                }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
