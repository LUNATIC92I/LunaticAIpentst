'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { Logo } from '@/components/Logo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [me, loading, router]);

  if (loading || !me) {
    return (
      <div className="bg-grid flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={36} />
          <p className="text-sm text-text-muted">Authenticating…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="bg-grid flex-1 overflow-x-hidden p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}
