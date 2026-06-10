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
  Home,
  LayoutDashboard
} from 'lucide-react';

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { href: '/masters/panels', label: 'Panels', icon: <Sun size={15} /> },
  { href: '/masters/inverters', label: 'Inverters', icon: <Cpu size={15} /> },
  { href: '/masters/batteries', label: 'Batteries', icon: <Battery size={15} /> },
  { href: '/masters/structures', label: 'Structures', icon: <Wrench size={15} /> },
  { href: '/masters/accessories', label: 'Accessories', icon: <Package size={15} /> },
  { href: '/masters/vendors', label: 'Vendors', icon: <Truck size={15} /> },
  { href: '/masters/pricing', label: 'Pricing Master', icon: <Tag size={15} /> },
  { href: '/masters/subsidy', label: 'Subsidy Master', icon: <Percent size={15} /> },
];

export default function MastersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Masters Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-border">
          <Link
            href="/masters"
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg
              ${pathname === '/masters'
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

      {/* Page Content */}
      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
}
