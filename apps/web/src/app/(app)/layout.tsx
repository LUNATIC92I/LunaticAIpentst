'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { Logo } from '@/components/Logo';
import { AnimatedBackground } from '@/components/AnimatedBackground';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [me, loading, router]);

  if (loading || !me) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Logo size={36} />
          <p className="text-sm text-text-muted">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex min-h-screen">
      <AnimatedBackground variant="app" />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-5 md:p-7">{children}</main>
      </div>
    </div>
  );
}
