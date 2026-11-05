'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, FileJson, FileSpreadsheet, FileCode, Loader2 } from 'lucide-react';
import { reports, missions, type Mission, type ReportRecord } from '@/lib/api';

const FORMATS: { key: 'pdf' | 'html' | 'json' | 'csv'; label: string; icon: typeof FileText }[] = [
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'html', label: 'HTML', icon: FileCode },
  { key: 'json', label: 'JSON', icon: FileJson },
  { key: 'csv', label: 'CSV', icon: FileSpreadsheet },
];

export default function ReportsPage() {
  const [missionList, setMissionList] = useState<Mission[]>([]);
  const [missionId, setMissionId] = useState('');
  const [list, setList] = useState<ReportRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    missions.list().then(setMissionList).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (missionId) reports.list(missionId).then(setList).catch(() => setList([]));
    else setList([]);
  }, [missionId]);

  async function generate(format: 'pdf' | 'html' | 'json' | 'csv') {
    if (!missionId) return;
    setBusy(format);
    setError(null);
    try {
      await reports.generate(missionId, format);
      setList(await reports.list(missionId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <FileText size={20} className="text-accent" /> Reports
        </h1>
        <p className="text-sm text-text-muted">
          Professional assessment reports. Every conclusion is traceable to hash-chained evidence.
        </p>
      </div>

      <select className="input max-w-sm" value={missionId} onChange={(e) => setMissionId(e.target.value)}>
        <option value="">Select a mission...</option>
        {missionList.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {missionId && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Generate</h2>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map(({ key, label, icon: Icon }) => (
              <button key={key} className="btn-ghost" disabled={busy !== null} onClick={() => generate(key)}>
                {busy === key ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />} {label}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}

      {list.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Generated reports</h2>
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent">{r.format}</span>
                  <span className="text-text-muted">{r.title}</span>
                  <span className={`text-xs ${r.status === 'ready' ? 'text-success' : 'text-warn'}`}>{r.status}</span>
                </div>
                <button
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                  disabled={r.status !== 'ready'}
                  onClick={() => reports.download(r.id, `report-${r.id}.${r.format}`)}
                >
                  <Download size={14} /> Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
