'use client';

import { useEffect, useState } from 'react';
import { Shield, Users, Activity, ScrollText, Ban, RotateCcw } from 'lucide-react';
import { admin, type AdminUser, type AdminStats, type AuditEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [u, r, s, a] = await Promise.all([admin.users(), admin.roles(), admin.stats(), admin.audit(40)]);
      setUsers(u);
      setRoles(r);
      setStats(s);
      setAudit(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (me && !me.permissions.includes('admin:users')) {
    return <div className="card p-6 text-sm text-text-muted">You do not have administrator access.</div>;
  }

  async function toggleSuspend(u: AdminUser) {
    try {
      await admin.suspend(u.id, !u.isSuspended);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changeRole(u: AdminUser, roleId: string) {
    try {
      await admin.setRole(u.id, roleId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <Shield size={20} className="text-accent" /> Administration
        </h1>
        <p className="text-sm text-text-muted">Members, roles, usage and the audit trail for your organization.</p>
      </div>
      {error && <div className="card p-3 text-sm text-danger">{error}</div>}

      {stats && (
        <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
          {[
            ['Members', stats.members], ['Missions', stats.missions], ['Running', stats.running],
            ['Findings', stats.findings], ['Confirmed', stats.confirmed], ['Sandboxes', stats.sandboxes],
            ['Tool runs', stats.toolRuns], ['Reports', stats.reports], ['AI providers', stats.providers],
          ].map(([label, n]) => (
            <div key={label as string}>
              <p className="text-[11px] uppercase tracking-wide text-text-dim">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text">{n as number}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-text"><Users size={15} className="text-accent" /> Members</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-dim">
              <th className="py-2">User</th><th>Role</th><th>MFA</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="py-2.5"><div className="text-text">{u.displayName ?? u.email}</div><div className="text-xs text-text-dim">{u.email}</div></td>
                <td>
                  <select className="input h-8 w-32 py-1 text-xs" value={u.role.id} onChange={(e) => changeRole(u, e.target.value)}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="text-xs text-text-muted">{u.mfaEnabled ? 'on' : 'off'}</td>
                <td>{u.isSuspended ? <span className="text-danger">Suspended</span> : <span className="text-success">Active</span>}</td>
                <td className="text-right">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleSuspend(u)}>
                    {u.isSuspended ? <><RotateCcw size={13} /> Reinstate</> : <><Ban size={13} /> Suspend</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-text"><ScrollText size={15} className="text-accent" /> Audit log</h2>
        <ul className="max-h-80 space-y-1 overflow-auto">
          {audit.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm">
              <span className="font-mono text-xs text-text-muted">{a.action}{a.target ? ` · ${a.target.slice(0, 10)}…` : ''}</span>
              <span className="text-xs text-text-dim">{new Date(a.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
