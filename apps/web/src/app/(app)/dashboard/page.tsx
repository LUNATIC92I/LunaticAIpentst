'use client';

import { useEffect, useState } from 'react';
import {
  Crosshair,
  Activity,
  Bug,
  ShieldCheck,
  Clock,
  TerminalSquare,
  Cpu,
  Server,
} from 'lucide-react';
import { platform, type DashboardStats } from '@/lib/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { FindingsBar, ActivityArea } from '@/components/dashboard/Charts';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function buildActivitySeries(activity: { createdAt: string }[]) {
  const days: { label: string; value: number }[] = [];
  const counts = new Map<string, number>();
  for (const a of activity) {
    const d = new Date(a.createdAt).toISOString().slice(0, 10);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), value: counts.get(key) ?? 0 });
  }
  return days;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-success',
  RUNNING: 'text-electric',
  FAILED: 'text-danger',
  PAUSED: 'text-warn',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platform
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e?.message ?? 'Failed to load dashboard'));
  }, []);

  if (error) {
    return <div className="card p-6 text-sm text-danger">{error}</div>;
  }
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse bg-surface/50" />
        ))}
      </div>
    );
  }

  const findingsData = [
    { label: 'Discovered', value: stats.vulnerabilities.discovered, color: '#38bdf8' },
    { label: 'Confirmed', value: stats.vulnerabilities.confirmed, color: '#ef4444' },
    { label: 'Pending', value: stats.vulnerabilities.pending, color: '#fbbf24' },
    { label: 'False pos.', value: stats.vulnerabilities.falsePositive, color: '#5c6b7e' },
  ];
  const activitySeries = buildActivitySeries(stats.recentActivity);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">Operational overview for your organization.</p>
      </div>

      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Missions" value={stats.missions.total} icon={Crosshair} hint={`${stats.missions.completed} completed`} />
        <StatCard label="Running" value={stats.missions.running} icon={Activity} accent="electric" />
        <StatCard label="Vulns discovered" value={stats.vulnerabilities.discovered} icon={Bug} accent="warn" />
        <StatCard label="Vulns confirmed" value={stats.vulnerabilities.confirmed} icon={ShieldCheck} accent="danger" />
        <StatCard label="Pending validation" value={stats.vulnerabilities.pending} icon={Clock} accent="warn" />
        <StatCard label="Commands executed" value={stats.commandsExecuted} icon={TerminalSquare} />
        <StatCard label="AI tokens" value={stats.aiTokens.toLocaleString()} icon={Cpu} accent="electric" />
        <StatCard label="Sandboxes" value={stats.sandboxes.reduce((n, s) => n + s.count, 0)} icon={Server} accent="success" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Findings breakdown</h2>
          <FindingsBar data={findingsData} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Activity (7 days)</h2>
          <ActivityArea data={activitySeries} />
        </div>
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Recent missions</h2>
          {stats.recentMissions.length === 0 ? (
            <p className="text-sm text-text-dim">No missions yet. Create one from the workspace.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentMissions.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate text-text">{m.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-dim">{m.mode}</span>
                    <span className={`text-xs ${STATUS_COLOR[m.status] ?? 'text-text-muted'}`}>{m.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-text">Recent activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-text-dim">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {stats.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-mono text-xs text-text-muted">{a.action}</span>
                  <span className="text-xs text-text-dim">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
