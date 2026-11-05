'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { AnimatedBackground } from '@/components/AnimatedBackground';

export default function Landing() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(me ? '/dashboard' : '/login');
  }, [me, loading, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <AnimatedBackground />
      <div className="relative z-10 flex flex-col items-center gap-3 animate-fade-in">
        <Logo size={40} />
        <p className="text-sm text-text-muted">Loading workspace...</p>
      </div>
    </div>
  );
}
