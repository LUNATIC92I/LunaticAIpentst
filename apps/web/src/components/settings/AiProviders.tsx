'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Zap, CheckCircle2, XCircle, Cpu } from 'lucide-react';
import { ai, type AiProvider, type ProviderTestResult } from '@/lib/api';

const KINDS = ['ANTHROPIC', 'OPENAI', 'GEMINI', 'DEEPSEEK', 'OPENROUTER', 'CUSTOM', 'MOCK'];
const DEFAULT_MODELS: Record<string, string> = {
  ANTHROPIC: 'claude-sonnet-4-5',
  OPENAI: 'gpt-4o-mini',
  GEMINI: 'gemini-1.5-pro',
  DEEPSEEK: 'deepseek-chat',
  OPENROUTER: 'openai/gpt-4o-mini',
  CUSTOM: '',
  MOCK: 'mock-echo',
};

export function AiProviders() {
  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [tests, setTests] = useState<Record<string, ProviderTestResult | 'loading'>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setProviders(await ai.providers());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function test(id: string) {
    setTests((t) => ({ ...t, [id]: 'loading' }));
    try {
      const result = await ai.testProvider(id);
      setTests((t) => ({ ...t, [id]: result }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { ok: false, error: (e as Error).message } }));
    }
  }

  async function remove(id: string) {
    await ai.removeProvider(id);
    await load();
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text">
          <Cpu size={16} className="text-accent" /> AI providers
        </h2>
        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setShowAdd((s) => !s)}>
          <Plus size={14} /> Add provider
        </button>
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Keys are encrypted at rest (AES-256-GCM) and never returned to the browser. A provider must
        be configured for the assistant to respond in CHAT mode.
      </p>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {showAdd && <AddForm onClose={() => setShowAdd(false)} onAdded={load} />}

      {providers === null ? (
        <div className="h-16 animate-pulse rounded bg-surface/50" />
      ) : providers.length === 0 ? (
        <p className="text-sm text-text-dim">No providers configured yet.</p>
      ) : (
        <ul className="space-y-2">
          {providers.map((p) => {
            const t = tests[p.id];
            return (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{p.label}</span>
                    <span className="rounded bg-graphite/40 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{p.kind}</span>
                    {p.keyLastFour && <span className="font-mono text-xs text-text-dim">••••{p.keyLastFour}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    {p.models.map((m) => m.name).join(', ') || 'no model'}
                  </div>
                  {t && t !== 'loading' && (
                    <div className={`mt-1 flex items-center gap-1 text-xs ${t.ok ? 'text-success' : 'text-danger'}`}>
                      {t.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {t.ok ? `OK · ${t.model} · ${(t.usage?.inputTokens ?? 0) + (t.usage?.outputTokens ?? 0)} tok` : t.error}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => test(p.id)} disabled={t === 'loading'}>
                    <Zap size={13} /> {t === 'loading' ? 'Testing…' : 'Test'}
                  </button>
                  <button className="px-2 py-1.5 text-text-dim hover:text-danger" onClick={() => remove(p.id)} aria-label="Remove">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [kind, setKind] = useState('ANTHROPIC');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS.ANTHROPIC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onKind(k: string) {
    setKind(k);
    setModel(DEFAULT_MODELS[k] ?? '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ai.addProvider({
        kind,
        label: label || kind,
        apiKey: kind === 'MOCK' ? undefined : apiKey || undefined,
        baseUrl: baseUrl || undefined,
        defaultModel: model,
      });
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border bg-bg-elevated p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-text-muted">Provider</label>
          <select className="input" value={kind} onChange={(e) => onKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-muted">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-muted">Default model</label>
        <input className="input font-mono" value={model} onChange={(e) => setModel(e.target.value)} required />
      </div>
      {kind !== 'MOCK' && (
        <div>
          <label className="mb-1 block text-xs text-text-muted">API key</label>
          <input className="input font-mono" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="stored encrypted" />
        </div>
      )}
      {(kind === 'CUSTOM' || kind === 'OPENROUTER') && (
        <div>
          <label className="mb-1 block text-xs text-text-muted">Base URL</label>
          <input className="input font-mono" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" />
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary text-xs" disabled={busy}>{busy ? 'Adding…' : 'Add provider'}</button>
      </div>
    </form>
  );
}
