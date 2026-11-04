'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Octagon, Play, Pause, CheckCircle2, Crosshair } from 'lucide-react';
import { missions, type Mission, type MissionStatus } from '@/lib/api';
import { StatusBadge } from '@/components/missions/StatusBadge';
import { ScopePanel } from '@/components/missions/ScopePanel';
import { ChatPanel } from '@/components/missions/ChatPanel';

const NEXT_ACTIONS: { label: string; to: MissionStatus; icon: typeof Play }[] = [
  { label: 'Start scoping', to: 'SCOPING', icon: Crosshair },
  { label: 'Run', to: 'RUNNING', icon: Play },
  { label: 'Pause', to: 'PAUSED', icon: Pause },
  { label: 'Complete', to: 'COMPLETED', icon: CheckCircle2 },
];

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [tab, setTab] = useState<'chat' | 'scope'>('chat');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMission(await missions.get(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(to: MissionStatus) {
    try {
      setMission(await missions.transition(id, to));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleEmergency() {
    if (!mission) return;
    setMission(await missions.emergencyStop(id, !mission.emergencyStop));
  }

  if (error) return <div className="card p-4 text-sm text-danger">{error}</div>;
  if (!mission) return <div className="card h-40 animate-pulse bg-surface/50" />;

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/missions" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
        <ArrowLeft size={15} /> Missions
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-text">{mission.name}</h1>
              <StatusBadge status={mission.status} />
            </div>
            {mission.description && <p className="mt-1 text-sm text-text-muted">{mission.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-dim">
              <span className="rounded bg-bg-elevated px-2 py-1">Mode: {mission.mode}</span>
              <span className="rounded bg-bg-elevated px-2 py-1">Permission: {mission.permissionMode}</span>
              <span className="rounded bg-bg-elevated px-2 py-1">Profile: {mission.agentProfile}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NEXT_ACTIONS.map(({ label, to, icon: Icon }) => (
              <button key={to} onClick={() => transition(to)} className="btn-ghost px-2.5 py-1.5 text-xs" title={label}>
                <Icon size={14} /> {label}
              </button>
            ))}
            <button
              onClick={toggleEmergency}
              className={`btn px-2.5 py-1.5 text-xs ${mission.emergencyStop ? 'bg-danger text-white hover:opacity-90' : 'border border-danger/40 text-danger hover:bg-danger/10'}`}
              title="Emergency stop halts all active operations for this mission"
            >
              <Octagon size={14} /> {mission.emergencyStop ? 'Stop active' : 'Emergency stop'}
            </button>
          </div>
        </div>
        {mission.emergencyStop && (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            Emergency stop is active — every scope check is denied and no active operation can run.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['chat', 'scope'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize transition ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t === 'chat' ? 'Workspace' : 'Scope'}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {tab === 'chat' ? <ChatPanel missionId={mission.id} /> : <ScopePanel mission={mission} onChange={load} />}
      </div>
    </div>
  );
}
