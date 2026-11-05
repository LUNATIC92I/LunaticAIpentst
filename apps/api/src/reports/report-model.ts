/**
 * Report model assembly (pure). Turns a mission + its findings + evidence into
 * a structured report model. Deterministic so it is unit-testable; the executive
 * summary and conclusion are derived from the real counts, not invented.
 */
export interface ReportEvidenceRef {
  kind: string;
  summary: string | null;
  hash: string;
}
export interface ReportFinding {
  title: string;
  description: string | null;
  severity: string;
  state: string;
  cwe: string | null;
  cve: string | null;
  owasp: string | null;
  cvssScore: number | null;
  cvssVector: string | null;
  remediation: string | null;
  evidence: ReportEvidenceRef[];
}
export interface ReportModel {
  title: string;
  generatedAt: string;
  mission: { id: string; name: string; description: string | null; status: string; mode: string; permissionMode: string };
  organization: { name: string };
  scope: { type: string; value: string }[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byState: Record<string, number>;
    confirmed: number;
    highOrCritical: number;
  };
  methodology: string[];
  executiveSummary: string;
  findings: ReportFinding[];
  evidenceIntegrity: { count: number; valid: boolean };
  conclusion: string;
}

export interface BuildReportInput {
  mission: { id: string; name: string; description: string | null; status: string; mode: string; permissionMode: string };
  organization: { name: string };
  scope: { type: string; value: string }[];
  findings: ReportFinding[];
  evidenceIntegrity: { count: number; valid: boolean };
  now?: Date;
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function buildReportModel(input: BuildReportInput): ReportModel {
  const now = input.now ?? new Date();
  const bySeverity: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const f of input.findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byState[f.state] = (byState[f.state] ?? 0) + 1;
  }
  const confirmed = byState['CONFIRMED'] ?? 0;
  const highOrCritical = (bySeverity['HIGH'] ?? 0) + (bySeverity['CRITICAL'] ?? 0);

  // Sort findings by severity (desc) then state.
  const findings = [...input.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const executiveSummary =
    input.findings.length === 0
      ? `This engagement against ${input.mission.name} produced no recorded findings within the authorized scope.`
      : `This engagement against ${input.mission.name} identified ${input.findings.length} finding(s): ` +
        `${highOrCritical} high/critical, ${confirmed} confirmed. All testing was limited to the authorized ` +
        `scope (${input.scope.length} entr${input.scope.length === 1 ? 'y' : 'ies'}). Each finding below is ` +
        `linked to timestamped, hash-chained evidence.`;

  const conclusion =
    highOrCritical > 0
      ? `${highOrCritical} high/critical issue(s) require prompt remediation. Re-test after fixes are applied.`
      : confirmed > 0
        ? `No high/critical issues were confirmed; address the remaining findings per the remediation guidance.`
        : `No confirmed high-impact vulnerabilities were identified within the authorized scope during this engagement.`;

  return {
    title: `Security Assessment - ${input.mission.name}`,
    generatedAt: now.toISOString(),
    mission: input.mission,
    organization: input.organization,
    scope: input.scope,
    summary: { total: input.findings.length, bySeverity, byState, confirmed, highOrCritical },
    methodology: [
      'Authorization and scope verification (every target validated by the scope guard).',
      'Reconnaissance (DNS, service and technology identification).',
      'Automated analysis with scope-limited tooling executed in isolated sandboxes.',
      'Triage and classification (potential -> detected -> reproduced -> confirmed).',
      'Evidence collection with a tamper-evident hash chain.',
    ],
    executiveSummary,
    findings,
    evidenceIntegrity: input.evidenceIntegrity,
    conclusion,
  };
}
