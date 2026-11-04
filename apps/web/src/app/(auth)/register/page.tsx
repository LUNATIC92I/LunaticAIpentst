'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { ApiError } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', displayName: '', organizationName: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        organizationName: form.organizationName || undefined,
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 shadow-glow animate-fade-in">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size={34} />
          <p className="text-sm text-text-muted">Create your organization workspace</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Work email</label>
            <input className="input" type="email" required value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Password</label>
            <input className="input" type="password" required minLength={12} value={form.password} onChange={set('password')} />
            <p className="mt-1 text-xs text-text-dim">At least 12 characters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Name</label>
              <input className="input" value={form.displayName} onChange={set('displayName')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Organization</label>
              <input className="input" value={form.organizationName} onChange={set('organizationName')} />
            </div>
          </div>
          {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
