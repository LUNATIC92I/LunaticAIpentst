'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Play,
  StepForward,
  Check,
  X,
  ShieldCheck,
  Globe,
  Wrench,
  Bug,
  Lock,
} from 'lucide-react';
import { agent, tools, findingsApi, type Execution, type PlanStep, type Finding, type Mission, type ToolCatalogItem } from '@/lib/api';

const ACTION_ICON = { scope_verify: ShieldCheck, dns_recon: Globe, tool: Wrench } as const;
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-warn',
  APPROVED: 'text-electric',
  REJECTED: 'text-text-dim',
  RUNNING: 'text-electric',
  SUCCEEDED: 'text-success',
  FAILED: 'text-danger',
  BLOCKED: 'text-warn',
};
const RISK_COLOR: Record<string, string> = { low: 'text-success', medium: 'text-warn', high: 'text-danger' };

export function AgentPanel({ mission }: { mission: Mission }) {
  const id = mission.id;
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [execs, setExecs] = useState<Execution[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [integrity, setIntegrity] = useState<{ count: number; valid: boolean } | null>(null);
  const [catalog, setCatalog] = useState<ToolCatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tools.catalog().then(setCatalog).catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    const [plan, e, f, v] = await Promise.all([
      agent.getPlan(id).catch(() => null),
      agent.executions(id).catch(() => []),
      agent.findings(id).catch(() => []),
      agent.verifyEvidence(id).catch(() => null),
    ]);
    setSteps(plan?.steps ?? []);
    setExecs(e);
    setFindings(f);
    setIntegrity(v);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function wrap(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const execByIndex = (i: number) => execs.find((e) => e.stepIndex === i);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost text-xs" disabled={busy} onClick={() => wrap(() => agent.plan(id))}>
          Generate plan
        </button>
        <button className="btn-ghost text-xs" disabled={busy || steps.length === 0} onClick={() => wrap(() => agent.advance(id))}>
          <StepForward size={14} /> Step
        </button>
        <button className="btn-primary text-xs" disabled={busy || steps.length === 0} onClick={() => wrap(() => agent.run(id))}>
          <Play size={14} /> Run
        </button>
        <span className="ml-auto text-xs text-text-dim">
          Mode: <span className="text-text-muted">{mission.permissionMode}</span> - Profile: <span className="text-text-muted">{mission.agentProfile}</span>
        </span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {catalog.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-elevated p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-text-dim">Tool adapters ({catalog.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.map((c) => (
              <span
                key={c.name}
                title={`${c.description} (${c.category}${c.active ? ', active' : ', passive'})`}
                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${c.active ? 'border-accent/30 text-accent' : 'border-border text-text-muted'}`}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {steps.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          No plan yet. Define a scope, then generate a plan to decompose the mission into
          scope-gated steps.
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((s) => {
            const e = execByIndex(s.index);
            const Icon = ACTION_ICON[s.action];
            return (
              <li key={s.index} className="rounded-lg border border-border bg-bg-elevated p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                      <Icon size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text">{s.title}</span>
                        <span className={`text-[10px] uppercase ${RISK_COLOR[s.risk]}`}>{s.risk}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">{s.rationale}</p>
                      {e?.scopeDecision && (
                        <p className="mt-1 font-mono text-[11px] text-text-dim">
                          scope: {e.scopeDecision.code}
                          {e.scopeDecision.resolvedIps?.length ? ` - ${e.scopeDecision.resolvedIps.join(', ')}` : ''}
                        </p>
                      )}
                      {e?.summary && e.status !== 'PENDING' && (
                        <p className="mt-0.5 text-[11px] text-text-dim">{e.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs ${STATUS_COLOR[e?.status ?? 'PENDING']}`}>{e?.status ?? '-'}</span>
                    {e?.status === 'PENDING' && (
                      <>
                        <button className="rounded border border-success/40 p-1 text-success hover:bg-success/10" onClick={() => wrap(() => agent.approve(id, e.id, true))} aria-label="Approve">
                          <Check size={14} />
                        </button>
                        <button className="rounded border border-danger/40 p-1 text-danger hover:bg-danger/10" onClick={() => wrap(() => agent.approve(id, e.id, false))} aria-label="Reject">
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Findings + evidence integrity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Bug size={15} className="text-warn" /> Findings
          </h3>
          {findings.length === 0 ? (
            <p className="text-xs text-text-dim">No findings yet.</p>
          ) : (
            <ul className="space-y-2">
              {findings.map((f) => (
                <li key={f.id} className="rounded-lg border border-border bg-bg-elevated p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text">{f.title}</span>
                    <span className="flex items-center gap-2 text-[11px]">
                      <span className="text-text-dim">{f.severity}</span>
                      <span className="rounded bg-graphite/40 px-1.5 py-0.5 text-text-muted">{f.state}</span>
                    </span>
                  </div>
                  {f.description && <p className="mt-0.5 text-xs text-text-muted">{f.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {f.cve && <span className="rounded bg-danger/15 px-1.5 py-0.5 font-mono text-danger">{f.cve}</span>}
                    {f.cwe && <span className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-warn">{f.cwe}</span>}
                    {f.owasp && <span className="rounded bg-electric/15 px-1.5 py-0.5 font-mono text-electric">{f.owasp}</span>}
                    <span className="text-text-dim">{f.evidence.length} evidence record(s)</span>
                  </div>
                  <TriageControls missionId={id} finding={f} onSaved={refresh} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Lock size={15} className="text-accent" /> Evidence integrity
          </h3>
          {integrity === null ? (
            <p className="text-xs text-text-dim">No evidence yet.</p>
          ) : (
            <div className={`rounded-lg border p-3 text-sm ${integrity.valid ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
              {integrity.valid ? 'OK Chain intact' : 'X Chain broken'} - {integrity.count} record(s)
              <p className="mt-1 text-xs text-text-muted">Hash-chained, tamper-evident per mission.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATES = ['POTENTIAL', 'DETECTED', 'REPRODUCED', 'CONFIRMED', 'FALSE_POSITIVE', 'INCONCLUSIVE'];

function TriageControls({ missionId, finding, onSaved }: { missionId: string; finding: Finding; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(finding.state);
  const [cvss, setCvss] = useState(finding.cvssVector ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = { state };
      if (cvss.trim()) payload.cvssVector = cvss.trim();
      await findingsApi.update(missionId, finding.id, payload);
      setOpen(false);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="mt-1.5 text-[11px] text-electric hover:underline" onClick={() => setOpen(true)}>
        Triage...
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-bg p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input h-8 w-40 py-1 text-xs" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="input h-8 flex-1 py-1 font-mono text-[11px]"
          placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N"
          value={cvss}
          onChange={(e) => setCvss(e.target.value)}
        />
        <button className="btn-primary px-2.5 py-1 text-xs" disabled={busy} onClick={save}>Save</button>
        <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}
      <p className="text-[11px] text-text-dim">CONFIRMED requires at least one evidence record.</p>
    </div>
  );
}
