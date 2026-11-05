'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Crosshair, MessageSquare, Bug, Target } from 'lucide-react';
import { missions, type Mission } from '@/lib/api';
import { StatusBadge } from '@/components/missions/StatusBadge';

export default function MissionsPage() {
  const [list, setList] = useState<Mission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      setList(await missions.list());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Missions</h1>
          <p className="text-sm text-text-muted">Authorized engagements for your organization.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New mission
        </button>
      </div>

      {error && <div className="card p-4 text-sm text-danger">{error}</div>}

      {list === null ? (
        <div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-20 animate-pulse bg-surface/50" />)}</div>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Crosshair className="text-text-dim" size={32} />
          <p className="text-text">No missions yet</p>
          <p className="max-w-sm text-sm text-text-muted">
            Create a mission to define an authorized target scope and start working with the
            assistant.
          </p>
          <button className="btn-primary mt-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New mission
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="card flex items-center justify-between p-4 transition hover:border-accent/30">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-text">{m.name}</span>
                  <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-dim">{m.mode}</span>
                </div>
                {m.description && <p className="mt-0.5 truncate text-sm text-text-muted">{m.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-5 text-xs text-text-dim">
                <span className="flex items-center gap-1" title="Scope entries"><Target size={13} />{m._count?.scopeEntries ?? 0}</span>
                <span className="flex items-center gap-1" title="Messages"><MessageSquare size={13} />{m._count?.messages ?? 0}</span>
                <span className="flex items-center gap-1" title="Findings"><Bug size={13} />{m._count?.findings ?? 0}</span>
                <StatusBadge status={m.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', mode: 'CHAT', permissionMode: 'APPROVAL' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await missions.create({
        name: form.name,
        description: form.description || undefined,
        mode: form.mode as Mission['mode'],
        permissionMode: form.permissionMode as Mission['permissionMode'],
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-text">New mission</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Description</label>
            <textarea className="input min-h-[72px] resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Mode</label>
              <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="CHAT">Chat</option>
                <option value="AGENT">Agent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Permission mode</label>
              <select className="input" value={form.permissionMode} onChange={(e) => setForm({ ...form, permissionMode: e.target.value })}>
                <option value="APPROVAL">Approval</option>
                <option value="SUPERVISED">Supervised</option>
                <option value="AUTONOMOUS">Autonomous</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !form.name}>
              {busy ? 'Creating...' : 'Create mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
