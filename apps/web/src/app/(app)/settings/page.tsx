'use client';

import { useAuth } from '@/lib/auth';
import { ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const { me } = useAuth();
  if (!me) return null;

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-text">Settings</h1>
        <p className="text-sm text-text-muted">Your account and organization.</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-medium text-text">Account</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" value={me.user.displayName ?? '—'} />
          <Field label="Email" value={me.user.email} />
          <Field label="Organization" value={me.org?.name ?? '—'} />
          <Field label="Last login" value={me.user.lastLoginAt ? new Date(me.user.lastLoginAt).toLocaleString() : '—'} />
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-medium text-text">Security</h2>
        <div className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-4 py-3">
          <div className="flex items-center gap-3">
            {me.user.mfaEnabled ? (
              <ShieldCheck className="text-success" size={20} />
            ) : (
              <ShieldAlert className="text-warn" size={20} />
            )}
            <div>
              <p className="text-sm text-text">Multi-factor authentication</p>
              <p className="text-xs text-text-muted">
                {me.user.mfaEnabled ? 'Enabled (TOTP).' : 'Not enabled. Enroll via /auth/mfa/begin.'}
              </p>
            </div>
          </div>
          <span className={`text-xs ${me.user.mfaEnabled ? 'text-success' : 'text-warn'}`}>
            {me.user.mfaEnabled ? 'Active' : 'Off'}
          </span>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-text">
          <KeyRound size={16} className="text-accent" /> Permissions
        </h2>
        {me.permissions.length === 0 ? (
          <p className="text-sm text-text-dim">No permissions assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {me.permissions.map((p) => (
              <span key={p} className="rounded-md border border-border bg-bg-elevated px-2 py-1 font-mono text-xs text-text-muted">
                {p}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-dim">{label}</dt>
      <dd className="mt-1 text-sm text-text">{value}</dd>
    </div>
  );
}
