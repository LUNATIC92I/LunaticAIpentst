'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Crosshair,
  Terminal,
  Globe,
  FileText,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/Logo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/missions', label: 'Missions', icon: Crosshair, soon: true },
  { href: '/terminal', label: 'Terminal', icon: Terminal, soon: true },
  { href: '/browser', label: 'Browser', icon: Globe, soon: true },
  { href: '/reports', label: 'Reports', icon: FileText, soon: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-elevated/70 md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo size={26} />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          // "soon" items have no backend yet — render them non-navigable rather
          // than link to an empty page.
          if (soon) {
            return (
              <div
                key={href}
                className="group flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-dim"
                title="Available in an upcoming phase"
              >
                <Icon size={18} className="text-text-dim/70" />
                <span className="flex-1">{label}</span>
                <span className="rounded bg-graphite px-1.5 py-0.5 text-[10px] text-text-dim">soon</span>
              </div>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text'
              }`}
            >
              <Icon size={18} className={active ? 'text-accent' : 'text-text-dim group-hover:text-text'} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <ShieldCheck size={14} className="text-accent" />
          Authorized operations only
        </div>
      </div>
    </aside>
  );
}
