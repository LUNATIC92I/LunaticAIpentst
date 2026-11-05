'use client';

import { useEffect, useState } from 'react';
import { Globe, ShieldX, ArrowRight, History, ExternalLink } from 'lucide-react';
import { browser, missions, type BrowserResult, type Mission, type BrowserHistoryItem } from '@/lib/api';

export default function BrowserPage() {
  const [missionList, setMissionList] = useState<Mission[]>([]);
  const [missionId, setMissionId] = useState('');
  const [url, setUrl] = useState('https://');
  const [result, setResult] = useState<BrowserResult | null>(null);
  const [history, setHistory] = useState<BrowserHistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    missions.list().then(setMissionList).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (missionId) browser.history(missionId).then(setHistory).catch(() => setHistory([]));
  }, [missionId]);

  async function visit(target?: string) {
    const u = target ?? url;
    if (!missionId || !u) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await browser.visit(missionId, u);
      setResult(r);
      browser.history(missionId).then(setHistory).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <Globe size={20} className="text-accent" /> Browser
        </h1>
        <p className="text-sm text-text-muted">
          Isolated recon browser. Every request is SSRF-filtered; the target must be in the mission
          scope.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-xs" value={missionId} onChange={(e) => setMissionId(e.target.value)}>
          <option value="">Select a mission...</option>
          {missionList.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void visit();
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1 font-mono text-sm"
          placeholder="https://target.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!missionId}
        />
        <button className="btn-primary" type="submit" disabled={busy || !missionId}>
          {busy ? 'Loading...' : <>Go <ArrowRight size={15} /></>}
        </button>
      </form>

      {error && <div className="card p-3 text-sm text-danger">{error}</div>}

      {result?.blocked && (
        <div className="card flex items-start gap-3 border-danger/30 bg-danger/10 p-4 text-sm">
          <ShieldX size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-danger">{result.decision?.code}</p>
            <p className="mt-1 text-text-muted">{result.decision?.reason}</p>
          </div>
        </div>
      )}

      {result && !result.blocked && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
              <span className="truncate font-mono text-text-muted">{result.finalUrl}</span>
              <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 ${(result.status ?? 0) < 400 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                {result.status} {result.statusText}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {result.screenshot && <img src={result.screenshot} alt="page screenshot" className="w-full" />}
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-medium text-text">Response headers</h3>
              <div className="max-h-48 overflow-auto rounded-lg border border-border bg-bg-elevated p-2 font-mono text-[11px] text-text-muted">
                {Object.entries(result.headers ?? {}).map(([k, v]) => (
                  <div key={k}><span className="text-accent">{k}</span>: {v}</div>
                ))}
              </div>
            </div>
            {result.redirectChain && result.redirectChain.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-medium text-text">Redirect chain</h3>
                <ol className="space-y-1 font-mono text-[11px] text-text-muted">
                  {result.redirectChain.map((u) => <li key={u}>&gt; {u}</li>)}
                </ol>
              </div>
            )}
            {result.blockedRequests && result.blockedRequests.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                  <ShieldX size={14} className="text-warn" /> Blocked sub-requests ({result.blockedRequests.length})
                </h3>
                <ul className="max-h-32 space-y-1 overflow-auto font-mono text-[11px] text-warn">
                  {result.blockedRequests.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <History size={15} className="text-text-muted" /> History
          </h3>
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                <button className="flex items-center gap-2 truncate text-left text-text-muted hover:text-accent" onClick={() => visit(h.command)}>
                  <ExternalLink size={13} /> <span className="truncate font-mono text-xs">{h.command}</span>
                </button>
                <span className="shrink-0 text-xs text-text-dim">{new Date(h.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
