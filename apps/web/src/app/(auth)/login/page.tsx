'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, needsTotp ? totp : undefined);
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      if (/mfa/i.test(msg)) {
        setNeedsTotp(true);
        setError('Enter your authenticator code to continue.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 shadow-glow animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={34} />
          <p className="text-sm text-text-muted">Sign in to your workspace</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Password</label>
            <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {needsTotp && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Authenticator code</label>
              <input className="input font-mono tracking-widest" inputMode="numeric" maxLength={6} placeholder="000000" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}
          {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-text-muted">
          No account?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
