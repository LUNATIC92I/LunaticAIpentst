'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function Topbar() {
  const { me, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  const initials = (me?.user.displayName ?? me?.user.email ?? '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-bg-elevated/60 px-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Building2 size={16} className="text-text-dim" />
        <span>{me?.org?.name ?? 'Workspace'}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-electric text-xs font-semibold text-bg">
            {initials || 'U'}
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-sm text-text">{me?.user.displayName ?? me?.user.email}</div>
            <div className="text-xs text-text-dim">{me?.user.email}</div>
          </div>
        </div>
        <button onClick={onLogout} className="btn-ghost px-2.5 py-2" title="Sign out" aria-label="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
