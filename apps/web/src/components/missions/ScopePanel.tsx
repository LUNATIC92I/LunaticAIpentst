'use client';

import { useState } from 'react';
import { Plus, Trash2, ShieldCheck, ShieldX, Search } from 'lucide-react';
import { missions, type Mission, type ScopeEntry, type ScopeDecision } from '@/lib/api';

export function ScopePanel({ mission, onChange }: { mission: Mission; onChange: () => void }) {
  const [entries, setEntries] = useState<ScopeEntry[]>(mission.scopeEntries ?? []);
  const [type, setType] = useState<'host' | 'ip' | 'cidr'>('host');
  const [value, setValue] = useState('');
  const [checkTarget, setCheckTarget] = useState('');
  const [decision, setDecision] = useState<ScopeDecision | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    const entry = await missions.addScope(mission.id, { type, value: value.trim() });
    setEntries((xs) => [...xs, entry]);
    setValue('');
    onChange();
  }

  async function remove(id: string) {
    await missions.removeScope(mission.id, id);
    setEntries((xs) => xs.filter((x) => x.id !== id));
    onChange();
  }

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!checkTarget.trim()) return;
    setBusy(true);
    setDecision(null);
    try {
      setDecision(await missions.scopeCheck(mission.id, checkTarget.trim(), true));
    } catch (err) {
      setDecision({ allowed: false, code: 'ERROR', reason: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-medium text-text">Authorized scope</h3>
        <p className="mb-3 text-xs text-text-muted">
          Only targets listed here may be acted on. The scope guard blocks everything else,
          including private/internal ranges (SSRF protection).
        </p>
        <form onSubmit={add} className="flex gap-2">
          <select className="input w-24" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="host">host</option>
            <option value="ip">ip</option>
            <option value="cidr">cidr</option>
          </select>
          <input className="input flex-1" placeholder={type === 'cidr' ? '203.0.113.0/24' : type === 'ip' ? '93.184.216.34' : 'example.com'} value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn-primary px-3" type="submit"><Plus size={16} /></button>
        </form>
      </div>

      {entries.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase text-text-dim">{e.type}</span>
                <span className="font-mono text-text">{e.value}</span>
              </span>
              <button onClick={() => remove(e.id)} className="text-text-dim hover:text-danger" aria-label="Remove">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
          <Search size={14} className="text-accent" /> Test a target against scope
        </h3>
        <form onSubmit={runCheck} className="flex gap-2">
          <input className="input flex-1 font-mono text-sm" placeholder="example.com or 10.0.0.5" value={checkTarget} onChange={(e) => setCheckTarget(e.target.value)} />
          <button className="btn-ghost" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check'}</button>
        </form>
        {decision && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${decision.allowed ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
            <div className="flex items-center gap-2">
              {decision.allowed ? <ShieldCheck className="text-success" size={16} /> : <ShieldX className="text-danger" size={16} />}
              <span className={decision.allowed ? 'text-success' : 'text-danger'}>{decision.code}</span>
            </div>
            <p className="mt-1 text-text-muted">{decision.reason}</p>
            {decision.resolvedIps && decision.resolvedIps.length > 0 && (
              <p className="mt-1 font-mono text-xs text-text-dim">resolved: {decision.resolvedIps.join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
